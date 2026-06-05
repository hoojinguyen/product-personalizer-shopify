import React, { useState, useEffect, useRef } from "react";
import ReactDOM from "react-dom/client";
import { 
  CustomizationOption, 
  isOptionVisible, 
  calculateTotalUpcharges 
} from "../utils/configEngine";
import { drawPersonalizerCanvas } from "../utils/canvasRenderer";

interface CustomizerConfig {
  enabled: boolean;
  layoutMode?: "stacked" | "tabs" | "modal";
  brandColor?: string;
  buttonColor?: string;
  buttonTextColor?: string;
  heading?: string;
  options: CustomizationOption[];
  customCSS?: string;
  customJS?: string;
}

export function StorefrontCustomizer({
  productId,
  baseImageUrl,
  shopDomain,
  isDemo,
  config,
}: {
  productId: string;
  baseImageUrl: string;
  shopDomain: string;
  isDemo: boolean;
  config: CustomizerConfig;
}) {
  const options = config.options || [];
  const layoutMode = config.layoutMode || "stacked";
  const brandColor = config.brandColor || "#008060";
  const buttonColor = config.buttonColor || "#008060";
  const buttonTextColor = config.buttonTextColor || "#ffffff";
  const heading = config.heading || "Personalize Your Item";

  // Form selections state mapping option.id -> value string
  const [fieldValues, setFieldValues] = useState<Record<string, string>>({});
  const [activeTabIdx, setActiveTabIdx] = useState<number>(0);
  const [isModalOpen, setIsModalOpen] = useState<boolean>(false);
  const [isUploading, setIsUploading] = useState<boolean>(false);
  const [uploadProgressMsg, setUploadProgressMsg] = useState<string>("");

  // Canvas Reference
  const canvasRef = useRef<HTMLCanvasElement | null>(null);
  const [bgImage, setBgImage] = useState<HTMLImageElement | null>(null);
  const [overlayImage, setOverlayImage] = useState<HTMLImageElement | null>(null);

  // Cache for preloaded clipart and uploaded images per option
  const [loadedLayerImages, setLoadedLayerImages] = useState<Record<string, HTMLImageElement>>({});

  // Initialize default options values
  useEffect(() => {
    const defaults: Record<string, string> = {};
    options.forEach((opt) => {
      if (opt.type === "swatch" && opt.choices) {
        defaults[opt.id] = opt.choices.split(",")[0].trim();
      } else if (opt.type === "select" && opt.choices) {
        defaults[opt.id] = opt.choices.split(",")[0].trim();
      } else if (opt.type === "clipart" && opt.choices) {
        try {
          const list = JSON.parse(opt.choices);
          if (Array.isArray(list) && list.length > 0) {
            defaults[opt.id] = list[0].url;
          }
        } catch (e) {
          defaults[opt.id] = "";
        }
      } else {
        defaults[opt.id] = "";
      }
    });
    setFieldValues(defaults);

    // Caches the product's base image onto state for rendering
    if (baseImageUrl) {
      const img = new Image();
      img.crossOrigin = "anonymous";
      img.src = baseImageUrl;
      img.onload = () => setBgImage(img);
    }

    // Proactively inject custom CSS overrides from dashboard if exists matching Phase 5
    if (config.customCSS) {
      const styleNode = document.createElement("style");
      styleNode.id = `personalizer-scoped-styles-${productId}`;
      styleNode.appendChild(document.createTextNode(config.customCSS));
      document.head.appendChild(styleNode);
    }

    // Proactively run custom Javascript hooks if exists matching Phase 5
    if (config.customJS) {
      try {
        const scriptFn = new Function("productId", "config", config.customJS);
        scriptFn(productId, config);
      } catch (err) {
        console.error("Custom JS override execution failed:", err);
      }
    }

    return () => {
      // Cleanup styles on unmount
      const existing = document.getElementById(`personalizer-scoped-styles-${productId}`);
      if (existing) existing.remove();
    };
  }, [productId, baseImageUrl]);

  // Dynamically preload layer images (Clipart & Custom Graphic uploads)
  useEffect(() => {
    options.forEach((opt) => {
      const val = fieldValues[opt.id];
      if ((opt.type === "clipart" || opt.type === "file") && val) {
        if (val.startsWith("http") && (!loadedLayerImages[opt.id] || loadedLayerImages[opt.id].src !== val)) {
          const img = new Image();
          img.crossOrigin = "anonymous";
          img.src = val;
          img.onload = () => {
            setLoadedLayerImages((prev) => ({ ...prev, [opt.id]: img }));
          };
        }
      }
    });
  }, [fieldValues, options]);

  // Handle single option value updating
  const handleValueChange = (optionId: string, val: string) => {
    setFieldValues((prev) => ({ ...prev, [optionId]: val }));
  };

  // Upload custom customer file proxy handler
  const handleFileUpload = async (optionId: string, file: File) => {
    if (!file) return;
    setIsUploading(true);
    setUploadProgressMsg("Uploading visual graphic...");

    const formData = new FormData();
    formData.append("file", file);

    try {
      const res = await fetch("/apps/personalizer/upload", {
        method: "POST",
        body: formData,
      });
      if (!res.ok) throw new Error("Upload response failed");
      const data = await res.json();

      if (data.success && data.url) {
        handleValueChange(optionId, data.url);
        // Preload uploaded image onto canvas
        const overlay = new Image();
        overlay.crossOrigin = "anonymous";
        overlay.src = data.url;
        overlay.onload = () => setOverlayImage(overlay);
      } else {
        alert(`Upload failed: ${data.error || "Unknown error"}`);
      }
    } catch (err) {
      console.error("File upload failed:", err);
      alert("Failed to upload image. Please try again.");
    } finally {
      setIsUploading(false);
    }
  };

  const isStorefrontOptionVisible = (opt: CustomizationOption) => {
    return isOptionVisible(opt, fieldValues, options);
  };

  const visibleOptions = options.filter(isStorefrontOptionVisible);

  // Live Multi-Layer Canvas Rendering matches ADR 0001
  useEffect(() => {
    const canvas = canvasRef.current;
    if (!canvas) return;

    drawPersonalizerCanvas({
      canvas,
      options,
      shopperValues: fieldValues,
      bgImage,
      scale: 1.0, // Storefront canvas scale
      livePreview: true,
      loadedLayerImages,
      overlayImage
    });
  }, [fieldValues, bgImage, loadedLayerImages, overlayImage, visibleOptions]);

  // agregates active upcharges total
  const calculateUpchargeTotal = (): number => {
    return calculateTotalUpcharges(options, fieldValues);
  };

  // Secured Interceptor submission loop mapping Phase 1 Cart Transform API
  const handleCartSubmission = async (e: Event) => {
    if (isDemo) return;
    e.preventDefault();
    e.stopPropagation();

    const canvas = canvasRef.current;
    if (!canvas) return;

    setIsUploading(true);
    setUploadProgressMsg("Saving personalization options...");

    try {
      // 1. Compile HTML5 dynamic canvas preview and upload securely via Proxy
      const base64Data = canvas.toDataURL("image/png", 0.7);
      const blob = await (await fetch(base64Data)).blob();
      const fileObj = new File([blob], `preview_${productId}.png`, { type: "image/png" });

      const uploadForm = new FormData();
      uploadForm.append("file", fileObj);

      const uploadRes = await fetch("/apps/personalizer/upload", {
        method: "POST",
        body: uploadForm,
      });
      if (!uploadRes.ok) throw new Error("Preview compilation failed");
      const uploadData = await uploadRes.json();

      if (!uploadData.success || !uploadData.url) {
        throw new Error(uploadData.error || "Resolved URL missing");
      }

      const finalizedPreviewUrl = uploadData.url;

      // 2. Set dynamic parameters as standard hidden checkout inputs
      const targetForm = e.target as HTMLFormElement;

      // Clean existing hidden attributes to prevent duplicates
      targetForm.querySelectorAll(".product-personalizer-hidden-checkout-prop").forEach((el) => el.remove());

      // dynamic upcharge amount
      const upchargeTotal = calculateUpchargeTotal();
      if (upchargeTotal > 0) {
        const feeInp = document.createElement("input");
        feeInp.type = "hidden";
        feeInp.className = "product-personalizer-hidden-checkout-prop";
        feeInp.name = "properties[_upcharge_amount]";
        feeInp.value = upchargeTotal.toFixed(2);
        targetForm.appendChild(feeInp);
      }

      // dynamic high-res S3 preview
      const previewInp = document.createElement("input");
      previewInp.type = "hidden";
      previewInp.className = "product-personalizer-hidden-checkout-prop";
      previewInp.name = "properties[_preview_url]";
      previewInp.value = finalizedPreviewUrl;
      targetForm.appendChild(previewInp);

      // Append all visible customization options as line-item properties cleanly
      visibleOptions.forEach((opt) => {
        const val = fieldValues[opt.id];
        if (val) {
          const optInp = document.createElement("input");
          optInp.type = "hidden";
          optInp.className = "product-personalizer-hidden-checkout-prop";
          optInp.name = `properties[${opt.label}]`;
          optInp.value = val;
          targetForm.appendChild(optInp);
        }
      });

      // 3. Remove event listener temporarily and resubmit form natively
      targetForm.removeEventListener("submit", handleCartSubmission);
      targetForm.submit();
    } catch (err) {
      console.error("Cart submit validation exception:", err);
      alert("Error adding customized item to cart. Please try again.");
      setIsUploading(false);
    }
  };

  // Intercept storefront cart form submission
  useEffect(() => {
    if (isDemo) return;
    const form = document.querySelector('form[action*="/cart/add"]');
    if (form) {
      form.addEventListener("submit", handleCartSubmission);
    }
    return () => {
      if (form) form.removeEventListener("submit", handleCartSubmission);
    };
  }, [fieldValues, visibleOptions, isDemo]);

  // Render individual customizer form inputs
  const renderOption = (opt: CustomizationOption) => {
    const value = fieldValues[opt.id] || "";

    return (
      <div key={opt.id} className="personalizer-group" data-option-id={opt.id}>
        <label className="personalizer-label" htmlFor={`field-${opt.id}`}>
          <span style={{ display: "flex", alignItems: "center", gap: "8px" }}>
            {opt.label}
            {opt.required && <span style={{ color: "hsl(354, 85%, 45%)" }}>*</span>}
          </span>
          <span style={{ display: "flex", alignItems: "center", gap: "6px" }}>
            {opt.priceUpcharge > 0 && (
              <span className="personalizer-fee-tag" data-upcharge-amount={opt.priceUpcharge}>
                +${opt.priceUpcharge.toFixed(2)}
              </span>
            )}
            {opt.type === "text" && (
              <span className="personalizer-char-count">
                {value.length}/{opt.maxChars || 50}
              </span>
            )}
          </span>
        </label>

        {opt.type === "text" && (
          <input
            type="text"
            id={`field-${opt.id}`}
            className="personalizer-input"
            value={value}
            maxLength={opt.maxChars || 50}
            onChange={(e) => handleValueChange(opt.id, e.target.value)}
            placeholder="Type your customization here..."
            required={opt.required}
            autoComplete="off"
          />
        )}

        {opt.type === "select" && (
          <select
            id={`field-${opt.id}`}
            className="personalizer-select"
            value={value}
            onChange={(e) => handleValueChange(opt.id, e.target.value)}
            required={opt.required}
          >
            {opt.choices?.split(",").map((choice, idx) => {
              const val = choice.trim();
              return (
                <option key={idx} value={val}>
                  {val}
                </option>
              );
            })}
          </select>
        )}

        {opt.type === "clipart" && (
          <div className="personalizer-clipart-list" style={{ display: "grid", gridTemplateColumns: "repeat(auto-fill, minmax(75px, 1fr))", gap: "8px", marginTop: "6px" }}>
            {(() => {
              try {
                const choices = JSON.parse(opt.choices || "[]");
                if (!Array.isArray(choices) || choices.length === 0) return <div style={{ fontSize: "12px", color: "#6d7175", fontStyle: "italic" }}>No clipart graphics configured</div>;
                return choices.map((img) => (
                  <button
                    key={img.id}
                    type="button"
                    className={`personalizer-clipart-btn ${value === img.url ? "active" : ""}`}
                    onClick={() => handleValueChange(opt.id, img.url)}
                    style={{
                      border: value === img.url ? `2.5px solid ${brandColor}` : "1.5px solid #babfc3",
                      borderRadius: "6px",
                      padding: "4px",
                      background: "#fff",
                      cursor: "pointer",
                      textAlign: "center",
                      display: "flex",
                      flexDirection: "column",
                      alignItems: "center",
                      gap: "4px",
                      outline: "none"
                    }}
                  >
                    <img src={img.url} alt={img.name} style={{ width: "100%", height: "40px", objectFit: "contain" }} />
                    <div style={{ fontSize: "9px", overflow: "hidden", textOverflow: "ellipsis", width: "100%", fontWeight: value === img.url ? 700 : 500, color: "#2c3e50" }}>
                      {img.name}
                    </div>
                  </button>
                ));
              } catch (e) {
                return <div style={{ fontSize: "11px", color: "#d93838" }}>Error parsing clipart list</div>;
              }
            })()}
          </div>
        )}

        {opt.type === "swatch" && (
          <div className="personalizer-swatch-list">
            {opt.choices?.split(",").map((color, idx) => {
              const hex = color.trim();
              return (
                <button
                  key={idx}
                  type="button"
                  className={`personalizer-swatch-btn ${value === hex ? "active" : ""}`}
                  style={{ backgroundColor: hex }}
                  onClick={() => handleValueChange(opt.id, hex)}
                  aria-label={`Select color ${hex}`}
                />
              );
            })}
          </div>
        )}

        {opt.type === "file" && (
          <div className="personalizer-file-upload-wrapper">
            <input
              type="file"
              id={`field-${opt.id}`}
              className="personalizer-file-input"
              accept="image/*"
              style={{ display: "none" }}
              onChange={(e) => {
                const file = e.target.files?.[0];
                if (file) handleFileUpload(opt.id, file);
              }}
            />
            <button
              type="button"
              className="personalizer-upload-trigger-btn"
              onClick={() => document.getElementById(`field-${opt.id}`)?.click()}
            >
              📸 Choose Image Decal
            </button>
            <div className="personalizer-file-preview-name" style={{ marginTop: "4px", fontSize: "12px", color: "#6d7175", fontStyle: "italic" }}>
              {value ? "✓ Image Uploaded Successfully" : "No image selected"}
            </div>
          </div>
        )}

        {opt.type === "checkbox" && (
          <div style={{ display: "flex", alignItems: "center", gap: "10px", marginTop: "4px" }}>
            <input
              type="checkbox"
              id={`field-${opt.id}`}
              className="personalizer-checkbox"
              checked={value === "Yes"}
              onChange={(e) => handleValueChange(opt.id, e.target.checked ? "Yes" : "")}
              style={{ width: "18px", height: "18px", cursor: "pointer" }}
              required={opt.required}
            />
            <label htmlFor={`field-${opt.id}`} style={{ fontSize: "14px", cursor: "pointer", fontWeight: 500 }}>
              Select to enable
            </label>
          </div>
        )}
      </div>
    );
  };

  // Render the core customizer layout block
  const renderCustomizerCard = () => {
    return (
      <div
        className="personalizer-card"
        style={{
          // @ts-ignore
          "--personalizer-brand-color": brandColor,
          "--personalizer-btn-color": buttonColor,
          "--personalizer-btn-text": buttonTextColor,
        }}
      >
        {/* Header block */}
        <div className="personalizer-header">
          <span className="personalizer-sparkle">✨</span>
          <h4 className="personalizer-title">{heading}</h4>
        </div>

        {/* Dynamic Presentation Layout Forms */}
        {layoutMode === "tabs" && visibleOptions.length > 1 ? (
          <div>
            {/* Tabs Navigation Headers */}
            <div className="personalizer-tabs-nav">
              {visibleOptions.map((opt, idx) => (
                <button
                  key={opt.id}
                  type="button"
                  className={`personalizer-tab-trigger ${activeTabIdx === idx ? "active" : ""}`}
                  onClick={(e) => {
                    e.preventDefault();
                    setActiveTabIdx(idx);
                  }}
                >
                  {opt.label.split("+")[0].trim()}
                </button>
              ))}
            </div>

            {/* Active Tab input field */}
            {visibleOptions[activeTabIdx] && renderOption(visibleOptions[activeTabIdx])}
          </div>
        ) : (
          /* Stacked Layout */
          <div style={{ display: "flex", flexDirection: "column", gap: "16px" }}>
            {visibleOptions.map(renderOption)}
          </div>
        )}

        {/* Live Canvas Preview Panel */}
        <div className="personalizer-group" style={{ marginTop: "16px" }}>
          <label className="personalizer-label">Engraving / Customization Preview</label>
          <div className="personalizer-canvas-container">
            <canvas ref={canvasRef} id="personalizer-canvas" />
            {isUploading && (
              <div id="personalizer-canvas-loader" style={{ display: "flex" }}>
                <div className="personalizer-spinner" />
                <span>{uploadProgressMsg || "Uploading customization..."}</span>
              </div>
            )}
          </div>
        </div>
      </div>
    );
  };

  // Modal Presentation Overrides
  if (layoutMode === "modal") {
    return (
      <>
        {/* Launcher Button on the main Product detail template flow */}
        <button
          type="button"
          className="personalizer-launcher-btn"
          onClick={(e) => {
            e.preventDefault();
            setIsModalOpen(true);
          }}
          style={{
            // @ts-ignore
            "--personalizer-btn-color": buttonColor,
            "--personalizer-btn-text": buttonTextColor,
          }}
        >
          ✨ {heading}
        </button>

        {/* Fullscreen Overlay Modal wrapper */}
        <div className={`personalizer-modal-overlay ${isModalOpen ? "active" : ""}`}>
          <div className="personalizer-modal-content">
            <button
              type="button"
              className="personalizer-modal-close-btn"
              onClick={() => setIsModalOpen(false)}
            >
              ×
            </button>

            {renderCustomizerCard()}

            <button
              type="button"
              className="personalizer-launcher-btn"
              onClick={(e) => {
                e.preventDefault();
                setIsModalOpen(false);
              }}
              style={{
                width: "100%",
                marginTop: "16px",
                justifyContent: "center",
                // @ts-ignore
                "--personalizer-btn-color": buttonColor,
                "--personalizer-btn-text": buttonTextColor,
              }}
            >
              Confirm Personalization ✓
            </button>
          </div>
        </div>
      </>
    );
  }

  return renderCustomizerCard();
}

// React Mounting client-side entrypoint script execution
document.addEventListener("DOMContentLoaded", () => {
  const mountNode = document.getElementById("product-personalizer-root");
  if (!mountNode) return;

  const productId = mountNode.getAttribute("data-product-id") || "";
  const baseImageUrl = mountNode.getAttribute("data-base-image") || "";
  const shopDomain = mountNode.getAttribute("data-shop-domain") || "";
  const isDemo = mountNode.getAttribute("data-is-demo") === "true";

  let config: CustomizerConfig = { enabled: false, options: [] };
  try {
    config = JSON.parse(mountNode.getAttribute("data-config") || "{}");
  } catch (err) {
    console.error("Failed to parse personalization config:", err);
  }

  if (config.enabled) {
    const root = ReactDOM.createRoot(mountNode);
    root.render(
      <React.StrictMode>
        <StorefrontCustomizer
          productId={productId}
          baseImageUrl={baseImageUrl}
          shopDomain={shopDomain}
          isDemo={isDemo}
          config={config}
        />
      </React.StrictMode>
    );
  }
});
