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

// Action: Save dynamic customization config to product metafield
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

interface ConditionalRule {
  fieldId: string;
  operator: "equals" | "not_equals" | "checked" | "unchecked";
  value: string;
}

interface CustomizationOption {
  id: string;
  type: "text" | "select" | "swatch" | "checkbox" | "file";
  label: string;
  required: boolean;
  priceUpcharge: number;
  maxChars?: number; // For type === "text"
  choices?: string; // For type === "select" or "swatch", comma-separated list
  conditionalRules?: ConditionalRule[];
}


export default function ConfigureProductOptions() {
  const { products } = useLoaderData<typeof loader>();
  const fetcher = useFetcher<typeof action>();
  const shopify = useAppBridge();

  const [selectedProduct, setSelectedProduct] = useState<any>(products[0] || null);
  const [enabled, setEnabled] = useState(false);
  const [options, setOptions] = useState<CustomizationOption[]>([]);
  const [upchargeVariantId, setUpchargeVariantId] = useState("");

  useEffect(() => {
    if (selectedProduct) {
      const configVal = selectedProduct.metafield?.value;
      if (configVal) {
        try {
          const config = JSON.parse(configVal);
          
          if (config.options) {
            // New schema format
            setOptions(config.options);
            setEnabled(config.enabled ?? false);
            setUpchargeVariantId(config.upchargeVariantId || "");
          } else {
            // Self-healing layer: Auto-migrate old static schema into dynamic options schema
            const migrated: CustomizationOption[] = [];
            if (config.enabled) {
              migrated.push({
                id: "migrated-text",
                type: "text",
                label: "Custom Engraving Text",
                required: true,
                priceUpcharge: config.fee ?? 0.0,
                maxChars: config.maxChars ?? 50
              });
              if (config.fontOptions && config.fontOptions.length > 0) {
                migrated.push({
                  id: "migrated-font",
                  type: "select",
                  label: "Font Style",
                  required: true,
                  priceUpcharge: 0.0,
                  choices: config.fontOptions.join(", ")
                });
              }
              if (config.colorOptions && config.colorOptions.length > 0) {
                migrated.push({
                  id: "migrated-color",
                  type: "swatch",
                  label: "Text Color",
                  required: true,
                  priceUpcharge: 0.0,
                  choices: config.colorOptions.join(", ")
                });
              }
            }
            setOptions(migrated);
            setEnabled(config.enabled ?? false);
            setUpchargeVariantId("");
          }
        } catch (e) {
          console.error("Error parsing product config, using default", e);
          setOptions([]);
          setEnabled(false);
          setUpchargeVariantId("");
        }
      } else {
        // Reset defaults for clean product
        setEnabled(false);
        setUpchargeVariantId("");
        setOptions([
          {
            id: "opt-default-text",
            type: "text",
            label: "Engraving Text",
            required: true,
            priceUpcharge: 0.0,
            maxChars: 30
          }
        ]);
      }
    }
  }, [selectedProduct]);

  useEffect(() => {
    if (fetcher.data?.ok) {
      shopify.toast.show("Personalization options updated successfully!");
    }
  }, [fetcher.data, shopify]);

  const handleAddOption = () => {
    const newOption: CustomizationOption = {
      id: `opt-${Date.now()}`,
      type: "text",
      label: "New Option Label",
      required: false,
      priceUpcharge: 0.0,
      maxChars: 50,
      conditionalRules: []
    };
    setOptions([...options, newOption]);
  };

  const handleRemoveOption = (id: string) => {
    setOptions(options.filter(o => o.id !== id));
  };

  const handleUpdateOption = (id: string, updates: Partial<CustomizationOption>) => {
    setOptions(options.map(o => {
      if (o.id === id) {
        const updated = { ...o, ...updates };
        // Reset type-specific fields if option type changes
        if (updates.type && updates.type !== o.type) {
          if (updates.type === "text") {
            updated.maxChars = 50;
            delete updated.choices;
          } else if (updates.type === "select") {
            updated.choices = "Option A, Option B, Option C";
            delete updated.maxChars;
          } else if (updates.type === "swatch") {
            updated.choices = "#000000, #E63946, #457B9D, #1D3557";
            delete updated.maxChars;
          } else if (updates.type === "checkbox") {
            delete updated.maxChars;
            delete updated.choices;
          } else if (updates.type === "file") {
            delete updated.maxChars;
            delete updated.choices;
          }
        }
        return updated;
      }
      return o;
    }));
  };

  const handleSave = () => {
    if (!selectedProduct) return;
    fetcher.submit(
      {
        productId: selectedProduct.id,
        enabled: String(enabled),
        options: JSON.stringify(options),
        upchargeVariantId: upchargeVariantId
      },
      { method: "POST" }
    );
  };

  return (
    <s-page heading="Configure Product Options">
      <s-section heading="Product-Specific Customization Options">
        <s-paragraph>
          Create personalization options for your store products. Add engraving inputs, font/color options, custom add-ons, or checkbox selections that map automatically to checkout line-item properties.
        </s-paragraph>
        
        {products.length === 0 ? (
          <s-box padding="large" background={"subdued" as any} borderRadius="base" borderWidth="base">
            <s-paragraph>No products found in your store. Please create a product first!</s-paragraph>
          </s-box>
        ) : (
          <div style={{ display: "grid", gridTemplateColumns: "1fr 2fr", gap: "24px", marginTop: "16px" }}>
            {/* Product List */}
            <s-box padding="base" borderRadius="base" borderWidth="base" background={"surface" as any}>
              <s-stack direction="block" gap={"small" as any}>
                <span style={{ fontSize: "16px", fontWeight: 700, display: "block", color: "#1a1a1a" }}>Store Products</span>
                <div style={{ display: "flex", flexDirection: "column", gap: "8px", maxHeight: "500px", overflowY: "auto" }}>
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
                            {isConfigured ? "🟢 Active Options" : "⚪ No Customizations"}
                          </div>
                        </div>
                      </button>
                    );
                  })}
                </div>
              </s-stack>
            </s-box>

            {/* Dynamic Customization Config Panel */}
            {selectedProduct && (
              <s-box padding="large" borderRadius="base" borderWidth="base" background={"surface" as any}>
                <s-stack direction="block" gap={"medium" as any}>
                  
                  {/* Selected Product Title */}
                  <div style={{ display: "flex", alignItems: "center", gap: "16px" }}>
                    {selectedProduct.featuredImage?.url && (
                      <img src={selectedProduct.featuredImage.url} alt="" style={{ width: "60px", height: "60px", borderRadius: "8px", objectFit: "cover" }} />
                    )}
                    <div>
                      <span style={{ fontSize: "20px", fontWeight: 700, display: "block", color: "#1a1a1a" }}>{selectedProduct.title}</span>
                      <s-paragraph>Configure interactive custom builder settings.</s-paragraph>
                    </div>
                  </div>

                  <hr style={{ border: 0, borderTop: "1px solid #e1e3e5", margin: "8px 0" }} />
                  {/* Enable Switch */}
                  <div style={{ display: "flex", alignItems: "center", gap: "12px", background: "#f9fafb", padding: "12px", borderRadius: "8px" }}>
                    <input
                      type="checkbox"
                      id="enable-checkbox"
                      checked={enabled}
                      onChange={(e) => setEnabled(e.target.checked)}
                      style={{ width: "20px", height: "20px", accentColor: "#008060", cursor: "pointer" }}
                    />
                    <label htmlFor="enable-checkbox" style={{ fontWeight: 600, fontSize: "15px", cursor: "pointer" }}>
                      Activate Personalization Block on Storefront
                    </label>
                  </div>

                  {/* Global $1.00 Upcharge GID mapping */}
                  <div style={{ background: "#f9fafb", padding: "16px", borderRadius: "8px", border: "1px solid #e1e3e5" }}>
                    <label style={{ display: "block", fontWeight: 600, fontSize: "14px", marginBottom: "6px" }}>
                      Global $1.00 Upcharge Product Variant ID (Shopify GID)
                    </label>
                    <input
                      type="text"
                      value={upchargeVariantId}
                      onChange={(e) => setUpchargeVariantId(e.target.value)}
                      placeholder="e.g. gid://shopify/ProductVariant/47852369145625"
                      style={{ width: "100%", padding: "8px", borderRadius: "6px", border: "1px solid #babfc3", background: "#ffffff" }}
                    />
                    <small style={{ display: "block", marginTop: "4px", color: "#6d7175", fontSize: "11px" }}>
                      To charge extra fees, create a hidden product priced at $1.00, and enter its Variant GID here. Our AJAX storefront engine adds this item automatically in multiples to bundle the correct personalization upcharge.
                    </small>
                  </div>

                  {enabled && (
                    <div style={{ display: "flex", flexDirection: "column", gap: "16px" }}>
                      <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", marginTop: "12px" }}>
                        <span style={{ fontSize: "16px", fontWeight: 700, display: "block", color: "#1a1a1a" }}>Customization Options List</span>
                        <button
                          type="button"
                          onClick={handleAddOption}
                          style={{
                            padding: "8px 16px",
                            background: "#008060",
                            color: "#ffffff",
                            border: "none",
                            borderRadius: "6px",
                            fontWeight: 600,
                            cursor: "pointer",
                            fontSize: "13px"
                          }}
                        >
                          ➕ Add Option
                        </button>
                      </div>

                      {options.length === 0 ? (
                        <div style={{ padding: "30px", border: "1px dashed #babfc3", borderRadius: "8px", textAlign: "center", color: "#6d7175" }}>
                          No options created yet. Click "Add Option" to get started.
                        </div>
                      ) : (
                        <div style={{ display: "flex", flexDirection: "column", gap: "16px" }}>
                          {options.map((option, index) => (
                            <div 
                              key={option.id} 
                              style={{ 
                                border: "1px solid #d2d5d8", 
                                borderRadius: "10px", 
                                padding: "16px", 
                                background: "#ffffff",
                                boxShadow: "0 2px 5px rgba(0,0,0,0.03)",
                                position: "relative"
                              }}
                            >
                              {/* Option Header */}
                              <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", marginBottom: "12px" }}>
                                <span style={{ fontWeight: 700, fontSize: "14px", color: "#2c6ecb" }}>Option #{index + 1}</span>
                                <button
                                  type="button"
                                  onClick={() => handleRemoveOption(option.id)}
                                  style={{
                                    background: "none",
                                    border: "none",
                                    color: "#d93838",
                                    fontWeight: 600,
                                    cursor: "pointer",
                                    fontSize: "12px"
                                  }}
                                >
                                  🗑️ Delete Option
                                </button>
                              </div>

                              {/* Form row 1: Label & Type */}
                              <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: "16px", marginBottom: "12px" }}>
                                <div>
                                  <label style={{ display: "block", fontWeight: 600, fontSize: "13px", marginBottom: "4px" }}>Option Label / Property Name</label>
                                  <input
                                    type="text"
                                    value={option.label}
                                    onChange={(e) => handleUpdateOption(option.id, { label: e.target.value })}
                                    style={{ width: "100%", padding: "8px", borderRadius: "6px", border: "1px solid #babfc3" }}
                                    placeholder="e.g. Engraving Text"
                                  />
                                </div>
                                <div>
                                  <label style={{ display: "block", fontWeight: 600, fontSize: "13px", marginBottom: "4px" }}>Input Type</label>
                                  <select
                                    value={option.type}
                                    onChange={(e) => handleUpdateOption(option.id, { type: e.target.value as any })}
                                    style={{ width: "100%", padding: "8px", borderRadius: "6px", border: "1px solid #babfc3", background: "#fff" }}
                                  >
                                    <option value="text">Single Line Text</option>
                                    <option value="select">Dropdown Menu</option>
                                    <option value="swatch">Color Swatches</option>
                                    <option value="file">Buyer Image Upload</option>
                                    <option value="checkbox">Checkbox Toggle</option>
                                  </select>
                                </div>
                              </div>

                              {/* Form row 2: Required & Upcharge */}
                              <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: "16px", marginBottom: "12px" }}>
                                <div style={{ display: "flex", alignItems: "center", gap: "8px" }}>
                                  <input
                                    type="checkbox"
                                    id={`required-${option.id}`}
                                    checked={option.required}
                                    onChange={(e) => handleUpdateOption(option.id, { required: e.target.checked })}
                                    style={{ width: "16px", height: "16px", accentColor: "#008060" }}
                                  />
                                  <label htmlFor={`required-${option.id}`} style={{ fontWeight: 600, fontSize: "13px", cursor: "pointer" }}>Is this field required?</label>
                                </div>
                                <div>
                                  <label style={{ display: "block", fontWeight: 600, fontSize: "13px", marginBottom: "4px" }}>Add-on / Upcharge Fee ($)</label>
                                  <input
                                    type="number"
                                    step="0.01"
                                    min="0"
                                    value={option.priceUpcharge}
                                    onChange={(e) => handleUpdateOption(option.id, { priceUpcharge: parseFloat(e.target.value) || 0 })}
                                    style={{ width: "100%", padding: "8px", borderRadius: "6px", border: "1px solid #babfc3" }}
                                    placeholder="0.00"
                                  />
                                </div>
                              </div>

                              {/* Form row 3: Type-specific config options */}
                              {option.type === "text" && (
                                <div style={{ borderTop: "1px dashed #e1e3e5", paddingTop: "12px" }}>
                                  <label style={{ display: "block", fontWeight: 600, fontSize: "13px", marginBottom: "4px" }}>Max Characters Limit</label>
                                  <input
                                    type="number"
                                    min="1"
                                    value={option.maxChars || 50}
                                    onChange={(e) => handleUpdateOption(option.id, { maxChars: parseInt(e.target.value) || 50 })}
                                    style={{ width: "100%", padding: "8px", borderRadius: "6px", border: "1px solid #babfc3" }}
                                  />
                                </div>
                              )}

                              {option.type === "select" && (
                                <div style={{ borderTop: "1px dashed #e1e3e5", paddingTop: "12px" }}>
                                  <label style={{ display: "block", fontWeight: 600, fontSize: "13px", marginBottom: "4px" }}>Dropdown Menu Options (comma-separated)</label>
                                  <input
                                    type="text"
                                    value={option.choices || ""}
                                    onChange={(e) => handleUpdateOption(option.id, { choices: e.target.value })}
                                    style={{ width: "100%", padding: "8px", borderRadius: "6px", border: "1px solid #babfc3" }}
                                    placeholder="Option A, Option B, Option C"
                                  />
                                </div>
                              )}

                              {option.type === "swatch" && (
                                <div style={{ borderTop: "1px dashed #e1e3e5", paddingTop: "12px" }}>
                                  <label style={{ display: "block", fontWeight: 600, fontSize: "13px", marginBottom: "4px" }}>Color List (comma-separated Hex values)</label>
                                  <input
                                    type="text"
                                    value={option.choices || ""}
                                    onChange={(e) => handleUpdateOption(option.id, { choices: e.target.value })}
                                    style={{ width: "100%", padding: "8px", borderRadius: "6px", border: "1px solid #babfc3" }}
                                    placeholder="#000000, #E63946, #457B9D"
                                  />
                                </div>
                              )}

                              {/* Conditional Logic Section */}
                              <div style={{ borderTop: "1px dashed #e1e3e5", marginTop: "16px", paddingTop: "12px" }}>
                                <span style={{ fontWeight: 700, fontSize: "13px", display: "block", marginBottom: "8px", color: "#2c6ecb" }}>
                                  Conditional Logic Rules (Only show if...)
                                </span>
                                
                                {(!option.conditionalRules || option.conditionalRules.length === 0) ? (
                                  <div style={{ fontSize: "12px", color: "#6d7175", fontStyle: "italic", marginBottom: "8px" }}>
                                    No rules configured. This option is always visible.
                                  </div>
                                ) : (
                                  <div style={{ display: "flex", flexDirection: "column", gap: "8px", marginBottom: "8px" }}>
                                    {option.conditionalRules.map((rule, ruleIdx) => (
                                      <div key={ruleIdx} style={{ display: "grid", gridTemplateColumns: "1.5fr 1fr 1.5fr auto", gap: "8px", alignItems: "center", background: "#f9fafb", padding: "8px", borderRadius: "6px" }}>
                                        {/* Parent Option Selector */}
                                        <select
                                          value={rule.fieldId}
                                          onChange={(e) => {
                                            const updatedRules = [...(option.conditionalRules || [])];
                                            updatedRules[ruleIdx].fieldId = e.target.value;
                                            handleUpdateOption(option.id, { conditionalRules: updatedRules });
                                          }}
                                          style={{ padding: "6px", borderRadius: "4px", border: "1px solid #babfc3", fontSize: "12px", background: "#fff" }}
                                        >
                                          <option value="">Select Option...</option>
                                          {options.filter(o => o.id !== option.id).map(o => (
                                            <option key={o.id} value={o.id}>{o.label}</option>
                                          ))}
                                        </select>

                                        {/* Operator Selector */}
                                        <select
                                          value={rule.operator}
                                          onChange={(e) => {
                                            const updatedRules = [...(option.conditionalRules || [])];
                                            updatedRules[ruleIdx].operator = e.target.value as any;
                                            handleUpdateOption(option.id, { conditionalRules: updatedRules });
                                          }}
                                          style={{ padding: "6px", borderRadius: "4px", border: "1px solid #babfc3", fontSize: "12px", background: "#fff" }}
                                        >
                                          <option value="equals">Equals</option>
                                          <option value="not_equals">Not Equals</option>
                                          <option value="checked">Checked</option>
                                          <option value="unchecked">Unchecked</option>
                                        </select>

                                        {/* Value Match */}
                                        <input
                                          type="text"
                                          value={rule.value}
                                          onChange={(e) => {
                                            const updatedRules = [...(option.conditionalRules || [])];
                                            updatedRules[ruleIdx].value = e.target.value;
                                            handleUpdateOption(option.id, { conditionalRules: updatedRules });
                                          }}
                                          placeholder="Value to match"
                                          disabled={rule.operator === "checked" || rule.operator === "unchecked"}
                                          style={{ padding: "6px", borderRadius: "4px", border: "1px solid #babfc3", fontSize: "12px" }}
                                        />

                                        {/* Delete Rule */}
                                        <button
                                          type="button"
                                          onClick={() => {
                                            const updatedRules = (option.conditionalRules || []).filter((_, idx) => idx !== ruleIdx);
                                            handleUpdateOption(option.id, { conditionalRules: updatedRules });
                                          }}
                                          style={{ background: "none", border: "none", color: "#d93838", cursor: "pointer", fontSize: "12px" }}
                                        >
                                          ❌
                                        </button>
                                      </div>
                                    ))}
                                  </div>
                                )}
                                
                                <button
                                  type="button"
                                  onClick={() => {
                                    const updatedRules = [...(option.conditionalRules || []), { fieldId: "", operator: "equals" as const, value: "" }];
                                    handleUpdateOption(option.id, { conditionalRules: updatedRules });
                                  }}
                                  style={{
                                    padding: "4px 8px",
                                    border: "1px dashed #2c6ecb",
                                    borderRadius: "4px",
                                    color: "#2c6ecb",
                                    background: "#ffffff",
                                    fontSize: "12px",
                                    fontWeight: 600,
                                    cursor: "pointer"
                                  }}
                                >
                                  ➕ Add Conditional Rule
                                </button>
                              </div>

                            </div>
                          ))}
                        </div>
                      )}
                    </div>
                  )}

                  <div style={{ marginTop: "24px" }}>
                    <s-button onClick={handleSave} variant="primary" {...(fetcher.state === "submitting" ? { loading: true } : {})}>
                      Save Dynamic Configuration
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
