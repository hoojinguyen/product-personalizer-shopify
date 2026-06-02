import { useLoaderData, useFetcher } from "react-router";
import type { LoaderFunctionArgs, ActionFunctionArgs } from "react-router";
import { authenticate } from "../shopify.server";
import db from "../db.server";
import { useEffect, useState } from "react";
import { useAppBridge } from "@shopify/app-bridge-react";

// Sub-components & shared utilities
import { ProductCatalogTable } from "../components/personalizer/ProductCatalogTable";
import { WorkspaceEditor } from "../components/personalizer/WorkspaceEditor";
import { CatalogPickerModal } from "../components/personalizer/CatalogPickerModal";

// The GraphQL query to fetch products and their personalization metafields
const PRODUCTS_QUERY = `#graphql
  query getProducts {
    products(first: 100) {
      edges {
        node {
          id
          title
          handle
          vendor
          tags
          featuredImage {
            url
          }
          variants(first: 50) {
            edges {
              node {
                id
                title
                price
              }
            }
          }
          metafield(namespace: "app", key: "customization_config") {
            id
            value
          }
        }
      }
    }
  }
`;

// Loader: Fetch products and assets from Shopify & DB
export const loader = async ({ request }: LoaderFunctionArgs) => {
  const { admin, session } = await authenticate.admin(request);
  const shop = session.shop;

  // Programmatically verify and create metafield definitions to ensure the app is self-healing
  try {
    await admin.graphql(
      `#graphql
      mutation createProductMetafieldDef {
        metafieldDefinitionCreate(definition: {
          namespace: "app"
          key: "customization_config"
          type: "json"
          ownerType: PRODUCT
          name: "Product Customization Config"
          access: {
            storefront: PUBLIC_READ
          }
        }) {
          metafieldDefinition {
            id
          }
          userErrors {
            message
          }
        }
      }`
    );
  } catch (err) {
    console.log("Metafield definition already exists or failed to create, skipping...", err);
  }

  const response = await admin.graphql(PRODUCTS_QUERY);
  const responseJson = await response.json();
  const products = responseJson.data?.products?.edges?.map((e: any) => e.node) || [];

  const assets = await db.asset.findMany({
    where: { shop }
  });

  return { products, assets, shop };
};

// Action: Save customization configuration
export const action = async ({ request }: ActionFunctionArgs) => {
  const { admin } = await authenticate.admin(request);
  const formData = await request.formData();
  
  const productId = formData.get("productId") as string;
  const enabled = formData.get("enabled") === "true";
  const optionsJson = formData.get("options") as string;
  const upchargeVariantId = formData.get("upchargeVariantId") as string;

  let options = [];
  try {
    options = JSON.parse(optionsJson);
  } catch (e) {
    console.error("Error parsing options JSON in action", e);
  }

  const config = {
    enabled,
    options,
    upchargeVariantId: upchargeVariantId || ""
  };

  const response = await admin.graphql(
    `#graphql
    mutation setProductMetafield($metafields: [MetafieldsSetInput!]!) {
      metafieldsSet(metafields: $metafields) {
        metafields {
          id
          value
        }
        userErrors {
          field
          message
        }
      }
    }`,
    {
      variables: {
        metafields: [
          {
            ownerId: productId,
            namespace: "app",
            key: "customization_config",
            type: "json",
            value: JSON.stringify(config)
          }
        ]
      }
    }
  );

  const responseJson = await response.json();
  return { ok: true, errors: responseJson.data?.metafieldsSet?.userErrors || [] };
};

