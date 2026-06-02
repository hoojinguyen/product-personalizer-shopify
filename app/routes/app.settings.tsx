import { useLoaderData, useFetcher } from "react-router";
import type { LoaderFunctionArgs, ActionFunctionArgs } from "react-router";
import { authenticate } from "../shopify.server";
import db from "../db.server";
import { useEffect, useState } from "react";
import { useAppBridge } from "@shopify/app-bridge-react";

// Loader: Fetch or seed the global AppSettings for this shop
export const loader = async ({ request }: LoaderFunctionArgs) => {
  const { session } = await authenticate.admin(request);
  const shop = session.shop;

  let settings = await db.appSettings.findUnique({
    where: { shop }
  });

  if (!settings) {
    settings = await db.appSettings.create({
      data: {
        shop,
        layoutMode: "stacked",
        brandColor: "#008060",
        buttonColor: "#008060",
        buttonTextColor: "#ffffff",
        popupType: "partial",
        showQuantity: true,
        cartRedirect: "stay",
        exportFormat: "png",
        dpiResolution: 300,
        customCss: "",
        customJs: ""
      }
    });
  }

  return { settings };
};

// Action: Handle global settings updates
export const action = async ({ request }: ActionFunctionArgs) => {
  const { session } = await authenticate.admin(request);
  const shop = session.shop;

  const formData = await request.formData();
  const intent = formData.get("intent") as string;

  if (intent === "save_global_settings") {
    const layoutMode = formData.get("layoutMode") as string;
    const brandColor = formData.get("brandColor") as string;
    const buttonColor = formData.get("buttonColor") as string;
    const buttonTextColor = formData.get("buttonTextColor") as string;
    const popupType = formData.get("popupType") as string;
    const showQuantity = formData.get("showQuantity") === "true";
    const cartRedirect = formData.get("cartRedirect") as string;
    const exportFormat = formData.get("exportFormat") as string;
    const dpiResolution = parseInt(formData.get("dpiResolution") as string) || 300;
    const customCss = formData.get("customCss") as string;
    const customJs = formData.get("customJs") as string;

    const updated = await db.appSettings.update({
      where: { shop },
      data: {
        layoutMode,
        brandColor,
        buttonColor,
        buttonTextColor,
        popupType,
        showQuantity,
        cartRedirect,
        exportFormat,
        dpiResolution,
        customCss,
        customJs
      }
    });

    return { success: true, settings: updated };
  }

  return { error: "Unknown action intent" };
};

