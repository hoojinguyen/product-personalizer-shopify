import { useLoaderData, useFetcher } from "react-router";
import type { LoaderFunctionArgs, ActionFunctionArgs } from "react-router";
import { authenticate } from "../shopify.server";
import db from "../db.server";
import { useEffect, useState } from "react";
import { useAppBridge } from "@shopify/app-bridge-react";
import Editor from "@monaco-editor/react";

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

  const [mounted, setMounted] = useState(false);
  useEffect(() => {
    setMounted(true);
  }, []);

  // State configurations (Persisted in DB)
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

  // Category management
  const [activeCategory, setActiveCategory] = useState("styling");

  // Mock settings configuration states (UX Spec)
  const [fieldStyle, setFieldStyle] = useState("Normal");
  const [stickyPreview, setStickyPreview] = useState(true);
  const [zoomHover, setZoomHover] = useState(false);
  const [instructionDisplayType, setInstructionDisplayType] = useState("question");
  const [globalPaddingTop, setGlobalPaddingTop] = useState(0);
  const [globalPaddingBottom, setGlobalPaddingBottom] = useState(0);
  const [globalPaddingLeft, setGlobalPaddingLeft] = useState(0);
  const [globalPaddingRight, setGlobalPaddingRight] = useState(0);
  const [globalMarginTop, setGlobalMarginTop] = useState(0);
  const [globalMarginBottom, setGlobalMarginBottom] = useState(20);
  const [globalMarginLeft, setGlobalMarginLeft] = useState(0);
  const [globalMarginRight, setGlobalMarginRight] = useState(0);

  const [globalBgColor, setGlobalBgColor] = useState("#ffffff");
  const [globalLabelColor, setGlobalLabelColor] = useState("#000000");
  const [globalInputColor, setGlobalInputColor] = useState("#000000");
  const [globalBorderColor, setGlobalBorderColor] = useState("#dddddd");
  const [swatchBorderColor, setSwatchBorderColor] = useState("#dddddd");
  const [activeSwatchBorderColor, setActiveSwatchBorderColor] = useState("#000000");
  const [activeSwatchBgColor, setActiveSwatchBgColor] = useState("#f0f0f0");
  const [tooltipBgColor, setTooltipBgColor] = useState("#cccccc");
  const [tooltipIconColor, setTooltipIconColor] = useState("#3d4246");

  // Mock Text states
  const [personalizeBtnText, setPersonalizeBtnText] = useState("Personalize");
  const [instructionsText, setInstructionsText] = useState("What to engrave?");
  const [selectSizeText, setSelectSizeText] = useState("Select Size");
  const [engraveTextLabel, setEngraveTextLabel] = useState("Engrave Initials");
  const [charLimit, setCharLimit] = useState(20);

  // Mock Image specs
  const [maxImageSize, setMaxImageSize] = useState("10MB");
  const [allowedJpg, setAllowedJpg] = useState(true);
  const [allowedPng, setAllowedPng] = useState(true);
  const [allowedSvg, setAllowedSvg] = useState(false);

  // Mock Checkbox spacing
  const [dropdownSpacing, setDropdownSpacing] = useState("compact");
  const [optionsColumns, setOptionsColumns] = useState("1");

  // Mock Pricing format
  const [currencySymbol, setCurrencySymbol] = useState("$");
  const [showUpchargeDetails, setShowUpchargeDetails] = useState(true);

  // Storefront preview states
  const [previewText, setPreviewText] = useState("Amelia");
  const [previewColor, setPreviewColor] = useState("#000000");
  const [previewFont, setPreviewFont] = useState("Arial");
  const [previewSize, setPreviewSize] = useState("Medium");
  const [previewMaterial, setPreviewMaterial] = useState("Wood");
  const [mockProductType, setMockProductType] = useState("backpack");

  // Check dirty state
  const isDirty =
    layoutMode !== settings.layoutMode ||
    brandColor !== settings.brandColor ||
    buttonColor !== settings.buttonColor ||
    buttonTextColor !== settings.buttonTextColor ||
    popupType !== settings.popupType ||
    showQuantity !== settings.showQuantity ||
    cartRedirect !== settings.cartRedirect ||
    exportFormat !== settings.exportFormat ||
    dpiResolution !== settings.dpiResolution ||
    customCss !== (settings.customCss || "") ||
    customJs !== (settings.customJs || "");

  useEffect(() => {
    if (fetcher.data?.success) {
      shopify.toast.show("Global app settings saved successfully!");
    } else if (fetcher.data?.error) {
      shopify.toast.show(`Error saving settings: ${fetcher.data.error}`);
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

  const handleDiscard = () => {
    setLayoutMode(settings.layoutMode);
    setBrandColor(settings.brandColor);
    setButtonColor(settings.buttonColor);
    setButtonTextColor(settings.buttonTextColor);
    setPopupType(settings.popupType);
    setShowQuantity(settings.showQuantity);
    setCartRedirect(settings.cartRedirect);
    setExportFormat(settings.exportFormat);
    setDpiResolution(settings.dpiResolution);
    setCustomCss(settings.customCss || "");
    setCustomJs(settings.customJs || "");
    shopify.toast.show("Changes discarded.");
  };

  const categories = [
    { id: "installation", name: "🔌 Installation", desc: "Active themes & app blocks" },
    { id: "styling", name: "🎨 Styling & Layout", desc: "Accent colors, padding, margins" },
    { id: "popup", name: "📐 Popup Dimensions", desc: "Modal layout customization" },
    { id: "text", name: "✍️ Text & Translations", desc: "Labels, character limits, buttons" },
    { id: "image", name: "🖼️ Image Upload Specs", desc: "Upload size constraints & formats" },
    { id: "swatches", name: "🔴 Swatches & Choices", desc: "Border styles & hover details" },
    { id: "dropdown", name: "🔘 Dropdowns & Checkboxes", desc: "Spacings & layout alignments" },
    { id: "cart", name: "🛒 Add to Cart & Checkout", desc: "Redirects & checkout behaviors" },
    { id: "export", name: "📄 Export & DPI formats", desc: "Vector PDF & DPI resolution specs" },
    { id: "pricing", name: "💰 Additional Pricing", desc: "Price layouts & format templates" },
    { id: "css", name: "💻 Custom CSS Overrides", desc: "Monaco editor stylesheet injection" },
    { id: "js", name: "⚙️ Custom JS Callbacks", desc: "Monaco editor script tracking" }
  ];

  return (
    <div className="settings-page">
      <link rel="preconnect" href="https://fonts.googleapis.com" />
      <link rel="preconnect" href="https://fonts.gstatic.com" crossOrigin="anonymous" />
      <link href="https://fonts.googleapis.com/css2?family=Alex+Brush&family=Playfair+Display:ital@0;1&family=Roboto+Mono:wght@400;700&display=swap" rel="stylesheet" />


      {/* Page Header */}
      <div className="header-bar">
        <h1 className="header-title">App Personalization Preferences</h1>
        {!isDirty && (
          <button className="btn-action-primary" onClick={handleSave} disabled={fetcher.state === "submitting"}>
            {fetcher.state === "submitting" ? "Saving..." : "Save Preferences"}
          </button>
        )}
      </div>

      {/* Dirty state notification bar */}
      {isDirty && (
        <div className="dirty-alert-banner">
          <span>⚠️ You have unsaved configuration changes in your settings draft!</span>
          <div className="dirty-actions">
            <button className="btn-action-secondary" onClick={handleDiscard} disabled={fetcher.state === "submitting"}>
              Discard Changes
            </button>
            <button className="btn-action-primary" onClick={handleSave} disabled={fetcher.state === "submitting"}>
              {fetcher.state === "submitting" ? "Saving settings..." : "Save Configuration"}
            </button>
          </div>
        </div>
      )}

      {/* Main Settings Grid */}
      <div className="workspace-grid">
        
        {/* Category Navigation Sidebar */}
        <div className="sidebar-card">
          {categories.map((cat) => (
            <button
              key={cat.id}
              className={`category-item ${activeCategory === cat.id ? "active" : ""}`}
              onClick={() => setActiveCategory(cat.id)}
            >
              <span className="category-name">{cat.name}</span>
              <span className="category-desc">{cat.desc}</span>
            </button>
          ))}
        </div>

        {/* Central Settings Form Panel */}
        <div className="form-card">
          {activeCategory === "installation" && (
            <div>
              <h2 className="form-title">🔌 Active Integration & Theme Blocks</h2>
              <p className="form-desc">Verify your Shopify app block injection and theme status.</p>
              
              <div className="form-toggle-row">
                <div className="toggle-info">
                  <span className="toggle-title">Dawn Theme App Block integration</span>
                  <span className="toggle-desc">Theme app extensions blocks injected automatically in product layouts.</span>
                </div>
                <span style={{ background: "#e2f1eb", color: "#006e52", padding: "4px 8px", borderRadius: "4px", fontSize: "11px", fontWeight: "bold" }}>
                  ACTIVE
                </span>
              </div>

              <div className="form-group">
                <label className="form-label">Selected Live Theme Directory</label>
                <select className="form-input" style={{ width: "100%" }} defaultValue="dawn">
                  <option value="dawn">Dawn (Version 15.0.0 - Development Copy)</option>
                  <option value="spotlight">Spotlight (Version 12.1.0)</option>
                </select>
              </div>

              <div style={{ marginTop: "24px", background: "#f9fafb", border: "1px solid #ebebeb", padding: "16px", borderRadius: "8px" }}>
                <span style={{ fontWeight: 600, display: "block", marginBottom: "8px", fontSize: "13px" }}>Theme Installation Instructions</span>
                <span style={{ fontSize: "12px", color: "#6d7175", lineHeight: "1.5" }}>
                  To load the personalization customizer onto your storefront, open the Shopify Theme Customizer, select your Product template, click **"Add block"** in the Product information section, and select **"Zepto Customizer Block"**. Save your changes.
                </span>
              </div>
            </div>
          )}

          {activeCategory === "styling" && (
            <div>
              <h2 className="form-title">🎨 Global Branding & Form Styling</h2>
              <p className="form-desc">Modify accent colors, margins, paddings, and font sizes.</p>
              
              <div className="form-group">
                <span className="form-label">Color Swatches</span>
                <div className="grid-color-picker">
                  <div>
                    <label className="form-label" style={{ fontSize: "11px" }}>Brand Accent Color</label>
                    <div className="color-input-wrapper">
                      <input type="color" className="color-well" value={brandColor} onChange={(e) => setBrandColor(e.target.value)} />
                      <input type="text" className="form-input" value={brandColor} onChange={(e) => setBrandColor(e.target.value)} />
                    </div>
                  </div>
                  <div>
                    <label className="form-label" style={{ fontSize: "11px" }}>Submit Button Background</label>
                    <div className="color-input-wrapper">
                      <input type="color" className="color-well" value={buttonColor} onChange={(e) => setButtonColor(e.target.value)} />
                      <input type="text" className="form-input" value={buttonColor} onChange={(e) => setButtonColor(e.target.value)} />
                    </div>
                  </div>
                  <div>
                    <label className="form-label" style={{ fontSize: "11px" }}>Submit Button Text Color</label>
                    <div className="color-input-wrapper">
                      <input type="color" className="color-well" value={buttonTextColor} onChange={(e) => setButtonTextColor(e.target.value)} />
                      <input type="text" className="form-input" value={buttonTextColor} onChange={(e) => setButtonTextColor(e.target.value)} />
                    </div>
                  </div>
                  <div>
                    <label className="form-label" style={{ fontSize: "11px" }}>Option Background Fill</label>
                    <div className="color-input-wrapper">
                      <input type="color" className="color-well" value={globalBgColor} onChange={(e) => setGlobalBgColor(e.target.value)} />
                      <input type="text" className="form-input" value={globalBgColor} onChange={(e) => setGlobalBgColor(e.target.value)} />
                    </div>
                  </div>
                </div>
              </div>

              <div className="form-toggle-row">
                <div className="toggle-info">
                  <span className="toggle-title">Enable Sticky Preview Drawer</span>
                  <span className="toggle-desc">Float the widget preview at the screen bottom when scrolling past.</span>
                </div>
                <label className="switch-input">
                  <input type="checkbox" checked={stickyPreview} onChange={(e) => setStickyPreview(e.target.checked)} />
                  <span className="switch-slider"></span>
                </label>
              </div>

              <div className="form-toggle-row">
                <div className="toggle-info">
                  <span className="toggle-title">Activate Zoom on Swatch Hover</span>
                  <span className="toggle-desc">Slightly zoom color and image swatches on pointer hover actions.</span>
                </div>
                <label className="switch-input">
                  <input type="checkbox" checked={zoomHover} onChange={(e) => setZoomHover(e.target.checked)} />
                  <span className="switch-slider"></span>
                </label>
              </div>

              <div className="form-group" style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: "16px" }}>
                <div>
                  <label className="form-label">Input Style Shape</label>
                  <select className="form-input" value={fieldStyle} onChange={(e) => setFieldStyle(e.target.value)}>
                    <option value="Normal">Normal Box (Sharp borders)</option>
                    <option value="Round">Round Box (Circular borders)</option>
                    <option value="Underline">Minimal Underline</option>
                  </select>
                </div>
                <div>
                  <label className="form-label">Instruction Help Style</label>
                  <select className="form-input" value={instructionDisplayType} onChange={(e) => setInstructionDisplayType(e.target.value)}>
                    <option value="question">Question Mark Link</option>
                    <option value="tooltip">Sleek Info Tooltip</option>
                  </select>
                </div>
              </div>

              <div className="form-group">
                <label className="form-label">Global Paddings (Top / Right / Bottom / Left in px)</label>
                <div className="layout-box-grid">
                  <input type="number" className="form-input" value={globalPaddingTop} onChange={(e) => setGlobalPaddingTop(parseInt(e.target.value) || 0)} placeholder="Top" />
                  <input type="number" className="form-input" value={globalPaddingRight} onChange={(e) => setGlobalPaddingRight(parseInt(e.target.value) || 0)} placeholder="Right" />
                  <input type="number" className="form-input" value={globalPaddingBottom} onChange={(e) => setGlobalPaddingBottom(parseInt(e.target.value) || 0)} placeholder="Bottom" />
                  <input type="number" className="form-input" value={globalPaddingLeft} onChange={(e) => setGlobalPaddingLeft(parseInt(e.target.value) || 0)} placeholder="Left" />
                </div>
              </div>

              <div className="form-group">
                <label className="form-label">Global Margins (Top / Right / Bottom / Left in px)</label>
                <div className="layout-box-grid">
                  <input type="number" className="form-input" value={globalMarginTop} onChange={(e) => setGlobalMarginTop(parseInt(e.target.value) || 0)} placeholder="Top" />
                  <input type="number" className="form-input" value={globalMarginRight} onChange={(e) => setGlobalMarginRight(parseInt(e.target.value) || 0)} placeholder="Right" />
                  <input type="number" className="form-input" value={globalMarginBottom} onChange={(e) => setGlobalMarginBottom(parseInt(e.target.value) || 0)} placeholder="Bottom" />
                  <input type="number" className="form-input" value={globalMarginLeft} onChange={(e) => setGlobalMarginLeft(parseInt(e.target.value) || 0)} placeholder="Left" />
                </div>
              </div>
            </div>
          )}

          {activeCategory === "popup" && (
            <div>
              <h2 className="form-title">📐 Storefront Presentation layout mode</h2>
              <p className="form-desc">Choose the default layout format where customization fields render.</p>
              
              <div className="form-group">
                <label className="form-label">Presenter Layout Mode</label>
                <select className="form-input" value={layoutMode} onChange={(e) => setLayoutMode(e.target.value)}>
                  <option value="stacked">Stacked Layout (Inline below price)</option>
                  <option value="tabs">Dynamic Tabs (Segmented layout)</option>
                  <option value="modal">Sleek Overlay Modal (Triggers screen overlay)</option>
                </select>
              </div>

              {layoutMode === "modal" && (
                <div className="form-group">
                  <label className="form-label">Modal Drawer Dimensions</label>
                  <select className="form-input" value={popupType} onChange={(e) => setPopupType(e.target.value)}>
                    <option value="partial">Partial Overlay Drawer (30% Screen Width)</option>
                    <option value="full">Fullscreen Customizer Canvas (100% overlay)</option>
                  </select>
                </div>
              )}

              <div className="form-toggle-row">
                <div className="toggle-info">
                  <span className="toggle-title">Enable Inline Quantity Selector</span>
                  <span className="toggle-desc">Show product quantity box directly inside customizer modal controls.</span>
                </div>
                <label className="switch-input">
                  <input type="checkbox" checked={showQuantity} onChange={(e) => setShowQuantity(e.target.checked)} />
                  <span className="switch-slider"></span>
                </label>
              </div>
            </div>
          )}

          {activeCategory === "text" && (
            <div>
              <h2 className="form-title">✍️ Text Validation & Translators</h2>
              <p className="form-desc">Configure character limits, placeholder rules, and translation text.</p>
              
              <div className="form-group">
                <label className="form-label">Personalize Button Action wording</label>
                <input type="text" className="form-input" value={personalizeBtnText} onChange={(e) => setPersonalizeBtnText(e.target.value)} />
              </div>

              <div className="form-group" style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: "16px" }}>
                <div>
                  <label className="form-label">Textarea Label</label>
                  <input type="text" className="form-input" value={engraveTextLabel} onChange={(e) => setEngraveTextLabel(e.target.value)} />
                </div>
                <div>
                  <label className="form-label">Instruction Wording</label>
                  <input type="text" className="form-input" value={instructionsText} onChange={(e) => setInstructionsText(e.target.value)} />
                </div>
              </div>

              <div className="form-group" style={{ display: "grid", gridTemplateColumns: "2fr 1fr", gap: "16px" }}>
                <div>
                  <label className="form-label">Default Size option text</label>
                  <input type="text" className="form-input" value={selectSizeText} onChange={(e) => setSelectSizeText(e.target.value)} />
                </div>
                <div>
                  <label className="form-label">Character Limit</label>
                  <input type="number" className="form-input" value={charLimit} onChange={(e) => setCharLimit(parseInt(e.target.value) || 0)} />
                </div>
              </div>
            </div>
          )}

          {activeCategory === "image" && (
            <div>
              <h2 className="form-title">🖼️ Custom Image Upload Restrictions</h2>
              <p className="form-desc">Define allowed file size, dimensions, and image extensions.</p>

              <div className="form-group">
                <label className="form-label">Maximum Allowed File Size</label>
                <select className="form-input" value={maxImageSize} onChange={(e) => setMaxImageSize(e.target.value)}>
                  <option value="5MB">5 MB (Standard web quality)</option>
                  <option value="10MB">10 MB (High density prints)</option>
                  <option value="20MB">20 MB (Raw vectors)</option>
                </select>
              </div>

              <div className="form-group">
                <label className="form-label">Allowed Extensions</label>
                <div style={{ display: "flex", flexDirection: "column", gap: "10px", background: "#f9fafb", padding: "12px", borderRadius: "8px" }}>
                  <div style={{ display: "flex", alignItems: "center", gap: "8px" }}>
                    <input type="checkbox" checked={allowedJpg} id="jpg-check" onChange={(e) => setAllowedJpg(e.target.checked)} />
                    <label htmlFor="jpg-check" style={{ fontSize: "13px" }}>JPEG (.jpg, .jpeg)</label>
                  </div>
                  <div style={{ display: "flex", alignItems: "center", gap: "8px" }}>
                    <input type="checkbox" checked={allowedPng} id="png-check" onChange={(e) => setAllowedPng(e.target.checked)} />
                    <label htmlFor="png-check" style={{ fontSize: "13px" }}>PNG (.png - supports transparent backgrounds)</label>
                  </div>
                  <div style={{ display: "flex", alignItems: "center", gap: "8px" }}>
                    <input type="checkbox" checked={allowedSvg} id="svg-check" onChange={(e) => setAllowedSvg(e.target.checked)} />
                    <label htmlFor="svg-check" style={{ fontSize: "13px" }}>SVG (.svg - vector graphic inputs)</label>
                  </div>
                </div>
              </div>

              <div className="form-group">
                <label className="form-label">Minimum Dimension Check</label>
                <select className="form-input" defaultValue="500">
                  <option value="300">300 x 300 pixels</option>
                  <option value="500">500 x 500 pixels (Recommended)</option>
                  <option value="1000">1000 x 1000 pixels (High Definition)</option>
                </select>
              </div>
            </div>
          )}

          {activeCategory === "swatches" && (
            <div>
              <h2 className="form-title">🔴 Swatch border & hover properties</h2>
              <p className="form-desc">Style storefront choices, color border wells, and select effects.</p>

              <div className="form-group">
                <span className="form-label">Swatch Borders</span>
                <div className="grid-color-picker">
                  <div>
                    <label className="form-label" style={{ fontSize: "11px" }}>Swatch Border Color</label>
                    <div className="color-input-wrapper">
                      <input type="color" className="color-well" value={swatchBorderColor} onChange={(e) => setSwatchBorderColor(e.target.value)} />
                      <input type="text" className="form-input" value={swatchBorderColor} onChange={(e) => setSwatchBorderColor(e.target.value)} />
                    </div>
                  </div>
                  <div>
                    <label className="form-label" style={{ fontSize: "11px" }}>Active Swatch Border Color</label>
                    <div className="color-input-wrapper">
                      <input type="color" className="color-well" value={activeSwatchBorderColor} onChange={(e) => setActiveSwatchBorderColor(e.target.value)} />
                      <input type="text" className="form-input" value={activeSwatchBorderColor} onChange={(e) => setActiveSwatchBorderColor(e.target.value)} />
                    </div>
                  </div>
                  <div>
                    <label className="form-label" style={{ fontSize: "11px" }}>Active Swatch Background</label>
                    <div className="color-input-wrapper">
                      <input type="color" className="color-well" value={activeSwatchBgColor} onChange={(e) => setActiveSwatchBgColor(e.target.value)} />
                      <input type="text" className="form-input" value={activeSwatchBgColor} onChange={(e) => setActiveSwatchBgColor(e.target.value)} />
                    </div>
                  </div>
                </div>
              </div>

              <div className="form-group">
                <label className="form-label">Active Choice Hover Interaction</label>
                <select className="form-input" defaultValue="zoom">
                  <option value="zoom">Magnify choice circular borders (Zoom)</option>
                  <option value="popover">Show popover details label on hover</option>
                </select>
              </div>
            </div>
          )}

          {activeCategory === "dropdown" && (
            <div>
              <h2 className="form-title">🔘 Dropdown & Checkbox layouts</h2>
              <p className="form-desc">Adjust the alignments and list spacings for selection rows.</p>

              <div className="form-group">
                <label className="form-label">Dropdown Spacing Scale</label>
                <select className="form-input" value={dropdownSpacing} onChange={(e) => setDropdownSpacing(e.target.value)}>
                  <option value="compact">Compact (Tight grid rows)</option>
                  <option value="normal">Normal (Generous grid spaces)</option>
                  <option value="relaxed">Relaxed (Wide padding rows)</option>
                </select>
              </div>

              <div className="form-group">
                <label className="form-label">Options Grid Column Count</label>
                <select className="form-input" value={optionsColumns} onChange={(e) => setOptionsColumns(e.target.value)}>
                  <option value="1">1 Column (Vertical list stack)</option>
                  <option value="2">2 Columns (Side-by-side grid split)</option>
                  <option value="3">3 Columns (Multi-option dense row)</option>
                </select>
              </div>
            </div>
          )}

          {activeCategory === "cart" && (
            <div>
              <h2 className="form-title">🛒 Add to Cart checkout behaviors</h2>
              <p className="form-desc">Define checkout redirection routing once options are submitted.</p>

              <div className="form-group">
                <label className="form-label">Redirection Rule</label>
                <select className="form-input" value={cartRedirect} onChange={(e) => setCartRedirect(e.target.value)}>
                  <option value="stay">Stay on Product Page (Dynamic loading check)</option>
                  <option value="cart">Redirect to Cart Page (/cart)</option>
                  <option value="checkout">Redirect to Shopify Checkout Portal (Instantly)</option>
                </select>
              </div>

              <div className="form-group">
                <label className="form-label">Spinner loader indicator wording</label>
                <input type="text" className="form-input" defaultValue="Adding to cart..." />
              </div>
            </div>
          )}

          {activeCategory === "export" && (
            <div>
              <h2 className="form-title">📄 High-Resolution Print Export layouts</h2>
              <p className="form-desc">Specify format output vectors compiled on checkout backend webhooks.</p>

              <div className="form-group" style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: "16px" }}>
                <div>
                  <label className="form-label">Default Export format</label>
                  <select className="form-input" value={exportFormat} onChange={(e) => setExportFormat(e.target.value)}>
                    <option value="png">Transparent PNG (Raster high density)</option>
                    <option value="pdf">Vector PDF Layouts (Infinite scale)</option>
                    <option value="svg">Razor-sharp SVG (Self-contained vectors)</option>
                  </select>
                </div>
                <div>
                  <label className="form-label">Resolution Density (DPI)</label>
                  <input
                    type="number"
                    min="72"
                    max="600"
                    className="form-input"
                    value={dpiResolution}
                    onChange={(e) => setDpiResolution(parseInt(e.target.value) || 300)}
                  />
                </div>
              </div>
            </div>
          )}

          {activeCategory === "pricing" && (
            <div>
              <h2 className="form-title">💰 Price adjustments formatting</h2>
              <p className="form-desc">Custom price formatting and template labels for upcharges.</p>

              <div className="form-group" style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: "16px" }}>
                <div>
                  <label className="form-label">Currency Wording symbol</label>
                  <input type="text" className="form-input" value={currencySymbol} onChange={(e) => setCurrencySymbol(e.target.value)} />
                </div>
                <div>
                  <label className="form-label">Upcharge Layout badge</label>
                  <select className="form-input" defaultValue="prefix">
                    <option value="prefix">Show upcharge inside choice tags (e.g. +$5.00)</option>
                    <option value="badge">Show upcharge in dedicated visual pill badge</option>
                  </select>
                </div>
              </div>

              <div className="form-toggle-row">
                <div className="toggle-info">
                  <span className="toggle-title">Show Upcharges in Cart Line Items</span>
                  <span className="toggle-desc">List price changes explicitly as separate metadata fields in checkout.</span>
                </div>
                <label className="switch-input">
                  <input type="checkbox" checked={showUpchargeDetails} onChange={(e) => setShowUpchargeDetails(e.target.checked)} />
                  <span className="switch-slider"></span>
                </label>
              </div>
            </div>
          )}

          {activeCategory === "css" && (
            <div>
              <h2 className="form-title">💻 Custom CSS stylesheet injection</h2>
              <p className="form-desc">Inject style rule overrides directly to storefront customization templates.</p>
              
              <div className="form-group">
                <label className="form-label" style={{ marginBottom: "12px" }}>Custom CSS Editor (Monaco Editor)</label>
                {mounted ? (
                  <div style={{ border: "1px solid #babfc3", borderRadius: "8px", overflow: "hidden", boxShadow: "0 1px 3px rgba(0,0,0,0.05)" }}>
                    <Editor
                      height="300px"
                      language="css"
                      theme="vs-light"
                      value={customCss}
                      onChange={(val) => setCustomCss(val || "")}
                      options={{
                        minimap: { enabled: false },
                        fontSize: 12,
                        lineNumbers: "on",
                        scrollBeyondLastLine: false,
                        automaticLayout: true,
                      }}
                    />
                  </div>
                ) : (
                  <textarea
                    rows={8}
                    className="form-input"
                    style={{ fontFamily: "monospace" }}
                    value={customCss}
                    onChange={(e) => setCustomCss(e.target.value)}
                    placeholder=".zepto-customizer-btn { border-radius: 12px; }"
                  />
                )}
              </div>
            </div>
          )}

          {activeCategory === "js" && (
            <div>
              <h2 className="form-title">⚙️ Custom JavaScript callback triggers</h2>
              <p className="form-desc">Inject custom pixel analytics hooks or dynamic events scripts.</p>
              
              <div className="form-group">
                <label className="form-label" style={{ marginBottom: "12px" }}>Custom JS Editor (Monaco Editor)</label>
                {mounted ? (
                  <div style={{ border: "1px solid #babfc3", borderRadius: "8px", overflow: "hidden", boxShadow: "0 1px 3px rgba(0,0,0,0.05)" }}>
                    <Editor
                      height="300px"
                      language="javascript"
                      theme="vs-light"
                      value={customJs}
                      onChange={(val) => setCustomJs(val || "")}
                      options={{
                        minimap: { enabled: false },
                        fontSize: 12,
                        lineNumbers: "on",
                        scrollBeyondLastLine: false,
                        automaticLayout: true,
                      }}
                    />
                  </div>
                ) : (
                  <textarea
                    rows={8}
                    className="form-input"
                    style={{ fontFamily: "monospace" }}
                    value={customJs}
                    onChange={(e) => setCustomJs(e.target.value)}
                    placeholder="window.addEventListener('customizer:save', (e) => { console.log(e.detail); });"
                  />
                )}
              </div>
            </div>
          )}
        </div>

        {/* Right Side Storefront Customizer Live Preview Block */}
        <div className="preview-card">
          <div className="preview-header">
            <span className="preview-title">Live Storefront Preview</span>
            <div className="mock-product-selector">
              <button
                className={`mock-product-btn ${mockProductType === "backpack" ? "active" : ""}`}
                onClick={() => setMockProductType("backpack")}
              >
                🎒 Backpack
              </button>
              <button
                className={`mock-product-btn ${mockProductType === "mug" ? "active" : ""}`}
                onClick={() => setMockProductType("mug")}
              >
                ☕ Mug
              </button>
            </div>
          </div>

          {/* Interactive Rendering Canvas Mockup */}
          <div
            className="mock-canvas-container"
            style={{
              backgroundImage: mockProductType === "backpack" ? "url(/backpack_mockup.png)" : "url(/mug_mockup.png)"
            }}
          >
            {/* Position personalization text according to selected product type */}
            <div
              className="personalized-overlay-text"
              style={{
                color: previewColor,
                fontFamily: previewFont === "Alexbrush" ? "'Alex Brush', cursive" : previewFont === "Playfair" ? "'Playfair Display', serif" : previewFont === "Mono" ? "'Roboto Mono', monospace" : "Arial, sans-serif",
                transform: mockProductType === "backpack" 
                  ? "translateY(55px) translateX(2px) scale(0.85)" 
                  : "translateY(10px) translateX(-25px) scale(0.9)",
                opacity: previewText ? 1 : 0.4
              }}
            >
              {previewText || "Personalized Text"}
            </div>
          </div>

          {/* Customizer form inputs mockup widget */}
          <div className="customizer-preview-widget">
            <h4 style={{ fontSize: "14px", fontWeight: 700, borderBottom: `2px solid ${brandColor}`, paddingBottom: "6px", color: brandColor, margin: "0 0 12px 0" }}>
              Personalize Your Item
            </h4>

            <div style={{ display: "flex", flexDirection: "column", gap: "12px" }}>
              {/* Size Select Mock */}
              <div>
                <label className="widget-field-label">{selectSizeText}</label>
                <div style={{ display: "flex", gap: "8px" }}>
                  {["Small", "Medium", "Large"].map((size) => (
                    <button
                      key={size}
                      className="btn-action-secondary"
                      style={{
                        flex: 1,
                        padding: "6px 0",
                        fontSize: "11px",
                        background: previewSize === size ? brandColor : "#ffffff",
                        color: previewSize === size ? "#ffffff" : "#202223",
                        borderColor: previewSize === size ? brandColor : "#babfc3"
                      }}
                      onClick={() => setPreviewSize(size)}
                    >
                      {size}
                    </button>
                  ))}
                </div>
              </div>

              {/* Text Area Customizer Option Mock */}
              <div>
                <label className="widget-field-label">
                  <span>{engraveTextLabel} <span style={{ color: "#d93838" }}>*</span></span>
                  <span style={{ fontSize: "10px", color: "#6d7175" }}>
                    {charLimit - previewText.length} characters left
                  </span>
                </label>
                <input
                  type="text"
                  className="form-input"
                  style={{
                    borderRadius: fieldStyle === "Round" ? "20px" : "6px",
                    borderBottomWidth: fieldStyle === "Underline" ? "2px" : "1px",
                    borderLeft: fieldStyle === "Underline" ? "none" : "1px solid #babfc3",
                    borderRight: fieldStyle === "Underline" ? "none" : "1px solid #babfc3",
                    borderTop: fieldStyle === "Underline" ? "none" : "1px solid #babfc3",
                  }}
                  value={previewText}
                  maxLength={charLimit}
                  onChange={(e) => setPreviewText(e.target.value)}
                  placeholder={instructionsText}
                />
              </div>

              {/* Font Selector Customizer Option Mock */}
              <div>
                <label className="widget-field-label">Select a Font</label>
                <select className="form-input" value={previewFont} onChange={(e) => setPreviewFont(e.target.value)}>
                  <option value="Arial">Sans-serif (Modern)</option>
                  <option value="Playfair">Playfair Serif (Classic)</option>
                  <option value="Alexbrush">Alex Brush Script (Cursive)</option>
                  <option value="Mono">Roboto Mono (Engraved style)</option>
                </select>
              </div>

              {/* Text Color Choices Customizer Swatches Mock */}
              <div>
                <label className="widget-field-label">Text Ink Color</label>
                <div className="widget-swatch-list">
                  {["#000000", brandColor, "#4A90E2", "#E25A9E"].map((color) => (
                    <button
                      key={color}
                      className="widget-swatch-circle"
                      onClick={() => setPreviewColor(color)}
                      style={{
                        backgroundColor: color,
                        border: previewColor === color ? `3px solid ${activeSwatchBorderColor}` : `1px solid ${swatchBorderColor}`,
                        boxShadow: previewColor === color ? `0 0 0 1px ${activeSwatchBgColor}` : "none",
                        transform: zoomHover && previewColor !== color ? "scale(0.95)" : "scale(1)"
                      }}
                    />
                  ))}
                </div>
              </div>

              {/* Material Dropdown Mock */}
              <div>
                <label className="widget-field-label">Hardware Material</label>
                <select className="form-input" value={previewMaterial} onChange={(e) => setPreviewMaterial(e.target.value)}>
                  <option value="Wood">Eco Wood</option>
                  <option value="Brass">Polished Brass</option>
                  <option value="Silver">Sterling Silver</option>
                </select>
              </div>

              {/* Submit Widget Button Mock */}
              <button
                className="customizer-button"
                disabled
                style={{
                  background: buttonColor,
                  color: buttonTextColor
                }}
              >
                {personalizeBtnText}
              </button>
            </div>
          </div>
        </div>

      </div>
    </div>
  );
}