export default function ConfigureProductOptions() {
  const { products: initialProducts, assets, shop } = useLoaderData<typeof loader>();
  const fetcher = useFetcher<typeof action>();
  const shopify = useAppBridge();

  // Custom UI layout modes coordination
  const [viewMode, setViewMode] = useState<"list" | "editor">("list");
  const [isAddModalOpen, setIsAddModalOpen] = useState(false);
  const [selectedProduct, setSelectedProduct] = useState<any>(null);
  
  // Ajax toggle flags
  const [savingStatusToggleId, setSavingStatusToggleId] = useState<string | null>(null);

  // Handle toast notification upon successful action triggers
  useEffect(() => {
    if (fetcher.data?.ok) {
      shopify.toast.show("Customization details saved successfully!");
      setSavingStatusToggleId(null);
    }
  }, [fetcher.data, shopify]);

  // Status Switch AJAX Mutator
  const handleToggleStatus = (product: any, currentEnabled: boolean) => {
    setSavingStatusToggleId(product.id);
    const configVal = product.metafield?.value;
    let configOptions = [];
    let configUpcharge = "";
    if (configVal) {
      try {
        const parsed = JSON.parse(configVal);
        configOptions = parsed.options || [];
        configUpcharge = parsed.upchargeVariantId || "";
      } catch (e) {}
    }
    
    if (configOptions.length === 0) {
      configOptions = [
        {
          id: "opt-default-text",
          type: "text",
          label: "Engraving Text",
          required: true,
          priceUpcharge: 0.0,
          maxChars: 30,
          placeholder: "Enter text to engrave",
          canvasX: 400,
          canvasY: 400,
          canvasFontSize: 48,
          canvasWidth: 250,
          canvasHeight: 250,
          canvasRotation: 0
        }
      ];
    }

    fetcher.submit(
      {
        productId: product.id,
        enabled: String(!currentEnabled),
        options: JSON.stringify(configOptions),
        upchargeVariantId: configUpcharge
      },
      { method: "POST" }
    );
  };

  // Bulk deleting option mappings
  const handleBulkDelete = (bulkSelectedIds: string[]) => {
    if (confirm(`Are you sure you want to delete personalization settings for ${bulkSelectedIds.length} products?`)) {
      bulkSelectedIds.forEach(id => {
        fetcher.submit(
          {
            productId: id,
            enabled: "false",
            options: JSON.stringify([]),
            upchargeVariantId: ""
          },
          { method: "POST" }
        );
      });
      shopify.toast.show("Bulk deletion completed!");
    }
  };

  // Duplicate options template to another product
  const handleDuplicateOptions = (sourceProduct: any) => {
    const targetProductTitle = prompt("Enter target product title to duplicate these configurations to:");
    if (!targetProductTitle) return;
    
    const targetProduct = initialProducts.find((p: any) => p.title.toLowerCase().includes(targetProductTitle.toLowerCase()));
    if (!targetProduct) {
      alert("Target product not found in store.");
      return;
    }
    
    const sourceConfig = sourceProduct.metafield?.value ? JSON.parse(sourceProduct.metafield.value) : { enabled: true, options: [] };
    
    fetcher.submit(
      {
        productId: targetProduct.id,
        enabled: String(sourceConfig.enabled ?? true),
        options: JSON.stringify(sourceConfig.options || []),
        upchargeVariantId: sourceConfig.upchargeVariantId || ""
      },
      { method: "POST" }
    );
    shopify.toast.show(`Duplicated options from ${sourceProduct.title} to ${targetProduct.title}!`);
  };

  // Export customization config template as local JSON file
  const handleExportJson = (product: any) => {
    const configVal = product.metafield?.value;
    let config = { enabled: true, options: [], upchargeVariantId: "" };
    if (configVal) {
      try {
        config = JSON.parse(configVal);
      } catch (e) {}
    }
    
    const dataStr = "data:text/json;charset=utf-8," + encodeURIComponent(JSON.stringify(config, null, 2));
    const dlAnchorElem = document.createElement('a');
    dlAnchorElem.setAttribute("href", dataStr);
    dlAnchorElem.setAttribute("download", `zepto_config_${product.handle}.json`);
    dlAnchorElem.click();
    
    shopify.toast.show(`Exported options schema for ${product.title}!`);
  };

  // Delete options configurations
  const handleDeleteOptions = (product: any) => {
    if (confirm(`Are you sure you want to completely remove personalization options for ${product.title}?`)) {
      fetcher.submit(
        {
          productId: product.id,
          enabled: "false",
          options: JSON.stringify([]),
          upchargeVariantId: ""
        },
        { method: "POST" }
      );
      shopify.toast.show(`Deleted options for ${product.title}!`);
    }
  };

  const handleOpenEditorForProduct = (product: any) => {
    setSelectedProduct(product);
    setViewMode("editor");
  };

  const handleAddSelectedProduct = (productId: string) => {
    const match = initialProducts.find((p: any) => p.id === productId);
    if (match) {
      setSelectedProduct(match);
      setViewMode("editor");
      setIsAddModalOpen(false);
    }
  };

  const handleSaveConfiguration = (config: { enabled: boolean; options: any[]; upchargeVariantId: string }) => {
    if (!selectedProduct) return;
    fetcher.submit(
      {
        productId: selectedProduct.id,
        enabled: String(config.enabled),
        options: JSON.stringify(config.options),
        upchargeVariantId: config.upchargeVariantId
      },
      { method: "POST" }
    );
  };

  return (
    <div className="personalizer-dashboard">
      
      {/* Styles Injections for Table/Workspace Layout components */}
      <style>{`
        .personalizer-dashboard {
          font-family: -apple-system, BlinkMacSystemFont, "San Francisco", "Segoe UI", Roboto, "Helvetica Neue", sans-serif;
          color: #202223;
          background-color: #f6f6f7;
          min-height: 100vh;
          padding: 24px;
        }
        .page-header {
          display: flex;
          justify-content: space-between;
          align-items: center;
          margin-bottom: 24px;
        }
        .page-title {
          font-size: 20px;
          font-weight: 700;
          color: #202223;
          margin: 0;
        }
        .btn-primary {
          background-color: #008060;
          color: #ffffff;
          border: none;
          border-radius: 6px;
          padding: 8px 16px;
          font-weight: 600;
          cursor: pointer;
          font-size: 14px;
          display: inline-flex;
          align-items: center;
          gap: 6px;
          transition: background-color 0.15s ease, transform 0.1s ease;
          box-shadow: 0 1px 3px rgba(0,0,0,0.08);
        }
        .btn-primary:hover {
          background-color: #006e52;
        }
        .btn-primary:active {
          transform: scale(0.98);
        }
        .btn-secondary {
          background-color: #ffffff;
          color: #202223;
          border: 1px solid #babfc3;
          border-radius: 6px;
          padding: 8px 16px;
          font-weight: 600;
          cursor: pointer;
          font-size: 14px;
          display: inline-flex;
          align-items: center;
          gap: 6px;
          transition: background-color 0.15s ease;
          box-shadow: 0 1px 2px rgba(0,0,0,0.05);
        }
        .btn-secondary:hover {
          background-color: #f6f6f7;
        }
        .btn-danger {
          background-color: #ffffff;
          color: #d82c0d;
          border: 1px solid #d82c0d;
          border-radius: 6px;
          padding: 6px 12px;
          font-weight: 600;
          cursor: pointer;
          font-size: 12px;
          transition: all 0.15s;
        }
        .btn-danger:hover {
          background-color: #fff4f4;
        }
        .search-filters-row {
          display: flex;
          gap: 12px;
          background: #ffffff;
          border: 1px solid #e1e3e5;
          border-radius: 8px;
          padding: 12px 16px;
          margin-bottom: 16px;
        }
        .search-wrapper {
          position: relative;
          flex: 1;
        }
        .search-input {
          box-sizing: border-box;
          width: 100%;
          padding: 8px 12px 8px 36px;
          border: 1px solid #babfc3;
          border-radius: 6px;
          font-size: 14px;
          outline: none;
          background: #ffffff;
        }
        .search-input:focus {
          border-color: #008060;
          box-shadow: 0 0 0 2px rgba(0, 128, 96, 0.15);
        }
        .search-icon {
          position: absolute;
          left: 12px;
          top: 50%;
          transform: translateY(-50%);
          color: #8c9196;
          font-size: 14px;
        }
        .filter-select {
          padding: 8px 12px;
          border: 1px solid #babfc3;
          border-radius: 6px;
          font-size: 14px;
          background: #ffffff;
          color: #202223;
          cursor: pointer;
          outline: none;
          min-width: 160px;
        }
        .data-table-container {
          background: #ffffff;
          border: 1px solid #e1e3e5;
          border-radius: 8px;
          overflow: hidden;
        }
        .data-table {
          width: 100%;
          border-collapse: collapse;
          text-align: left;
        }
        .data-table th {
          background: #f6f6f7;
          padding: 14px 16px;
          font-size: 12px;
          font-weight: 600;
          text-transform: uppercase;
          color: #6d7175;
          border-bottom: 1px solid #e1e3e5;
        }
        .data-table td {
          padding: 14px 16px;
          font-size: 14px;
          border-bottom: 1px solid #ebebeb;
          vertical-align: middle;
        }
        .bulk-actions-bar {
          background: #f0fbf7;
          border: 1px solid #008060;
          padding: 10px 16px;
          border-radius: 8px;
          margin-bottom: 16px;
          display: flex;
          justify-content: space-between;
          align-items: center;
        }
        .pill-tag {
          display: inline-block;
          padding: 2px 8px;
          background-color: #f1f1f1;
          color: #202223;
          font-size: 11px;
          font-weight: 600;
          border-radius: 12px;
          margin-right: 4px;
        }
        .status-toggle {
          position: relative;
          display: inline-block;
          width: 44px;
          height: 24px;
        }
        .status-toggle input {
          opacity: 0;
          width: 0;
          height: 0;
        }
        .status-slider {
          position: absolute;
          cursor: pointer;
          top: 0; left: 0; right: 0; bottom: 0;
          background-color: #e4e4e7;
          transition: 0.3s;
          border-radius: 24px;
        }
        .status-slider:before {
          position: absolute;
          content: "";
          height: 18px;
          width: 18px;
          left: 3px;
          bottom: 3px;
          background-color: white;
          transition: 0.3s;
          border-radius: 50%;
        }
        .status-toggle input:checked + .status-slider {
          background-color: #10b981;
        }
        .status-toggle input:checked + .status-slider:before {
          transform: translateX(20px);
        }
        .spinner-overlay {
          position: absolute;
          top: 4px;
          left: 4px;
          border: 2px solid rgba(0,0,0,0.1);
          border-top: 2px solid #008060;
          border-radius: 50%;
          width: 10px;
          height: 10px;
          animation: spin 0.8s linear infinite;
        }
        .pagination-footer {
          display: flex;
          justify-content: space-between;
          align-items: center;
          padding: 16px;
          background: #ffffff;
          border-top: 1px solid #e1e3e5;
        }
        .pagination-btn {
          border: 1px solid #babfc3;
          background: #ffffff;
          padding: 6px 12px;
          border-radius: 6px;
          font-size: 13px;
          cursor: pointer;
        }
        .pagination-btn:disabled {
          background: #f1f1f1;
          color: #8c9196;
          cursor: not-allowed;
        }
        .modal-backdrop {
          position: fixed;
          top: 0; left: 0; right: 0; bottom: 0;
          background: rgba(0,0,0,0.5);
          backdrop-filter: blur(4px);
          z-index: 1000;
          display: flex;
          align-items: center;
          justify-content: center;
        }
        .modal-card {
          background: #ffffff;
          border-radius: 8px;
          width: 600px;
          max-width: 90%;
          max-height: 80vh;
          display: flex;
          flex-direction: column;
          overflow: hidden;
        }
        .modal-header {
          display: flex;
          justify-content: space-between;
          align-items: center;
          padding: 16px 20px;
          border-bottom: 1px solid #e1e3e5;
        }
        .modal-header h3 {
          margin: 0;
          font-size: 16px;
          font-weight: 600;
        }
        .modal-close {
          background: none;
          border: none;
          font-size: 20px;
          cursor: pointer;
          color: #6d7175;
        }
        .modal-body {
          padding: 20px;
          overflow-y: auto;
          flex: 1;
        }
        .modal-footer {
          display: flex;
          justify-content: space-between;
          align-items: center;
          padding: 16px 20px;
          border-top: 1px solid #e1e3e5;
          background: #f6f6f7;
        }
      `}</style>

      {viewMode === "list" ? (
        <ProductCatalogTable
          products={initialProducts}
          onConfigureProduct={handleOpenEditorForProduct}
          onDeleteOptions={handleDeleteOptions}
          onDuplicateOptions={handleDuplicateOptions}
          onExportJson={handleExportJson}
          onToggleStatus={handleToggleStatus}
          savingStatusToggleId={savingStatusToggleId}
          onOpenAddModal={() => setIsAddModalOpen(true)}
          onBulkDelete={handleBulkDelete}
        />
      ) : (
        <WorkspaceEditor
          product={selectedProduct}
          assets={assets}
          shop={shop}
          onBack={() => setViewMode("list")}
          onSave={handleSaveConfiguration}
        />
      )}

      {/* Catalog Selector Modal */}
      <CatalogPickerModal
        isOpen={isAddModalOpen}
        products={initialProducts}
        onClose={() => setIsAddModalOpen(false)}
        onAdd={handleAddSelectedProduct}
      />

    </div>
  );
}
