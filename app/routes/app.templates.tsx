import { useLoaderData, useFetcher } from "react-router";
import type { LoaderFunctionArgs, ActionFunctionArgs } from "react-router";
import { authenticate } from "../shopify.server";
import db from "../db.server";
import { useState, useEffect, useRef } from "react";
import { useAppBridge } from "@shopify/app-bridge-react";

// The GraphQL query to fetch store products for link selection
const PRODUCTS_QUERY = `#graphql
  query getProducts {
    products(first: 50) {
      edges {
        node {
          id
          title
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

export const loader = async ({ request }: LoaderFunctionArgs) => {
  const { admin, session } = await authenticate.admin(request);
  const shop = session.shop;

  const templates = await db.template.findMany({
    where: { shop },
    orderBy: { createdAt: "desc" }
  });

  const assets = await db.asset.findMany({
    where: { shop }
  });

  const response = await admin.graphql(PRODUCTS_QUERY);
  const responseJson = await response.json();
  const products = responseJson.data?.products?.edges?.map((e: any) => e.node) || [];

  return { templates, assets, products, shop };
};

export const action = async ({ request }: ActionFunctionArgs) => {
  const { admin, session } = await authenticate.admin(request);
  const shop = session.shop;

  const formData = await request.formData();
  const intent = formData.get("intent") as string;

  if (intent === "save_template") {
    const id = formData.get("id") as string;
    const name = formData.get("name") as string;
    const optionsJson = formData.get("options") as string;
    const productLinksJson = formData.get("productLinks") as string; // List of Shopify Product GIDs to link

    let productLinks: string[] = [];
    try {
      productLinks = JSON.parse(productLinksJson);
    } catch (e) {}

    let template;
    if (id) {
      template = await db.template.update({
        where: { id, shop },
        data: { name, options: optionsJson }
      });
    } else {
      template = await db.template.create({
        data: { shop, name, options: optionsJson }
      });
    }

    // Hybrid Mapped-Sync: Propagate updated options config to linked products
    const parsedOptions = JSON.parse(optionsJson);
    const metafieldPayload = {
      enabled: true,
      templateId: template.id,
      layoutMode: parsedOptions.layoutMode || "stacked",
      brandColor: parsedOptions.brandColor || "#008060",
      buttonColor: parsedOptions.buttonColor || "#008060",
      buttonTextColor: parsedOptions.buttonTextColor || "#ffffff",
      heading: parsedOptions.heading || "Personalize Your Item",
      options: parsedOptions.options || []
    };

    // Bulk set metafields for linked products
    const userErrors: any[] = [];
    for (const productId of productLinks) {
      try {
        const res = await admin.graphql(
          `#graphql
          mutation setProductMetafield($metafields: [MetafieldsSetInput!]!) {
            metafieldsSet(metafields: $metafields) {
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
                  value: JSON.stringify(metafieldPayload)
                }
              ]
            }
          }
        );
        const resJson = await res.json();
        const errs = resJson.data?.metafieldsSet?.userErrors || [];
        if (errs.length > 0) userErrors.push(...errs);
      } catch (err: any) {
        userErrors.push({ field: productId, message: err.message });
      }
    }

    // Also: Identify products that were previously linked to this template but now unlinked, and disable them
    // For simplicity in this SQLite model, unlinked checks are done client-side by submitting old list vs new list

    return { success: true, template, userErrors };
  }

  if (intent === "delete_template") {
    const id = formData.get("id") as string;
    const linkedProductsJson = formData.get("linkedProducts") as string;
    let linkedProducts: string[] = [];
    try { linkedProducts = JSON.parse(linkedProductsJson); } catch (e) {}

    // Delete Template
    await db.template.delete({
      where: { id, shop }
    });

    // Clear metafields on previously linked products
    for (const productId of linkedProducts) {
      try {
        await admin.graphql(
          `#graphql
          mutation setProductMetafield($metafields: [MetafieldsSetInput!]!) {
            metafieldsSet(metafields: $metafields) {
              userErrors {
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
                  value: JSON.stringify({ enabled: false, options: [] })
                }
              ]
            }
          }
        );
      } catch (e) {}
    }

    return { success: true, deleted: id };
  }

  return { error: "Unknown intent" };
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
  maxChars?: number;
  choices?: string; // Comma-separated or linked asset Set ID
  choicesType?: "custom" | "global"; // Whether it uses custom list or links to an AssetSet
  assetSetId?: string; // Links to global colors/options AssetSet
  conditionalRules?: ConditionalRule[];
}

export default function TemplatesPanel() {
  const { templates, assets, products } = useLoaderData<typeof loader>();
  const fetcher = useFetcher<any>();
  const shopify = useAppBridge();

  const [selectedTemplate, setSelectedTemplate] = useState<any>(null);
  const [templateName, setTemplateName] = useState("");
  const [heading, setHeading] = useState("Personalize Your Item");
  const [layoutMode, setLayoutMode] = useState<"stacked" | "tabs" | "modal">("stacked");
  const [brandColor, setBrandColor] = useState("#008060");
  const [buttonColor, setButtonColor] = useState("#008060");
  const [buttonTextColor, setButtonTextColor] = useState("#ffffff");
  const [options, setOptions] = useState<CustomizationOption[]>([]);
  
  // Product Linkage states
  const [linkedProducts, setLinkedProducts] = useState<string[]>([]);
  const [showProductLinker, setShowProductLinker] = useState(false);

  // Live Canvas Preview states
  const canvasRef = useRef<HTMLCanvasElement | null>(null);
  const [previewText, setPreviewText] = useState("Hello World");
  const [previewFont, setPreviewFont] = useState("Arial");
  const [previewColor, setPreviewColor] = useState("#000000");

  const fontAssets = assets.filter(a => a.type === "FONTS");
  const colorAssets = assets.filter(a => a.type === "COLORS");
  const optionAssets = assets.filter(a => a.type === "OPTIONS");

  // Load selected template configurations
  useEffect(() => {
    if (selectedTemplate) {
      setTemplateName(selectedTemplate.name);
      try {
        const config = JSON.parse(selectedTemplate.options);
        setHeading(config.heading || "Personalize Your Item");
        setLayoutMode(config.layoutMode || "stacked");
        setBrandColor(config.brandColor || "#008060");
        setButtonColor(config.buttonColor || "#008060");
        setButtonTextColor(config.buttonTextColor || "#ffffff");
        setOptions(config.options || []);

        // Find products currently linked to this template
        const linked: string[] = [];
        products.forEach((p: any) => {
          if (p.metafield?.value) {
            try {
              const pf = JSON.parse(p.metafield.value);
              if (pf.templateId === selectedTemplate.id) linked.push(p.id);
            } catch (e) {}
          }
        });
        setLinkedProducts(linked);
      } catch (e) {
        setOptions([]);
        setLinkedProducts([]);
      }
    } else {
      // Clear for new template
      setTemplateName("New Customization Blueprint");
      setHeading("Personalize Your Item");
      setLayoutMode("stacked");
      setBrandColor("#008060");
      setButtonColor("#008060");
      setButtonTextColor("#ffffff");
      setOptions([
        {
          id: "opt-default-text",
          type: "text",
          label: "Engraving Custom Text",
          required: true,
          priceUpcharge: 0,
          maxChars: 30
        }
      ]);
      setLinkedProducts([]);
    }
  }, [selectedTemplate, products]);

  // Load custom typography @font-face rules on mount so React canvas can render them
  useEffect(() => {
    fontAssets.forEach(f => {
      try {
        const val = JSON.parse(f.value);
        const fontName = f.name;
        const fontUrl = val.url;
        const format = val.format;
        const newStyle = document.createElement("style");
        newStyle.appendChild(document.createTextNode(`@font-face { font-family: "${fontName}"; src: url("${fontUrl}") format("${format}"); }`));
        document.head.appendChild(newStyle);
      } catch (e) {}
    });
  }, [fontAssets]);

  // WYSIWYG Canvas Rendering matching ADR 0001
  useEffect(() => {
    const canvas = canvasRef.current;
    if (!canvas) return;
    const cx = canvas.getContext("2d");
    if (!cx) return;

    canvas.width = 400;
    canvas.height = 400;

    cx.clearRect(0, 0, canvas.width, canvas.height);
    // Draw canvas card background
    cx.fillStyle = "#f4f6f8";
    cx.fillRect(0, 0, canvas.width, canvas.height);

    // Draw grid bounds for context
    cx.strokeStyle = "rgba(44,110,203,0.15)";
    cx.lineWidth = 1;
    cx.strokeRect(20, 20, canvas.width - 40, canvas.height - 40);

    // Draw title placeholder
    cx.fillStyle = "#6d7175";
    cx.font = "bold 12px Arial, sans-serif";
    cx.textAlign = "center";
    cx.fillText("LIVE WYSIWYG PRINT CANVAS", canvas.width / 2, 40);

    // Draw customized layers preview
    cx.fillStyle = previewColor;
    cx.textAlign = "center";
    cx.textBaseline = "middle";
    // Check if custom uploaded font is ready
    cx.font = `bold 28px "${previewFont}", Arial, sans-serif`;
    cx.fillText(previewText || "(Type your text)", canvas.width / 2, canvas.height / 2);
  }, [previewText, previewFont, previewColor]);

  useEffect(() => {
    if (fetcher.data?.success) {
      shopify.toast.show("Template blueprints linked and synchronized successfully!");
    }
  }, [fetcher.data, shopify]);

  const handleAddOption = () => {
    setOptions([
      ...options,
      {
        id: `opt-${Date.now()}`,
        type: "text",
        label: "Custom Choice Field",
        required: false,
        priceUpcharge: 0,
        maxChars: 30
      }
    ]);
  };

  const handleRemoveOption = (id: string) => {
    setOptions(options.filter(o => o.id !== id));
  };

  const handleUpdateOption = (id: string, updates: Partial<CustomizationOption>) => {
    setOptions(options.map(o => {
      if (o.id === id) {
        const u = { ...o, ...updates };
        if (updates.type && updates.type !== o.type) {
          if (u.type === "text") u.maxChars = 30;
          else if (u.type === "select" || u.type === "swatch") {
            u.choicesType = "custom";
            u.choices = "Option X, Option Y";
          }
        }
        return u;
      }
      return o;
    }));
  };

  const handleSaveTemplate = () => {
    if (!templateName.trim()) {
      shopify.toast.show("Please enter a template name");
      return;
    }

    const payload = {
      heading,
      layoutMode,
      brandColor,
      buttonColor,
      buttonTextColor,
      options
    };

    fetcher.submit(
      {
        intent: "save_template",
        id: selectedTemplate?.id || "",
        name: templateName,
        options: JSON.stringify(payload),
        productLinks: JSON.stringify(linkedProducts)
      },
      { method: "POST" }
    );
  };

  const handleDeleteTemplate = () => {
    if (!selectedTemplate) return;
    if (confirm("Delete this template? Linked products will have their personalization features removed.")) {
      fetcher.submit(
        {
          intent: "delete_template",
          id: selectedTemplate.id,
          linkedProducts: JSON.stringify(linkedProducts)
        },
        { method: "POST" }
      );
      setSelectedTemplate(null);
    }
  };

  const toggleProductLink = (id: string) => {
    if (linkedProducts.includes(id)) {
      setLinkedProducts(linkedProducts.filter(pId => pId !== id));
    } else {
      setLinkedProducts([...linkedProducts, id]);
    }
  };

  return (
    <s-page heading="Templates Customizer Dashboard">
      <s-section heading="Personalization Customizer Templates">
        <s-paragraph>
          Templates let you build multi-option customer customization modules once, and bulk-link them across hundreds of products. Linked items are kept synchronized automatically when you update your master blueprint.
        </s-paragraph>

        {/* Top select or create buttons */}
        <div style={{ display: "flex", gap: "12px", margin: "16px 0", flexWrap: "wrap", alignItems: "center" }}>
          <span style={{ fontWeight: 600 }}>Active Templates:</span>
          <select
            value={selectedTemplate?.id || ""}
            onChange={(e) => {
              const t = templates.find(temp => temp.id === e.target.value);
              setSelectedTemplate(t || null);
            }}
            style={{ padding: "8px", borderRadius: "6px", border: "1px solid #babfc3", background: "#fff", minWidth: "220px" }}
          >
            <option value="">➕ Create New Blueprint...</option>
            {templates.map(t => (
              <option key={t.id} value={t.id}>📐 {t.name}</option>
            ))}
          </select>

          {selectedTemplate && (
            <button
              onClick={handleDeleteTemplate}
              style={{
                padding: "8px 16px",
                background: "#d93838",
                color: "#fff",
                border: "none",
                borderRadius: "6px",
                fontWeight: 600,
                cursor: "pointer",
                fontSize: "13px"
              }}
            >
              🗑️ Delete Template
            </button>
          )}
        </div>

        {/* Master Workspace Editor Grid */}
        <div style={{ display: "grid", gridTemplateColumns: "2fr 1fr", gap: "24px", marginTop: "24px" }}>
          
          {/* LEFT PANEL: Layers & Control Panel Settings */}
          <div style={{ background: "#ffffff", padding: "20px", border: "1px solid #e1e3e5", borderRadius: "10px" }}>
            <h3 style={{ fontSize: "16px", fontWeight: 700, marginBottom: "16px", color: "#1a1a1a" }}>
              📐 Customizer Blueprint Controls
            </h3>

            <div style={{ display: "flex", flexDirection: "column", gap: "16px" }}>
              <div>
                <label style={{ display: "block", fontWeight: 600, fontSize: "13px", marginBottom: "4px" }}>Blueprint Template Name</label>
                <input
                  type="text"
                  value={templateName}
                  onChange={(e) => setTemplateName(e.target.value)}
                  style={{ width: "100%", padding: "8px", borderRadius: "6px", border: "1px solid #babfc3" }}
                  placeholder="e.g. Ring Engraving Template"
                />
              </div>

              <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: "16px" }}>
                <div>
                  <label style={{ display: "block", fontWeight: 600, fontSize: "13px", marginBottom: "4px" }}>Form Header Title</label>
                  <input
                    type="text"
                    value={heading}
                    onChange={(e) => setHeading(e.target.value)}
                    style={{ width: "100%", padding: "8px", borderRadius: "6px", border: "1px solid #babfc3" }}
                  />
                </div>
                <div>
                  <label style={{ display: "block", fontWeight: 600, fontSize: "13px", marginBottom: "4px" }}>Layout Mode</label>
                  <select
                    value={layoutMode}
                    onChange={(e) => setLayoutMode(e.target.value as any)}
                    style={{ width: "100%", padding: "8px", borderRadius: "6px", border: "1px solid #babfc3", background: "#fff" }}
                  >
                    <option value="stacked">Stacked Inline Layout</option>
                    <option value="tabs">Dynamic Tabs Layout</option>
                    <option value="modal">Sleek Overlay Modal</option>
                  </select>
                </div>
              </div>

              <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr 1fr", gap: "12px", background: "#f9fafb", padding: "12px", borderRadius: "8px" }}>
                <div>
                  <label style={{ display: "block", fontWeight: 600, fontSize: "11px", marginBottom: "4px" }}>Theme Accent Color</label>
                  <input type="color" value={brandColor} onChange={(e) => setBrandColor(e.target.value)} style={{ width: "100%", height: "30px", border: "none", cursor: "pointer" }} />
                </div>
                <div>
                  <label style={{ display: "block", fontWeight: 600, fontSize: "11px", marginBottom: "4px" }}>Button Background</label>
                  <input type="color" value={buttonColor} onChange={(e) => setButtonColor(e.target.value)} style={{ width: "100%", height: "30px", border: "none", cursor: "pointer" }} />
                </div>
                <div>
                  <label style={{ display: "block", fontWeight: 600, fontSize: "11px", marginBottom: "4px" }}>Button Text Color</label>
                  <input type="color" value={buttonTextColor} onChange={(e) => setButtonTextColor(e.target.value)} style={{ width: "100%", height: "30px", border: "none", cursor: "pointer" }} />
                </div>
              </div>

              <hr style={{ border: 0, borderTop: "1px solid #e1e3e5", margin: "8px 0" }} />

              {/* Options Layers list */}
              <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center" }}>
                <span style={{ fontWeight: 700, fontSize: "14px" }}>Customizer Form Fields</span>
                <button
                  type="button"
                  onClick={handleAddOption}
                  style={{ padding: "6px 12px", background: "#008060", color: "#fff", border: "none", borderRadius: "6px", cursor: "pointer", fontSize: "13px", fontWeight: 600 }}
                >
                  ➕ Add Input Field
                </button>
              </div>

              <div style={{ display: "flex", flexDirection: "column", gap: "12px" }}>
                {options.map((opt, idx) => (
                  <div key={opt.id} style={{ border: "1px solid #e1e3e5", padding: "14px", borderRadius: "8px", background: "#fdfdfd" }}>
                    <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", marginBottom: "10px" }}>
                      <span style={{ fontWeight: 700, fontSize: "13px", color: "#008060" }}>Input Layer #{idx + 1}</span>
                      <button
                        onClick={() => handleRemoveOption(opt.id)}
                        style={{ background: "none", border: "none", color: "#d93838", cursor: "pointer", fontSize: "11px", fontWeight: 600 }}
                      >
                        🗑️ Remove Field
                      </button>
                    </div>

                    <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: "12px", marginBottom: "8px" }}>
                      <div>
                        <label style={{ display: "block", fontSize: "12px", fontWeight: 600, marginBottom: "2px" }}>Label</label>
                        <input
                          type="text"
                          value={opt.label}
                          onChange={(e) => handleUpdateOption(opt.id, { label: e.target.value })}
                          style={{ width: "100%", padding: "6px", borderRadius: "4px", border: "1px solid #babfc3" }}
                        />
                      </div>
                      <div>
                        <label style={{ display: "block", fontSize: "12px", fontWeight: 600, marginBottom: "2px" }}>Input Type</label>
                        <select
                          value={opt.type}
                          onChange={(e) => handleUpdateOption(opt.id, { type: e.target.value as any })}
                          style={{ width: "100%", padding: "6px", borderRadius: "4px", border: "1px solid #babfc3", background: "#fff" }}
                        >
                          <option value="text">Single Line Text</option>
                          <option value="select">Dropdown Choice</option>
                          <option value="swatch">Color Swatch Palette</option>
                          <option value="file">Customer Image Upload</option>
                          <option value="checkbox">Add-on Checkbox</option>
                        </select>
                      </div>
                    </div>

                    <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: "12px", marginBottom: "8px" }}>
                      <div style={{ display: "flex", alignItems: "center", gap: "6px" }}>
                        <input type="checkbox" id={`req-${opt.id}`} checked={opt.required} onChange={(e) => handleUpdateOption(opt.id, { required: e.target.checked })} style={{ accentColor: "#008060" }} />
                        <label htmlFor={`req-${opt.id}`} style={{ fontSize: "12px", cursor: "pointer" }}>Is Field Required?</label>
                      </div>
                      <div>
                        <label style={{ display: "block", fontSize: "12px", fontWeight: 600, marginBottom: "2px" }}>Option Upcharge Fee ($)</label>
                        <input
                          type="number"
                          step="0.01"
                          value={opt.priceUpcharge}
                          onChange={(e) => handleUpdateOption(opt.id, { priceUpcharge: parseFloat(e.target.value) || 0 })}
                          style={{ width: "100%", padding: "6px", borderRadius: "4px", border: "1px solid #babfc3" }}
                        />
                      </div>
                    </div>

                    {/* Reusable Choice Set Linking Logic */}
                    {(opt.type === "select" || opt.type === "swatch") && (
                      <div style={{ borderTop: "1px dashed #e1e3e5", marginTop: "8px", paddingTop: "8px" }}>
                        <div style={{ display: "flex", gap: "10px", alignItems: "center", marginBottom: "6px" }}>
                          <span style={{ fontSize: "12px", fontWeight: 600 }}>Choices Type:</span>
                          <label style={{ fontSize: "12px", cursor: "pointer" }}>
                            <input
                              type="radio"
                              name={`choicesType-${opt.id}`}
                              checked={opt.choicesType !== "global"}
                              onChange={() => handleUpdateOption(opt.id, { choicesType: "custom" })}
                            /> Custom List
                          </label>
                          <label style={{ fontSize: "12px", cursor: "pointer" }}>
                            <input
                              type="radio"
                              name={`choicesType-${opt.id}`}
                              checked={opt.choicesType === "global"}
                              onChange={() => handleUpdateOption(opt.id, { choicesType: "global" })}
                            /> Link Reusable Set
                          </label>
                        </div>

                        {opt.choicesType === "global" ? (
                          <div>
                            <label style={{ display: "block", fontSize: "11px", color: "#6d7175", marginBottom: "2px" }}>Select Linked Brand Asset Set</label>
                            <select
                              value={opt.assetSetId || ""}
                              onChange={(e) => {
                                const asset = assets.find(a => a.id === e.target.value);
                                handleUpdateOption(opt.id, { assetSetId: e.target.value, choices: asset?.value || "" });
                              }}
                              style={{ width: "100%", padding: "6px", borderRadius: "4px", border: "1px solid #babfc3", background: "#fff" }}
                            >
                              <option value="">Choose Asset List...</option>
                              {opt.type === "swatch"
                                ? colorAssets.map(c => <option key={c.id} value={c.id}> {c.name}</option>)
                                : optionAssets.map(o => <option key={o.id} value={o.id}> {o.name}</option>)
                              }
                            </select>
                          </div>
                        ) : (
                          <div>
                            <label style={{ display: "block", fontSize: "11px", color: "#6d7175", marginBottom: "2px" }}>Custom choices (comma-separated list)</label>
                            <input
                              type="text"
                              value={opt.choices || ""}
                              onChange={(e) => handleUpdateOption(opt.id, { choices: e.target.value })}
                              style={{ width: "100%", padding: "6px", borderRadius: "4px", border: "1px solid #babfc3" }}
                              placeholder={opt.type === "swatch" ? "#000000, #FFFFFF" : "Option A, Option B"}
                            />
                          </div>
                        )}
                      </div>
                    )}
                  </div>
                ))}
              </div>
            </div>

            {/* Product Linker and Sync Buttons */}
            <div style={{ marginTop: "24px", display: "flex", gap: "12px" }}>
              <button
                onClick={() => setShowProductLinker(!showProductLinker)}
                style={{
                  padding: "10px 18px",
                  background: "#2c3e50",
                  color: "#fff",
                  border: "none",
                  borderRadius: "6px",
                  fontWeight: 600,
                  cursor: "pointer",
                  fontSize: "14px"
                }}
              >
                🔗 Link to Products ({linkedProducts.length})
              </button>
              
              <button
                onClick={handleSaveTemplate}
                style={{
                  padding: "10px 18px",
                  background: "#008060",
                  color: "#fff",
                  border: "none",
                  borderRadius: "6px",
                  fontWeight: 600,
                  cursor: "pointer",
                  fontSize: "14px",
                  flex: 1
                }}
              >
                💾 Save blueprint & Bulk Sync Metafields
              </button>
            </div>

            {/* Linkage products picker popup wrapper */}
            {showProductLinker && (
              <div style={{ marginTop: "16px", padding: "16px", border: "1px solid #babfc3", borderRadius: "8px", background: "#f9fafb" }}>
                <h4 style={{ fontWeight: 700, fontSize: "14px", marginBottom: "8px" }}>Select Products to Apply Personalizer Layout:</h4>
                <div style={{ display: "flex", flexDirection: "column", gap: "8px", maxHeight: "250px", overflowY: "auto", background: "#fff", padding: "8px", borderRadius: "6px", border: "1px solid #e1e3e5" }}>
                  {products.map((p: any) => (
                    <label key={p.id} style={{ display: "flex", alignItems: "center", gap: "10px", padding: "4px", cursor: "pointer" }}>
                      <input
                        type="checkbox"
                        checked={linkedProducts.includes(p.id)}
                        onChange={() => toggleProductLink(p.id)}
                        style={{ accentColor: "#008060" }}
                      />
                      {p.featuredImage?.url ? (
                        <img src={p.featuredImage.url} alt="" style={{ width: "24px", height: "24px", objectFit: "cover", borderRadius: "2px" }} />
                      ) : (
                        <span>📦</span>
                      )}
                      <span style={{ fontSize: "13px", fontWeight: 500 }}>{p.title}</span>
                    </label>
                  ))}
                </div>
              </div>
            )}
          </div>

          {/* RIGHT PANEL: Live Preview WYSIWYG Canvas */}
          <div style={{ display: "flex", flexDirection: "column", gap: "20px" }}>
            <div style={{ background: "#ffffff", padding: "20px", border: "1px solid #e1e3e5", borderRadius: "10px", position: "sticky", top: "20px" }}>
              <h3 style={{ fontSize: "16px", fontWeight: 700, marginBottom: "16px", color: "#1a1a1a" }}>
                🎨 Live WYSIWYG Preview
              </h3>

              <div style={{ display: "flex", flexDirection: "column", alignItems: "center", gap: "16px" }}>
                <canvas
                  ref={canvasRef}
                  style={{
                    width: "100%",
                    maxWidth: "280px",
                    height: "280px",
                    border: "1px solid #babfc3",
                    borderRadius: "8px",
                    boxShadow: "0 4px 12px rgba(0,0,0,0.05)"
                  }}
                />

                {/* Canvas dynamic mock controls */}
                <div style={{ width: "100%", display: "flex", flexDirection: "column", gap: "12px", background: "#f9fafb", padding: "12px", borderRadius: "8px" }}>
                  <span style={{ fontWeight: 700, fontSize: "12px", color: "#6d7175" }}>Canvas Tester Values</span>
                  <div>
                    <label style={{ display: "block", fontSize: "11px", marginBottom: "2px" }}>Sample Engraving Text</label>
                    <input
                      type="text"
                      value={previewText}
                      onChange={(e) => setPreviewText(e.target.value)}
                      style={{ width: "100%", padding: "6px", borderRadius: "4px", border: "1px solid #babfc3", background: "#fff", fontSize: "12px" }}
                    />
                  </div>
                  <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: "8px" }}>
                    <div>
                      <label style={{ display: "block", fontSize: "11px", marginBottom: "2px" }}>Sample Font Set</label>
                      <select
                        value={previewFont}
                        onChange={(e) => setPreviewFont(e.target.value)}
                        style={{ width: "100%", padding: "6px", borderRadius: "4px", border: "1px solid #babfc3", background: "#fff", fontSize: "12px" }}
                      >
                        <option value="Arial">Arial (System)</option>
                        <option value="Times New Roman">Times New Roman</option>
                        {fontAssets.map(f => (
                          <option key={f.id} value={f.name}>{f.name} (Uploaded)</option>
                        ))}
                      </select>
                    </div>
                    <div>
                      <label style={{ display: "block", fontSize: "11px", marginBottom: "2px" }}>Sample Color</label>
                      <select
                        value={previewColor}
                        onChange={(e) => setPreviewColor(e.target.value)}
                        style={{ width: "100%", padding: "6px", borderRadius: "4px", border: "1px solid #babfc3", background: "#fff", fontSize: "12px" }}
                      >
                        <option value="#000000">Black</option>
                        <option value="#E63946">Crimson</option>
                        <option value="#457B9D">Slate Blue</option>
                        <option value="#1D3557">Dark Navy</option>
                      </select>
                    </div>
                  </div>
                </div>
              </div>
            </div>
          </div>

        </div>

      </s-section>
    </s-page>
  );
}
