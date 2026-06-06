import React from "react";

interface StorefrontPreviewProps {
  mockProductType: string;
  setMockProductType: (type: string) => void;
  previewColor: string;
  setPreviewColor: (color: string) => void;
  previewFont: string;
  setPreviewFont: (font: string) => void;
  previewText: string;
  setPreviewText: (text: string) => void;
  brandColor: string;
  selectSizeText: string;
  previewSize: string;
  setPreviewSize: (size: string) => void;
  engraveTextLabel: string;
  charLimit: number;
  instructionsText: string;
  previewMaterial: string;
  setPreviewMaterial: (material: string) => void;
  activeSwatchBorderColor: string;
  swatchBorderColor: string;
  zoomHover: boolean;
  fieldStyle: string;
  buttonColor: string;
  buttonTextColor: string;
  personalizeBtnText: string;
}

export function StorefrontPreview({
  mockProductType,
  setMockProductType,
  previewColor,
  setPreviewColor,
  previewFont,
  setPreviewFont,
  previewText,
  setPreviewText,
  brandColor,
  selectSizeText,
  previewSize,
  setPreviewSize,
  engraveTextLabel,
  charLimit,
  instructionsText,
  previewMaterial,
  setPreviewMaterial,
  activeSwatchBorderColor,
  swatchBorderColor,
  zoomHover,
  fieldStyle,
  buttonColor,
  buttonTextColor,
  personalizeBtnText,
}: StorefrontPreviewProps) {
  return (
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
  );
}
