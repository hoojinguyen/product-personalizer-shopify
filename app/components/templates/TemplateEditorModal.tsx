import React from "react";

export interface ConditionalRule {
  fieldId: string;
  operator: "equals" | "not_equals" | "checked" | "unchecked";
  value: string;
}

export interface CustomizationOption {
  id: string;
  type: "text" | "select" | "swatch" | "checkbox" | "file" | "clipart";
  label: string;
  required: boolean;
  priceUpcharge: number;
  defaultValue?: string;
  maxChars?: number;
  choices?: string;
  choicesType?: "custom" | "global";
  assetSetId?: string;
  conditionalRules?: ConditionalRule[];
  canvasX?: number;
  canvasY?: number;
  canvasWidth?: number;
  canvasHeight?: number;
  canvasRotation?: number;
  canvasFontSize?: number;
}

interface TemplateEditorModalProps {
  isModalOpen: boolean;
  handleSafeClose: () => void;
  templateName: string;
  setTemplateName: (v: string) => void;
  templateDescription: string;
  setTemplateDescription: (v: string) => void;
  heading: string;
  setHeading: (v: string) => void;
  layoutMode: "stacked" | "tabs" | "modal";
  setLayoutMode: (v: "stacked" | "tabs" | "modal") => void;
  brandColor: string;
  setBrandColor: (v: string) => void;
  buttonColor: string;
  setButtonColor: (v: string) => void;
  buttonTextColor: string;
  setButtonTextColor: (v: string) => void;
  options: CustomizationOption[];
  viewName: string;
  setViewName: (v: string) => void;
  viewBackground: string;
  setViewBackground: (v: string) => void;
  canvasW: number;
  setCanvasW: (v: number) => void;
  canvasH: number;
  setCanvasH: (v: number) => void;
  generatePreview: boolean;
  setGeneratePreview: (v: boolean) => void;
  previewSize: string;
  setPreviewSize: (v: string) => void;
  additionalFile: boolean;
  setAdditionalFile: (v: boolean) => void;
  hideBackground: boolean;
  setHideBackground: (v: boolean) => void;
  customCartLabel: boolean;
  setCustomCartLabel: (v: boolean) => void;
  livePreview: boolean;
  setLivePreview: (v: boolean) => void;
  linkedProducts: string[];
  assets: any[];
  fetcher: any;
  handleUndo: () => void;
  handleRedo: () => void;
  historyIndex: number;
  optionHistory: any[];
  selectedTemplate: any;
  setIsLinkModalOpen: (open: boolean) => void;
  setLinkingTemplateId: (id: string | null) => void;
  handleSaveTemplate: () => void;
  canvasZoom: number;
  setCanvasZoom: React.Dispatch<React.SetStateAction<number>>;
  previewText: string;
  setPreviewText: (v: string) => void;
  previewFont: string;
  setPreviewFont: (v: string) => void;
  previewColor: string;
  setPreviewColor: (v: string) => void;
  canvasRef: React.RefObject<HTMLCanvasElement>;
  selectedOptionId: string | null;
  setSelectedOptionId: (v: string | null) => void;
  handleCanvasMouseDown: (e: React.MouseEvent<HTMLCanvasElement>) => void;
  handleCanvasMouseMove: (e: React.MouseEvent<HTMLCanvasElement>) => void;
  handleCanvasMouseUp: () => void;
  handleAddOption: () => void;
  handleUpdateOption: (id: string, updates: Partial<CustomizationOption>) => void;
  handleUpdateOptionAndPush: (id: string, updates: Partial<CustomizationOption>) => void;
  pendingRemoveId: string | null;
  setPendingRemoveId: (v: string | null) => void;
  handleRemoveOption: (id: string) => void;
  dragOverIdx: number | null;
  setDragOverIdx: (v: number | null) => void;
  handleReorderOption: (fromIdx: number, toIdx: number) => void;
  customizerLoading: boolean;
}

