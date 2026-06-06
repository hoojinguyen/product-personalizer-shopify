import React from "react";
import Editor from "@monaco-editor/react";

interface SettingsFormProps {
  activeCategory: string; // Used as the active tab ID
  layoutMode: string;
  setLayoutMode: (mode: string) => void;
  brandColor: string;
  setBrandColor: (color: string) => void;
  buttonColor: string;
  setButtonColor: (color: string) => void;
  buttonTextColor: string;
  setButtonTextColor: (color: string) => void;
  globalBgColor: string;
  setGlobalBgColor: (color: string) => void;
  stickyPreview: boolean;
  setStickyPreview: (val: boolean) => void;
  zoomHover: boolean;
  setZoomHover: (val: boolean) => void;
  fieldStyle: string;
  setFieldStyle: (style: string) => void;
  instructionDisplayType: string;
  setInstructionDisplayType: (type: string) => void;
  globalPaddingTop: number;
  setGlobalPaddingTop: (val: number) => void;
  globalPaddingBottom: number;
  setGlobalPaddingBottom: (val: number) => void;
  globalPaddingLeft: number;
  setGlobalPaddingLeft: (val: number) => void;
  globalPaddingRight: number;
  setGlobalPaddingRight: (val: number) => void;
  globalMarginTop: number;
  setGlobalMarginTop: (val: number) => void;
  globalMarginBottom: number;
  setGlobalMarginBottom: (val: number) => void;
  globalMarginLeft: number;
  setGlobalMarginLeft: (val: number) => void;
  globalMarginRight: number;
  setGlobalMarginRight: (val: number) => void;
  popupType: string;
  setPopupType: (type: string) => void;
  showQuantity: boolean;
  setShowQuantity: (val: boolean) => void;
  personalizeBtnText: string;
  setPersonalizeBtnText: (text: string) => void;
  engraveTextLabel: string;
  setEngraveTextLabel: (text: string) => void;
  instructionsText: string;
  setInstructionsText: (text: string) => void;
  selectSizeText: string;
  setSelectSizeText: (text: string) => void;
  charLimit: number;
  setCharLimit: (val: number) => void;
  maxImageSize: string;
  setMaxImageSize: (size: string) => void;
  allowedJpg: boolean;
  setAllowedJpg: (val: boolean) => void;
  allowedPng: boolean;
  setAllowedPng: (val: boolean) => void;
  allowedSvg: boolean;
  setAllowedSvg: (val: boolean) => void;
  swatchBorderColor: string;
  setSwatchBorderColor: (color: string) => void;
  activeSwatchBorderColor: string;
  setActiveSwatchBorderColor: (color: string) => void;
  activeSwatchBgColor: string;
  setActiveSwatchBgColor: (color: string) => void;
  dropdownSpacing: string;
  setDropdownSpacing: (spacing: string) => void;
  optionsColumns: string;
  setOptionsColumns: (cols: string) => void;
  cartRedirect: string;
  setCartRedirect: (redirect: string) => void;
  exportFormat: string;
  setExportFormat: (format: string) => void;
  dpiResolution: number;
  setDpiResolution: (val: number) => void;
  currencySymbol: string;
  setCurrencySymbol: (symbol: string) => void;
  showUpchargeDetails: boolean;
  setShowUpchargeDetails: (val: boolean) => void;
  customCss: string;
  setCustomCss: (css: string) => void;
  customJs: string;
  setCustomJs: (js: string) => void;
  mounted: boolean;
  handleSave: () => void;
  handleDiscard: () => void;
  dispatchFormChange: () => void;
}

