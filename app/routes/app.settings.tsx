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
  const [swatchBorderColor, setSwatchBorderColor] = useState("#dddddd");
  const [activeSwatchBorderColor, setActiveSwatchBorderColor] = useState("#000000");
  const [activeSwatchBgColor, setActiveSwatchBgColor] = useState("#f0f0f0");

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

  // Helper to trigger save bar's change detector for Monaco Editors
  const dispatchFormChange = () => {
    const form = document.querySelector("form[data-save-bar]");
    if (form) {
      form.dispatchEvent(new Event("input", { bubbles: true }));
    }
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
    <s-page heading="App Personalization Preferences">
      <link rel="preconnect" href="https://fonts.googleapis.com" />
      <link rel="preconnect" href="https://fonts.gstatic.com" crossOrigin="anonymous" />
      <link href="https://fonts.googleapis.com/css2?family=Alex+Brush&family=Playfair+Display:ital@0;1&family=Roboto+Mono:wght@400;700&display=swap" rel="stylesheet" />

      <style>{`
        .category-item {
          display: block;
          width: 100%;
          text-align: left;
          background: none;
          border: none;
          padding: 10px 12px;
          border-radius: 6px;
          cursor: pointer;
          transition: all 0.15s ease;
          margin-bottom: 4px;
        }
        .category-item:hover {
          background: #f1f2f4;
        }
        .category-item.active {
          background: #e2f1eb;
          color: #006e52;
          font-weight: 600;
        }
        .category-name {
          font-size: 14px;
          display: block;
        }
        .category-desc {
          font-size: 11px;
          color: #6d7175;
          display: block;
          margin-top: 2px;
        }
        .preview-card {
          position: sticky;
          top: 20px;
        }
        .preview-header {
          display: flex;
          justify-content: space-between;
          align-items: center;
          margin-bottom: 16px;
        }
        .preview-title {
          font-size: 14px;
          font-weight: 700;
          color: #6d7175;
          text-transform: uppercase;
        }
        .mock-product-selector {
          display: flex;
          background: #f1f2f4;
          padding: 3px;
          border-radius: 6px;
          gap: 4px;
        }
        .mock-product-btn {
          border: none;
          background: none;
          font-size: 11px;
          padding: 4px 8px;
          border-radius: 4px;
          cursor: pointer;
          font-weight: 600;
        }
        .mock-product-btn.active {
          background: #ffffff;
          box-shadow: 0 1px 3px rgba(0,0,0,0.1);
        }
        .mock-canvas-container {
          height: 220px;
          border-radius: 8px;
          background-size: contain;
          background-repeat: no-repeat;
          background-position: center;
          background-color: #f7f8f9;
          display: flex;
          align-items: center;
          justify-content: center;
          position: relative;
          overflow: hidden;
          box-shadow: inset 0 0 10px rgba(0,0,0,0.02);
          margin-bottom: 16px;
        }
        .personalized-overlay-text {
          font-size: 20px;
          font-weight: bold;
          text-shadow: 0 1px 2px rgba(255,255,255,0.8);
          user-select: none;
          max-width: 150px;
          word-break: break-all;
          text-align: center;
        }
        .customizer-preview-widget {
          border-top: 1px solid #ebebeb;
          padding-top: 16px;
        }
        .widget-field-label {
          font-size: 12px;
          font-weight: 600;
          color: #2c3e50;
          margin-bottom: 4px;
          display: flex;
          justify-content: space-between;
        }
        .customizer-button {
          width: 100%;
          padding: 10px;
          border: none;
          border-radius: 6px;
          font-weight: 600;
          font-size: 13px;
          cursor: default;
          text-align: center;
          margin-top: 12px;
        }
        .widget-swatch-list {
          display: flex;
          gap: 6px;
          margin-top: 6px;
        }
        .widget-swatch-circle {
          width: 22px;
          height: 22px;
          border-radius: 50%;
          cursor: pointer;
          border: 1px solid #d2d5d8;
        }
        @media (max-width: 1200px) {
          s-page > s-grid {
            display: flex !important;
            flex-direction: column !important;
            gap: 16px !important;
          }
          .preview-card {
            position: static !important;
          }
        }
        .box-model-container {
          background: #f6f6f7;
          padding: 16px;
          border-radius: 8px;
          border: 1px solid #e1e3e5;
          margin-top: 8px;
        }
        .box-model-title {
          font-size: 13px;
          font-weight: 600;
          color: #202223;
          margin-bottom: 12px;
          display: block;
        }
        .box-model-grid {
          display: grid;
          grid-template-columns: 80px 80px 80px;
          grid-template-rows: auto auto auto;
          gap: 8px;
          align-items: center;
          justify-content: center;
        }
        .box-model-center {
          grid-column: 2;
          grid-row: 2;
          width: 100%;
          height: 48px;
          background: #ffffff;
          border: 1px dashed #008060;
          border-radius: 4px;
          display: flex;
          align-items: center;
          justify-content: center;
          font-size: 11px;
          color: #008060;
          font-weight: 600;
          text-transform: uppercase;
        }
        .box-model-cell-top {
          grid-column: 2;
          grid-row: 1;
        }
        .box-model-cell-left {
          grid-column: 1;
          grid-row: 2;
        }
        .box-model-cell-right {
          grid-column: 3;
          grid-row: 2;
        }
        .box-model-cell-bottom {
          grid-column: 2;
          grid-row: 3;
        }
      `}</style>

      {/* Main Settings Grid Layout */}
      <s-grid gridTemplateColumns="260px 1fr 340px" gap="base">
        
        {/* Category Navigation Sidebar */}
        <s-box padding="base" background="base" border="base" borderRadius="base">
          {categories.map((cat) => (
            <button
              key={cat.id}
              type="button"
              className={`category-item ${activeCategory === cat.id ? "active" : ""}`}
              onClick={() => setActiveCategory(cat.id)}
            >
              <span className="category-name">{cat.name}</span>
              <span className="category-desc">{cat.desc}</span>
            </button>
          ))}
        </s-box>

        {/* Central Settings Form Panel */}
        <s-box padding="base" background="base" border="base" borderRadius="base">
          <form
            data-save-bar
            onSubmit={(e) => {
              e.preventDefault();
              handleSave();
            }}
            onReset={(e) => {
              e.preventDefault();
              handleDiscard();
            }}
          >
            {/* Category: Installation */}
            <div style={{ display: activeCategory === "installation" ? "block" : "none" }}>
              <s-stack gap="base" direction="block">
                <s-heading>🔌 Active Integration & Theme Blocks</s-heading>
                <s-paragraph color="subdued">Verify your Shopify app block injection and theme status.</s-paragraph>
                <s-divider></s-divider>
                
                <s-box padding="base" background="subdued" border="base" borderRadius="base">
                  <s-stack direction="inline" gap="base" alignItems="center">
                    <s-text type="strong">Dawn Theme App Block integration</s-text>
                    <s-badge tone="success">Active</s-badge>
                  </s-stack>
                </s-box>

                <s-select
                  label="Selected Live Theme Directory"
                  name="theme"
                >
                  <s-option value="dawn">Dawn (Version 15.0.0 - Development Copy)</s-option>
                  <s-option value="spotlight">Spotlight (Version 12.1.0)</s-option>
                </s-select>

                <s-box padding="base" background="subdued" border="base" borderRadius="base">
                  <s-text type="strong">Theme Installation Instructions</s-text>
                  <s-paragraph color="subdued">
                    To load the personalization customizer onto your storefront, open the Shopify Theme Customizer, select your Product template, click &quot;Add block&quot; in the Product information section, and select &quot;Zepto Customizer Block&quot;. Save your changes.
                  </s-paragraph>
                </s-box>
              </s-stack>
            </div>

            {/* Category: Styling & Layout */}
            <div style={{ display: activeCategory === "styling" ? "block" : "none" }}>
              <s-stack gap="base" direction="block">
                <s-heading>🎨 Global Branding & Form Styling</s-heading>
                <s-paragraph color="subdued">Modify accent colors, margins, paddings, and font sizes.</s-paragraph>
                <s-divider></s-divider>

                <s-grid gridTemplateColumns="1fr 1fr" gap="base">
                  <s-color-field
                    label="Brand Accent Color"
                    name="brandColor"
                    value={brandColor}
                    onChange={(e) => setBrandColor((e.target as HTMLInputElement).value)}
                    details="Accent color for active indicators and links"
                  />
                  <s-color-field
                    label="Submit Button Background"
                    name="buttonColor"
                    value={buttonColor}
                    onChange={(e) => setButtonColor((e.target as HTMLInputElement).value)}
                    details="Background color of the storefront personalized button"
                  />
                  <s-color-field
                    label="Submit Button Text Color"
                    name="buttonTextColor"
                    value={buttonTextColor}
                    onChange={(e) => setButtonTextColor((e.target as HTMLInputElement).value)}
                    details="Text color on the storefront personalization button"
                  />
                  <s-color-field
                    label="Option Background Fill"
                    name="globalBgColor"
                    value={globalBgColor}
                    onChange={(e) => setGlobalBgColor((e.target as HTMLInputElement).value)}
                  />
                </s-grid>

                <s-switch
                  label="Enable Sticky Preview Drawer"
                  name="stickyPreview"
                  details="Float the widget preview at the screen bottom when scrolling past"
                  checked={stickyPreview}
                  onChange={(e) => setStickyPreview((e.target as HTMLInputElement).checked)}
                />

                <s-switch
                  label="Activate Zoom on Swatch Hover"
                  name="zoomHover"
                  details="Slightly zoom color and image swatches on pointer hover actions"
                  checked={zoomHover}
                  onChange={(e) => setZoomHover((e.target as HTMLInputElement).checked)}
                />

                <s-grid gridTemplateColumns="1fr 1fr" gap="base">
                  <s-select
                    label="Input Style Shape"
                    name="fieldStyle"
                    value={fieldStyle}
                    onChange={(e) => setFieldStyle((e.target as HTMLSelectElement).value)}
                  >
                    <s-option value="Normal">Normal Box (Sharp borders)</s-option>
                    <s-option value="Round">Round Box (Circular borders)</s-option>
                    <s-option value="Underline">Minimal Underline</s-option>
                  </s-select>
                  <s-select
                    label="Instruction Help Style"
                    name="instructionDisplayType"
                    value={instructionDisplayType}
                    onChange={(e) => setInstructionDisplayType((e.target as HTMLSelectElement).value)}
                  >
                    <s-option value="question">Question Mark Link</s-option>
                    <s-option value="tooltip">Sleek Info Tooltip</s-option>
                  </s-select>
                </s-grid>

                <div className="box-model-container">
                  <span className="box-model-title">Global Paddings</span>
                  <div className="box-model-grid">
                    <div className="box-model-cell-top">
                      <s-number-field label="Top" value={String(globalPaddingTop)} min={0} onChange={(e) => setGlobalPaddingTop(parseInt((e.target as HTMLInputElement).value) || 0)} suffix="px" />
                    </div>
                    <div className="box-model-cell-left">
                      <s-number-field label="Left" value={String(globalPaddingLeft)} min={0} onChange={(e) => setGlobalPaddingLeft(parseInt((e.target as HTMLInputElement).value) || 0)} suffix="px" />
                    </div>
                    <div className="box-model-center">
                      Padding
                    </div>
                    <div className="box-model-cell-right">
                      <s-number-field label="Right" value={String(globalPaddingRight)} min={0} onChange={(e) => setGlobalPaddingRight(parseInt((e.target as HTMLInputElement).value) || 0)} suffix="px" />
                    </div>
                    <div className="box-model-cell-bottom">
                      <s-number-field label="Bottom" value={String(globalPaddingBottom)} min={0} onChange={(e) => setGlobalPaddingBottom(parseInt((e.target as HTMLInputElement).value) || 0)} suffix="px" />
                    </div>
                  </div>
                </div>

                <div className="box-model-container">
                  <span className="box-model-title">Global Margins</span>
                  <div className="box-model-grid">
                    <div className="box-model-cell-top">
                      <s-number-field label="Top" value={String(globalMarginTop)} min={0} onChange={(e) => setGlobalMarginTop(parseInt((e.target as HTMLInputElement).value) || 0)} suffix="px" />
                    </div>
                    <div className="box-model-cell-left">
                      <s-number-field label="Left" value={String(globalMarginLeft)} min={0} onChange={(e) => setGlobalMarginLeft(parseInt((e.target as HTMLInputElement).value) || 0)} suffix="px" />
                    </div>
                    <div className="box-model-center" style={{ borderColor: "#2c3e50", color: "#2c3e50" }}>
                      Margin
                    </div>
                    <div className="box-model-cell-right">
                      <s-number-field label="Right" value={String(globalMarginRight)} min={0} onChange={(e) => setGlobalMarginRight(parseInt((e.target as HTMLInputElement).value) || 0)} suffix="px" />
                    </div>
                    <div className="box-model-cell-bottom">
                      <s-number-field label="Bottom" value={String(globalMarginBottom)} min={0} onChange={(e) => setGlobalMarginBottom(parseInt((e.target as HTMLInputElement).value) || 0)} suffix="px" />
                    </div>
                  </div>
                </div>
              </s-stack>
            </div>

            {/* Category: Popup Dimensions */}
            <div style={{ display: activeCategory === "popup" ? "block" : "none" }}>
              <s-stack gap="base" direction="block">
                <s-heading>📐 Storefront Presentation Layout Mode</s-heading>
                <s-paragraph color="subdued">Choose the default layout format where customization fields render.</s-paragraph>
                <s-divider></s-divider>

                <s-select
                  label="Presenter Layout Mode"
                  name="layoutMode"
                  value={layoutMode}
                  onChange={(e) => setLayoutMode((e.target as HTMLSelectElement).value)}
                >
                  <s-option value="stacked">Stacked Layout (Inline below price)</s-option>
                  <s-option value="tabs">Dynamic Tabs (Segmented layout)</s-option>
                  <s-option value="modal">Sleek Overlay Modal (Triggers screen overlay)</s-option>
                </s-select>

                {layoutMode === "modal" && (
                  <s-select
                    label="Modal Drawer Dimensions"
                    name="popupType"
                    value={popupType}
                    onChange={(e) => setPopupType((e.target as HTMLSelectElement).value)}
                  >
                    <s-option value="partial">Partial Overlay Drawer (30% Screen Width)</s-option>
                    <s-option value="full">Fullscreen Customizer Canvas (100% overlay)</s-option>
                  </s-select>
                )}

                <s-switch
                  label="Enable Inline Quantity Selector"
                  name="showQuantity"
                  details="Show product quantity box directly inside customizer modal controls"
                  checked={showQuantity}
                  onChange={(e) => setShowQuantity((e.target as HTMLInputElement).checked)}
                />
              </s-stack>
            </div>

            {/* Category: Text & Translations */}
            <div style={{ display: activeCategory === "text" ? "block" : "none" }}>
              <s-stack gap="base" direction="block">
                <s-heading>✍️ Text Validation & Translators</s-heading>
                <s-paragraph color="subdued">Configure character limits, placeholder rules, and translation text.</s-paragraph>
                <s-divider></s-divider>

                <s-text-field
                  label="Personalize Button Action Wording"
                  name="personalizeBtnText"
                  value={personalizeBtnText}
                  onChange={(e) => setPersonalizeBtnText((e.target as HTMLInputElement).value)}
                />

                <s-grid gridTemplateColumns="1fr 1fr" gap="base">
                  <s-text-field
                    label="Textarea Label"
                    name="engraveTextLabel"
                    value={engraveTextLabel}
                    onChange={(e) => setEngraveTextLabel((e.target as HTMLInputElement).value)}
                  />
                  <s-text-field
                    label="Instruction Wording"
                    name="instructionsText"
                    value={instructionsText}
                    onChange={(e) => setInstructionsText((e.target as HTMLInputElement).value)}
                  />
                </s-grid>

                <s-grid gridTemplateColumns="2fr 1fr" gap="base">
                  <s-text-field
                    label="Default Size Option Text"
                    name="selectSizeText"
                    value={selectSizeText}
                    onChange={(e) => setSelectSizeText((e.target as HTMLInputElement).value)}
                  />
                  <s-number-field
                    label="Character Limit"
                    name="charLimit"
                    value={String(charLimit)}
                    min={0}
                    onChange={(e) => setCharLimit(parseInt((e.target as HTMLInputElement).value) || 0)}
                  />
                </s-grid>
              </s-stack>
            </div>

            {/* Category: Image Upload */}
            <div style={{ display: activeCategory === "image" ? "block" : "none" }}>
              <s-stack gap="base" direction="block">
                <s-heading>🖼️ Custom Image Upload Restrictions</s-heading>
                <s-paragraph color="subdued">Define allowed file size, dimensions, and image extensions.</s-paragraph>
                <s-divider></s-divider>

                <s-select
                  label="Maximum Allowed File Size"
                  name="maxImageSize"
                  value={maxImageSize}
                  onChange={(e) => setMaxImageSize((e.target as HTMLSelectElement).value)}
                >
                  <s-option value="5MB">5 MB (Standard web quality)</s-option>
                  <s-option value="10MB">10 MB (High density prints)</s-option>
                  <s-option value="20MB">20 MB (Raw vectors)</s-option>
                </s-select>

                <s-box padding="base" background="subdued" border="base" borderRadius="base">
                  <s-stack gap="small" direction="block">
                    <s-text type="strong">Allowed Extensions</s-text>
                    <s-checkbox
                      label="JPEG (.jpg, .jpeg)"
                      name="allowedJpg"
                      checked={allowedJpg}
                      onChange={(e) => setAllowedJpg((e.target as HTMLInputElement).checked)}
                    />
                    <s-checkbox
                      label="PNG (.png - supports transparent backgrounds)"
                      name="allowedPng"
                      checked={allowedPng}
                      onChange={(e) => setAllowedPng((e.target as HTMLInputElement).checked)}
                    />
                    <s-checkbox
                      label="SVG (.svg - vector graphic inputs)"
                      name="allowedSvg"
                      checked={allowedSvg}
                      onChange={(e) => setAllowedSvg((e.target as HTMLInputElement).checked)}
                    />
                  </s-stack>
                </s-box>

                <s-select label="Minimum Dimension Check" value="500">
                  <s-option value="300">300 x 300 pixels</s-option>
                  <s-option value="500">500 x 500 pixels (Recommended)</s-option>
                  <s-option value="1000">1000 x 1000 pixels (High Definition)</s-option>
                </s-select>
              </s-stack>
            </div>

            {/* Category: Swatches */}
            <div style={{ display: activeCategory === "swatches" ? "block" : "none" }}>
              <s-stack gap="base" direction="block">
                <s-heading>🔴 Swatch Border & Hover Properties</s-heading>
                <s-paragraph color="subdued">Style storefront choices, color border wells, and select effects.</s-paragraph>
                <s-divider></s-divider>

                <s-grid gridTemplateColumns="1fr 1fr" gap="base">
                  <s-color-field
                    label="Swatch Border Color"
                    name="swatchBorderColor"
                    value={swatchBorderColor}
                    onChange={(e) => setSwatchBorderColor((e.target as HTMLInputElement).value)}
                  />
                  <s-color-field
                    label="Active Swatch Border Color"
                    name="activeSwatchBorderColor"
                    value={activeSwatchBorderColor}
                    onChange={(e) => setActiveSwatchBorderColor((e.target as HTMLInputElement).value)}
                  />
                  <s-color-field
                    label="Active Swatch Background"
                    name="activeSwatchBgColor"
                    value={activeSwatchBgColor}
                    onChange={(e) => setActiveSwatchBgColor((e.target as HTMLInputElement).value)}
                  />
                </s-grid>

                <s-select label="Active Choice Hover Interaction" value="zoom">
                  <s-option value="zoom">Magnify choice circular borders (Zoom)</s-option>
                  <s-option value="popover">Show popover details label on hover</s-option>
                </s-select>
              </s-stack>
            </div>

            {/* Category: Dropdowns & Checkboxes */}
            <div style={{ display: activeCategory === "dropdown" ? "block" : "none" }}>
              <s-stack gap="base" direction="block">
                <s-heading>🔘 Dropdown & Checkbox Layouts</s-heading>
                <s-paragraph color="subdued">Adjust the alignments and list spacings for selection rows.</s-paragraph>
                <s-divider></s-divider>

                <s-select
                  label="Dropdown Spacing Scale"
                  name="dropdownSpacing"
                  value={dropdownSpacing}
                  onChange={(e) => setDropdownSpacing((e.target as HTMLSelectElement).value)}
                >
                  <s-option value="compact">Compact (Tight grid rows)</s-option>
                  <s-option value="normal">Normal (Generous grid spaces)</s-option>
                  <s-option value="relaxed">Relaxed (Wide padding rows)</s-option>
                </s-select>

                <s-select
                  label="Options Grid Column Count"
                  name="optionsColumns"
                  value={optionsColumns}
                  onChange={(e) => setOptionsColumns((e.target as HTMLSelectElement).value)}
                >
                  <s-option value="1">1 Column (Vertical list stack)</s-option>
                  <s-option value="2">2 Columns (Side-by-side grid split)</s-option>
                  <s-option value="3">3 Columns (Multi-option dense row)</s-option>
                </s-select>
              </s-stack>
            </div>

            {/* Category: Add to Cart Settings */}
            <div style={{ display: activeCategory === "cart" ? "block" : "none" }}>
              <s-stack gap="base" direction="block">
                <s-heading>🛒 Add to Cart Checkout Behaviors</s-heading>
                <s-paragraph color="subdued">Define checkout redirection routing once options are submitted.</s-paragraph>
                <s-divider></s-divider>

                <s-select
                  label="Redirection Rule"
                  name="cartRedirect"
                  value={cartRedirect}
                  onChange={(e) => setCartRedirect((e.target as HTMLSelectElement).value)}
                >
                  <s-option value="stay">Stay on Product Page (Dynamic loading check)</s-option>
                  <s-option value="cart">Redirect to Cart Page (/cart)</s-option>
                  <s-option value="checkout">Redirect to Shopify Checkout Portal (Instantly)</s-option>
                </s-select>

                <s-text-field label="Spinner loader indicator wording" value="Adding to cart..." />
              </s-stack>
            </div>

            {/* Category: Export */}
            <div style={{ display: activeCategory === "export" ? "block" : "none" }}>
              <s-stack gap="base" direction="block">
                <s-heading>📄 High-Resolution Print Export Layouts</s-heading>
                <s-paragraph color="subdued">Specify format output vectors compiled on checkout backend webhooks.</s-paragraph>
                <s-divider></s-divider>

                <s-grid gridTemplateColumns="1fr 1fr" gap="base">
                  <s-select
                    label="Default Export Format"
                    name="exportFormat"
                    value={exportFormat}
                    onChange={(e) => setExportFormat((e.target as HTMLSelectElement).value)}
                  >
                    <s-option value="png">Transparent PNG (Raster high density)</s-option>
                    <s-option value="pdf">Vector PDF Layouts (Infinite scale)</s-option>
                    <s-option value="svg">Razor-sharp SVG (Self-contained vectors)</s-option>
                  </s-select>
                  <s-number-field
                    label="Resolution Density (DPI)"
                    name="dpiResolution"
                    value={String(dpiResolution)}
                    min={72}
                    max={600}
                    onChange={(e) => setDpiResolution(parseInt((e.target as HTMLInputElement).value) || 300)}
                  />
                </s-grid>
              </s-stack>
            </div>

            {/* Category: Pricing */}
            <div style={{ display: activeCategory === "pricing" ? "block" : "none" }}>
              <s-stack gap="base" direction="block">
                <s-heading>💰 Price Adjustments Formatting</s-heading>
                <s-paragraph color="subdued">Custom price formatting and template labels for upcharges.</s-paragraph>
                <s-divider></s-divider>

                <s-grid gridTemplateColumns="1fr 1fr" gap="base">
                  <s-text-field
                    label="Currency Wording Symbol"
                    name="currencySymbol"
                    value={currencySymbol}
                    onChange={(e) => setCurrencySymbol((e.target as HTMLInputElement).value)}
                  />
                  <s-select label="Upcharge Layout Badge" value="prefix">
                    <s-option value="prefix">Show upcharge inside choice tags (e.g. +$5.00)</s-option>
                    <s-option value="badge">Show upcharge in dedicated visual pill badge</s-option>
                  </s-select>
                </s-grid>

                <s-switch
                  label="Show Upcharges in Cart Line Items"
                  name="showUpchargeDetails"
                  details="List price changes explicitly as separate metadata fields in checkout"
                  checked={showUpchargeDetails}
                  onChange={(e) => setShowUpchargeDetails((e.target as HTMLInputElement).checked)}
                />
              </s-stack>
            </div>

            {/* Category: Custom CSS */}
            <div style={{ display: activeCategory === "css" ? "block" : "none" }}>
              <s-stack gap="base" direction="block">
                <s-heading>💻 Custom CSS Stylesheet Injection</s-heading>
                <s-paragraph color="subdued">Inject style rule overrides directly to storefront customization templates.</s-paragraph>
                <s-divider></s-divider>

                <s-text color="subdued">Custom CSS Editor (Monaco Editor)</s-text>
                <input type="hidden" name="customCss" value={customCss} />
                {mounted ? (
                  <s-box border="base" borderRadius="base" background="base">
                    <div style={{ borderRadius: "8px", overflow: "hidden" }}>
                      <Editor
                        height="300px"
                        language="css"
                        theme="vs-light"
                        value={customCss}
                        onChange={(val) => {
                          setCustomCss(val || "");
                          dispatchFormChange();
                        }}
                        options={{
                          minimap: { enabled: false },
                          fontSize: 12,
                          lineNumbers: "on",
                          scrollBeyondLastLine: false,
                          automaticLayout: true,
                        }}
                      />
                    </div>
                  </s-box>
                ) : (
                  <s-text-area
                    rows={8}
                    value={customCss}
                    onChange={(e) => setCustomCss((e.target as HTMLInputElement).value)}
                    placeholder=".zepto-customizer-btn { border-radius: 12px; }"
                  />
                )}
              </s-stack>
            </div>

            {/* Category: Custom JS */}
            <div style={{ display: activeCategory === "js" ? "block" : "none" }}>
              <s-stack gap="base" direction="block">
                <s-heading>⚙️ Custom JavaScript Callback Triggers</s-heading>
                <s-paragraph color="subdued">Inject custom pixel analytics hooks or dynamic events scripts.</s-paragraph>
                <s-divider></s-divider>

                <s-text color="subdued">Custom JS Editor (Monaco Editor)</s-text>
                <input type="hidden" name="customJs" value={customJs} />
                {mounted ? (
                  <s-box border="base" borderRadius="base" background="base">
                    <div style={{ borderRadius: "8px", overflow: "hidden" }}>
                      <Editor
                        height="300px"
                        language="javascript"
                        theme="vs-light"
                        value={customJs}
                        onChange={(val) => {
                          setCustomJs(val || "");
                          dispatchFormChange();
                        }}
                        options={{
                          minimap: { enabled: false },
                          fontSize: 12,
                          lineNumbers: "on",
                          scrollBeyondLastLine: false,
                          automaticLayout: true,
                        }}
                      />
                    </div>
                  </s-box>
                ) : (
                  <s-text-area
                    rows={8}
                    value={customJs}
                    onChange={(e) => setCustomJs((e.target as HTMLInputElement).value)}
                    placeholder="window.addEventListener('customizer:save', (e) => { console.log(e.detail); });"
                  />
                )}
              </s-stack>
            </div>

          </form>
        </s-box>

        {/* Right Side Storefront Customizer Live Preview Block */}
        <div className="preview-card">
          <s-box padding="base" background="base" border="base" borderRadius="base">
            <div className="preview-header">
              <span className="preview-title">Live Storefront Preview</span>
              <div className="mock-product-selector">
                <button
                  type="button"
                  className={`mock-product-btn ${mockProductType === "backpack" ? "active" : ""}`}
                  onClick={() => setMockProductType("backpack")}
                >
                  🎒 Backpack
                </button>
                <button
                  type="button"
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

              <s-stack gap="base" direction="block">
                {/* Size Select Mock */}
                <div>
                  <span className="widget-field-label">{selectSizeText}</span>
                  <s-button-group gap="base">
                    {["Small", "Medium", "Large"].map((size) => (
                      <button
                        key={size}
                        type="button"
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
                  </s-button-group>
                </div>

                {/* Text Area Customizer Option Mock */}
                <div>
                  <label className="widget-field-label" htmlFor="preview-engrave-text">
                    <span>{engraveTextLabel} <span style={{ color: "#d93838" }}>*</span></span>
                    <span style={{ fontSize: "10px", color: "#6d7175" }}>
                      {charLimit - previewText.length} characters left
                    </span>
                  </label>
                  <input
                    type="text"
                    id="preview-engrave-text"
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
                    onChange={(e) => setPreviewText((e.target as HTMLInputElement).value)}
                    placeholder={instructionsText}
                  />
                </div>

                {/* Font Selector Customizer Option Mock */}
                <div>
                  <label className="widget-field-label" htmlFor="preview-font-select">Select a Font</label>
                  <select id="preview-font-select" className="form-input" value={previewFont} onChange={(e) => setPreviewFont((e.target as HTMLSelectElement).value)}>
                    <option value="Arial">Sans-serif (Modern)</option>
                    <option value="Playfair">Playfair Serif (Classic)</option>
                    <option value="Alexbrush">Alex Brush Script (Cursive)</option>
                    <option value="Mono">Roboto Mono (Engraved style)</option>
                  </select>
                </div>

                {/* Text Color Choices Customizer Swatches Mock */}
                <div>
                  <span className="widget-field-label">Text Ink Color</span>
                  <div className="widget-swatch-list">
                    {["#000000", brandColor, "#4A90E2", "#E25A9E"].map((color) => (
                      <button
                        key={color}
                        type="button"
                        className="widget-swatch-circle"
                        onClick={() => setPreviewColor(color)}
                        style={{
                          backgroundColor: color,
                          border: previewColor === color ? `3px solid ${activeSwatchBorderColor}` : `1px solid ${swatchBorderColor}`,
                          transform: zoomHover && previewColor !== color ? "scale(0.95)" : "scale(1)"
                        }}
                      />
                    ))}
                  </div>
                </div>

                {/* Material Dropdown Mock */}
                <div>
                  <label className="widget-field-label" htmlFor="preview-material-select">Hardware Material</label>
                  <select id="preview-material-select" className="form-input" value={previewMaterial} onChange={(e) => setPreviewMaterial((e.target as HTMLSelectElement).value)}>
                    <option value="Wood">Eco Wood</option>
                    <option value="Brass">Polished Brass</option>
                    <option value="Silver">Sterling Silver</option>
                  </select>
                </div>

                {/* Submit Widget Button Mock */}
                <button
                  type="button"
                  className="customizer-button"
                  disabled
                  style={{
                    background: buttonColor,
                    color: buttonTextColor
                  }}
                >
                  {personalizeBtnText}
                </button>
              </s-stack>
            </div>
          </s-box>
        </div>

      </s-grid>
    </s-page>
  );
}
