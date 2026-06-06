import { useLoaderData, useFetcher } from "react-router";
import type { LoaderFunctionArgs, ActionFunctionArgs } from "react-router";
import { authenticate } from "../shopify.server";
import db from "../db.server";
import { useEffect, useState } from "react";
import { useAppBridge } from "@shopify/app-bridge-react";
import { SettingsSidebar } from "../components/settings/SettingsSidebar";
import { SettingsForm } from "../components/settings/SettingsForm";
import { StorefrontPreview } from "../components/settings/StorefrontPreview";
import { useLayoutContext } from "../components/layout";

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
  const { updateSaveBar } = useLayoutContext();

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

  // Compute whether form is dirty vs persisted settings
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

  const isSaving = fetcher.state === "submitting";


  // Update save bar whenever dirty state changes
  useEffect(() => {
    updateSaveBar(
      isDirty
        ? { isDirty: true, onSave: handleSave, onDiscard: handleDiscard, isSaving }
        : undefined
    );
  }, [isDirty, isSaving]);

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
        .form-input {
          width: 100%;
          padding: 8px 12px;
          font-size: 13px;
          border: 1px solid #babfc3;
          border-radius: 6px;
          outline: none;
          background-color: #ffffff;
          color: #202223;
          transition: border-color 0.15s ease, box-shadow 0.15s ease;
          box-sizing: border-box;
        }
        .form-input:focus {
          border-color: #008060;
          box-shadow: 0 0 0 2px rgba(0, 128, 96, 0.15);
        }
        .btn-action-secondary {
          border: 1px solid #babfc3;
          border-radius: 6px;
          background: #ffffff;
          color: #202223;
          font-weight: 500;
          cursor: pointer;
          transition: all 0.15s ease;
        }
        .btn-action-secondary:hover {
          background: #f6f6f7;
          border-color: #8c9196;
        }
      `}</style>

      {/* Main Settings Grid Layout */}
      <s-grid gridTemplateColumns="260px 1fr 340px" gap="base">
        
        {/* Category Navigation Sidebar */}
        <SettingsSidebar
          categories={categories}
          activeCategory={activeCategory}
          setActiveCategory={setActiveCategory}
        />

        {/* Central Settings Form Panel */}
        <SettingsForm
          activeCategory={activeCategory}
          layoutMode={layoutMode}
          setLayoutMode={setLayoutMode}
          brandColor={brandColor}
          setBrandColor={setBrandColor}
          buttonColor={buttonColor}
          setButtonColor={setButtonColor}
          buttonTextColor={buttonTextColor}
          setButtonTextColor={setButtonTextColor}
          globalBgColor={globalBgColor}
          setGlobalBgColor={setGlobalBgColor}
          stickyPreview={stickyPreview}
          setStickyPreview={setStickyPreview}
          zoomHover={zoomHover}
          setZoomHover={setZoomHover}
          fieldStyle={fieldStyle}
          setFieldStyle={setFieldStyle}
          instructionDisplayType={instructionDisplayType}
          setInstructionDisplayType={setInstructionDisplayType}
          globalPaddingTop={globalPaddingTop}
          setGlobalPaddingTop={setGlobalPaddingTop}
          globalPaddingBottom={globalPaddingBottom}
          setGlobalPaddingBottom={setGlobalPaddingBottom}
          globalPaddingLeft={globalPaddingLeft}
          setGlobalPaddingLeft={setGlobalPaddingLeft}
          globalPaddingRight={globalPaddingRight}
          setGlobalPaddingRight={setGlobalPaddingRight}
          globalMarginTop={globalMarginTop}
          setGlobalMarginTop={setGlobalMarginTop}
          globalMarginBottom={globalMarginBottom}
          setGlobalMarginBottom={setGlobalMarginBottom}
          globalMarginLeft={globalMarginLeft}
          setGlobalMarginLeft={setGlobalMarginLeft}
          globalMarginRight={globalMarginRight}
          setGlobalMarginRight={setGlobalMarginRight}
          popupType={popupType}
          setPopupType={setPopupType}
          showQuantity={showQuantity}
          setShowQuantity={setShowQuantity}
          personalizeBtnText={personalizeBtnText}
          setPersonalizeBtnText={setPersonalizeBtnText}
          engraveTextLabel={engraveTextLabel}
          setEngraveTextLabel={setEngraveTextLabel}
          instructionsText={instructionsText}
          setInstructionsText={setInstructionsText}
          selectSizeText={selectSizeText}
          setSelectSizeText={setSelectSizeText}
          charLimit={charLimit}
          setCharLimit={setCharLimit}
          maxImageSize={maxImageSize}
          setMaxImageSize={setMaxImageSize}
          allowedJpg={allowedJpg}
          setAllowedJpg={setAllowedJpg}
          allowedPng={allowedPng}
          setAllowedPng={setAllowedPng}
          allowedSvg={allowedSvg}
          setAllowedSvg={setAllowedSvg}
          swatchBorderColor={swatchBorderColor}
          setSwatchBorderColor={setSwatchBorderColor}
          activeSwatchBorderColor={activeSwatchBorderColor}
          setActiveSwatchBorderColor={setActiveSwatchBorderColor}
          activeSwatchBgColor={activeSwatchBgColor}
          setActiveSwatchBgColor={setActiveSwatchBgColor}
          dropdownSpacing={dropdownSpacing}
          setDropdownSpacing={setDropdownSpacing}
          optionsColumns={optionsColumns}
          setOptionsColumns={setOptionsColumns}
          cartRedirect={cartRedirect}
          setCartRedirect={setCartRedirect}
          exportFormat={exportFormat}
          setExportFormat={setExportFormat}
          dpiResolution={dpiResolution}
          setDpiResolution={setDpiResolution}
          currencySymbol={currencySymbol}
          setCurrencySymbol={setCurrencySymbol}
          showUpchargeDetails={showUpchargeDetails}
          setShowUpchargeDetails={setShowUpchargeDetails}
          customCss={customCss}
          setCustomCss={setCustomCss}
          customJs={customJs}
          setCustomJs={setCustomJs}
          mounted={mounted}
          handleSave={handleSave}
          handleDiscard={handleDiscard}
          dispatchFormChange={dispatchFormChange}
        />

        {/* Right Side Storefront Customizer Live Preview Block */}
        <StorefrontPreview
          mockProductType={mockProductType}
          setMockProductType={setMockProductType}
          previewColor={previewColor}
          setPreviewColor={setPreviewColor}
          previewFont={previewFont}
          setPreviewFont={setPreviewFont}
          previewText={previewText}
          setPreviewText={setPreviewText}
          brandColor={brandColor}
          selectSizeText={selectSizeText}
          previewSize={previewSize}
          setPreviewSize={setPreviewSize}
          engraveTextLabel={engraveTextLabel}
          charLimit={charLimit}
          instructionsText={instructionsText}
          previewMaterial={previewMaterial}
          setPreviewMaterial={setPreviewMaterial}
          activeSwatchBorderColor={activeSwatchBorderColor}
          swatchBorderColor={swatchBorderColor}
          zoomHover={zoomHover}
          fieldStyle={fieldStyle}
          buttonColor={buttonColor}
          buttonTextColor={buttonTextColor}
          personalizeBtnText={personalizeBtnText}
          dropdownSpacing={dropdownSpacing}
          optionsColumns={optionsColumns}
          layoutMode={layoutMode}
        />

      </s-grid>
    </s-page>
  );
}