export const TemplateEditorModal: React.FC<TemplateEditorModalProps> = ({
  isModalOpen,
  handleSafeClose,
  templateName,
  setTemplateName,
  templateDescription,
  setTemplateDescription,
  heading,
  setHeading,
  layoutMode,
  setLayoutMode,
  brandColor,
  setBrandColor,
  buttonColor,
  setButtonColor,
  buttonTextColor,
  setButtonTextColor,
  options,
  viewName,
  setViewName,
  viewBackground,
  setViewBackground,
  canvasW,
  setCanvasW,
  canvasH,
  setCanvasH,
  generatePreview,
  setGeneratePreview,
  previewSize,
  setPreviewSize,
  additionalFile,
  setAdditionalFile,
  hideBackground,
  setHideBackground,
  customCartLabel,
  setCustomCartLabel,
  livePreview,
  setLivePreview,
  linkedProducts,
  assets,
  fetcher,
  handleUndo,
  handleRedo,
  historyIndex,
  optionHistory,
  selectedTemplate,
  setIsLinkModalOpen,
  setLinkingTemplateId,
  handleSaveTemplate,
  canvasZoom,
  setCanvasZoom,
  previewText,
  setPreviewText,
  previewFont,
  setPreviewFont,
  previewColor,
  setPreviewColor,
  canvasRef,
  selectedOptionId,
  setSelectedOptionId,
  handleCanvasMouseDown,
  handleCanvasMouseMove,
  handleCanvasMouseUp,
  handleAddOption,
  handleUpdateOption,
  handleUpdateOptionAndPush,
  pendingRemoveId,
  setPendingRemoveId,
  handleRemoveOption,
  dragOverIdx,
  setDragOverIdx,
  handleReorderOption,
  customizerLoading,
}) => {
  if (!isModalOpen) return null;

  const fontAssets = assets.filter((a) => a.type === "FONT" || a.type === "FONTS");
  const colorAssets = assets.filter((a) => a.type === "COLOR" || a.type === "COLORS");
  const optionAssets = assets.filter((a) => a.type === "OPTION" || a.type === "OPTIONS");

  return (
    <div className="customizer-overlay">
      <div className="customizer-card">
        {customizerLoading ? (
          <div className="skeleton-customizer-container" style={{ display: "flex", flexDirection: "column", height: "100%", width: "100%" }}>
            {/* Skeleton Header */}
            <div className="skeleton-header" style={{ height: "64px", borderBottom: "1px solid #ebebeb", display: "flex", alignItems: "center", justifyContent: "space-between", padding: "0 20px" }}>
              <div style={{ display: "flex", alignItems: "center", gap: "12px" }}>
                <div className="skeleton-pulse" style={{ width: "24px", height: "24px", borderRadius: "50%", background: "#f0f0f0" }} />
                <div className="skeleton-pulse" style={{ width: "250px", height: "20px", borderRadius: "4px", background: "#f0f0f0" }} />
              </div>
              <div style={{ display: "flex", gap: "10px" }}>
                <div className="skeleton-pulse" style={{ width: "120px", height: "36px", borderRadius: "6px", background: "#f0f0f0" }} />
                <div className="skeleton-pulse" style={{ width: "120px", height: "36px", borderRadius: "6px", background: "#f0f0f0" }} />
              </div>
            </div>
            {/* Skeleton Body */}
            <div style={{ display: "flex", flex: 1, overflow: "hidden" }}>
              {/* Skeleton Sidebar */}
              <div style={{ width: "320px", borderRight: "1px solid #ebebeb", padding: "20px", display: "flex", flexDirection: "column", gap: "20px" }}>
                <div className="skeleton-pulse" style={{ width: "80px", height: "16px", borderRadius: "4px", background: "#f0f0f0" }} />
                <div className="skeleton-pulse" style={{ width: "100%", height: "40px", borderRadius: "6px", background: "#f0f0f0" }} />
                <div className="skeleton-pulse" style={{ width: "100%", height: "40px", borderRadius: "6px", background: "#f0f0f0" }} />
                <div className="skeleton-pulse" style={{ width: "100%", height: "40px", borderRadius: "6px", background: "#f0f0f0" }} />
                <div className="skeleton-pulse" style={{ width: "100%", height: "150px", borderRadius: "8px", background: "#f0f0f0" }} />
              </div>
              {/* Skeleton Canvas */}
              <div style={{ flex: 1, padding: "40px", display: "flex", flexDirection: "column", alignItems: "center", justifyContent: "center", background: "#f6f6f7" }}>
                <div className="skeleton-pulse" style={{ width: "450px", height: "450px", borderRadius: "12px", background: "#ffffff", border: "1px solid #ebebeb", display: "flex", flexDirection: "column", alignItems: "center", justifyContent: "center", gap: "20px", padding: "20px" }} />
              </div>
            </div>
          </div>
        ) : (
          <>
            {/* Customizer Header */}
            <div className="customizer-header">
              <div style={{ display: "flex", alignItems: "center", gap: "12px" }}>
                <button
                  className="customizer-btn"
                  onClick={handleSafeClose}
                  style={{ border: "none", background: "transparent", padding: "4px 8px", color: "#6d7175", display: "inline-flex", alignItems: "center", justifyContent: "center" }}
                  title="Close Customizer (Esc)"
                >
                  <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round"><line x1="18" y1="6" x2="6" y2="18"/><line x1="6" y1="6" x2="18" y2="18"/></svg>
                </button>
                <h2>Template Customizer: <span style={{ color: "#1a1a1a", fontWeight: "bold" }}>{templateName || "New Template"}</span></h2>
              </div>
              
              <div style={{ display: "flex", gap: "10px", alignItems: "center" }}>
                {/* Undo/Redo Buttons */}
                <div style={{ display: "flex", border: "1px solid #cbd5e1", borderRadius: "6px", background: "#ffffff", marginRight: "10px" }}>
                  <button
                    className="customizer-btn"
                    onClick={handleUndo}
                    disabled={historyIndex <= 0}
                    title="Undo (⌘Z)"
                    style={{ border: "none", borderRadius: "6px 0 0 6px", padding: "8px 12px", background: "transparent", cursor: historyIndex <= 0 ? "not-allowed" : "pointer", opacity: historyIndex <= 0 ? 0.4 : 1, display: "inline-flex", alignItems: "center", gap: "6px" }}
                  >
                    <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round"><path d="M3 7v6h6"/><path d="M21 17a9 9 0 0 0-9-9 9 9 0 0 0-6 2.3L3 13"/></svg>
                    Undo
                  </button>
                  <div style={{ width: "1px", background: "#cbd5e1" }} />
                  <button
                    className="customizer-btn"
                    onClick={handleRedo}
                    disabled={historyIndex >= optionHistory.length - 1}
                    title="Redo (⌘⇧Z)"
                    style={{ border: "none", borderRadius: "0 6px 6px 0", padding: "8px 12px", background: "transparent", cursor: historyIndex >= optionHistory.length - 1 ? "not-allowed" : "pointer", opacity: historyIndex >= optionHistory.length - 1 ? 0.4 : 1, display: "inline-flex", alignItems: "center", gap: "6px" }}
                  >
                    Redo
                    <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round"><path d="M21 7v6h-6"/><path d="M3 17a9 9 0 0 1 9-9 9 9 0 0 1 6 2.3l3 2.7"/></svg>
                  </button>
                </div>
                
                <button
                  className="customizer-btn"
                  onClick={() => {
                    setLinkingTemplateId(selectedTemplate?.id || "temp-draft");
                    setIsLinkModalOpen(true);
                  }}
                  style={{ display: "inline-flex", alignItems: "center", gap: "6px" }}
                >
                  <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round"><path d="M10 13a5 5 0 0 0 7.54.54l3-3a5 5 0 0 0-7.07-7.07l-1.72 1.71"/><path d="M14 11a5 5 0 0 0-7.54-.54l-3 3a5 5 0 0 0 7.07 7.07l1.71-1.71"/></svg>
                  Link to Products ({linkedProducts.length})
                </button>
                <button
                  className="customizer-btn primary"
                  onClick={handleSaveTemplate}
                  disabled={fetcher.state === "submitting"}
                  style={fetcher.state === "submitting" ? { opacity: 0.7, cursor: "not-allowed", display: "inline-flex", alignItems: "center", gap: "6px" } : { display: "inline-flex", alignItems: "center", gap: "6px" }}
                  title="Save Template (⌘S)"
                >
                  {fetcher.state === "submitting" ? (
                    <><span className="save-spinner" /> Saving...</>
                  ) : (
                    <>
                      <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round"><path d="M19 21H5a2 2 0 0 1-2-2V5a2 2 0 0 1 2-2h11l5 5v11a2 2 0 0 1-2 2z"/><polyline points="17 21 17 13 7 13 7 21"/><polyline points="7 3 7 8 15 8"/></svg>
                      Save Template
                    </>
                  )}
                </button>
              </div>
            </div>

            {/* Split pane Workspace */}
            <div className="customizer-pane">
              {/* LEFT SIDEBAR: Config & Elements */}
              <div className="customizer-sidebar">
                {/* View settings tab bar */}
                <div className="customizer-subtabs">
                  <div className="customizer-subtab active">Main View</div>
                </div>

                {/* Sidebar Scrollable accordion panels */}
                <div style={{ flex: 1, overflowY: "auto" }}>
                  {/* Accordion 1: Basic Settings */}
                  <details className="sidebar-accordion" open>
                    <summary>Basic Settings</summary>
                    <div className="accordion-content">
                      <div className="input-group">
                        <label>Template Name</label>
                        <input
                          type="text"
                          className="custom-input"
                          value={templateName}
                          onChange={(e) => setTemplateName(e.target.value)}
                          placeholder="e.g. Chronos C-200 Watch Face"
                        />
                      </div>
                      <div className="input-group">
                        <label>Description</label>
                        <textarea
                          className="custom-input"
                          value={templateDescription}
                          onChange={(e) => setTemplateDescription(e.target.value)}
                          placeholder="Optional helper details..."
                          style={{ minHeight: "60px", resize: "vertical", fontFamily: "inherit" }}
                        />
                      </div>
                      <div className="input-group">
                        <label>Form Header Title</label>
                        <input
                          type="text"
                          className="custom-input"
                          value={heading}
                          onChange={(e) => setHeading(e.target.value)}
                        />
                      </div>
                      <div className="input-group">
                        <label style={{ display: "inline-flex", alignItems: "center" }}>
                          Layout Mode
                          <span className="help-tooltip-container">
                            <span className="help-tooltip-icon">
                              <svg width="12" height="12" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5"><circle cx="12" cy="12" r="10"/><line x1="12" y1="16" x2="12" y2="12"/><line x1="12" y1="8" x2="12.01" y2="8"/></svg>
                            </span>
                            <span className="help-tooltip-text">Controls how personalization options are laid out on your product page (e.g., stacked list, tabs, or modal popup).</span>
                          </span>
                        </label>
                        <select
                          className="custom-input"
                          value={layoutMode}
                          onChange={(e) => setLayoutMode(e.target.value as any)}
                        >
                          <option value="stacked">Stacked Layout (Inline)</option>
                          <option value="tabs">Dynamic Tabs</option>
                          <option value="modal">Sleek Overlay Modal</option>
                        </select>
                      </div>
                      <div className="input-group">
                        <label>View Name</label>
                        <input
                          type="text"
                          className="custom-input"
                          value={viewName}
                          onChange={(e) => setViewName(e.target.value)}
                        />
                      </div>
                      <div className="input-group">
                        <label>View Background</label>
                        <div className="background-grid-picker" style={{ display: "grid", gridTemplateColumns: "repeat(3, 1fr)", gap: "8px", marginTop: "6px" }}>
                          <div 
                            className={`background-grid-item ${viewBackground === "Blank Canvas" ? "active" : ""}`}
                            onClick={() => setViewBackground("Blank Canvas")}
                          >
                            Blank Canvas
                          </div>

                          {assets.filter((a) => a.type === "IMAGE" || a.type === "IMAGES").map((a) => {
                            try {
                              const parsed = JSON.parse(a.value);
                              const isSelected = viewBackground === parsed.url;
                              return (
                                <div 
                                  key={a.id}
                                  className={`background-grid-item ${isSelected ? "active" : ""}`}
                                  onClick={() => setViewBackground(parsed.url)}
                                  title={a.name}
                                  style={{ padding: "2px", position: "relative", overflow: "hidden" }}
                                >
                                  <img 
                                    src={parsed.url} 
                                    alt={a.name} 
                                    style={{ width: "100%", height: "100%", minHeight: "44px", objectFit: "cover", borderRadius: "4px" }} 
                                  />
                                </div>
                              );
                            } catch (e) { return null; }
                          })}

                          {(() => {
                            const isCustom = viewBackground !== "Blank Canvas" && !assets.some((a) => { try { return JSON.parse(a.value).url === viewBackground; } catch (e) { return false; } });
                            return (
                              <div 
                                className={`background-grid-item ${isCustom ? "active" : ""}`}
                                onClick={() => setViewBackground("")}
                              >
                                Custom URL
                              </div>
                            );
                          })()}
                        </div>

                        {(() => {
                          const isCustom = viewBackground !== "Blank Canvas" && !assets.some((a) => { try { return JSON.parse(a.value).url === viewBackground; } catch (e) { return false; } });
                          return isCustom && (
                            <input
                              type="text"
                              className="custom-input"
                              style={{ marginTop: "8px" }}
                              value={viewBackground}
                              onChange={(e) => setViewBackground(e.target.value)}
                              placeholder="Enter image URL or relative path..."
                            />
                          );
                        })()}
                      </div>

                      <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: "10px" }}>
                        <div className="input-group">
                          <label style={{ display: "inline-flex", alignItems: "center" }}>
                            Canvas Width (px)
                            <span className="help-tooltip-container">
                              <span className="help-tooltip-icon">
                                <svg width="10" height="10" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5"><circle cx="12" cy="12" r="10"/><line x1="12" y1="16" x2="12" y2="12"/><line x1="12" y1="8" x2="12.01" y2="8"/></svg>
                              </span>
                              <span className="help-tooltip-text">The logical viewport width of the design canvas. Determines aspect ratio and print/decal coordinates resolution.</span>
                            </span>
                          </label>
                          <input
                            type="number"
                            min="500"
                            max="5000"
                            className="custom-input"
                            value={canvasW}
                            onChange={(e) => setCanvasW(Math.max(500, Math.min(5000, parseInt(e.target.value) || 1000)))}
                          />
                        </div>
                        <div className="input-group">
                          <label style={{ display: "inline-flex", alignItems: "center" }}>
                            Canvas Height (px)
                            <span className="help-tooltip-container">
                              <span className="help-tooltip-icon">
                                <svg width="10" height="10" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5"><circle cx="12" cy="12" r="10"/><line x1="12" y1="16" x2="12" y2="12"/><line x1="12" y1="8" x2="12.01" y2="8"/></svg>
                              </span>
                              <span className="help-tooltip-text">The logical viewport height of the design canvas. Determines aspect ratio and print/decal coordinates resolution.</span>
                            </span>
                          </label>
                          <input
                            type="number"
                            min="500"
                            max="5000"
                            className="custom-input"
                            value={canvasH}
                            onChange={(e) => setCanvasH(Math.max(500, Math.min(5000, parseInt(e.target.value) || 1000)))}
                          />
                        </div>
                      </div>
                    </div>
                  </details>

                  {/* Accordion 2: Cart and Order settings */}
                  <details className="sidebar-accordion">
                    <summary>Cart and Order settings</summary>
                    <div className="accordion-content">
                      <div className="toggle-switch-wrapper">
                        <span className="toggle-switch-label">Generate Preview Image</span>
                        <label className="toggle-switch">
                          <input
                            type="checkbox"
                            checked={generatePreview}
                            onChange={(e) => setGeneratePreview(e.target.checked)}
                          />
                          <span className="toggle-slider" />
                        </label>
                      </div>
                      <div className="input-group">
                        <label>Preview Size quality</label>
                        <select
                          className="custom-input"
                          value={previewSize}
                          onChange={(e) => setPreviewSize(e.target.value)}
                        >
                          <option value="Compressed">Compressed JPG</option>
                          <option value="High">Full Quality PNG</option>
                        </select>
                      </div>
                      <div className="toggle-switch-wrapper">
                        <span className="toggle-switch-label">Include Additional Files</span>
                        <label className="toggle-switch">
                          <input
                            type="checkbox"
                            checked={additionalFile}
                            onChange={(e) => setAdditionalFile(e.target.checked)}
                          />
                          <span className="toggle-slider" />
                        </label>
                      </div>
                      <div className="toggle-switch-wrapper">
                        <span className="toggle-switch-label" style={{ display: "inline-flex", alignItems: "center" }}>
                          Hide Background in order image
                          <span className="help-tooltip-container">
                            <span className="help-tooltip-icon">
                              <svg width="12" height="12" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5"><circle cx="12" cy="12" r="10"/><line x1="12" y1="16" x2="12" y2="12"/><line x1="12" y1="8" x2="12.01" y2="8"/></svg>
                            </span>
                            <span className="help-tooltip-text">If enabled, the canvas background image is excluded from the final customization image saved for order fulfillment.</span>
                          </span>
                        </span>
                        <label className="toggle-switch">
                          <input
                            type="checkbox"
                            checked={hideBackground}
                            onChange={(e) => setHideBackground(e.target.checked)}
                          />
                          <span className="toggle-slider" />
                        </label>
                      </div>
                      <div className="toggle-switch-wrapper">
                        <span className="toggle-switch-label" style={{ display: "inline-flex", alignItems: "center" }}>
                          Custom cart labels override
                          <span className="help-tooltip-container">
                            <span className="help-tooltip-icon">
                              <svg width="12" height="12" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5"><circle cx="12" cy="12" r="10"/><line x1="12" y1="16" x2="12" y2="12"/><line x1="12" y1="8" x2="12.01" y2="8"/></svg>
                            </span>
                            <span className="help-tooltip-text">Allows overriding Shopify cart line item titles with custom names specified under each element's customization properties.</span>
                          </span>
                        </span>
                        <label className="toggle-switch">
                          <input
                            type="checkbox"
                            checked={customCartLabel}
                            onChange={(e) => setCustomCartLabel(e.target.checked)}
                          />
                          <span className="toggle-slider" />
                        </label>
                      </div>
                    </div>
                  </details>

                  {/* Accordion 3: Element options tree */}
                  <details className="sidebar-accordion" open>
                    <summary>Elements Tree</summary>
                    <div className="accordion-content">
                      <div className="toggle-switch-wrapper" style={{ borderBottom: "1px dashed #ebebeb", paddingBottom: "10px" }}>
                        <span className="toggle-switch-label" style={{ fontWeight: 600, color: "#6d7175", fontSize: "11px", textTransform: "uppercase" }}>Show Live Editor Bounds</span>
                        <label className="toggle-switch">
                          <input
                            type="checkbox"
                            checked={livePreview}
                            onChange={(e) => setLivePreview(e.target.checked)}
                          />
                          <span className="toggle-slider" />
                        </label>
                      </div>

                      {options.length === 0 ? (
                        <div style={{ textAlign: "center", padding: "20px 0", color: "#8c9196", fontSize: "12px" }}>
                          There are no elements under this view.
                        </div>
                      ) : (
                        <div style={{ display: "flex", flexDirection: "column", gap: "10px" }}>
                          {options.map((opt, idx) => {
                            const isSelected = selectedOptionId === opt.id;
                            return (
                              <div
                                key={opt.id}
                                draggable
                                onDragStart={(e) => {
                                  e.dataTransfer.setData("text/plain", String(idx));
                                  e.dataTransfer.effectAllowed = "move";
                                }}
                                onDragOver={(e) => {
                                  e.preventDefault();
                                  e.dataTransfer.dropEffect = "move";
                                  setDragOverIdx(idx);
                                }}
                                onDragLeave={() => setDragOverIdx(null)}
                                onDrop={(e) => {
                                  e.preventDefault();
                                  const fromIdx = parseInt(e.dataTransfer.getData("text/plain"), 10);
                                  handleReorderOption(fromIdx, idx);
                                }}
                                className={`option-card-wrapper ${dragOverIdx === idx ? "drag-over" : isSelected ? "selected" : ""}`}
                              >
                                <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", marginBottom: "8px" }}>
                                  <div style={{ display: "flex", alignItems: "center", gap: "6px" }}>
                                    <span style={{ cursor: "grab", color: "#8c9196", display: "inline-flex", alignItems: "center" }} title="Drag to reorder">
                                      <svg width="12" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="3" strokeLinecap="round" strokeLinejoin="round">
                                        <circle cx="9" cy="5" r="1"/>
                                        <circle cx="9" cy="12" r="1"/>
                                        <circle cx="9" cy="19" r="1"/>
                                        <circle cx="15" cy="5" r="1"/>
                                        <circle cx="15" cy="12" r="1"/>
                                        <circle cx="15" cy="19" r="1"/>
                                      </svg>
                                    </span>
                                    <span style={{ fontWeight: 700, fontSize: "12px", color: isSelected ? "#1a1a1a" : "#6d7175" }}>
                                      Option Layer #{idx + 1}
                                    </span>
                                  </div>
                                  {pendingRemoveId === opt.id ? (
                                    <div style={{ display: "flex", gap: "6px", alignItems: "center" }}>
                                      <span style={{ fontSize: "10px", color: "#6d7175" }}>Remove?</span>
                                      <button
                                        onClick={() => { handleRemoveOption(opt.id); setPendingRemoveId(null); }}
                                        style={{ border: "none", background: "#d92d20", color: "#fff", fontSize: "10px", fontWeight: "bold", cursor: "pointer", padding: "2.5px 8px", borderRadius: "4px" }}
                                      >
                                        Yes
                                      </button>
                                      <button
                                        onClick={() => setPendingRemoveId(null)}
                                        style={{ border: "1px solid #cbd5e1", background: "#fff", color: "#1a1a1a", fontSize: "10px", fontWeight: "bold", cursor: "pointer", padding: "2.5px 8px", borderRadius: "4px" }}
                                      >
                                        Cancel
                                      </button>
                                    </div>
                                  ) : (
                                    <button
                                      onClick={() => setPendingRemoveId(opt.id)}
                                      style={{ border: "none", background: "none", color: "#d92d20", fontSize: "11px", fontWeight: "bold", cursor: "pointer", display: "inline-flex", alignItems: "center", gap: "2px" }}
                                    >
                                      <svg width="12" height="12" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round"><polyline points="3 6 5 6 21 6"/><path d="M19 6v14a2 2 0 0 1-2 2H7a2 2 0 0 1-2-2V6m3 0V4a2 2 0 0 1 2-2h4a2 2 0 0 1 2 2v2"/></svg>
                                      Remove
                                    </button>
                                  )}
                                </div>
                                <input
                                  type="text"
                                  className="custom-input"
                                  style={{ width: "100%", padding: "4px 8px", fontSize: "12px", marginBottom: "8px" }}
                                  value={opt.label}
                                  onChange={(e) => handleUpdateOption(opt.id, { label: e.target.value })}
                                />
                                <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: "8px", marginBottom: "8px" }}>
                                  <div>
                                    <label style={{ fontSize: "9px", color: "#8c9196", textTransform: "uppercase" }}>Type</label>
                                    <select
                                      className="custom-input"
                                      style={{ width: "100%", padding: "4px", fontSize: "11px" }}
                                      value={opt.type}
                                      onChange={(e) => handleUpdateOptionAndPush(opt.id, { type: e.target.value as any })}
                                    >
                                      <option value="text">Single Line Text</option>
                                      <option value="select">Dropdown Choice</option>
                                      <option value="swatch">Color Swatch Palette</option>
                                      <option value="file">File Decal Upload</option>
                                      <option value="checkbox">Option Checkbox</option>
                                    </select>
                                  </div>
                                  <div>
                                    <label style={{ fontSize: "9px", color: "#8c9196", textTransform: "uppercase", display: "inline-flex", alignItems: "center" }}>
                                      Upcharge ($)
                                      <span className="help-tooltip-container">
                                        <span className="help-tooltip-icon" style={{ marginLeft: "2px" }}>
                                          <svg width="8" height="8" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5"><circle cx="12" cy="12" r="10"/><line x1="12" y1="16" x2="12" y2="12"/><line x1="12" y1="8" x2="12.01" y2="8"/></svg>
                                        </span>
                                        <span className="help-tooltip-text" style={{ textTransform: "none", fontWeight: "normal", fontSize: "10px", width: "140px" }}>An optional extra fee added to product base price when this option is selected.</span>
                                      </span>
                                    </label>
                                    <input
                                      type="number"
                                      step="0.01"
                                      className="custom-input"
                                      style={{ width: "100%", padding: "4px", fontSize: "11px" }}
                                      value={opt.priceUpcharge}
                                      onChange={(e) => handleUpdateOption(opt.id, { priceUpcharge: parseFloat(e.target.value) || 0 })}
                                    />
                                  </div>
                                </div>

                                {/* Choices Sets */}
                                {(opt.type === "select" || opt.type === "swatch") && (
                                  <div style={{ marginTop: "6px", borderTop: "1px dashed #e1e3e6", paddingTop: "6px" }}>
                                    <div style={{ display: "flex", gap: "10px", alignItems: "center", marginBottom: "4px" }}>
                                      <label style={{ fontSize: "10px", fontWeight: "bold" }}>Choices:</label>
                                      <label style={{ fontSize: "10px", cursor: "pointer" }}>
                                        <input
                                          type="radio"
                                          name={`choicesType-${opt.id}`}
                                          checked={opt.choicesType !== "global"}
                                          onChange={() => handleUpdateOptionAndPush(opt.id, { choicesType: "custom" })}
                                        /> Custom
                                      </label>
                                      <label style={{ fontSize: "10px", cursor: "pointer" }}>
                                        <input
                                          type="radio"
                                          name={`choicesType-${opt.id}`}
                                          checked={opt.choicesType === "global"}
                                          onChange={() => handleUpdateOptionAndPush(opt.id, { choicesType: "global" })}
                                        /> Asset Link
                                      </label>
                                    </div>
                                    {opt.choicesType === "global" ? (
                                      <select
                                        className="custom-input"
                                        style={{ width: "100%", padding: "4px", fontSize: "11px" }}
                                        value={opt.assetSetId || ""}
                                        onChange={(e) => {
                                          const asset = assets.find(a => a.id === e.target.value);
                                          handleUpdateOptionAndPush(opt.id, { assetSetId: e.target.value, choices: asset?.value || "" });
                                        }}
                                      >
                                        <option value="">Select Asset...</option>
                                        {opt.type === "swatch"
                                          ? colorAssets.map(c => <option key={c.id} value={c.id}>🎨 {c.name}</option>)
                                          : optionAssets.map(o => <option key={o.id} value={o.id}>📋 {o.name}</option>)
                                        }
                                      </select>
                                    ) : (
                                      <input
                                        type="text"
                                        className="custom-input"
                                        style={{ width: "100%", padding: "4px", fontSize: "11px" }}
                                        placeholder={opt.type === "swatch" ? "#000, #fff" : "Option A, Option B"}
                                        value={opt.choices || ""}
                                        onChange={(e) => handleUpdateOption(opt.id, { choices: e.target.value })}
                                      />
                                    )}
                                  </div>
                                )}

                                {/* Coordinate layouts settings */}
                                {(opt.type === "text" || opt.type === "clipart" || opt.type === "file") && (
                                  <div style={{ marginTop: "10px", borderTop: "1px dashed #cbd5e1", paddingTop: "10px" }}>
                                    <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: "10px" }}>
                                      <div className="input-group">
                                        <label style={{ fontSize: "9px" }}>X Position</label>
                                        <input
                                          type="number"
                                          className="custom-input"
                                          style={{ padding: "4px 8px", fontSize: "11px", width: "100%" }}
                                          value={opt.canvasX ?? 500}
                                          onChange={(e) => handleUpdateOption(opt.id, { canvasX: parseInt(e.target.value) || 0 })}
                                        />
                                      </div>
                                      <div className="input-group">
                                        <label style={{ fontSize: "9px" }}>Y Position</label>
                                        <input
                                          type="number"
                                          className="custom-input"
                                          style={{ padding: "4px 8px", fontSize: "11px", width: "100%" }}
                                          value={opt.canvasY ?? 500}
                                          onChange={(e) => handleUpdateOption(opt.id, { canvasY: parseInt(e.target.value) || 0 })}
                                        />
                                      </div>
                                    </div>
                                    <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: "10px", marginTop: "8px" }}>
                                      {opt.type === "text" ? (
                                        <div className="input-group">
                                          <label style={{ fontSize: "9px" }}>Font Size (px)</label>
                                          <input
                                            type="number"
                                            className="custom-input"
                                            style={{ padding: "4px 8px", fontSize: "11px", width: "100%" }}
                                            value={opt.canvasFontSize ?? 80}
                                            onChange={(e) => handleUpdateOption(opt.id, { canvasFontSize: parseInt(e.target.value) || 12 })}
                                          />
                                        </div>
                                      ) : (
                                        <>
                                          <div className="input-group">
                                            <label style={{ fontSize: "9px" }}>Width (px)</label>
                                            <input
                                              type="number"
                                              className="custom-input"
                                              style={{ padding: "4px 8px", fontSize: "11px", width: "100%" }}
                                              value={opt.canvasWidth ?? 250}
                                              onChange={(e) => handleUpdateOption(opt.id, { canvasWidth: parseInt(e.target.value) || 10 })}
                                            />
                                          </div>
                                          <div className="input-group">
                                            <label style={{ fontSize: "9px" }}>Height (px)</label>
                                            <input
                                              type="number"
                                              className="custom-input"
                                              style={{ padding: "4px 8px", fontSize: "11px", width: "100%" }}
                                              value={opt.canvasHeight ?? 250}
                                              onChange={(e) => handleUpdateOption(opt.id, { canvasHeight: parseInt(e.target.value) || 10 })}
                                            />
                                          </div>
                                        </>
                                      )}
                                      <div className="input-group">
                                        <label style={{ fontSize: "9px" }}>Rotation (°)</label>
                                        <input
                                          type="number"
                                          min="-360"
                                          max="360"
                                          className="custom-input"
                                          style={{ padding: "4px 8px", fontSize: "11px", width: "100%" }}
                                          value={opt.canvasRotation ?? 0}
                                          onChange={(e) => handleUpdateOption(opt.id, { canvasRotation: parseInt(e.target.value) || 0 })}
                                        />
                                      </div>
                                    </div>
                                  </div>
                                )}
                              </div>
                            );
                          })}
                        </div>
                      )}

                      <button
                        className="customizer-btn"
                        onClick={handleAddOption}
                        style={{ width: "100%", marginTop: "12px", display: "inline-flex", alignItems: "center", justifyContent: "center", gap: "6px" }}
                      >
                        <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5"><line x1="12" y1="5" x2="12" y2="19"/><line x1="5" y1="12" x2="19" y2="12"/></svg>
                        Add Layer Element
                      </button>
                    </div>
                  </details>
                </div>
              </div>

              {/* RIGHT CANVAS: Interactive design mockup */}
              <div className="customizer-main">
                <div className="canvas-frame-container">
                  <div style={{ position: "relative", maxWidth: "100%", padding: "10px", background: "#fcfcfc", border: "1px dashed #cbd5e1", borderRadius: "8px" }}>
                    <canvas
                      ref={canvasRef}
                      onMouseDown={handleCanvasMouseDown}
                      onMouseMove={handleCanvasMouseMove}
                      onMouseUp={handleCanvasMouseUp}
                      onMouseLeave={handleCanvasMouseUp}
                      className="canvas-interactive"
                      style={{ transform: `scale(${canvasZoom / 100})`, transformOrigin: "center center", transition: "transform 0.1s ease" }}
                    />
                    
                    {/* Floating Zoom Controls over Canvas (P2) */}
                    <div style={{
                      position: "absolute",
                      bottom: "20px",
                      right: "20px",
                      display: "flex",
                      background: "#ffffff",
                      border: "1px solid #cbd5e1",
                      borderRadius: "6px",
                      padding: "3px",
                      boxShadow: "0 2px 8px rgba(0,0,0,0.1)",
                      zIndex: 10
                    }}>
                      <button
                        onClick={() => setCanvasZoom((prev) => Math.max(25, prev - 10))}
                        style={{ border: "none", background: "none", cursor: "pointer", padding: "4px 8px", display: "inline-flex", alignItems: "center", justifyContent: "center", color: "#6d7175" }}
                        title="Zoom Out"
                      >
                        <svg width="12" height="12" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round"><line x1="5" y1="12" x2="19" y2="12"/></svg>
                      </button>
                      <div style={{ width: "1px", background: "#cbd5e1" }} />
                      <button
                        onClick={() => setCanvasZoom(100)}
                        style={{ border: "none", background: "none", cursor: "pointer", fontSize: "11px", padding: "4px 6px", fontWeight: "bold", color: "#1a1a1a", display: "inline-flex", alignItems: "center", justifyContent: "center" }}
                        title="Reset Zoom to 100%"
                      >
                        Reset (100%)
                      </button>
                      <div style={{ width: "1px", background: "#cbd5e1" }} />
                      <button
                        onClick={() => setCanvasZoom((prev) => Math.max(25, Math.min(200, prev + 10)))}
                        style={{ border: "none", background: "none", cursor: "pointer", padding: "4px 8px", display: "inline-flex", alignItems: "center", justifyContent: "center", color: "#6d7175" }}
                        title="Zoom In"
                      >
                        <svg width="12" height="12" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round"><line x1="12" y1="5" x2="12" y2="19"/><line x1="5" y1="12" x2="19" y2="12"/></svg>
                      </button>
                    </div>
                  </div>

                  {/* Zoom controls (P2) */}
                  <div style={{ display: "flex", alignItems: "center", gap: "10px", width: "100%", justifyContent: "center", marginTop: "4px" }}>
                    <span style={{ fontSize: "12px", color: "#6d7175" }}>Zoom:</span>
                    <button
                      className="customizer-btn"
                      style={{ padding: "2px 8px", fontSize: "12px" }}
                      onClick={() => setCanvasZoom((prev) => Math.max(25, prev - 10))}
                    >
                      -
                    </button>
                    <input
                      type="range"
                      min="25"
                      max="200"
                      step="5"
                      value={canvasZoom}
                      onChange={(e) => setCanvasZoom(parseInt(e.target.value))}
                      style={{ flex: 1, accentColor: "#1a1a1a" }}
                    />
                    <button
                      className="customizer-btn"
                      style={{ padding: "2px 8px", fontSize: "12px" }}
                      onClick={() => setCanvasZoom((prev) => Math.max(25, Math.min(200, prev + 10)))}
                    >
                      +
                    </button>
                    <span style={{ fontSize: "12px", minWidth: "35px", textAlign: "right", fontWeight: 600 }}>{canvasZoom}%</span>
                    <button
                      className="customizer-btn"
                      style={{ padding: "2px 8px", fontSize: "12px", border: "none", background: "transparent", color: "#1a1a1a", fontWeight: "bold" }}
                      onClick={() => setCanvasZoom(100)}
                    >
                      Reset
                    </button>
                  </div>

                  {/* Canvas Dynamic testing fields */}
                  <div style={{ width: "100%", display: "flex", flexDirection: "column", gap: "12px", background: "#ffffff", border: "1px solid #ebebeb", boxShadow: "0 2px 8px rgba(0,0,0,0.04)", padding: "16px", borderRadius: "10px", marginTop: "24px" }}>
                    <div style={{ display: "flex", alignItems: "center", gap: "6px" }}>
                      <span style={{ fontSize: "14px" }}>⚙️</span>
                      <span style={{ fontWeight: 700, fontSize: "12px", color: "#2c3e50", letterSpacing: "0.5px", textTransform: "uppercase" }}>Interactive Tester Controls</span>
                    </div>
                    
                    <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr 1fr", gap: "12px" }}>
                      <div className="input-group">
                        <label style={{ fontSize: "11px", fontWeight: 600, color: "#6d7175", marginBottom: "4px" }}>Sample Text</label>
                        <input
                          type="text"
                          className="custom-input"
                          style={{ padding: "8px 10px", fontSize: "12px", borderRadius: "6px", border: "1px solid #babfc3" }}
                          value={previewText}
                          onChange={(e) => setPreviewText(e.target.value)}
                        />
                      </div>
                      <div className="input-group">
                        <label style={{ fontSize: "11px", fontWeight: 600, color: "#6d7175", marginBottom: "4px" }}>Sample Font</label>
                        <select
                          className="custom-input"
                          style={{ padding: "8px 10px", fontSize: "12px", borderRadius: "6px", border: "1px solid #babfc3", height: "34px" }}
                          value={previewFont}
                          onChange={(e) => setPreviewFont(e.target.value)}
                        >
                          <option value="Arial">Arial (System)</option>
                          <option value="Times New Roman">Times New Roman</option>
                          {fontAssets.map((f) => (
                            <option key={f.id} value={f.name}>{f.name}</option>
                          ))}
                        </select>
                      </div>
                      <div className="input-group">
                        <label style={{ fontSize: "11px", fontWeight: 600, color: "#6d7175", marginBottom: "4px" }}>Sample Color</label>
                        <select
                          className="custom-input"
                          style={{ padding: "8px 10px", fontSize: "12px", borderRadius: "6px", border: "1px solid #babfc3", height: "34px" }}
                          value={previewColor}
                          onChange={(e) => setPreviewColor(e.target.value)}
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
          </>
        )}
      </div>
    </div>
  );
};