export function SettingsForm({
  activeCategory,
  layoutMode,
  setLayoutMode,
  brandColor,
  setBrandColor,
  buttonColor,
  setButtonColor,
  buttonTextColor,
  setButtonTextColor,
  globalBgColor,
  setGlobalBgColor,
  stickyPreview,
  setStickyPreview,
  zoomHover,
  setZoomHover,
  fieldStyle,
  setFieldStyle,
  instructionDisplayType,
  setInstructionDisplayType,
  globalPaddingTop,
  setGlobalPaddingTop,
  globalPaddingBottom,
  setGlobalPaddingBottom,
  globalPaddingLeft,
  setGlobalPaddingLeft,
  globalPaddingRight,
  setGlobalPaddingRight,
  globalMarginTop,
  setGlobalMarginTop,
  globalMarginBottom,
  setGlobalMarginBottom,
  globalMarginLeft,
  setGlobalMarginLeft,
  globalMarginRight,
  setGlobalMarginRight,
  popupType,
  setPopupType,
  showQuantity,
  setShowQuantity,
  personalizeBtnText,
  setPersonalizeBtnText,
  engraveTextLabel,
  setEngraveTextLabel,
  instructionsText,
  setInstructionsText,
  selectSizeText,
  setSelectSizeText,
  charLimit,
  setCharLimit,
  maxImageSize,
  setMaxImageSize,
  allowedJpg,
  setAllowedJpg,
  allowedPng,
  setAllowedPng,
  allowedSvg,
  setAllowedSvg,
  swatchBorderColor,
  setSwatchBorderColor,
  activeSwatchBorderColor,
  setActiveSwatchBorderColor,
  activeSwatchBgColor,
  setActiveSwatchBgColor,
  dropdownSpacing,
  setDropdownSpacing,
  optionsColumns,
  setOptionsColumns,
  cartRedirect,
  setCartRedirect,
  exportFormat,
  setExportFormat,
  dpiResolution,
  setDpiResolution,
  currencySymbol,
  setCurrencySymbol,
  showUpchargeDetails,
  setShowUpchargeDetails,
  customCss,
  setCustomCss,
  customJs,
  setCustomJs,
  mounted,
  handleSave,
  handleDiscard,
  dispatchFormChange,
}: SettingsFormProps) {
  return (
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
        {/* ================= TAB 1: INTEGRATION ================= */}
        <div style={{ display: activeCategory === "integration" ? "block" : "none" }}>
          <s-stack gap="base" direction="block">
            <s-heading>Active Integration & Theme Blocks</s-heading>
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

        {/* ================= TAB 2: DESIGN & LAYOUT ================= */}
        <div style={{ display: activeCategory === "design" ? "block" : "none" }}>
          <s-stack gap="base" direction="block">
            {/* Section 1: Global Styling */}
            <s-stack gap="base" direction="block">
              <s-heading>Global Branding & Form Styling</s-heading>
              <s-paragraph color="subdued">Modify accent colors, margins, paddings, and font sizes.</s-paragraph>
              <s-divider></s-divider>

              <s-grid gridTemplateColumns="1fr 1fr" gap="base">
                <s-color-field
                  label="Brand Accent Color"
                  name="brandColor"
                  value={brandColor}
                  onChange={(e: any) => setBrandColor(e.target.value)}
                  details="Accent color for active indicators and links"
                />
                <s-color-field
                  label="Submit Button Background"
                  name="buttonColor"
                  value={buttonColor}
                  onChange={(e: any) => setButtonColor(e.target.value)}
                  details="Background color of the storefront personalized button"
                />
                <s-color-field
                  label="Submit Button Text Color"
                  name="buttonTextColor"
                  value={buttonTextColor}
                  onChange={(e: any) => setButtonTextColor(e.target.value)}
                  details="Text color on the storefront personalization button"
                />
                <s-color-field
                  label="Option Background Fill"
                  name="globalBgColor"
                  value={globalBgColor}
                  onChange={(e: any) => setGlobalBgColor(e.target.value)}
                />
              </s-grid>

              <s-switch
                label="Enable Sticky Preview Drawer"
                name="stickyPreview"
                details="Float the widget preview at the screen bottom when scrolling past"
                checked={stickyPreview}
                onChange={(e: any) => setStickyPreview(e.target.checked)}
              />

              <s-switch
                label="Activate Zoom on Swatch Hover"
                name="zoomHover"
                details="Slightly zoom color and image swatches on pointer hover actions"
                checked={zoomHover}
                onChange={(e: any) => setZoomHover(e.target.checked)}
              />

              <s-grid gridTemplateColumns="1fr 1fr" gap="base">
                <s-select
                  label="Input Style Shape"
                  name="fieldStyle"
                  value={fieldStyle}
                  onChange={(e: any) => setFieldStyle(e.target.value)}
                >
                  <s-option value="Normal">Normal Box (Sharp borders)</s-option>
                  <s-option value="Round">Round Box (Circular borders)</s-option>
                  <s-option value="Underline">Minimal Underline</s-option>
                </s-select>
                <s-select
                  label="Instruction Help Style"
                  name="instructionDisplayType"
                  value={instructionDisplayType}
                  onChange={(e: any) => setInstructionDisplayType(e.target.value)}
                >
                  <s-option value="question">Question Mark Link</s-option>
                  <s-option value="tooltip">Sleek Info Tooltip</s-option>
                </s-select>
              </s-grid>

              <div className="box-model-container">
                <span className="box-model-title">Global Paddings</span>
                <div className="box-model-grid">
                  <div className="box-model-cell-top">
                    <s-number-field label="Top" value={String(globalPaddingTop)} min={0} onChange={(e: any) => setGlobalPaddingTop(parseInt(e.target.value) || 0)} suffix="px" />
                  </div>
                  <div className="box-model-cell-left">
                    <s-number-field label="Left" value={String(globalPaddingLeft)} min={0} onChange={(e: any) => setGlobalPaddingLeft(parseInt(e.target.value) || 0)} suffix="px" />
                  </div>
                  <div className="box-model-center">
                    Padding
                  </div>
                  <div className="box-model-cell-right">
                    <s-number-field label="Right" value={String(globalPaddingRight)} min={0} onChange={(e: any) => setGlobalPaddingRight(parseInt(e.target.value) || 0)} suffix="px" />
                  </div>
                  <div className="box-model-cell-bottom">
                    <s-number-field label="Bottom" value={String(globalPaddingBottom)} min={0} onChange={(e: any) => setGlobalPaddingBottom(parseInt(e.target.value) || 0)} suffix="px" />
                  </div>
                </div>
              </div>

              <div className="box-model-container">
                <span className="box-model-title">Global Margins</span>
                <div className="box-model-grid">
                  <div className="box-model-cell-top">
                    <s-number-field label="Top" value={String(globalMarginTop)} min={0} onChange={(e: any) => setGlobalMarginTop(parseInt(e.target.value) || 0)} suffix="px" />
                  </div>
                  <div className="box-model-cell-left">
                    <s-number-field label="Left" value={String(globalMarginLeft)} min={0} onChange={(e: any) => setGlobalMarginLeft(parseInt(e.target.value) || 0)} suffix="px" />
                  </div>
                  <div className="box-model-center" style={{ borderColor: "#2c3e50", color: "#2c3e50" }}>
                    Margin
                  </div>
                  <div className="box-model-cell-right">
                    <s-number-field label="Right" value={String(globalMarginRight)} min={0} onChange={(e: any) => setGlobalMarginRight(parseInt(e.target.value) || 0)} suffix="px" />
                  </div>
                  <div className="box-model-cell-bottom">
                    <s-number-field label="Bottom" value={String(globalMarginBottom)} min={0} onChange={(e: any) => setGlobalMarginBottom(parseInt(e.target.value) || 0)} suffix="px" />
                  </div>
                </div>
              </div>
            </s-stack>

            <s-divider></s-divider>

            {/* Section 2: Presenter Layout */}
            <s-stack gap="base" direction="block">
              <s-heading>Storefront Presentation Layout Mode</s-heading>
              <s-paragraph color="subdued">Choose the default layout format where customization fields render.</s-paragraph>
              <s-divider></s-divider>

              <s-select
                label="Presenter Layout Mode"
                name="layoutMode"
                value={layoutMode}
                onChange={(e: any) => setLayoutMode(e.target.value)}
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
                  onChange={(e: any) => setPopupType(e.target.value)}
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
                onChange={(e: any) => setShowQuantity(e.target.checked)}
              />
            </s-stack>

            <s-divider></s-divider>

            {/* Section 3: Swatches & Hover */}
            <s-stack gap="base" direction="block">
              <s-heading>Swatch Border & Hover Properties</s-heading>
              <s-paragraph color="subdued">Style storefront choices, color border wells, and select effects.</s-paragraph>
              <s-divider></s-divider>

              <s-grid gridTemplateColumns="1fr 1fr" gap="base">
                <s-color-field
                  label="Swatch Border Color"
                  name="swatchBorderColor"
                  value={swatchBorderColor}
                  onChange={(e: any) => setSwatchBorderColor(e.target.value)}
                />
                <s-color-field
                  label="Active Swatch Border Color"
                  name="activeSwatchBorderColor"
                  value={activeSwatchBorderColor}
                  onChange={(e: any) => setActiveSwatchBorderColor(e.target.value)}
                />
                <s-color-field
                  label="Active Swatch Background"
                  name="activeSwatchBgColor"
                  value={activeSwatchBgColor}
                  onChange={(e: any) => setActiveSwatchBgColor(e.target.value)}
                />
              </s-grid>

              <s-select label="Active Choice Hover Interaction" value="zoom">
                <s-option value="zoom">Magnify choice circular borders (Zoom)</s-option>
                <s-option value="popover">Show popover details label on hover</s-option>
              </s-select>
            </s-stack>

            <s-divider></s-divider>

            {/* Section 4: Dropdowns & Spacings */}
            <s-stack gap="base" direction="block">
              <s-heading>Dropdown & Checkbox Layouts</s-heading>
              <s-paragraph color="subdued">Adjust the alignments and list spacings for selection rows.</s-paragraph>
              <s-divider></s-divider>

              <s-select
                label="Dropdown Spacing Scale"
                name="dropdownSpacing"
                value={dropdownSpacing}
                onChange={(e: any) => setDropdownSpacing(e.target.value)}
              >
                <s-option value="compact">Compact (Tight grid rows)</s-option>
                <s-option value="normal">Normal (Generous grid spaces)</s-option>
                <s-option value="relaxed">Relaxed (Wide padding rows)</s-option>
              </s-select>

              <s-select
                label="Options Grid Column Count"
                name="optionsColumns"
                value={optionsColumns}
                onChange={(e: any) => setOptionsColumns(e.target.value)}
              >
                <s-option value="1">1 Column (Vertical list stack)</s-option>
                <s-option value="2">2 Columns (Side-by-side grid split)</s-option>
                <s-option value="3">3 Columns (Multi-option dense row)</s-option>
              </s-select>
            </s-stack>
          </s-stack>
        </div>

        {/* ================= TAB 3: FORM FIELDS ================= */}
        <div style={{ display: activeCategory === "fields" ? "block" : "none" }}>
          <s-stack gap="base" direction="block">
            {/* Section 1: Text & Translations */}
            <s-stack gap="base" direction="block">
              <s-heading>Text Validation & Translators</s-heading>
              <s-paragraph color="subdued">Configure character limits, placeholder rules, and translation text.</s-paragraph>
              <s-divider></s-divider>

              <s-text-field
                label="Personalize Button Action Wording"
                name="personalizeBtnText"
                value={personalizeBtnText}
                onChange={(e: any) => setPersonalizeBtnText(e.target.value)}
              />

              <s-grid gridTemplateColumns="1fr 1fr" gap="base">
                <s-text-field
                  label="Textarea Label"
                  name="engraveTextLabel"
                  value={engraveTextLabel}
                  onChange={(e: any) => setEngraveTextLabel(e.target.value)}
                />
                <s-text-field
                  label="Instruction Wording"
                  name="instructionsText"
                  value={instructionsText}
                  onChange={(e: any) => setInstructionsText(e.target.value)}
                />
              </s-grid>

              <s-grid gridTemplateColumns="2fr 1fr" gap="base">
                <s-text-field
                  label="Default Size Option Text"
                  name="selectSizeText"
                  value={selectSizeText}
                  onChange={(e: any) => setSelectSizeText(e.target.value)}
                />
                <s-number-field
                  label="Character Limit"
                  name="charLimit"
                  value={String(charLimit)}
                  min={0}
                  onChange={(e: any) => setCharLimit(parseInt(e.target.value) || 0)}
                />
              </s-grid>
            </s-stack>

            <s-divider></s-divider>

            {/* Section 2: Image Upload */}
            <s-stack gap="base" direction="block">
              <s-heading>Custom Image Upload Restrictions</s-heading>
              <s-paragraph color="subdued">Define allowed file size, dimensions, and image extensions.</s-paragraph>
              <s-divider></s-divider>

              <s-select
                label="Maximum Allowed File Size"
                name="maxImageSize"
                value={maxImageSize}
                onChange={(e: any) => setMaxImageSize(e.target.value)}
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
                    onChange={(e: any) => setAllowedJpg(e.target.checked)}
                  />
                  <s-checkbox
                    label="PNG (.png - supports transparent backgrounds)"
                    name="allowedPng"
                    checked={allowedPng}
                    onChange={(e: any) => setAllowedPng(e.target.checked)}
                  />
                  <s-checkbox
                    label="SVG (.svg - vector graphic inputs)"
                    name="allowedSvg"
                    checked={allowedSvg}
                    onChange={(e: any) => setAllowedSvg(e.target.checked)}
                  />
                </s-stack>
              </s-box>

              <s-select label="Minimum Dimension Check" value="500">
                <s-option value="300">300 x 300 pixels</s-option>
                <s-option value="500">500 x 500 pixels (Recommended)</s-option>
                <s-option value="1000">1000 x 1000 pixels (High Definition)</s-option>
              </s-select>
            </s-stack>
          </s-stack>
        </div>

        {/* ================= TAB 4: CART & CHECKOUT ================= */}
        <div style={{ display: activeCategory === "cart" ? "block" : "none" }}>
          <s-stack gap="base" direction="block">
            {/* Section 1: Cart Checkout Redirect */}
            <s-stack gap="base" direction="block">
              <s-heading>Add to Cart Checkout Behaviors</s-heading>
              <s-paragraph color="subdued">Define checkout redirection routing once options are submitted.</s-paragraph>
              <s-divider></s-divider>

              <s-select
                label="Redirection Rule"
                name="cartRedirect"
                value={cartRedirect}
                onChange={(e: any) => setCartRedirect(e.target.value)}
              >
                <s-option value="stay">Stay on Product Page (Dynamic loading check)</s-option>
                <s-option value="cart">Redirect to Cart Page (/cart)</s-option>
                <s-option value="checkout">Redirect to Shopify Checkout Portal (Instantly)</s-option>
              </s-select>

              <s-text-field label="Spinner loader indicator wording" value="Adding to cart..." />
            </s-stack>

            <s-divider></s-divider>

            {/* Section 4: Additional Pricing Options */}
            <s-stack gap="base" direction="block">
              <s-heading>Price Adjustments Formatting</s-heading>
              <s-paragraph color="subdued">Custom price formatting and template labels for upcharges.</s-paragraph>
              <s-divider></s-divider>

              <s-grid gridTemplateColumns="1fr 1fr" gap="base">
                <s-text-field
                  label="Currency Wording Symbol"
                  name="currencySymbol"
                  value={currencySymbol}
                  onChange={(e: any) => setCurrencySymbol(e.target.value)}
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
                onChange={(e: any) => setShowUpchargeDetails(e.target.checked)}
              />
            </s-stack>
          </s-stack>
        </div>

        {/* ================= TAB 4: DEVELOPER SETTINGS ================= */}
        <div style={{ display: activeCategory === "developer" ? "block" : "none" }}>
          <s-stack gap="base" direction="block">
            {/* Section 1: Print Export */}
            <s-stack gap="base" direction="block">
              <s-heading>High-Resolution Print Export Layouts</s-heading>
              <s-paragraph color="subdued">Specify format output vectors compiled on checkout backend webhooks.</s-paragraph>
              <s-divider></s-divider>

              <s-grid gridTemplateColumns="1fr 1fr" gap="base">
                <s-select
                  label="Default Export Format"
                  name="exportFormat"
                  value={exportFormat}
                  onChange={(e: any) => setExportFormat(e.target.value)}
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
                  onChange={(e: any) => setDpiResolution(parseInt(e.target.value) || 300)}
                />
              </s-grid>
            </s-stack>

            <s-divider></s-divider>

            {/* Section 2: Custom CSS */}
            <s-stack gap="base" direction="block">
              <s-heading>Custom CSS Stylesheet Injection</s-heading>
              <s-paragraph color="subdued">Inject style rule overrides directly to storefront customization templates.</s-paragraph>
              <s-divider></s-divider>

              <s-text color="subdued">Custom CSS Editor</s-text>
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
                  onChange={(e: any) => setCustomCss(e.target.value)}
                  placeholder=".zepto-customizer-btn { border-radius: 12px; }"
                />
              )}
            </s-stack>

            <s-divider></s-divider>

            {/* Section 3: Custom JS */}
            <s-stack gap="base" direction="block">
              <s-heading>Custom JavaScript Callback Triggers</s-heading>
              <s-paragraph color="subdued">Inject custom pixel analytics hooks or dynamic events scripts.</s-paragraph>
              <s-divider></s-divider>

              <s-text color="subdued">Custom JS Editor</s-text>
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
                  onChange={(e: any) => setCustomJs(e.target.value)}
                  placeholder="window.addEventListener('customizer:save', (e) => { console.log(e.detail); });"
                />
              )}
            </s-stack>
          </s-stack>
        </div>
      </form>
    </s-box>
  );
}