export default function AppSettingsPanel() {
  const { settings } = useLoaderData<typeof loader>();
  const fetcher = useFetcher<typeof action>();
  const shopify = useAppBridge();

  // State configurations
  const [layoutMode, setLayoutMode] = useState(settings.layoutMode);
  const [brandColor, setBrandColor] = useState(settings.brandColor);
  const [buttonColor, setButtonColor] = useState(settings.buttonColor);
  const [buttonTextColor, setButtonTextColor] = useState(settings.buttonTextColor);
  const [popupType, setPopupType] = useState(settings.popupType);
  const [showQuantity, setShowQuantity] = useState(settings.showQuantity);
  const [cartRedirect, setCartRedirect] = useState(settings.cartRedirect);
  const [exportFormat, setExportFormat] = useState(settings.exportFormat);
  const [dpiResolution, setDpiResolution] = useState(settings.dpiResolution);
  const [customCss, setCustomCss] = useState(settings.customCss || "");
  const [customJs, setCustomJs] = useState(settings.customJs || "");

  // Tab preview simulation helpers
  const [previewText, setPreviewText] = useState("Jane");
  const [previewColor, setPreviewColor] = useState("#000000");

  useEffect(() => {
    if (fetcher.data?.success) {
      shopify.toast.show("Global app settings saved successfully!");
    } else if (fetcher.data?.error) {
      shopify.toast.show(`Error saving: ${fetcher.data.error}`);
    }
  }, [fetcher.data, shopify]);

  const handleSave = () => {
    fetcher.submit(
      {
        intent: "save_global_settings",
        layoutMode,
        brandColor,
        buttonColor,
        buttonTextColor,
        popupType,
        showQuantity: String(showQuantity),
        cartRedirect,
        exportFormat,
        dpiResolution: String(dpiResolution),
        customCss,
        customJs
      },
      { method: "POST" }
    );
  };

  return (
    <s-page heading="Global App Settings">
      <s-section heading="Personalizer Preferences Console">
        <s-paragraph>
          Configure the default presentation style, shopper checkouts, image exports, and developer script overrides. These settings apply globally across all customizable products.
        </s-paragraph>

        <div style={{ display: "grid", gridTemplateColumns: "3fr 2fr", gap: "24px", marginTop: "24px" }}>
          
          {/* Settings Control Panel */}
          <div style={{ display: "flex", flexDirection: "column", gap: "20px" }}>
            
            {/* Theme Customizer & Aesthetics */}
            <s-box padding="base" borderRadius="base" borderWidth="base" background={"surface" as any}>
              <s-stack direction="block" gap={"small" as any}>
                <span style={{ fontSize: "16px", fontWeight: 700, display: "block", color: "#1a1a1a" }}>🎨 Styling & Color Palette</span>
                <s-paragraph>Establish the primary brand colors that appear on custom storefront controls.</s-paragraph>
                
                <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr 1fr", gap: "12px", marginTop: "8px" }}>
                  <div>
                    <label style={{ display: "block", fontSize: "12px", fontWeight: 600, marginBottom: "4px" }}>Brand Accent Color</label>
                    <div style={{ display: "flex", gap: "8px", alignItems: "center" }}>
                      <input type="color" value={brandColor} onChange={(e) => setBrandColor(e.target.value)} style={{ width: "35px", height: "30px", padding: 0, border: "none", cursor: "pointer", borderRadius: "4px" }} />
                      <input type="text" value={brandColor} onChange={(e) => setBrandColor(e.target.value)} style={{ width: "100%", padding: "6px", fontSize: "12px", border: "1px solid #babfc3", borderRadius: "4px" }} />
                    </div>
                  </div>
                  <div>
                    <label style={{ display: "block", fontSize: "12px", fontWeight: 600, marginBottom: "4px" }}>Button Background</label>
                    <div style={{ display: "flex", gap: "8px", alignItems: "center" }}>
                      <input type="color" value={buttonColor} onChange={(e) => setButtonColor(e.target.value)} style={{ width: "35px", height: "30px", padding: 0, border: "none", cursor: "pointer", borderRadius: "4px" }} />
                      <input type="text" value={buttonColor} onChange={(e) => setButtonColor(e.target.value)} style={{ width: "100%", padding: "6px", fontSize: "12px", border: "1px solid #babfc3", borderRadius: "4px" }} />
                    </div>
                  </div>
                  <div>
                    <label style={{ display: "block", fontSize: "12px", fontWeight: 600, marginBottom: "4px" }}>Button Text Color</label>
                    <div style={{ display: "flex", gap: "8px", alignItems: "center" }}>
                      <input type="color" value={buttonTextColor} onChange={(e) => setButtonTextColor(e.target.value)} style={{ width: "35px", height: "30px", padding: 0, border: "none", cursor: "pointer", borderRadius: "4px" }} />
                      <input type="text" value={buttonTextColor} onChange={(e) => setButtonTextColor(e.target.value)} style={{ width: "100%", padding: "6px", fontSize: "12px", border: "1px solid #babfc3", borderRadius: "4px" }} />
                    </div>
                  </div>
                </div>
              </s-stack>
            </s-box>

            {/* Customizer Layout Configs */}
            <s-box padding="base" borderRadius="base" borderWidth="base" background={"surface" as any}>
              <s-stack direction="block" gap={"small" as any}>
                <span style={{ fontSize: "16px", fontWeight: 700, display: "block", color: "#1a1a1a" }}>📐 Presentation Layout Mode</span>
                <s-paragraph>Choose the default layout format where customization fields render on storefront pages.</s-paragraph>
                
                <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: "16px", marginTop: "8px" }}>
                  <div>
                    <label style={{ display: "block", fontSize: "12px", fontWeight: 600, marginBottom: "4px" }}>Storefront Layout Mode</label>
                    <select
                      value={layoutMode}
                      onChange={(e) => setLayoutMode(e.target.value)}
                      style={{ width: "100%", padding: "8px", borderRadius: "6px", border: "1px solid #babfc3", background: "#fff" }}
                    >
                      <option value="stacked">Stacked Layout (Inline below price)</option>
                      <option value="tabs">Dynamic Tabs (Segments options)</option>
                      <option value="modal">Sleek Overlay Modal (Triggers overlay)</option>
                    </select>
                  </div>

                  <div>
                    <label style={{ display: "block", fontSize: "12px", fontWeight: 600, marginBottom: "4px" }}>Modal Dimensions</label>
                    <select
                      value={popupType}
                      onChange={(e) => setPopupType(e.target.value)}
                      style={{ width: "100%", padding: "8px", borderRadius: "6px", border: "1px solid #babfc3", background: "#fff" }}
                    >
                      <option value="partial">Partial Overlay Drawer (30% Width)</option>
                      <option value="full">Fullscreen Customizer Canvas (100% overlay)</option>
                    </select>
                  </div>
                </div>

                <div style={{ display: "flex", alignItems: "center", gap: "8px", marginTop: "10px", background: "#f9fafb", padding: "10px", borderRadius: "6px" }}>
                  <input
                    type="checkbox"
                    id="show-quantity"
                    checked={showQuantity}
                    onChange={(e) => setShowQuantity(e.target.checked)}
                    style={{ width: "16px", height: "16px", accentColor: "#008060", cursor: "pointer" }}
                  />
                  <label htmlFor="show-quantity" style={{ fontSize: "13px", fontWeight: 600, cursor: "pointer" }}>
                    Enable Inline Quantity Input inside Overlay Modal
                  </label>
                </div>
              </s-stack>
            </s-box>

            {/* Shopping Cart Actions & Post-Cart Redirection */}
            <s-box padding="base" borderRadius="base" borderWidth="base" background={"surface" as any}>
              <s-stack direction="block" gap={"small" as any}>
                <span style={{ fontSize: "16px", fontWeight: 700, display: "block", color: "#1a1a1a" }}>🛒 Add-to-Cart Post Action</span>
                <s-paragraph>Define what happens when a customer clicks the customizer checkout button.</s-paragraph>
                
                <div style={{ marginTop: "8px" }}>
                  <label style={{ display: "block", fontSize: "12px", fontWeight: 600, marginBottom: "4px" }}>Redirection Rule</label>
                  <select
                    value={cartRedirect}
                    onChange={(e) => setCartRedirect(e.target.value)}
                    style={{ width: "100%", padding: "8px", borderRadius: "6px", border: "1px solid #babfc3", background: "#fff" }}
                  >
                    <option value="stay">Stay on Product Page (Dynamic loading check)</option>
                    <option value="cart">Redirect to Cart Page (/cart)</option>
                    <option value="checkout">Redirect to Shopify Checkout Portal (Instantly)</option>
                  </select>
                </div>
              </s-stack>
            </s-box>

            {/* Print quality specs */}
            <s-box padding="base" borderRadius="base" borderWidth="base" background={"surface" as any}>
              <s-stack direction="block" gap={"small" as any}>
                <span style={{ fontSize: "16px", fontWeight: 700, display: "block", color: "#1a1a1a" }}>📄 High-Resolution Vector Export Specs</span>
                <s-paragraph>Control the files compiled during checkout webhook processes.</s-paragraph>
                
                <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: "16px", marginTop: "8px" }}>
                  <div>
                    <label style={{ display: "block", fontSize: "12px", fontWeight: 600, marginBottom: "4px" }}>Default Export Format</label>
                    <select
                      value={exportFormat}
                      onChange={(e) => setExportFormat(e.target.value)}
                      style={{ width: "100%", padding: "8px", borderRadius: "6px", border: "1px solid #babfc3", background: "#fff" }}
                    >
                      <option value="png">Transparent PNG (Raster high density)</option>
                      <option value="pdf">Vector PDF Layouts (Infinite scale)</option>
                      <option value="svg">Razor-sharp SVG (Self-contained vectors)</option>
                    </select>
                  </div>
                  <div>
                    <label style={{ display: "block", fontSize: "12px", fontWeight: 600, marginBottom: "4px" }}>Resolution Density (DPI)</label>
                    <input
                      type="number"
                      min="72"
                      max="600"
                      value={dpiResolution}
                      onChange={(e) => setDpiResolution(parseInt(e.target.value) || 300)}
                      style={{ width: "100%", padding: "8px", borderRadius: "6px", border: "1px solid #babfc3", background: "#fff" }}
                    />
                  </div>
                </div>
              </s-stack>
            </s-box>

            {/* Custom developer CSS/JS console overrides */}
            <s-box padding="base" borderRadius="base" borderWidth="base" background={"surface" as any}>
              <s-stack direction="block" gap={"small" as any}>
                <span style={{ fontSize: "16px", fontWeight: 700, display: "block", color: "#1a1a1a" }}>💻 Custom CSS / JS Overrides Console</span>
                <s-paragraph>Inject raw stylesheets or JavaScript tracking hooks directly into storefront pages.</s-paragraph>
                
                <div style={{ display: "flex", flexDirection: "column", gap: "12px", marginTop: "8px" }}>
                  <div>
                    <label style={{ display: "block", fontSize: "12px", fontWeight: 600, marginBottom: "4px" }}>Custom CSS Overrides</label>
                    <textarea
                      rows={4}
                      value={customCss}
                      onChange={(e) => setCustomCss(e.target.value)}
                      placeholder=".zepto-customizer-option { border-radius: 12px; }"
                      style={{ width: "100%", padding: "8px", borderRadius: "6px", border: "1px solid #babfc3", fontFamily: "monospace", fontSize: "12px", background: "#fff" }}
                    />
                  </div>
                  <div>
                    <label style={{ display: "block", fontSize: "12px", fontWeight: 600, marginBottom: "4px" }}>Custom JavaScript Triggers (Analytics / Pixel Fires)</label>
                    <textarea
                      rows={4}
                      value={customJs}
                      onChange={(e) => setCustomJs(e.target.value)}
                      placeholder="window.addEventListener('customizer:open', () => { console.log('Customizer Opened'); });"
                      style={{ width: "100%", padding: "8px", borderRadius: "6px", border: "1px solid #babfc3", fontFamily: "monospace", fontSize: "12px", background: "#fff" }}
                    />
                  </div>
                </div>
              </s-stack>
            </s-box>

            <div style={{ marginTop: "12px" }}>
              <s-button onClick={handleSave} variant="primary" {...(fetcher.state === "submitting" ? { loading: true } : {})}>
                Save Global Preferences
              </s-button>
            </div>

          </div>

          {/* RIGHT SIDE: Live Mockup preview widget */}
          <div>
            <div style={{ position: "sticky", top: "20px" }}>
              <span style={{ fontSize: "16px", fontWeight: 700, display: "block", color: "#1a1a1a", marginBottom: "8px" }}>👀 Widget Mockup Preview</span>
              <div style={{
                background: "#ffffff",
                border: "1px solid #e1e3e5",
                borderRadius: "12px",
                padding: "20px",
                boxShadow: "0 4px 12px rgba(0,0,0,0.05)"
              }}>
                {/* Form header */}
                <h4 style={{ fontSize: "16px", fontWeight: 700, borderBottom: `2px solid ${brandColor}`, paddingBottom: "8px", color: brandColor, margin: "0 0 16px 0" }}>
                  Personalize Your Item
                </h4>

                <div style={{ display: "flex", flexDirection: "column", gap: "16px" }}>
                  
                  {/* Field Option mock */}
                  <div>
                    <label style={{ display: "block", fontSize: "12px", fontWeight: 600, color: "#2c3e50", marginBottom: "4px" }}>
                      Engraving Initials <span style={{ color: "#d93838" }}>*</span>
                    </label>
                    <input
                      type="text"
                      value={previewText}
                      onChange={(e) => setPreviewText(e.target.value)}
                      style={{
                        width: "100%",
                        padding: "8px",
                        borderRadius: "6px",
                        border: "1px solid #babfc3"
                      }}
                    />
                  </div>

                  {/* Swatch options mock */}
                  <div>
                    <label style={{ display: "block", fontSize: "12px", fontWeight: 600, color: "#2c3e50", marginBottom: "6px" }}>
                      Text Coloring Style
                    </label>
                    <div style={{ display: "flex", gap: "10px" }}>
                      {["#000000", brandColor, "#457B9D"].map((c, idx) => (
                        <button
                          key={idx}
                          onClick={() => setPreviewColor(c)}
                          style={{
                            width: "28px",
                            height: "28px",
                            borderRadius: "50%",
                            border: previewColor === c ? `3px solid ${brandColor}` : "1px solid #d2d5d8",
                            background: c,
                            cursor: "pointer",
                            padding: 0
                          }}
                        />
                      ))}
                    </div>
                  </div>

                  {/* Mock live mockup render canvas preview */}
                  <div style={{
                    height: "150px",
                    border: "1px dashed #e1e3e5",
                    borderRadius: "8px",
                    background: "#fdfdfd",
                    display: "flex",
                    alignItems: "center",
                    justifyContent: "center",
                    position: "relative"
                  }}>
                    <span style={{
                      fontSize: "24px",
                      fontWeight: "bold",
                      color: previewColor,
                      fontFamily: "Arial, sans-serif"
                    }}>
                      {previewText || "Preview"}
                    </span>
                    <small style={{ position: "absolute", bottom: "6px", right: "6px", color: "#6d7175", fontSize: "9px" }}>
                      100x150 mockup preview
                    </small>
                  </div>

                  {/* Submit Button mock */}
                  <button
                    disabled
                    style={{
                      width: "100%",
                      padding: "10px",
                      background: buttonColor,
                      color: buttonTextColor,
                      border: "none",
                      borderRadius: "6px",
                      fontWeight: 600,
                      cursor: "default"
                    }}
                  >
                    Confirm Design & Add to Cart
                  </button>

                  <div style={{ fontSize: "11px", color: "#6d7175", textAlign: "center", fontStyle: "italic" }}>
                    Mockup renders according to your customization settings layout rules.
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
