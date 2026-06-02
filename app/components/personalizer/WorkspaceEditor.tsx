import { useEffect, useState, useRef } from "react";
import { CustomizationOption, isOptionVisible, calculateTotalUpcharges } from "../../utils/configEngine";
import { drawPersonalizerCanvas } from "../../utils/canvasRenderer";

interface WorkspaceEditorProps {
  product: any;
  assets: any[];
  shop: string;
  onBack: () => void;
  onSave: (config: { enabled: boolean; options: CustomizationOption[]; upchargeVariantId: string }) => void;
}

export function WorkspaceEditor({
  product,
  assets,
  shop,
  onBack,
  onSave
}: WorkspaceEditorProps) {
  // Customizer Configuration State
  const [enabled, setEnabled] = useState(false);
  const [options, setOptions] = useState<CustomizationOption[]>([]);
  const [upchargeVariantId, setUpchargeVariantId] = useState("");

  // Canvas Alignment and Drag States
  const [showGrid, setShowGrid] = useState(true);
  const [livePreview, setLivePreview] = useState(false);
  const [mockupView, setMockupView] = useState("Front Mockup View");
  const canvasRef = useRef<HTMLCanvasElement | null>(null);
  const [bgImage, setBgImage] = useState<HTMLImageElement | null>(null);
  const [activeLayerId, setActiveLayerId] = useState<string | null>(null);
  const [hoveredOptionId, setHoveredOptionId] = useState<string | null>(null);
  const [isAddDrawerOpen, setIsAddDrawerOpen] = useState(false);
  const [isSettingsDrawerOpen, setIsSettingsDrawerOpen] = useState(false);

  // Table row actions dropdown state
  const [activeFlyoutId, setActiveFlyoutId] = useState<string | null>(null);
  const [activeAccordion, setActiveAccordion] = useState<string>("basic");

  // Shopper storefront inputs testing states
  const [shopperValues, setShopperValues] = useState<Record<string, any>>({});
  const [draggedIndex, setDraggedIndex] = useState<number | null>(null);

  // Drag and drop / Rotate Canvas State
  const [dragState, setDragState] = useState<{
    isDragging: boolean;
    isResizing: boolean;
    isRotating: boolean;
    resizeHandle: "nw" | "ne" | "sw" | "se" | null;
    startMouseX: number;
    startMouseY: number;
    startCanvasX: number;
    startCanvasY: number;
    startWidth: number;
    startHeight: number;
    startFontSize: number;
    startRotation: number;
  }>({
    isDragging: false,
    isResizing: false,
    isRotating: false,
    resizeHandle: null,
    startMouseX: 0,
    startMouseY: 0,
    startCanvasX: 0,
    startCanvasY: 0,
    startWidth: 250,
    startHeight: 250,
    startFontSize: 48,
    startRotation: 0
  });

  // Filter asset listings
  const fontAssets = assets.filter(a => a.type === "FONT" || a.type === "FONTS");
  const colorAssets = assets.filter(a => a.type === "COLOR" || a.type === "COLORS");
  const optionAssets = assets.filter(a => a.type === "OPTION" || a.type === "OPTIONS");

  // Load custom typography @font-face rules on mount
  useEffect(() => {
    fontAssets.forEach(f => {
      try {
        const val = JSON.parse(f.value);
        const fontName = f.name;
        const fontUrl = val.url;
        const format = val.format || "truetype";
        if (fontUrl) {
          const newStyle = document.createElement("style");
          newStyle.appendChild(document.createTextNode(`@font-face { font-family: "${fontName}"; src: url("${fontUrl}") format("${format}"); }`));
          document.head.appendChild(newStyle);
        }
      } catch (e) {}
    });
  }, [fontAssets]);

  // Load personalization config from product metafield
  useEffect(() => {
    if (product) {
      const configVal = product.metafield?.value;
      if (configVal) {
        try {
          const config = JSON.parse(configVal);
          if (config.options) {
            setOptions(config.options);
            setEnabled(config.enabled ?? false);
            setUpchargeVariantId(config.upchargeVariantId || "");
          } else {
            // Apply fallback default option
            setOptions([getDefaultTextOption()]);
            setEnabled(config.enabled ?? false);
            setUpchargeVariantId("");
          }
        } catch (e) {
          setOptions([getDefaultTextOption()]);
          setEnabled(false);
          setUpchargeVariantId("");
        }
      } else {
        setEnabled(false);
        setUpchargeVariantId("");
        setOptions([getDefaultTextOption()]);
      }
      
      // Load background mockup image
      if (product.featuredImage?.url) {
        const img = new Image();
        img.crossOrigin = "anonymous";
        img.src = product.featuredImage.url;
        img.onload = () => setBgImage(img);
        img.onerror = () => setBgImage(null);
      } else {
        setBgImage(null);
      }
      
      // Reset shopper testing values
      setShopperValues({});
    }
  }, [product]);

  // Refreshes Unified Canvas rendering loop
  useEffect(() => {
    const canvas = canvasRef.current;
    if (!canvas) return;

    drawPersonalizerCanvas({
      canvas,
      options,
      shopperValues,
      bgImage,
      mockupView,
      scale: 0.5, // Admin canvas workspace scale
      activeLayerId,
      hoveredOptionId,
      showGrid,
      livePreview
    });
  }, [options, bgImage, showGrid, livePreview, activeLayerId, hoveredOptionId, shopperValues, mockupView]);

  function getDefaultTextOption(): CustomizationOption {
    return {
      id: "opt-default-text",
      type: "text",
      label: "Engraving Text",
      required: true,
      priceUpcharge: 0.0,
      maxChars: 30,
      placeholder: "Enter text to engrave",
      canvasX: 400,
      canvasY: 400,
      canvasFontSize: 48,
      canvasWidth: 250,
      canvasHeight: 250,
      canvasRotation: 0
    };
  }

  // Adding customization element layouts
  const handleAddElementOption = (type: CustomizationOption["type"]) => {
    const label = type.charAt(0).toUpperCase() + type.slice(1) + " Personalization";
    const newOption: CustomizationOption = {
      id: `opt-${Date.now()}`,
      type,
      label,
      required: false,
      priceUpcharge: 0.0,
      canvasX: 400,
      canvasY: 400,
      canvasWidth: 240,
      canvasHeight: type === "textarea" ? 140 : type === "info" ? 100 : 240,
      canvasRotation: 0,
      canvasFontSize: type === "textarea" ? 32 : 48,
      placeholder: `Enter your customization...`,
      conditionalRules: []
    };

    if (type === "select") {
      newOption.choices = "Option A, Option B, Option C";
    } else if (type === "swatch") {
      newOption.choices = "#000000, #E63946, #457B9D, #1D3557";
      newOption.allowShopperColor = true;
    } else if (type === "clipart") {
      newOption.choices = "Heart, Star, Smiley Face";
    }

    setOptions([...options, newOption]);
    setActiveLayerId(newOption.id);
    setActiveFlyoutId(newOption.id);
    setIsAddDrawerOpen(false);
  };

  const handleRemoveOption = (id: string) => {
    if (confirm("Are you sure you want to remove this option layer?")) {
      setOptions(options.filter(o => o.id !== id));
      if (activeLayerId === id) setActiveLayerId(null);
      if (activeFlyoutId === id) setActiveFlyoutId(null);
    }
  };

  const handleUpdateOption = (id: string, updates: Partial<CustomizationOption>) => {
    setOptions(options.map(o => {
      if (o.id === id) {
        return { ...o, ...updates };
      }
      return o;
    }));
  };

  // Drag-and-drop layer reordering HTML5 Handlers
  const handleDragStart = (idx: number) => {
    setDraggedIndex(idx);
  };
  
  const handleDragOver = (e: React.DragEvent, idx: number) => {
    e.preventDefault();
    if (draggedIndex === null || draggedIndex === idx) return;
    const reordered = [...options];
    const [removed] = reordered.splice(draggedIndex, 1);
    reordered.splice(idx, 0, removed);
    setOptions(reordered);
    setDraggedIndex(idx);
  };

  const handleDragEnd = () => {
    setDraggedIndex(null);
  };

  // Canvas Mouse scaling math
  const getCanvasMousePos = (e: React.MouseEvent<HTMLCanvasElement>) => {
    const canvas = canvasRef.current;
    if (!canvas) return { x: 0, y: 0 };
    const rect = canvas.getBoundingClientRect();
    const x = ((e.clientX - rect.left) / rect.width) * 400;
    const y = ((e.clientY - rect.top) / rect.height) * 400;
    return { x, y };
  };

  // Interactive bounding box selections, rotate & dragging handlers
  const handleCanvasMouseDown = (e: React.MouseEvent<HTMLCanvasElement>) => {
    const { x, y } = getCanvasMousePos(e);
    const mappedX = x * 2;
    const mappedY = y * 2;

    if (activeLayerId) {
      const opt = options.find(o => o.id === activeLayerId);
      if (opt && isOptionVisible(opt, shopperValues)) {
        const cx = opt.canvasX ?? 400;
        const cy = opt.canvasY ?? 400;
        
        let shopperText = shopperValues[opt.id] !== undefined ? shopperValues[opt.id] : opt.label;
        if (opt.caseConstraint === "uppercase") shopperText = String(shopperText).toUpperCase();
        if (opt.caseConstraint === "lowercase") shopperText = String(shopperText).toLowerCase();

        const w = opt.type === "text" || opt.type === "textarea"
          ? ((opt.canvasFontSize ?? 48) * String(shopperText || "Text").length * 0.5) 
          : (opt.canvasWidth ?? 250);
        const h = opt.type === "text" || opt.type === "textarea" 
          ? (opt.canvasFontSize ?? 48) 
          : (opt.canvasHeight ?? 250);

        // Check rotation circle handle
        const handleX = cx;
        const handleY = cy - h/2 - 25;
        const distToRotation = Math.sqrt((mappedX - handleX) ** 2 + (mappedY - handleY) ** 2);
        
        if (distToRotation < 15) {
          setDragState({
            isDragging: false,
            isResizing: false,
            isRotating: true,
            resizeHandle: null,
            startMouseX: mappedX,
            startMouseY: mappedY,
            startCanvasX: cx,
            startCanvasY: cy,
            startWidth: opt.canvasWidth ?? 250,
            startHeight: opt.canvasHeight ?? 250,
            startFontSize: opt.canvasFontSize ?? 48,
            startRotation: opt.canvasRotation ?? 0
          });
          return;
        }

        // Check corner resize handles
        const threshold = 18;
        const left = cx - w/2;
        const right = cx + w/2;
        const top = cy - h/2;
        const bottom = cy + h/2;

        let handle: "nw" | "ne" | "sw" | "se" | null = null;
        if (Math.abs(mappedX - left) < threshold && Math.abs(mappedY - top) < threshold) handle = "nw";
        else if (Math.abs(mappedX - right) < threshold && Math.abs(mappedY - top) < threshold) handle = "ne";
        else if (Math.abs(mappedX - left) < threshold && Math.abs(mappedY - bottom) < threshold) handle = "sw";
        else if (Math.abs(mappedX - right) < threshold && Math.abs(mappedY - bottom) < threshold) handle = "se";

        if (handle) {
          setDragState({
            isDragging: false,
            isResizing: true,
            isRotating: false,
            resizeHandle: handle,
            startMouseX: mappedX,
            startMouseY: mappedY,
            startCanvasX: cx,
            startCanvasY: cy,
            startWidth: opt.canvasWidth ?? 250,
            startHeight: opt.canvasHeight ?? 250,
            startFontSize: opt.canvasFontSize ?? 48,
            startRotation: opt.canvasRotation ?? 0
          });
          return;
        }
      }
    }

    // Layer body selection checking
    for (let i = options.length - 1; i >= 0; i--) {
      const opt = options[i];
      if (!isOptionVisible(opt, shopperValues)) continue;
      
      const cx = opt.canvasX ?? 400;
      const cy = opt.canvasY ?? 400;
      let shopperText = shopperValues[opt.id] !== undefined ? shopperValues[opt.id] : opt.label;
      if (opt.caseConstraint === "uppercase") shopperText = String(shopperText).toUpperCase();
      if (opt.caseConstraint === "lowercase") shopperText = String(shopperText).toLowerCase();

      const w = opt.type === "text" || opt.type === "textarea"
        ? ((opt.canvasFontSize ?? 48) * String(shopperText || "Text").length * 0.5) 
        : (opt.canvasWidth ?? 250);
      const h = opt.type === "text" || opt.type === "textarea" 
        ? (opt.canvasFontSize ?? 48) 
        : (opt.canvasHeight ?? 250);

      if (
        mappedX >= cx - w/2 &&
        mappedX <= cx + w/2 &&
        mappedY >= cy - h/2 &&
        mappedY <= cy + h/2
      ) {
        setActiveLayerId(opt.id);
        setDragState({
          isDragging: true,
          isResizing: false,
          isRotating: false,
          resizeHandle: null,
          startMouseX: mappedX,
          startMouseY: mappedY,
          startCanvasX: cx,
          startCanvasY: cy,
          startWidth: opt.canvasWidth ?? 250,
          startHeight: opt.canvasHeight ?? 250,
          startFontSize: opt.canvasFontSize ?? 48,
          startRotation: opt.canvasRotation ?? 0
        });
        return;
      }
    }

    setActiveLayerId(null);
  };

  const handleCanvasMouseMove = (e: React.MouseEvent<HTMLCanvasElement>) => {
    const { x, y } = getCanvasMousePos(e);
    const mappedX = x * 2;
    const mappedY = y * 2;

    const opt = options.find(o => o.id === activeLayerId);

    if (dragState.isDragging && opt) {
      const dx = mappedX - dragState.startMouseX;
      const dy = mappedY - dragState.startMouseY;
      handleUpdateOption(opt.id, {
        canvasX: Math.round(dragState.startCanvasX + dx),
        canvasY: Math.round(dragState.startCanvasY + dy)
      });
    } else if (dragState.isResizing && opt) {
      const dx = mappedX - dragState.startMouseX;
      const dy = mappedY - dragState.startMouseY;
      const handle = dragState.resizeHandle;

      if (opt.type === "text" || opt.type === "textarea") {
        const factor = handle?.startsWith("s") ? 1 : -1;
        const sizeDelta = Math.round(dy * factor);
        const newSize = Math.max(12, dragState.startFontSize + sizeDelta);
        handleUpdateOption(opt.id, {
          canvasFontSize: newSize
        });
      } else {
        const wFactor = handle?.endsWith("e") ? 1 : -1;
        const hFactor = handle?.startsWith("s") ? 1 : -1;
        
        const newWidth = Math.max(40, dragState.startWidth + Math.round(dx * wFactor));
        const newHeight = Math.max(40, dragState.startHeight + Math.round(dy * hFactor));
        
        handleUpdateOption(opt.id, {
          canvasWidth: newWidth,
          canvasHeight: newHeight
        });
      }
    } else if (dragState.isRotating && opt) {
      const dx = mappedX - opt.canvasX!;
      const dy = mappedY - opt.canvasY!;
      let angle = Math.atan2(dy, dx) * (180 / Math.PI);
      angle = (angle + 90) % 360;
      handleUpdateOption(opt.id, {
        canvasRotation: Math.round(angle)
      });
    } else {
      // Hover checks
      let hoverId = null;
      for (let i = options.length - 1; i >= 0; i--) {
        const o = options[i];
        if (!isOptionVisible(o, shopperValues)) continue;
        
        const cx = o.canvasX ?? 400;
        const cy = o.canvasY ?? 400;
        let shopperText = shopperValues[o.id] !== undefined ? shopperValues[o.id] : o.label;
        if (o.caseConstraint === "uppercase") shopperText = String(shopperText).toUpperCase();
        if (o.caseConstraint === "lowercase") shopperText = String(shopperText).toLowerCase();

        const w = o.type === "text" || o.type === "textarea"
          ? ((o.canvasFontSize ?? 48) * String(shopperText || "Text").length * 0.5)
          : (o.canvasWidth ?? 250);
        const h = o.type === "text" || o.type === "textarea" 
          ? (o.canvasFontSize ?? 48) 
          : (o.canvasHeight ?? 250);

        if (
          mappedX >= cx - w/2 &&
          mappedX <= cx + w/2 &&
          mappedY >= cy - h/2 &&
          mappedY <= cy + h/2
        ) {
          hoverId = o.id;
          break;
        }
      }
      setHoveredOptionId(hoverId);
    }
  };

  const handleCanvasMouseUp = () => {
    setDragState(prev => ({
      ...prev,
      isDragging: false,
      isResizing: false,
      isRotating: false,
      resizeHandle: null
    }));
  };

  const handleShopperValueChange = (optionId: string, value: any) => {
    setShopperValues(prev => ({
      ...prev,
      [optionId]: value
    }));
  };

  const saveConfiguration = () => {
    onSave({
      enabled,
      options,
      upchargeVariantId
    });
  };

  return (
    <div className="editor-fullscreen">
      
      {/* Editor top actions bar */}
      <div className="editor-header">
        <div style={{ display: "flex", alignItems: "center", gap: "12px" }}>
          <button className="btn-secondary" style={{ padding: "6px 12px" }} onClick={onBack}>
            ← Exit editor
          </button>
          <span style={{ fontWeight: 600, fontSize: "15px", color: "#202223" }}>
            Template Designer: <strong style={{ color: "#008060" }}>{product.title}</strong>
          </span>
        </div>

        <div style={{ display: "flex", alignItems: "center", gap: "16px" }}>
          <div style={{ display: "flex", alignItems: "center", gap: "8px" }}>
            <span style={{ fontSize: "13px", fontWeight: 600 }}>Enable store customizer:</span>
            <label className="status-toggle">
              <input
                type="checkbox"
                checked={enabled}
                onChange={(e) => setEnabled(e.target.checked)}
              />
              <span className="status-slider" />
            </label>
          </div>
          
          <button className="btn-primary" onClick={saveConfiguration}>
            💾 Save customization options
          </button>
        </div>
      </div>

      <div className="editor-body">
        
        {/* ==========================================
            1. LEFT PANEL: LAYERS & ELEMENT BUILDER
            ========================================== */}
        <div className="left-panel">
          <div style={{ padding: "16px", borderBottom: "1px solid #e1e3e5", background: "#f9fafb", display: "flex", justifyContent: "space-between", alignItems: "center" }}>
            <span style={{ fontWeight: 700, fontSize: "14px" }}>Layers & Personalization fields</span>
            <button className="btn-primary" style={{ padding: "4px 8px", fontSize: "12px" }} onClick={() => setIsAddDrawerOpen(true)}>
              ➕ Add field layer
            </button>
          </div>

          <div style={{ padding: "16px", overflowY: "auto", flex: 1 }}>
            {options.length === 0 ? (
              <div style={{ textAlign: "center", padding: "40px 10px", color: "#8c9196", fontSize: "12px" }}>
                No layer elements configured yet. Click "Add field layer" to begin.
              </div>
            ) : (
              options.map((opt, idx) => {
                const isSelected = activeLayerId === opt.id;
                return (
                  <div
                    key={opt.id}
                    draggable
                    onDragStart={() => handleDragStart(idx)}
                    onDragOver={(e) => handleDragOver(e, idx)}
                    onDragEnd={handleDragEnd}
                    className={`option-layer-card ${isSelected ? "selected" : ""}`}
                    onClick={() => {
                      setActiveLayerId(opt.id);
                      setActiveFlyoutId(opt.id);
                    }}
                  >
                    <div style={{ color: "#8c9196", cursor: "grab", fontSize: "14px" }}>☰</div>
                    <div style={{ flex: 1, minWidth: 0 }}>
                      <div style={{ fontWeight: 600, fontSize: "13px", overflow: "hidden", textOverflow: "ellipsis", whiteSpace: "nowrap" }}>
                        {opt.label}
                      </div>
                      <div style={{ fontSize: "10px", color: "#6d7175", textTransform: "uppercase" }}>
                        {opt.type} {opt.priceUpcharge > 0 && `• +$${opt.priceUpcharge.toFixed(2)}`}
                      </div>
                    </div>
                    
                    <button
                      className="btn-danger"
                      style={{ padding: "2px 6px", fontSize: "10px" }}
                      onClick={(e) => {
                        e.stopPropagation();
                        handleRemoveOption(opt.id);
                      }}
                    >
                      Delete
                    </button>
                  </div>
                );
              })
            )}
          </div>

          {/* Add Drawer component slider */}
          <div className={`flyout-panel ${isAddDrawerOpen ? "active" : ""}`} style={{ zIndex: 110 }}>
            <div style={{ padding: "16px", borderBottom: "1px solid #e1e3e5", display: "flex", justifyContent: "space-between", alignItems: "center", background: "#f9fafb" }}>
              <span style={{ fontWeight: 700, fontSize: "14px" }}>Add Personalization Option field</span>
              <button className="modal-close" onClick={() => setIsAddDrawerOpen(false)}>×</button>
            </div>
            <div style={{ padding: "16px", display: "flex", flexDirection: "column", gap: "10px", overflowY: "auto" }}>
              <button className="btn-secondary" style={{ justifyContent: "flex-start", padding: "12px" }} onClick={() => handleAddElementOption("text")}>🔤 Short Text Input</button>
              <button className="btn-secondary" style={{ justifyContent: "flex-start", padding: "12px" }} onClick={() => handleAddElementOption("textarea")}>📝 Text Area Block</button>
              <button className="btn-secondary" style={{ justifyContent: "flex-start", padding: "12px" }} onClick={() => handleAddElementOption("select")}>🔽 Select Dropdown</button>
              <button className="btn-secondary" style={{ justifyContent: "flex-start", padding: "12px" }} onClick={() => handleAddElementOption("swatch")}>🎨 Swatches Color picker</button>
              <button className="btn-secondary" style={{ justifyContent: "flex-start", padding: "12px" }} onClick={() => handleAddElementOption("file")}>📁 Decal File Upload</button>
              <button className="btn-secondary" style={{ justifyContent: "flex-start", padding: "12px" }} onClick={() => handleAddElementOption("checkbox")}>☑️ Option Checkbox</button>
              <button className="btn-secondary" style={{ justifyContent: "flex-start", padding: "12px" }} onClick={() => handleAddElementOption("clipart")}>🎨 Clipart Graphic Selector</button>
              <button className="btn-secondary" style={{ justifyContent: "flex-start", padding: "12px" }} onClick={() => handleAddElementOption("font")}>🔤 Typography Font Selector</button>
            </div>
          </div>

          {/* Settings Drawer flyout */}
          {activeFlyoutId && (() => {
            const opt = options.find(o => o.id === activeFlyoutId);
            if (!opt) return null;

            return (
              <div className={`flyout-panel ${activeFlyoutId ? "active" : ""}`}>
                <div style={{ padding: "16px", borderBottom: "1px solid #e1e3e5", display: "flex", justifyContent: "space-between", alignItems: "center", background: "#f9fafb" }}>
                  <span style={{ fontWeight: 700, fontSize: "14px" }}>Configure Layer Details</span>
                  <button className="modal-close" onClick={() => setActiveFlyoutId(null)}>×</button>
                </div>
                
                <div style={{ flex: 1, overflowY: "auto" }}>
                  
                  {/* Accordion 1: Basic Options */}
                  <div className="accordion-item">
                    <div className="accordion-header" onClick={() => setActiveAccordion(activeAccordion === "basic" ? "" : "basic")}>
                      <span>⚙️ Basic settings</span>
                      <span>{activeAccordion === "basic" ? "▲" : "▼"}</span>
                    </div>
                    {activeAccordion === "basic" && (
                      <div className="accordion-content" style={{ display: "flex", flexDirection: "column", gap: "12px" }}>
                        <div>
                          <label style={{ fontSize: "12px", fontWeight: 600, display: "block", marginBottom: "4px" }}>Option Label Title</label>
                          <input
                            type="text"
                            value={opt.label}
                            className="search-input"
                            style={{ width: "100%" }}
                            onChange={(e) => handleUpdateOption(opt.id, { label: e.target.value })}
                          />
                        </div>

                        <div>
                          <label style={{ fontSize: "12px", fontWeight: 600, display: "block", marginBottom: "4px" }}>Required validation check</label>
                          <input
                            type="checkbox"
                            checked={opt.required}
                            id={`required-check-${opt.id}`}
                            onChange={(e) => handleUpdateOption(opt.id, { required: e.target.checked })}
                          />
                          <label htmlFor={`required-check-${opt.id}`} style={{ fontSize: "13px", marginLeft: "6px" }}>Shopper must fill this field</label>
                        </div>

                        <div>
                          <label style={{ fontSize: "12px", fontWeight: 600, display: "block", marginBottom: "4px" }}>Layout price upcharge amount ($)</label>
                          <input
                            type="number"
                            step="0.01"
                            value={opt.priceUpcharge}
                            className="search-input"
                            style={{ width: "100%" }}
                            onChange={(e) => handleUpdateOption(opt.id, { priceUpcharge: parseFloat(e.target.value) || 0 })}
                          />
                        </div>

                        {(opt.type === "text" || opt.type === "textarea") && (
                          <>
                            <div>
                              <label style={{ fontSize: "12px", fontWeight: 600, display: "block", marginBottom: "4px" }}>Characters limit threshold</label>
                              <input
                                type="number"
                                value={opt.maxChars || ""}
                                className="search-input"
                                style={{ width: "100%" }}
                                onChange={(e) => handleUpdateOption(opt.id, { maxChars: parseInt(e.target.value) || undefined })}
                              />
                            </div>
                            <div>
                              <label style={{ fontSize: "12px", fontWeight: 600, display: "block", marginBottom: "4px" }}>Case constraint override</label>
                              <select
                                value={opt.caseConstraint || "normal"}
                                className="filter-select"
                                style={{ width: "100%" }}
                                onChange={(e) => handleUpdateOption(opt.id, { caseConstraint: e.target.value as any })}
                              >
                                <option value="normal">Normal mixed case</option>
                                <option value="uppercase">Uppercase formatting</option>
                                <option value="lowercase">Lowercase formatting</option>
                              </select>
                            </div>
                          </>
                        )}

                        {(opt.type === "select" || opt.type === "swatch" || opt.type === "clipart") && (
                          <div>
                            <label style={{ fontSize: "12px", fontWeight: 600, display: "block", marginBottom: "4px" }}>
                              {opt.type === "swatch" ? "Color Swatches (Hex list comma separated)" : "Choices list (comma separated)"}
                            </label>
                            <textarea
                              value={opt.choices || ""}
                              className="search-input"
                              style={{ width: "100%", height: "60px" }}
                              onChange={(e) => handleUpdateOption(opt.id, { choices: e.target.value })}
                            />
                          </div>
                        )}
                      </div>
                    )}
                  </div>

                  {/* Accordion 2: Canvas Positions */}
                  <div className="accordion-item">
                    <div className="accordion-header" onClick={() => setActiveAccordion(activeAccordion === "canvas" ? "" : "canvas")}>
                      <span>📐 Layout placements (800x800 logical matrix)</span>
                      <span>{activeAccordion === "canvas" ? "▲" : "▼"}</span>
                    </div>
                    {activeAccordion === "canvas" && (
                      <div className="accordion-content" style={{ display: "flex", flexDirection: "column", gap: "12px" }}>
                        <div style={{ display: "flex", gap: "10px" }}>
                          <div style={{ flex: 1 }}>
                            <label style={{ fontSize: "11px", display: "block" }}>X coordinate</label>
                            <input
                              type="number"
                              value={opt.canvasX ?? 400}
                              className="search-input"
                              onChange={(e) => handleUpdateOption(opt.id, { canvasX: parseInt(e.target.value) || 0 })}
                            />
                          </div>
                          <div style={{ flex: 1 }}>
                            <label style={{ fontSize: "11px", display: "block" }}>Y coordinate</label>
                            <input
                              type="number"
                              value={opt.canvasY ?? 400}
                              className="search-input"
                              onChange={(e) => handleUpdateOption(opt.id, { canvasY: parseInt(e.target.value) || 0 })}
                            />
                          </div>
                        </div>

                        {(opt.type === "text" || opt.type === "textarea") ? (
                          <div>
                            <label style={{ fontSize: "11px", display: "block" }}>Logical font size (px)</label>
                            <input
                              type="number"
                              value={opt.canvasFontSize ?? 48}
                              className="search-input"
                              onChange={(e) => handleUpdateOption(opt.id, { canvasFontSize: parseInt(e.target.value) || 0 })}
                            />
                          </div>
                        ) : (
                          <div style={{ display: "flex", gap: "10px" }}>
                            <div style={{ flex: 1 }}>
                              <label style={{ fontSize: "11px", display: "block" }}>Layer Width (px)</label>
                              <input
                                type="number"
                                value={opt.canvasWidth ?? 250}
                                className="search-input"
                                onChange={(e) => handleUpdateOption(opt.id, { canvasWidth: parseInt(e.target.value) || 0 })}
                              />
                            </div>
                            <div style={{ flex: 1 }}>
                              <label style={{ fontSize: "11px", display: "block" }}>Layer Height (px)</label>
                              <input
                                type="number"
                                value={opt.canvasHeight ?? 250}
                                className="search-input"
                                onChange={(e) => handleUpdateOption(opt.id, { canvasHeight: parseInt(e.target.value) || 0 })}
                              />
                            </div>
                          </div>
                        )}

                        <div>
                          <label style={{ fontSize: "11px", display: "block" }}>Layer Rotation angle (0-360°)</label>
                          <input
                            type="range"
                            min="0"
                            max="360"
                            value={opt.canvasRotation ?? 0}
                            style={{ width: "100%" }}
                            onChange={(e) => handleUpdateOption(opt.id, { canvasRotation: parseInt(e.target.value) || 0 })}
                          />
                        </div>
                      </div>
                    )}
                  </div>

                  {/* Accordion 3: Conditional Visibility Logic */}
                  <div className="accordion-item">
                    <div className="accordion-header" onClick={() => setActiveAccordion(activeAccordion === "conditional" ? "" : "conditional")}>
                      <span>🔗 Conditional Logic Rules</span>
                      <span>{activeAccordion === "conditional" ? "▲" : "▼"}</span>
                    </div>
                    {activeAccordion === "conditional" && (
                      <div className="accordion-content" style={{ display: "flex", flexDirection: "column", gap: "10px" }}>
                        <p style={{ fontSize: "11px", color: "#6d7175", margin: 0 }}>
                          Select logic parameters to show or hide this layer element depending on another option field value selection:
                        </p>

                        {(opt.conditionalRules || []).map((rule, ruleIdx) => (
                          <div key={ruleIdx} style={{ display: "flex", flexDirection: "column", gap: "6px", padding: "8px", border: "1px solid #e1e3e5", borderRadius: "6px", background: "#f9fafb" }}>
                            <select
                              value={rule.fieldId}
                              onChange={(e) => {
                                const updatedRules = [...(opt.conditionalRules || [])];
                                updatedRules[ruleIdx].fieldId = e.target.value;
                                handleUpdateOption(opt.id, { conditionalRules: updatedRules });
                              }}
                              className="filter-select"
                              style={{ width: "100%", padding: "6px" }}
                            >
                              <option value="">Select option field...</option>
                              {options.filter(o => o.id !== opt.id).map(o => (
                                <option key={o.id} value={o.id}>{o.label}</option>
                              ))}
                            </select>

                            <select
                              value={rule.operator}
                              onChange={(e) => {
                                const updatedRules = [...(opt.conditionalRules || [])];
                                updatedRules[ruleIdx].operator = e.target.value as any;
                                handleUpdateOption(opt.id, { conditionalRules: updatedRules });
                              }}
                              className="filter-select"
                              style={{ width: "100%", padding: "6px" }}
                            >
                              <option value="equals">Equals</option>
                              <option value="not_equals">Not Equals</option>
                              <option value="checked">Checked</option>
                              <option value="unchecked">Unchecked</option>
                            </select>

                            {rule.operator !== "checked" && rule.operator !== "unchecked" && (
                              <input
                                type="text"
                                className="search-input"
                                style={{ padding: "6px" }}
                                placeholder="Value to match..."
                                value={rule.value}
                                onChange={(e) => {
                                  const updatedRules = [...(opt.conditionalRules || [])];
                                  updatedRules[ruleIdx].value = e.target.value;
                                  handleUpdateOption(opt.id, { conditionalRules: updatedRules });
                                }}
                              />
                            )}

                            <button
                              className="btn-danger"
                              style={{ alignSelf: "flex-end", padding: "4px 8px" }}
                              onClick={() => {
                                const updatedRules = (opt.conditionalRules || []).filter((_, rIdx) => rIdx !== ruleIdx);
                                handleUpdateOption(opt.id, { conditionalRules: updatedRules });
                              }}
                            >
                              Remove Rule
                            </button>
                          </div>
                        ))}

                        <button
                          className="btn-secondary"
                          style={{ width: "100%", padding: "6px", fontSize: "12px", borderStyle: "dashed" }}
                          onClick={() => {
                            const updatedRules = [...(opt.conditionalRules || []), { fieldId: "", operator: "equals" as const, value: "" }];
                            handleUpdateOption(opt.id, { conditionalRules: updatedRules });
                          }}
                        >
                          ➕ Add Conditional Rule
                        </button>
                      </div>
                    )}
                  </div>

                </div>
              </div>
            );
          })()}
        </div>

        {/* ==========================================
            2. CENTER PANEL: THE WYSIWYG CANVAS
            ========================================== */}
        <div className="center-panel">
          <div style={{
            position: "absolute",
            top: "16px",
            display: "flex",
            gap: "14px",
            background: "#ffffff",
            padding: "8px 16px",
            borderRadius: "24px",
            boxShadow: "0 2px 10px rgba(0,0,0,0.05)",
            zIndex: 10,
            alignItems: "center"
          }}>
            <div style={{ display: "flex", alignItems: "center", gap: "6px" }}>
              <input
                type="checkbox"
                id="grid-markers-toggle"
                checked={showGrid}
                onChange={(e) => setShowGrid(e.target.checked)}
              />
              <label htmlFor="grid-markers-toggle" style={{ fontSize: "12px", fontWeight: 600 }}>Show Alignment Grid</label>
            </div>
            
            <span style={{ color: "#e1e3e5" }}>|</span>
            
            <div style={{ display: "flex", alignItems: "center", gap: "8px" }}>
              <span style={{ fontSize: "12px", fontWeight: 600 }}>Live Preview</span>
              <label className="status-toggle" style={{ transform: "scale(0.8)", margin: "0 -4px" }}>
                <input
                  type="checkbox"
                  checked={livePreview}
                  onChange={(e) => setLivePreview(e.target.checked)}
                />
                <span className="status-slider" />
              </label>
            </div>
          </div>

          <div style={{ position: "relative" }}>
            <canvas
              ref={canvasRef}
              onMouseDown={handleCanvasMouseDown}
              onMouseMove={handleCanvasMouseMove}
              onMouseUp={handleCanvasMouseUp}
              onMouseLeave={handleCanvasMouseUp}
              style={{
                border: "1px solid #babfc3",
                borderRadius: "8px",
                boxShadow: "0 4px 20px rgba(0,0,0,0.06)",
                background: "#ffffff",
                cursor: dragState.isDragging ? "grabbing" : dragState.isResizing ? "nwse-resize" : dragState.isRotating ? "crosshair" : "default"
              }}
            />

            {/* Logical coordinate overlays in workspace */}
            {activeLayerId && (() => {
              const opt = options.find(o => o.id === activeLayerId);
              if (!opt || !isOptionVisible(opt, shopperValues)) return null;
              return (
                <div className="coordinates-badge">
                  X: {opt.canvasX} | Y: {opt.canvasY} | Rotation: {opt.canvasRotation}° {opt.canvasWidth && `| W: ${opt.canvasWidth} H: ${opt.canvasHeight}`}
                </div>
              );
            })()}
          </div>

          <div style={{ marginTop: "16px", textAlign: "center", fontSize: "12px", color: "#6d7175" }}>
            💡 Drag elements to position, rotate using the top node, and resize using corner handles!
          </div>
        </div>

        {/* ==========================================
            3. RIGHT PANEL: SHOPPER INPUT PREVIEW
            ========================================== */}
        <div className="right-panel">
          <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", borderBottom: "1px solid #e1e3e5", paddingBottom: "12px" }}>
            <span style={{ fontWeight: 700, fontSize: "14px" }}>🛍️ Shopper Form Preview</span>
            <span className="upcharge-badge">
              + ${calculateTotalUpcharges(options, shopperValues).toFixed(2)} Upcharge
            </span>
          </div>

          <div style={{ flex: 1, display: "flex", flexDirection: "column", gap: "16px" }}>
            {options.map((opt) => {
              if (!isOptionVisible(opt, shopperValues)) return null;

              return (
                <div key={opt.id} style={{ display: "flex", flexDirection: "column", gap: "6px" }}>
                  <label style={{ fontSize: "13px", fontWeight: 600, display: "flex", justifyContent: "space-between" }}>
                    <span>
                      {opt.label} {opt.required && <span style={{ color: "#d82c0d" }}>*</span>}
                    </span>
                    {opt.priceUpcharge > 0 && (
                      <span style={{ color: "#008060", fontSize: "11px" }}>(+${opt.priceUpcharge.toFixed(2)})</span>
                    )}
                  </label>

                  {opt.type === "text" && (
                    <div style={{ position: "relative" }}>
                      <input
                        type="text"
                        maxLength={opt.maxChars}
                        placeholder={opt.placeholder || "Enter engraving text..."}
                        className="search-input"
                        style={{ padding: "8px 12px" }}
                        value={shopperValues[opt.id] || ""}
                        onChange={(e) => handleShopperValueChange(opt.id, e.target.value)}
                      />
                      {opt.maxChars && (
                        <span style={{ fontSize: "10px", color: "#8c9196", position: "absolute", right: "10px", bottom: "-14px" }}>
                          {opt.maxChars - String(shopperValues[opt.id] || "").length} characters left
                        </span>
                      )}
                    </div>
                  )}

                  {opt.type === "textarea" && (
                    <textarea
                      maxLength={opt.maxChars}
                      placeholder={opt.placeholder || "Enter engraving instructions..."}
                      className="search-input"
                      style={{ padding: "8px 12px", height: "60px" }}
                      value={shopperValues[opt.id] || ""}
                      onChange={(e) => handleShopperValueChange(opt.id, e.target.value)}
                    />
                  )}

                  {opt.type === "select" && (
                    <select
                      className="filter-select"
                      style={{ width: "100%" }}
                      value={shopperValues[opt.id] || ""}
                      onChange={(e) => handleShopperValueChange(opt.id, e.target.value)}
                    >
                      <option value="">Choose option...</option>
                      {opt.choices?.split(",").map(c => (
                        <option key={c.trim()} value={c.trim()}>{c.trim()}</option>
                      ))}
                    </select>
                  )}

                  {opt.type === "swatch" && (
                    <div style={{ display: "flex", gap: "8px", flexWrap: "wrap", marginTop: "4px" }}>
                      {opt.choices?.split(",").map(colorHex => {
                        const cleanHex = colorHex.trim();
                        const isActive = shopperValues[opt.id] === cleanHex;
                        return (
                          <span
                            key={cleanHex}
                            className={`swatch-circle ${isActive ? "active" : ""}`}
                            style={{ backgroundColor: cleanHex }}
                            onClick={() => handleShopperValueChange(opt.id, cleanHex)}
                          />
                        );
                      })}
                    </div>
                  )}

                  {opt.type === "file" && (
                    <div style={{ border: "1px dashed #babfc3", padding: "16px", borderRadius: "6px", textAlign: "center", background: "#f9fafb" }}>
                      <span style={{ color: "#6d7175", fontSize: "12px" }}>📁 Drag & drop Decal visual graphic here</span>
                    </div>
                  )}

                  {opt.type === "checkbox" && (
                    <div style={{ display: "flex", alignItems: "center", gap: "8px" }}>
                      <input
                        type="checkbox"
                        id={`chk-sh-${opt.id}`}
                        checked={!!shopperValues[opt.id]}
                        onChange={(e) => handleShopperValueChange(opt.id, e.target.checked)}
                      />
                      <label htmlFor={`chk-sh-${opt.id}`} style={{ fontSize: "13px", cursor: "pointer" }}>
                        Yes, I want this personalization choice!
                      </label>
                    </div>
                  )}

                  {opt.type === "font" && (
                    <select
                      className="filter-select"
                      style={{ width: "100%" }}
                      value={shopperValues[opt.id] || ""}
                      onChange={(e) => handleShopperValueChange(opt.id, e.target.value)}
                    >
                      <option value="Arial">Choose typography style...</option>
                      <option value="Arial">Arial</option>
                      <option value="Times New Roman">Times New Roman</option>
                      {fontAssets.map(f => (
                        <option key={f.id} value={f.name}>{f.name}</option>
                      ))}
                    </select>
                  )}

                  {opt.type === "clipart" && (
                    <div style={{ display: "flex", gap: "8px", flexWrap: "wrap" }}>
                      {opt.choices?.split(",").map(clipartVal => {
                        const cleanVal = clipartVal.trim();
                        const isActive = shopperValues[opt.id] === cleanVal;
                        return (
                          <button
                            key={cleanVal}
                            className="btn-secondary"
                            style={{
                              padding: "6px 12px",
                              fontSize: "11px",
                              borderColor: isActive ? "#008060" : "#babfc3",
                              background: isActive ? "#f0fbf7" : "#ffffff"
                            }}
                            onClick={() => handleShopperValueChange(opt.id, cleanVal)}
                          >
                            {cleanVal}
                          </button>
                        );
                      })}
                    </div>
                  )}

                  {opt.description && (
                    <span style={{ fontSize: "11px", color: "#6d7175", fontStyle: "italic" }}>
                      {opt.description}
                    </span>
                  )}
                </div>
              );
            })}
          </div>

          {/* Checkout simulator button */}
          <div style={{ borderTop: "1px solid #e1e3e5", paddingTop: "16px", marginTop: "auto" }}>
            <button
              className="btn-primary"
              style={{ width: "100%", height: "44px", justifyContent: "center", fontSize: "14px" }}
              onClick={() => alert("Simulation adds this customized design to cart")}
            >
              🛒 Simulate storefront checkout
            </button>
          </div>
        </div>

      </div>

    </div>
  );
}
