import { useLoaderData, useFetcher } from "react-router";
import type { LoaderFunctionArgs, ActionFunctionArgs } from "react-router";
import { authenticate } from "../shopify.server";
import { useEffect, useState } from "react";
import { useAppBridge } from "@shopify/app-bridge-react";

// The GraphQL query to fetch products and their personalization metafields
const PRODUCTS_QUERY = `#graphql
  query getProducts {
    products(first: 20) {
      edges {
        node {
          id
          title
          handle
          featuredImage {
            url
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

// Loader: Fetch products and their current configuration metafields
export const loader = async ({ request }: LoaderFunctionArgs) => {
  const { admin } = await authenticate.admin(request);

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

  return { products };
};

// Action: Save customization config to product metafield
export const action = async ({ request }: ActionFunctionArgs) => {
  const { admin } = await authenticate.admin(request);
  const formData = await request.formData();
  
  const productId = formData.get("productId") as string;
  const enabled = formData.get("enabled") === "true";
  const maxChars = parseInt(formData.get("maxChars") as string) || 50;
  const fee = parseFloat(formData.get("fee") as string) || 0.0;
  const fontOptions = (formData.get("fonts") as string)?.split(",").map(f => f.trim()) || ["Arial", "Script", "Gothic"];
  const colorOptions = (formData.get("colors") as string)?.split(",").map(c => c.trim()) || ["#000000", "#FF0000", "#0000FF"];

  const config = {
    enabled,
    maxChars,
    fee,
    fontOptions,
    colorOptions
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

export default function Settings() {
  const { products } = useLoaderData<typeof loader>();
  const fetcher = useFetcher<typeof action>();
  const shopify = useAppBridge();

  const [selectedProduct, setSelectedProduct] = useState<any>(products[0] || null);
  const [enabled, setEnabled] = useState(false);
  const [maxChars, setMaxChars] = useState(50);
  const [fee, setFee] = useState(0.0);
  const [fonts, setFonts] = useState("Arial, Script, Gothic");
  const [colors, setColors] = useState("#000000, #E63946, #457B9D, #1D3557");

  useEffect(() => {
    if (selectedProduct) {
      const configVal = selectedProduct.metafield?.value;
      if (configVal) {
        try {
          const config = JSON.parse(configVal);
          setEnabled(config.enabled ?? false);
          setMaxChars(config.maxChars ?? 50);
          setFee(config.fee ?? 0.0);
          setFonts(config.fontOptions?.join(", ") ?? "Arial, Script, Gothic");
          setColors(config.colorOptions?.join(", ") ?? "#000000, #E63946, #457B9D, #1D3557");
        } catch (e) {
          console.error("Error parsing product config", e);
        }
      } else {
        // Reset defaults
        setEnabled(false);
        setMaxChars(50);
        setFee(0.0);
        setFonts("Arial, Script, Gothic");
        setColors("#000000, #E63946, #457B9D, #1D3557");
      }
    }
  }, [selectedProduct]);

  useEffect(() => {
    if (fetcher.data?.ok) {
      shopify.toast.show("Personalization settings updated successfully!");
    }
  }, [fetcher.data, shopify]);

  const handleSave = () => {
    if (!selectedProduct) return;
    fetcher.submit(
      {
        productId: selectedProduct.id,
        enabled: String(enabled),
        maxChars: String(maxChars),
        fee: String(fee),
        fonts,
        colors
      },
      { method: "POST" }
    );
  };

  return (
    <s-page heading="Product Personalizer Settings">
      <s-section heading="Select Product to Personalize">
        <s-paragraph>
          Choose a product from your store to configure options like engraving, custom fonts, colors, and add-on pricing.
        </s-paragraph>
        
        {products.length === 0 ? (
          <s-box padding="large" background="subdued" borderRadius="base" borderWidth="base">
            <s-paragraph>No products found in your store. Please create a product first!</s-paragraph>
          </s-box>
        ) : (
          <div style={{ display: "grid", gridTemplateColumns: "1fr 2fr", gap: "24px", marginTop: "16px" }}>
            {/* Product List */}
            <s-box padding="base" borderRadius="base" borderWidth="base" background="surface">
              <s-stack direction="block" gap="small">
                <s-text size="medium" weight="bold">Products</s-text>
                <div style={{ display: "flex", flexDirection: "column", gap: "8px", maxHeight: "400px", overflowY: "auto" }}>
                  {products.map((product: any) => {
                    const isConfigured = product.metafield?.value ? JSON.parse(product.metafield.value).enabled : false;
                    return (
                      <button
                        key={product.id}
                        onClick={() => setSelectedProduct(product)}
                        style={{
                          display: "flex",
                          alignItems: "center",
                          gap: "12px",
                          padding: "10px",
                          border: selectedProduct?.id === product.id ? "2px solid #008060" : "1px solid #e1e3e5",
                          borderRadius: "8px",
                          background: selectedProduct?.id === product.id ? "#f0fdf4" : "#ffffff",
                          textAlign: "left",
                          cursor: "pointer",
                          transition: "all 0.2s"
                        }}
                      >
                        {product.featuredImage?.url ? (
                          <img src={product.featuredImage.url} alt="" style={{ width: "40px", height: "40px", borderRadius: "4px", objectFit: "cover" }} />
                        ) : (
                          <div style={{ width: "40px", height: "40px", borderRadius: "4px", background: "#f1f2f4", display: "flex", alignItems: "center", justifyContent: "center" }}>📦</div>
                        )}
                        <div style={{ flex: 1, minWidth: 0 }}>
                          <div style={{ fontWeight: 600, overflow: "hidden", textOverflow: "ellipsis", whiteSpace: "nowrap" }}>{product.title}</div>
                          <div style={{ fontSize: "12px", color: isConfigured ? "#008060" : "#6d7175" }}>
                            {isConfigured ? "🟢 Enabled" : "⚪ Disabled"}
                          </div>
                        </div>
                      </button>
                    );
                  })}
                </div>
              </s-stack>
            </s-box>

            {/* Config Panel */}
            {selectedProduct && (
              <s-box padding="large" borderRadius="base" borderWidth="base" background="surface">
                <s-stack direction="block" gap="medium">
                  <div style={{ display: "flex", alignItems: "center", gap: "16px" }}>
                    {selectedProduct.featuredImage?.url && (
                      <img src={selectedProduct.featuredImage.url} alt="" style={{ width: "60px", height: "60px", borderRadius: "8px", objectFit: "cover" }} />
                    )}
                    <div>
                      <s-text size="large" weight="bold">{selectedProduct.title}</s-text>
                      <s-paragraph>Configure product customization options.</s-paragraph>
                    </div>
                  </div>

                  <hr style={{ border: 0, borderTop: "1px solid #e1e3e5", margin: "16px 0" }} />

                  {/* Enable Switch */}
                  <div style={{ display: "flex", alignItems: "center", gap: "12px" }}>
                    <input
                      type="checkbox"
                      id="enable-checkbox"
                      checked={enabled}
                      onChange={(e) => setEnabled(e.target.checked)}
                      style={{ width: "20px", height: "20px", accentColor: "#008060" }}
                    />
                    <label htmlFor="enable-checkbox" style={{ fontWeight: 600, fontSize: "16px", cursor: "pointer" }}>
                      Enable Text Personalization for this Product
                    </label>
                  </div>

                  {enabled && (
                    <div style={{ display: "flex", flexDirection: "column", gap: "16px", marginTop: "16px" }}>
                      <div>
                        <label style={{ display: "block", fontWeight: 600, marginBottom: "6px" }}>Max Characters Allowed</label>
                        <input
                          type="number"
                          value={maxChars}
                          onChange={(e) => setMaxChars(parseInt(e.target.value) || 0)}
                          style={{ width: "100%", padding: "10px", borderRadius: "6px", border: "1px solid #babfc3" }}
                          min="1"
                        />
                        <span style={{ fontSize: "12px", color: "#6d7175" }}>Limit the length of engraving or text input.</span>
                      </div>

                      <div>
                        <label style={{ display: "block", fontWeight: 600, marginBottom: "6px" }}>Upcharge / Customization Fee ($)</label>
                        <input
                          type="number"
                          step="0.01"
                          value={fee}
                          onChange={(e) => setFee(parseFloat(e.target.value) || 0.0)}
                          style={{ width: "100%", padding: "10px", borderRadius: "6px", border: "1px solid #babfc3" }}
                          min="0"
                        />
                        <span style={{ fontSize: "12px", color: "#6d7175" }}>Enter any extra charge associated with this personalization.</span>
                      </div>

                      <div>
                        <label style={{ display: "block", fontWeight: 600, marginBottom: "6px" }}>Allowed Fonts (comma separated)</label>
                        <input
                          type="text"
                          value={fonts}
                          onChange={(e) => setFonts(e.target.value)}
                          style={{ width: "100%", padding: "10px", borderRadius: "6px", border: "1px solid #babfc3" }}
                        />
                        <span style={{ fontSize: "12px", color: "#6d7175" }}>List font options for the customer (e.g. Arial, Georgia, Brush Script MT).</span>
                      </div>

                      <div>
                        <label style={{ display: "block", fontWeight: 600, marginBottom: "6px" }}>Allowed Colors (comma separated Hex values)</label>
                        <input
                          type="text"
                          value={colors}
                          onChange={(e) => setColors(e.target.value)}
                          style={{ width: "100%", padding: "10px", borderRadius: "6px", border: "1px solid #babfc3" }}
                        />
                        <span style={{ fontSize: "12px", color: "#6d7175" }}>List hexadecimal colors for the preview (e.g. #000000, #FF0000, #00FF00).</span>
                      </div>
                    </div>
                  )}

                  <div style={{ marginTop: "24px" }}>
                    <s-button onClick={handleSave} variant="primary" {...(fetcher.state === "submitting" ? { loading: true } : {})}>
                      Save Configuration
                    </s-button>
                  </div>
                </s-stack>
              </s-box>
            )}
          </div>
        )}
      </s-section>
    </s-page>
  );
}
