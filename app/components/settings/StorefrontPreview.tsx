import React, { useState } from "react";

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
  dropdownSpacing?: string;
  optionsColumns?: string;
  layoutMode?: string;
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
  dropdownSpacing = "compact",
  optionsColumns = "1",
  layoutMode = "stacked",
}: StorefrontPreviewProps) {
  const [isModalOpen, setIsModalOpen] = useState(false);
  const [activeTab, setActiveTab] = useState("text");

  const renderFields = (tabFilter?: "text" | "material") => {
    return (
      <div
        style={{
          display: "grid",
          gridTemplateColumns:
            optionsColumns === "2"
              ? "repeat(2, 1fr)"
              : optionsColumns === "3"
              ? "repeat(3, 1fr)"
              : "1fr",
          gap:
            dropdownSpacing === "compact"
              ? "8px"
              : dropdownSpacing === "relaxed"
              ? "20px"
              : "12px",
        }}
      >
        {/* Size Select Mock */}
        {(!tabFilter || tabFilter === "text") && (
          <div>
            <span className="widget-field-label">{selectSizeText}</span>
            <div style={{ display: "flex", gap: "8px", width: "100%" }}>
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
            </div>
          </div>
        )}

        {/* Text Area Customizer Option Mock */}
        {(!tabFilter || tabFilter === "text") && (
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
        )}

        {/* Font Selector Customizer Option Mock */}
        {(!tabFilter || tabFilter === "text") && (
          <div>
            <label className="widget-field-label" htmlFor="preview-font-select">Select a Font</label>
            <select id="preview-font-select" className="form-input" value={previewFont} onChange={(e) => setPreviewFont((e.target as HTMLSelectElement).value)}>
              <option value="Arial">Sans-serif (Modern)</option>
              <option value="Playfair">Playfair Serif (Classic)</option>
              <option value="Alexbrush">Alex Brush Script (Cursive)</option>
              <option value="Mono">Roboto Mono (Engraved style)</option>
            </select>
          </div>
        )}

        {/* Text Color Choices Customizer Swatches Mock */}
        {(!tabFilter || tabFilter === "material") && (
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
        )}

        {/* Material Dropdown Mock */}
        {(!tabFilter || tabFilter === "material") && (
          <div>
            <label className="widget-field-label" htmlFor="preview-material-select">Hardware Material</label>
            <select id="preview-material-select" className="form-input" value={previewMaterial} onChange={(e) => setPreviewMaterial((e.target as HTMLSelectElement).value)}>
              <option value="Wood">Eco Wood</option>
              <option value="Brass">Polished Brass</option>
              <option value="Silver">Sterling Silver</option>
            </select>
          </div>
        )}
      </div>
    );
  };

  return (
    <div className="preview-card" style={{ position: "sticky", top: "96px", alignSelf: "start" }}>
      <s-box padding="base" background="base" border="base" borderRadius="base">
        <div className="preview-header">
          <span className="preview-title">Live Storefront Preview</span>
          <div className="mock-product-selector">
            <button
              type="button"
              className={`mock-product-btn ${mockProductType === "backpack" ? "active" : ""}`}
              onClick={() => setMockProductType("backpack")}
            >
              Backpack
            </button>
            <button
              type="button"
              className={`mock-product-btn ${mockProductType === "mug" ? "active" : ""}`}
              onClick={() => setMockProductType("mug")}
            >
              Mug
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
              transform: (() => {
                const multiplier = previewSize === "Small" ? 0.75 : previewSize === "Large" ? 1.25 : 1.0;
                return mockProductType === "backpack"
                  ? `translateY(80px) translateX(2px) scale(${0.85 * multiplier})`
                  : `translateY(10px) translateX(-25px) scale(${0.9 * multiplier})`;
              })(),
              opacity: previewText ? 1 : 0.4
            }}
          >
            {previewText || "Personalized Text"}
          </div>
        </div>

        {/* Customizer form inputs mockup widget */}
        <div className="customizer-preview-widget">
          {layoutMode === "modal" ? (
            <div>
              <button
                type="button"
                className="customizer-button"
                style={{
                  background: buttonColor,
                  color: buttonTextColor,
                  cursor: "pointer",
                  marginTop: "12px"
                }}
                onClick={() => setIsModalOpen(true)}
              >
                {personalizeBtnText}
              </button>
            </div>
          ) : layoutMode === "tabs" ? (
            <div>
              <h4 style={{ fontSize: "14px", fontWeight: 700, borderBottom: `2px solid ${brandColor}`, paddingBottom: "6px", color: brandColor, margin: "0 0 12px 0" }}>
                Personalize Your Item
              </h4>
              <div style={{ display: "flex", gap: "4px", borderBottom: "1px solid #ebebeb", marginBottom: "12px", background: "#f1f2f4", padding: "4px", borderRadius: "6px" }}>
                <button
                  type="button"
                  style={{
                    flex: 1,
                    border: "none",
                    background: activeTab === "text" ? "#ffffff" : "transparent",
                    boxShadow: activeTab === "text" ? "0 1px 3px rgba(0,0,0,0.05)" : "none",
                    padding: "6px",
                    fontSize: "12px",
                    fontWeight: 600,
                    cursor: "pointer",
                    borderRadius: "4px",
                    color: activeTab === "text" ? brandColor : "#6d7175"
                  }}
                  onClick={() => setActiveTab("text")}
                >
                  Text & Font
                </button>
                <button
                  type="button"
                  style={{
                    flex: 1,
                    border: "none",
                    background: activeTab === "material" ? "#ffffff" : "transparent",
                    boxShadow: activeTab === "material" ? "0 1px 3px rgba(0,0,0,0.05)" : "none",
                    padding: "6px",
                    fontSize: "12px",
                    fontWeight: 600,
                    cursor: "pointer",
                    borderRadius: "4px",
                    color: activeTab === "material" ? brandColor : "#6d7175"
                  }}
                  onClick={() => setActiveTab("material")}
                >
                  Ink & Hardware
                </button>
              </div>
              
              {renderFields(activeTab as "text" | "material")}

              <button
                type="button"
                className="customizer-button"
                disabled
                style={{
                  background: buttonColor,
                  color: buttonTextColor,
                  marginTop: "16px"
                }}
              >
                {personalizeBtnText}
              </button>
            </div>
          ) : (
            <div>
              <h4 style={{ fontSize: "14px", fontWeight: 700, borderBottom: `2px solid ${brandColor}`, paddingBottom: "6px", color: brandColor, margin: "0 0 12px 0" }}>
                Personalize Your Item
              </h4>
              
              {renderFields()}

              <button
                type="button"
                className="customizer-button"
                disabled
                style={{
                  background: buttonColor,
                  color: buttonTextColor,
                  marginTop: "16px"
                }}
              >
                {personalizeBtnText}
              </button>
            </div>
          )}
        </div>

        {/* Modal Overlay Mockup */}
        {layoutMode === "modal" && isModalOpen && (
          <div
            style={{
              position: "absolute",
              top: 0,
              left: 0,
              right: 0,
              bottom: 0,
              backgroundColor: "rgba(255, 255, 255, 0.98)",
              zIndex: 100,
              borderRadius: "8px",
              padding: "20px 16px",
              display: "flex",
              flexDirection: "column",
              border: "1px solid #babfc3",
              boxShadow: "0 4px 20px rgba(0,0,0,0.15)"
            }}
          >
            <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", marginBottom: "16px", borderBottom: `2px solid ${brandColor}`, paddingBottom: "6px" }}>
              <span style={{ fontWeight: 700, fontSize: "14px", color: brandColor }}>Personalize Your Item</span>
              <button
                type="button"
                style={{ background: "none", border: "none", fontSize: "18px", cursor: "pointer", color: "#6d7175", fontWeight: "bold", padding: "0 4px" }}
                onClick={() => setIsModalOpen(false)}
              >
                ✕
              </button>
            </div>
            
            <div style={{ flex: 1, overflowY: "auto", paddingRight: "4px" }}>
              {renderFields()}
            </div>

            <button
              type="button"
              className="customizer-button"
              style={{
                background: buttonColor,
                color: buttonTextColor,
                cursor: "pointer",
                marginTop: "16px",
                width: "100%"
              }}
              onClick={() => setIsModalOpen(false)}
            >
              Apply Options
            </button>
          </div>
        )}
      </s-box>
    </div>
  );
}
