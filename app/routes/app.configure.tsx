import { useLoaderData, useFetcher } from "react-router";
import type { LoaderFunctionArgs, ActionFunctionArgs } from "react-router";
import { authenticate } from "../shopify.server";
import db from "../db.server";
import { useEffect, useState } from "react";
import { useAppBridge } from "@shopify/app-bridge-react";
import { PersonalizationConfigSync } from "../utils/templateSync";

// Sub-components & shared utilities
import { ProductCatalogTable } from "../components/personalizer/ProductCatalogTable";
import { WorkspaceEditor } from "../components/personalizer/WorkspaceEditor";
import { CatalogPickerModal } from "../components/personalizer/CatalogPickerModal";
import { ConfirmModal } from "../components/personalizer/ConfirmModal";
import { CloseIcon } from "../components/personalizer/Icons";

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
          createdDefinition {
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
  const { admin, session } = await authenticate.admin(request);
  const shop = session.shop;
  const formData = await request.formData();
  
  const bulkUpdatesJson = formData.get("bulkUpdates") as string;
  if (bulkUpdatesJson) {
    try {
      const metafields = JSON.parse(bulkUpdatesJson);
      const errors = await PersonalizationConfigSync.publishRawMetafields({ admin, shop, db }, metafields);
      return { ok: errors.length === 0, errors };
    } catch (e: any) {
      console.error("Error executing bulk metafieldsSet", e);
      return { ok: false, errors: [{ message: e.message || "Bulk update failed" }] };
    }
  }

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

  try {
    const result = await PersonalizationConfigSync.syncProductConfig(
      { admin, shop, db },
      productId,
      { enabled, options, upchargeVariantId }
    );
    return { ok: result.success, errors: result.errors };
  } catch (e: any) {
    console.error("Error syncing product config", e);
    return { ok: false, errors: [{ message: e.message || "Sync product config failed" }] };
  }
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

  // Custom confirmation modal state
  const [confirmModal, setConfirmModal] = useState<{
    isOpen: boolean;
    title: string;
    message: string;
    confirmLabel?: string;
    cancelLabel?: string;
    isDestructive?: boolean;
    onConfirm: () => void;
  }>({
    isOpen: false,
    title: "",
    message: "",
    onConfirm: () => {}
  });

  // Custom duplicate product modal state
  const [duplicateModalSource, setDuplicateModalSource] = useState<any>(null);
  const [duplicateTargetProductId, setDuplicateTargetProductId] = useState<string>("");

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

  // Helper to submit bulk updates to the action
  const submitBulkUpdates = (updates: { id: string; enabled: boolean; options: any[]; upchargeVariantId: string }[]) => {
    const metafields = updates.map(update => ({
      ownerId: update.id,
      namespace: "app",
      key: "customization_config",
      type: "json",
      value: JSON.stringify({
        enabled: update.enabled,
        options: update.options,
        upchargeVariantId: update.upchargeVariantId
      })
    }));

    fetcher.submit(
      { bulkUpdates: JSON.stringify(metafields) },
      { method: "POST" }
    );
  };

  // Bulk activate options
  const handleBulkActivate = (ids: string[]) => {
    const updates = ids.map(id => {
      const product = initialProducts.find((p: any) => p.id === id);
      let options = [];
      let upcharge = "";
      if (product?.metafield?.value) {
        try {
          const parsed = JSON.parse(product.metafield.value);
          options = parsed.options || [];
          upcharge = parsed.upchargeVariantId || "";
        } catch (e) {}
      }
      if (options.length === 0) {
        options = [
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
      return { id, enabled: true, options, upchargeVariantId: upcharge };
    });

    submitBulkUpdates(updates);
    shopify.toast.show(`Activating customization for ${ids.length} products...`);
  };

  // Bulk deactivate options
  const handleBulkDeactivate = (ids: string[]) => {
    const updates = ids.map(id => {
      const product = initialProducts.find((p: any) => p.id === id);
      let options = [];
      let upcharge = "";
      if (product?.metafield?.value) {
        try {
          const parsed = JSON.parse(product.metafield.value);
          options = parsed.options || [];
          upcharge = parsed.upchargeVariantId || "";
        } catch (e) {}
      }
      return { id, enabled: false, options, upchargeVariantId: upcharge };
    });

    submitBulkUpdates(updates);
    shopify.toast.show(`Deactivating customization for ${ids.length} products...`);
  };

  const triggerConfirm = (params: {
    title: string;
    message: string;
    confirmLabel?: string;
    cancelLabel?: string;
    isDestructive?: boolean;
    onConfirm: () => void;
  }) => {
    setConfirmModal({
      isOpen: true,
      ...params
    });
  };

  // Bulk deleting option mappings
  const handleBulkDelete = (bulkSelectedIds: string[]) => {
    triggerConfirm({
      title: "Delete Customizer Settings",
      message: `Are you sure you want to delete personalization settings for ${bulkSelectedIds.length} products? This action cannot be undone.`,
      confirmLabel: "Delete",
      isDestructive: true,
      onConfirm: () => {
        const updates = bulkSelectedIds.map(id => ({
          id,
          enabled: false,
          options: [],
          upchargeVariantId: ""
        }));
        submitBulkUpdates(updates);
        shopify.toast.show(`Deleting customization settings for ${bulkSelectedIds.length} products...`);
      }
    });
  };

  // Duplicate options template to another product
  const handleDuplicateOptions = (sourceProduct: any) => {
    setDuplicateModalSource(sourceProduct);
    const otherProducts = initialProducts.filter((p: any) => p.id !== sourceProduct.id);
    if (otherProducts.length > 0) {
      setDuplicateTargetProductId(otherProducts[0].id);
    } else {
      setDuplicateTargetProductId("");
    }
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
    triggerConfirm({
      title: "Delete Options Configuration",
      message: `Are you sure you want to completely remove personalization options for ${product.title}? This action cannot be undone.`,
      confirmLabel: "Delete",
      isDestructive: true,
      onConfirm: () => {
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
    });
  };

  const handleOpenEditorForProduct = (product: any) => {
    setSelectedProduct(product);
    setViewMode("editor");
  };

  const handleAddSelectedProducts = (selectedIds: string[]) => {
    if (selectedIds.length === 1) {
      const match = initialProducts.find((p: any) => p.id === selectedIds[0]);
      if (match) {
        setSelectedProduct(match);
        setViewMode("editor");
        setIsAddModalOpen(false);
      }
    } else if (selectedIds.length > 1) {
      const defaultOptions = [
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
      const updates = selectedIds.map(id => ({
        id,
        enabled: true,
        options: defaultOptions,
        upchargeVariantId: ""
      }));
      submitBulkUpdates(updates);
      setIsAddModalOpen(false);
      shopify.toast.show(`Initializing customization for ${selectedIds.length} products...`);
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

  const handleCancelConfirm = () => {
    setConfirmModal(prev => ({ ...prev, isOpen: false }));
  };

  const handleExecuteConfirm = () => {
    confirmModal.onConfirm();
    setConfirmModal(prev => ({ ...prev, isOpen: false }));
  };

  if (viewMode === "editor") {
    return (
      <WorkspaceEditor
        product={selectedProduct}
        assets={assets}
        shop={shop}
        onBack={() => setViewMode("list")}
        onSave={handleSaveConfiguration}
      />
    );
  }

  return (
    <s-page heading="Product Options">
      
      {/* Styles Injections for Table/Workspace Layout components */}
      <style>{`
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
        .btn-primary:disabled {
          background-color: #ebebeb;
          color: #8c9196;
          cursor: not-allowed;
          box-shadow: none;
          transform: none !important;
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
        .btn-tertiary {
          background-color: transparent;
          color: #202223;
          border: none;
          border-radius: 6px;
          padding: 6px 12px;
          font-weight: 600;
          cursor: pointer;
          font-size: 13px;
          display: inline-flex;
          align-items: center;
          gap: 6px;
          transition: background-color 0.15s ease, color 0.15s ease;
        }
        .btn-tertiary:hover {
          background-color: #f1f2f4;
        }
        .btn-tertiary:active {
          background-color: #e4e6eb;
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
          appearance: none;
          -webkit-appearance: none;
          -moz-appearance: none;
          background-image: url("data:image/svg+xml;utf8,<svg xmlns='http://www.w3.org/2000/svg' viewBox='0 0 20 20' fill='%236d7175'><path d='M10 13a1 1 0 0 1-.707-.293l-4-4a1 1 0 1 1 1.414-1.414L10 10.586l3.293-3.293a1 1 0 1 1 1.414 1.414l-4 4A1 1 0 0 1 10 13z'/></svg>");
          background-repeat: no-repeat;
          background-position: right 10px center;
          background-size: 16px 16px;
          padding-right: 32px !important;
        }
        .filter-select:focus {
          border-color: #008060;
          box-shadow: 0 0 0 2px rgba(0, 128, 96, 0.15);
        }
        input[type="checkbox"] {
          appearance: none;
          -webkit-appearance: none;
          background-color: #ffffff;
          margin: 0;
          font: inherit;
          color: #008060;
          width: 16px;
          height: 16px;
          border: 1.5px solid #babfc3;
          border-radius: 4px;
          display: inline-grid;
          place-content: center;
          cursor: pointer;
          transition: all 0.15s ease-in-out;
          vertical-align: middle;
        }
        input[type="checkbox"]::before {
          content: "";
          width: 9px;
          height: 9px;
          transform: scale(0);
          transition: 120ms transform ease-in-out;
          background-color: #ffffff;
          clip-path: polygon(14% 44%, 0 65%, 50% 100%, 100% 16%, 80% 0%, 43% 62%);
        }
        input[type="checkbox"]:checked {
          background-color: #008060;
          border-color: #008060;
        }
        input[type="checkbox"]:checked::before {
          transform: scale(1);
        }
        input[type="checkbox"]:focus {
          outline: none;
          border-color: #008060;
          box-shadow: 0 0 0 2px rgba(0, 128, 96, 0.25);
        }
        .polaris-status-dot {
          display: inline-block;
          width: 8px;
          height: 8px;
          border-radius: 50%;
        }
        .polaris-status-dot-active {
          background-color: #008060;
        }
        .polaris-status-dot-inactive {
          background-color: #8c9196;
        }
        .data-table-container {
          background: #ffffff;
          border: 1px solid #e1e3e5;
          border-radius: 8px;
        }
        .data-table th:first-child {
          border-top-left-radius: 8px;
        }
        .data-table th:last-child {
          border-top-right-radius: 8px;
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
        .polaris-switch {
          position: relative;
          display: inline-flex;
          align-items: center;
          cursor: pointer;
          user-select: none;
        }
        .polaris-switch input {
          position: absolute;
          opacity: 0;
          width: 0;
          height: 0;
        }
        .polaris-switch-track {
          position: relative;
          width: 38px;
          height: 20px;
          background-color: #8c9196;
          border-radius: 10px;
          transition: background-color 0.2s cubic-bezier(0.19, 1, 0.22, 1);
        }
        .polaris-switch input:checked + .polaris-switch-track {
          background-color: #008060;
        }
        .polaris-switch input:disabled + .polaris-switch-track {
          background-color: #e4e4e7;
          cursor: not-allowed;
          opacity: 0.6;
        }
        .polaris-switch-thumb {
          position: absolute;
          top: 2px;
          left: 2px;
          width: 16px;
          height: 16px;
          background-color: #ffffff;
          border-radius: 50%;
          box-shadow: 0 1px 3px rgba(0, 0, 0, 0.2);
          transition: transform 0.2s cubic-bezier(0.19, 1, 0.22, 1);
          display: flex;
          align-items: center;
          justify-content: center;
        }
        .polaris-switch input:checked + .polaris-switch-track .polaris-switch-thumb {
          transform: translateX(18px);
        }
        .polaris-switch-spinner {
          width: 10px;
          height: 10px;
          border: 1.5px solid rgba(0, 0, 0, 0.1);
          border-top: 1.5px solid #008060;
          border-radius: 50%;
          animation: polaris-spin 0.6s linear infinite;
        }
        @keyframes polaris-spin {
          0% { transform: rotate(0deg); }
          100% { transform: rotate(360deg); }
        }
        .pagination-footer {
          display: flex;
          justify-content: space-between;
          align-items: center;
          padding: 16px;
          background: #ffffff;
          border-top: 1px solid #e1e3e5;
          border-bottom-left-radius: 8px;
          border-bottom-right-radius: 8px;
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
        .dropdown-item-hover {
          transition: background-color 0.15s ease;
        }
        .dropdown-item-hover:hover {
          background-color: #f6f6f7 !important;
        }
        .dropdown-item-hover-danger {
          transition: background-color 0.15s ease;
        }
        .dropdown-item-hover-danger:hover {
          background-color: #fff4f4 !important;
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
          cursor: pointer;
          color: #6d7175;
          padding: 4px;
          border-radius: 4px;
          transition: background-color 0.15s ease, color 0.15s ease;
          display: flex;
          align-items: center;
          justify-content: center;
        }
        .modal-close:hover {
          background-color: #f6f6f7;
          color: #202223;
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

      <ProductCatalogTable
        products={initialProducts}
        shop={shop}
        onConfigureProduct={handleOpenEditorForProduct}
        onDeleteOptions={handleDeleteOptions}
        onDuplicateOptions={handleDuplicateOptions}
        onExportJson={handleExportJson}
        onToggleStatus={handleToggleStatus}
        savingStatusToggleId={savingStatusToggleId}
        onOpenAddModal={() => setIsAddModalOpen(true)}
        onBulkDelete={handleBulkDelete}
        onBulkActivate={handleBulkActivate}
        onBulkDeactivate={handleBulkDeactivate}
      />

      {/* Catalog Selector Modal */}
      <CatalogPickerModal
        isOpen={isAddModalOpen}
        products={initialProducts}
        onClose={() => setIsAddModalOpen(false)}
        onAdd={handleAddSelectedProducts}
      />

      {/* Confirmation Modal */}
      <ConfirmModal
        isOpen={confirmModal.isOpen}
        title={confirmModal.title}
        message={confirmModal.message}
        confirmLabel={confirmModal.confirmLabel}
        cancelLabel={confirmModal.cancelLabel}
        isDestructive={confirmModal.isDestructive}
        onConfirm={handleExecuteConfirm}
        onCancel={handleCancelConfirm}
      />

      {/* Duplicate Option Modal */}
      {duplicateModalSource && (
        <div className="modal-backdrop" style={{ zIndex: 1040 }}>
          <div className="modal-card" style={{ width: "460px" }}>
            <div className="modal-header">
              <h3>Duplicate Options</h3>
              <button
                className="modal-close"
                onClick={() => setDuplicateModalSource(null)}
                style={{ display: "flex", alignItems: "center", justifyContent: "center" }}
              >
                <CloseIcon />
              </button>
            </div>
            <div className="modal-body" style={{ display: "flex", flexDirection: "column", gap: "12px" }}>
              <p style={{ fontSize: "13px", color: "#6d7175", margin: 0 }}>
                Copy customization options and upcharges from <strong>{duplicateModalSource.title}</strong> to another product.
              </p>
              
              <div style={{ display: "flex", flexDirection: "column", gap: "6px" }}>
                <span style={{ fontSize: "13px", fontWeight: 600 }}>Select Target Product:</span>
                <select
                  value={duplicateTargetProductId}
                  onChange={(e) => setDuplicateTargetProductId(e.target.value)}
                  className="filter-select"
                  style={{ width: "100%", boxSizing: "border-box" }}
                >
                  {initialProducts
                    .filter((p: any) => p.id !== duplicateModalSource.id)
                    .map((p: any) => (
                      <option key={p.id} value={p.id}>
                        {p.title} (ID: {p.id.split("/").pop()})
                      </option>
                    ))}
                </select>
              </div>
            </div>
            <div className="modal-footer">
              <span />
              <div style={{ display: "flex", gap: "8px" }}>
                <button
                  className="btn-secondary"
                  onClick={() => setDuplicateModalSource(null)}
                  style={{ border: "1px solid #babfc3", color: "#6d7175", background: "#ffffff" }}
                >
                  Cancel
                </button>
                <button
                  className="btn-primary"
                  disabled={!duplicateTargetProductId}
                  onClick={() => {
                    const targetProduct = initialProducts.find((p: any) => p.id === duplicateTargetProductId);
                    if (targetProduct) {
                      const sourceConfig = duplicateModalSource.metafield?.value
                        ? JSON.parse(duplicateModalSource.metafield.value)
                        : { enabled: true, options: [] };
                      
                      fetcher.submit(
                        {
                          productId: targetProduct.id,
                          enabled: String(sourceConfig.enabled ?? true),
                          options: JSON.stringify(sourceConfig.options || []),
                          upchargeVariantId: sourceConfig.upchargeVariantId || ""
                        },
                        { method: "POST" }
                      );
                      shopify.toast.show(`Duplicated options from ${duplicateModalSource.title} to ${targetProduct.title}!`);
                    }
                    setDuplicateModalSource(null);
                  }}
                >
                  Duplicate
                </button>
              </div>
            </div>
          </div>
        </div>
      )}

    </s-page>
  );
}
