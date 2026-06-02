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

  // Reorder and popover states
  const [isAddMenuOpen, setIsAddMenuOpen] = useState(false);
  const [draggedIndex, setDraggedIndex] = useState<number | null>(null);

  // Right Sidebar active mode: "designer" or "shopper"
  const [rightSidebarMode, setRightSidebarMode] = useState<"designer" | "shopper">("designer");

  // Shopper storefront inputs testing states
  const [shopperValues, setShopperValues] = useState<Record<string, any>>({});

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
      activeLayerId: rightSidebarMode === "designer" ? activeLayerId : null, // Hide active outline bounds in storefront preview mode
      hoveredOptionId,
      showGrid,
      livePreview
    });
  }, [options, bgImage, showGrid, livePreview, activeLayerId, hoveredOptionId, shopperValues, mockupView, rightSidebarMode]);

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
    setRightSidebarMode("designer");
    setIsAddMenuOpen(false);
  };

  const handleRemoveOption = (id: string) => {
    if (confirm("Are you sure you want to remove this option layer?")) {
      setOptions(options.filter(o => o.id !== id));
      if (activeLayerId === id) setActiveLayerId(null);
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
    if (rightSidebarMode !== "designer") return; // Prevent edits in shopper mode
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
    if (rightSidebarMode !== "designer") return;
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

  // Get active layer details
  const activeLayer = options.find(o => o.id === activeLayerId);

  // Extract variants from product if loaded
  const variants = product.variants?.edges?.map((e: any) => e.node) || [];

  return (
    <div className="editor-fullscreen">
      
      {/* Styles Injections for Fluid 3-Column Polaris UI */}
      <style>{`
        .editor-fullscreen {
          position: fixed;
          top: 0; left: 0; right: 0; bottom: 0;
          background-color: var(--p-color-bg-surface-secondary);
          z-index: 999;
          display: flex;
          flex-direction: column;
          font-family: -apple-system, BlinkMacSystemFont, "San Francisco", "Segoe UI", Roboto, "Helvetica Neue", sans-serif;
        }
        .editor-header {
          height: 56px;
          background-color: var(--p-color-bg-surface);
          border-bottom: 1px solid var(--p-color-border-muted);
          display: flex;
          align-items: center;
          justify-content: space-between;
          padding: 0 16px;
          box-shadow: 0 1px 2px rgba(0,0,0,0.02);
        }
        .editor-body {
          flex: 1;
          display: flex;
          overflow: hidden;
        }
        .left-panel {
          width: 320px;
          background-color: var(--p-color-bg-surface);
          border-right: 1px solid var(--p-color-border-muted);
          display: flex;
          flex-direction: column;
          position: relative;
          overflow: hidden;
        }
        .center-panel {
          flex: 1;
          background-color: var(--p-color-bg-surface-secondary);
          background-image: radial-gradient(var(--p-color-border-muted) 1px, transparent 1px);
          background-size: 16px 16px;
          display: flex;
          flex-direction: column;
          align-items: center;
          justify-content: center;
          position: relative;
          padding: 24px;
        }
        .right-panel {
          width: 360px;
          background-color: var(--p-color-bg-surface);
          border-left: 1px solid var(--p-color-border-muted);
          display: flex;
          flex-direction: column;
          overflow: hidden;
        }
        .panel-content {
          flex: 1;
          overflow-y: auto;
          padding: 16px;
          display: flex;
          flex-direction: column;
          gap: 16px;
        }
        .layer-card {
          display: flex;
          align-items: center;
          gap: 12px;
          padding: 12px;
          background-color: var(--p-color-bg-surface);
          border: 1px solid var(--p-color-border-muted);
          border-radius: 8px;
          margin-bottom: 8px;
          cursor: grab;
          transition: all 0.15s ease;
        }
        .layer-card:hover {
          background-color: var(--p-color-bg-surface-hover);
          border-color: var(--p-color-border-hover);
        }
        .layer-card.selected {
          background-color: var(--p-color-bg-surface-active);
          border-color: var(--p-color-border-active);
          box-shadow: 0 0 0 1px var(--p-color-border-active);
        }
        .canvas-container {
          position: relative;
          background-color: var(--p-color-bg-surface);
          border-radius: 12px;
          box-shadow: var(--p-shadow-300);
          border: 1px solid var(--p-color-border-muted);
          padding: 16px;
        }
        .floating-toolbar {
          position: absolute;
          top: 16px;
          display: flex;
          gap: 12px;
          background-color: var(--p-color-bg-surface);
          padding: 6px 12px;
          border-radius: 24px;
          box-shadow: var(--p-shadow-200);
          border: 1px solid var(--p-color-border-muted);
          z-index: 10;
          align-items: center;
        }
        .tab-header {
          display: flex;
          border-bottom: 1px solid var(--p-color-border-muted);
          background-color: var(--p-color-bg-surface-secondary);
        }
        .tab-button {
          flex: 1;
          padding: 12px;
          background: none;
          border: none;
          font-weight: 600;
          font-size: 13px;
          cursor: pointer;
          color: var(--p-color-text-secondary);
          border-bottom: 2px solid transparent;
          transition: all 0.15s ease;
        }
        .tab-button:hover {
          color: var(--p-color-text);
          background-color: var(--p-color-bg-surface-hover);
        }
        .tab-button.active {
          color: var(--p-color-text-active);
          border-bottom-color: var(--p-color-border-active);
          background-color: var(--p-color-bg-surface);
        }
        .settings-section-title {
          font-weight: 700;
          font-size: 11px;
          text-transform: uppercase;
          color: var(--p-color-text-secondary);
          letter-spacing: 0.05em;
          margin-bottom: 6px;
          margin-top: 10px;
        }
        .settings-group {
          display: flex;
          flex-direction: column;
          gap: 12px;
          padding: 12px;
          background-color: var(--p-color-bg-surface-secondary);
          border-radius: 8px;
          border: 1px solid var(--p-color-border-muted);
          margin-bottom: 12px;
        }
        .swatch-item {
          width: 28px;
          height: 28px;
          border-radius: 50%;
          border: 2px solid var(--p-color-border-muted);
          cursor: pointer;
          transition: all 0.15s ease;
        }
        .swatch-item.active {
          transform: scale(1.1);
          border-color: var(--p-color-border-active);
          box-shadow: 0 0 0 2px var(--p-color-bg-surface);
        }
        .coordinates-overlay {
          background-color: rgba(0, 0, 0, 0.85);
          color: #fff;
          position: absolute;
          bottom: 12px;
          right: 12px;
          padding: 4px 8px;
          border-radius: 4px;
          font-size: 10px;
          font-family: monospace;
          pointer-events: none;
          z-index: 5;
        }
        .upcharge-pill {
          background-color: var(--p-color-bg-success-subdued);
          color: var(--p-color-text-success);
          padding: 2px 8px;
          border-radius: 12px;
          font-size: 11px;
          font-weight: 700;
        }
      `}</style>

      {/* 🟢 TOP ACTION BAR */}
      <div className="editor-header">
        <div style={{ display: "flex", alignItems: "center", gap: "12px" }}>
          <div style={{ display: "inline-flex" }}>
            <s-button variant="secondary" onClick={onBack}>
              ← Exit Editor
            </s-button>
          </div>
          <h2 style={{ fontSize: "15px", fontWeight: 600, margin: 0, color: "var(--p-color-text)" }}>
            Template Designer: <strong style={{ color: "var(--p-color-text-success)" }}>{product.title}</strong>
          </h2>
        </div>

        <div style={{ display: "flex", alignItems: "center", gap: "16px" }}>
          <s-checkbox
            label="Enable Customizer"
            checked={enabled}
            onChange={(e: any) => setEnabled(e.currentTarget.checked)}
          />
          <div style={{ display: "inline-flex" }}>
            <s-button variant="primary" onClick={saveConfiguration}>
              💾 Save Settings
            </s-button>
          </div>
        </div>
      </div>

      <div className="editor-body">
        
        {/* ==========================================
            1. LEFT PANEL: LAYERS & ELEMENT BUILDER
            ========================================== */}
        <div className="left-panel">
          <div style={{
            padding: "12px 16px",
            borderBottom: "1px solid var(--p-color-border-muted)",
            background: "var(--p-color-bg-surface-secondary)",
            display: "flex",
            justifyContent: "space-between",
            alignItems: "center"
          }}>
            <h3 style={{ fontSize: "14px", fontWeight: 600, margin: 0 }}>Layers Hierarchy</h3>
            
            <div style={{ position: "relative" }}>
              <div style={{ display: "inline-flex" }}>
                <s-button variant="secondary" onClick={() => setIsAddMenuOpen(!isAddMenuOpen)}>
                  ➕ Add Layer
                </s-button>
              </div>

              {isAddMenuOpen && (
                <>
                  <div
                    style={{ position: "fixed", top: 0, left: 0, right: 0, bottom: 0, zIndex: 100 }}
                    onClick={() => setIsAddMenuOpen(false)}
                  />
                  <div style={{
                    position: "absolute",
                    right: "0",
                    top: "36px",
                    background: "var(--p-color-bg-surface)",
                    border: "1px solid var(--p-color-border-muted)",
                    borderRadius: "8px",
                    boxShadow: "var(--p-shadow-200)",
                    zIndex: 101,
                    width: "220px",
                    display: "flex",
                    flexDirection: "column",
                    padding: "8px",
                    gap: "4px"
                  }}>
                    <div style={{ display: "flex", flexDirection: "column", gap: "4px" }}>
                      <s-button variant="secondary" onClick={() => handleAddElementOption("text")}>🔤 Short Text Input</s-button>
                      <s-button variant="secondary" onClick={() => handleAddElementOption("textarea")}>📝 Text Area Block</s-button>
                      <s-button variant="secondary" onClick={() => handleAddElementOption("select")}>🔽 Select Dropdown</s-button>
                      <s-button variant="secondary" onClick={() => handleAddElementOption("swatch")}>🎨 Swatches Color</s-button>
                      <s-button variant="secondary" onClick={() => handleAddElementOption("file")}>📁 Decal File Upload</s-button>
                      <s-button variant="secondary" onClick={() => handleAddElementOption("checkbox")}>☑️ Option Checkbox</s-button>
                      <s-button variant="secondary" onClick={() => handleAddElementOption("clipart")}>🎨 Clipart Graphic</s-button>
                      <s-button variant="secondary" onClick={() => handleAddElementOption("font")}>🔤 Typography Font</s-button>
                    </div>
                  </div>
                </>
              )}
            </div>
          </div>

          <div style={{ padding: "16px", overflowY: "auto", flex: 1 }}>
            {options.length === 0 ? (
              <div style={{ textAlign: "center", padding: "40px 10px", color: "var(--p-color-text-secondary)", fontSize: "13px" }}>
                No layer elements configured yet. Click "Add Layer" to begin.
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
                    className={`layer-card ${isSelected ? "selected" : ""}`}
                    onClick={() => {
                      setActiveLayerId(opt.id);
                      setRightSidebarMode("designer");
                    }}
                  >
                    <div style={{ color: "var(--p-color-text-secondary)", cursor: "grab", fontSize: "14px" }}>☰</div>
                    <div style={{ flex: 1, minWidth: 0 }}>
                      <p style={{ fontSize: "13px", fontWeight: 600, margin: 0, overflow: "hidden", textOverflow: "ellipsis", whiteSpace: "nowrap" }}>
                        {opt.label}
                      </p>
                      <span style={{ fontSize: "11px", color: "var(--p-color-text-secondary)", textTransform: "uppercase" }}>
                        {opt.type} {opt.priceUpcharge > 0 && `• +$${opt.priceUpcharge.toFixed(2)}`}
                      </span>
                    </div>
                    
                    <div style={{ display: "inline-flex" }}>
                      <s-button
                        variant="secondary"
                        onClick={(e: any) => {
                          e.stopPropagation();
                          handleRemoveOption(opt.id);
                        }}
                      >
                        Delete
                      </s-button>
                    </div>
                  </div>
                );
              })
            )}
          </div>
        </div>

        {/* ==========================================
            2. CENTER PANEL: THE WYSIWYG CANVAS
            ========================================== */}
        <div className="center-panel">
          
          {/* Floating Canvas Toolbar */}
          <div className="floating-toolbar">
            <s-checkbox
              label="Grid Guides"
              checked={showGrid}
              onChange={(e: any) => setShowGrid(e.currentTarget.checked)}
            />
            
            <span style={{ color: "var(--p-color-border-muted)" }}>|</span>
            
            <s-checkbox
              label="Live Sandbox"
              checked={livePreview}
              onChange={(e: any) => setLivePreview(e.currentTarget.checked)}
            />

            <span style={{ color: "var(--p-color-border-muted)" }}>|</span>

            <s-select
              label="Mockup View"
              labelAccessibilityVisibility="exclusive"
              value={mockupView}
              onChange={(e: any) => setMockupView(e.currentTarget.value)}
            >
              <s-option value="Front Mockup View">Front View</s-option>
              <s-option value="Back Mockup View">Back View</s-option>
            </s-select>

            <s-badge tone="info">Scale: 50%</s-badge>
          </div>

          {/* Styled Canvas Card Sheet */}
          <div className="canvas-container">
            <canvas
              ref={canvasRef}
              onMouseDown={handleCanvasMouseDown}
              onMouseMove={handleCanvasMouseMove}
              onMouseUp={handleCanvasMouseUp}
              onMouseLeave={handleCanvasMouseUp}
              style={{
                border: "1px solid var(--p-color-border-muted)",
                borderRadius: "6px",
                background: "#ffffff",
                cursor: rightSidebarMode !== "designer" ? "default" : dragState.isDragging ? "grabbing" : dragState.isResizing ? "nwse-resize" : dragState.isRotating ? "crosshair" : "default"
              }}
            />

            {/* Logical coordinate overlays in workspace */}
            {rightSidebarMode === "designer" && activeLayerId && (() => {
              const opt = options.find(o => o.id === activeLayerId);
              if (!opt || !isOptionVisible(opt, shopperValues)) return null;
              return (
                <div className="coordinates-overlay">
                  X: {opt.canvasX} | Y: {opt.canvasY} {opt.canvasWidth && `| W: ${opt.canvasWidth} H: ${opt.canvasHeight}`} | Rotation: {opt.canvasRotation}°
                </div>
              );
            })()}
          </div>

          <div style={{ marginTop: "16px", textAlign: "center" }}>
            <p style={{ fontSize: "13px", color: "var(--p-color-text-secondary)", margin: 0 }}>
              💡 Drag layers to reposition, rotate using the top circular handle, and resize via corners!
            </p>
          </div>
        </div>

        {/* ==========================================
            3. RIGHT PANEL: DESIGNER SETTINGS / SHOPPER PREVIEW
            ========================================== */}
        <div className="right-panel">
          
          {/* Segmented Mode Tabs Header */}
          <div className="tab-header">
            <button
              className={`tab-button ${rightSidebarMode === "designer" ? "active" : ""}`}
              onClick={() => setRightSidebarMode("designer")}
            >
              🛠️ Layer Configuration
            </button>
            <button
              className={`tab-button ${rightSidebarMode === "shopper" ? "active" : ""}`}
              onClick={() => setRightSidebarMode("shopper")}
            >
              🛍️ Storefront Preview
            </button>
          </div>

          <div className="panel-content">
            
            {/* 🛠️ DESIGNER CONFIGURATION MODE */}
            {rightSidebarMode === "designer" && (
              <>
                {activeLayer ? (
                  <div style={{ display: "flex", flexDirection: "column", gap: "16px" }}>
                    
                    {/* Basic Settings */}
                    <div className="settings-section-title">⚙️ Layer Properties</div>
                    <div className="settings-group">
                      <s-text-field
                        label="Option Label Title"
                        value={activeLayer.label}
                        onChange={(e: any) => handleUpdateOption(activeLayer.id, { label: e.currentTarget.value })}
                      />
                      
                      <s-checkbox
                        label="Shopper validation required"
                        checked={activeLayer.required}
                        onChange={(e: any) => handleUpdateOption(activeLayer.id, { required: e.currentTarget.checked })}
                      />

                      <s-number-field
                        label="Price Upcharge ($)"
                        value={String(activeLayer.priceUpcharge)}
                        onChange={(e: any) => handleUpdateOption(activeLayer.id, { priceUpcharge: parseFloat(e.currentTarget.value) || 0 })}
                        min={0}
                        step={0.01}
                      />

                      {/* Text & Text Area limits */}
                      {(activeLayer.type === "text" || activeLayer.type === "textarea") && (
                        <>
                          <s-number-field
                            label="Characters limit threshold"
                            value={String(activeLayer.maxChars ?? 0)}
                            onChange={(e: any) => handleUpdateOption(activeLayer.id, { maxChars: parseInt(e.currentTarget.value) || undefined })}
                            min={0}
                          />
                          <s-select
                            label="Case restriction override"
                            value={activeLayer.caseConstraint || "normal"}
                            onChange={(e: any) => handleUpdateOption(activeLayer.id, { caseConstraint: e.currentTarget.value as any })}
                          >
                            <s-option value="normal">Normal mixed case</s-option>
                            <s-option value="uppercase">FORCE UPPERCASE</s-option>
                            <s-option value="lowercase">force lowercase</s-option>
                          </s-select>
                        </>
                      )}

                      {/* Dropdown / Swatch choices */}
                      {(activeLayer.type === "select" || activeLayer.type === "swatch" || activeLayer.type === "clipart") && (
                        <s-text-field
                          label={activeLayer.type === "swatch" ? "Color Swatches (Hex list comma separated)" : "Choices list (comma separated)"}
                          value={activeLayer.choices || ""}
                          onChange={(e: any) => handleUpdateOption(activeLayer.id, { choices: e.currentTarget.value })}
                          placeholder={activeLayer.type === "swatch" ? "#000, #fff, #ff0000" : "Option A, Option B, Option C"}
                        />
                      )}
                    </div>

                    {/* Transform Matrix Settings */}
                    <div className="settings-section-title">📐 Canvas Placements</div>
                    <div className="settings-group">
                      <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: "8px" }}>
                        <s-number-field
                          label="X Position (px)"
                          value={String(activeLayer.canvasX ?? 400)}
                          onChange={(e: any) => handleUpdateOption(activeLayer.id, { canvasX: parseInt(e.currentTarget.value) || 0 })}
                        />
                        <s-number-field
                          label="Y Position (px)"
                          value={String(activeLayer.canvasY ?? 400)}
                          onChange={(e: any) => handleUpdateOption(activeLayer.id, { canvasY: parseInt(e.currentTarget.value) || 0 })}
                        />
                      </div>

                      {(activeLayer.type === "text" || activeLayer.type === "textarea") ? (
                        <s-number-field
                          label="Logical Font Size (px)"
                          value={String(activeLayer.canvasFontSize ?? 48)}
                          onChange={(e: any) => handleUpdateOption(activeLayer.id, { canvasFontSize: parseInt(e.currentTarget.value) || 0 })}
                        />
                      ) : (
                        <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: "8px" }}>
                          <s-number-field
                            label="Layer Width (px)"
                            value={String(activeLayer.canvasWidth ?? 250)}
                            onChange={(e: any) => handleUpdateOption(activeLayer.id, { canvasWidth: parseInt(e.currentTarget.value) || 0 })}
                          />
                          <s-number-field
                            label="Layer Height (px)"
                            value={String(activeLayer.canvasHeight ?? 250)}
                            onChange={(e: any) => handleUpdateOption(activeLayer.id, { canvasHeight: parseInt(e.currentTarget.value) || 0 })}
                          />
                        </div>
                      )}

                      <div>
                        <div style={{ display: "flex", justifyContent: "space-between", marginBottom: "4px" }}>
                          <span style={{ fontSize: "13px" }}>Layer Rotation</span>
                          <span style={{ fontSize: "13px", fontWeight: 600 }}>{activeLayer.canvasRotation ?? 0}°</span>
                        </div>
                        <input
                          type="range"
                          min="0"
                          max="360"
                          value={activeLayer.canvasRotation ?? 0}
                          style={{ width: "100%", accentColor: "var(--p-color-border-active)" }}
                          onChange={(e) => handleUpdateOption(activeLayer.id, { canvasRotation: parseInt(e.target.value) || 0 })}
                        />
                      </div>
                    </div>

                    {/* Conditional Rules Visibility Routing */}
                    <div className="settings-section-title">🔗 Visibility Conditional Logic</div>
                    <div className="settings-group">
                      {(activeLayer.conditionalRules || []).map((rule, ruleIdx) => (
                        <div key={ruleIdx} style={{
                          display: "flex",
                          flexDirection: "column",
                          gap: "8px",
                          padding: "10px",
                          border: "1px solid var(--p-color-border-muted)",
                          borderRadius: "6px",
                          backgroundColor: "var(--p-color-bg-surface)"
                        }}>
                          <s-select
                            label="If Option..."
                            value={rule.fieldId}
                            onChange={(e: any) => {
                              const updatedRules = [...(activeLayer.conditionalRules || [])];
                              updatedRules[ruleIdx].fieldId = e.currentTarget.value;
                              handleUpdateOption(activeLayer.id, { conditionalRules: updatedRules });
                            }}
                          >
                            <s-option value="">Select option...</s-option>
                            {options.filter(o => o.id !== activeLayer.id).map(o => (
                              <s-option key={o.id} value={o.id}>{o.label}</s-option>
                            ))}
                          </s-select>

                          <s-select
                            label="Operator"
                            value={rule.operator}
                            onChange={(e: any) => {
                              const updatedRules = [...(activeLayer.conditionalRules || [])];
                              updatedRules[ruleIdx].operator = e.currentTarget.value as any;
                              handleUpdateOption(activeLayer.id, { conditionalRules: updatedRules });
                            }}
                          >
                            <s-option value="equals">Equals</s-option>
                            <s-option value="not_equals">Not Equals</s-option>
                            <s-option value="checked">Checked</s-option>
                            <s-option value="unchecked">Unchecked</s-option>
                          </s-select>

                          {rule.operator !== "checked" && rule.operator !== "unchecked" && (
                            <s-text-field
                              label="Value to match"
                              placeholder="Value..."
                              value={rule.value}
                              onChange={(e: any) => {
                                const updatedRules = [...(activeLayer.conditionalRules || [])];
                                updatedRules[ruleIdx].value = e.currentTarget.value;
                                handleUpdateOption(activeLayer.id, { conditionalRules: updatedRules });
                              }}
                            />
                          )}

                          <div style={{ display: "inline-flex" }}>
                            <s-button
                              variant="secondary"
                              onClick={() => {
                                const updatedRules = (activeLayer.conditionalRules || []).filter((_, rIdx) => rIdx !== ruleIdx);
                                handleUpdateOption(activeLayer.id, { conditionalRules: updatedRules });
                              }}
                            >
                              Remove Rule
                            </s-button>
                          </div>
                        </div>
                      ))}

                      <div style={{ display: "inline-flex" }}>
                        <s-button
                          variant="secondary"
                          onClick={() => {
                            const updatedRules = [...(activeLayer.conditionalRules || []), { fieldId: "", operator: "equals" as const, value: "" }];
                            handleUpdateOption(activeLayer.id, { conditionalRules: updatedRules });
                          }}
                        >
                          ➕ Add Visibility Rule
                        </s-button>
                      </div>
                    </div>

                  </div>
                ) : (
                  <div style={{ display: "flex", flexDirection: "column", gap: "16px" }}>
                    <div className="settings-section-title">⚙️ Template Configuration</div>
                    <div className="settings-group">
                      <s-checkbox
                        label="Storefront customizable widget enabled"
                        checked={enabled}
                        onChange={(e: any) => setEnabled(e.currentTarget.checked)}
                      />

                      {variants.length > 0 ? (
                        <s-select
                          label="Synced Upcharge Variant"
                          details="Sync customization fees directly inside the main cart line item using Cart Transform API"
                          value={upchargeVariantId}
                          onChange={(e: any) => setUpchargeVariantId(e.currentTarget.value)}
                        >
                          <s-option value="">None (No upcharge variant mapped)</s-option>
                          {variants.map((v: any) => (
                            <s-option key={v.id} value={v.id}>
                              {v.title} ({v.price ? `$${v.price}` : "Free"})
                            </s-option>
                          ))}
                        </s-select>
                      ) : (
                        <s-text-field
                          label="Synced Upcharge Variant ID"
                          details="Specify the ProductVariant GID linked downstream to checkout upcharge properties."
                          value={upchargeVariantId}
                          onChange={(e: any) => setUpchargeVariantId(e.currentTarget.value)}
                          placeholder="gid://shopify/ProductVariant/..."
                        />
                      )}
                    </div>

                    <div style={{ textAlign: "center", padding: "30px 10px", border: "1px dashed var(--p-color-border-muted)", borderRadius: "8px", background: "var(--p-color-bg-surface-secondary)" }}>
                      <p style={{ fontSize: "13px", color: "var(--p-color-text-secondary)", margin: 0 }}>
                        Select a layer from the left sidebar to configure its coordinates, styles, and visibility criteria contextually.
                      </p>
                    </div>
                  </div>
                )}
              </>
            )}

            {/* 🛍️ STOREFRONT EMULATOR PREVIEW MODE */}
            {rightSidebarMode === "shopper" && (
              <div style={{ display: "flex", flexDirection: "column", gap: "16px", height: "100%" }}>
                
                <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center" }}>
                  <h3 style={{ fontSize: "14px", fontWeight: 600, margin: 0 }}>Widget Emulator</h3>
                  <span className="upcharge-pill">
                    + ${calculateTotalUpcharges(options, shopperValues).toFixed(2)} Fee
                  </span>
                </div>

                <s-divider />

                <div style={{ display: "flex", flexDirection: "column", gap: "16px", flex: 1 }}>
                  {options.map((opt) => {
                    if (!isOptionVisible(opt, shopperValues)) return null;

                    return (
                      <div key={opt.id} style={{ display: "flex", flexDirection: "column", gap: "6px" }}>
                        <p style={{ fontSize: "13px", fontWeight: 600, margin: 0 }}>
                          {opt.label} {opt.required && <span style={{ color: "var(--p-color-text-critical)" }}>*</span>}
                          {opt.priceUpcharge > 0 && (
                            <span style={{ color: "var(--p-color-text-success)", fontSize: "12px", marginLeft: "4px" }}>(+${opt.priceUpcharge.toFixed(2)})</span>
                          )}
                        </p>

                        {opt.type === "text" && (
                          <div style={{ position: "relative" }}>
                            <s-text-field
                              value={shopperValues[opt.id] || ""}
                              onChange={(e: any) => handleShopperValueChange(opt.id, e.currentTarget.value)}
                              placeholder={opt.placeholder || "Enter custom text..."}
                            />
                            {opt.maxChars && (
                              <div style={{ display: "flex", justifyContent: "flex-end", marginTop: "2px" }}>
                                <span style={{ fontSize: "11px", color: "var(--p-color-text-secondary)" }}>
                                  {opt.maxChars - String(shopperValues[opt.id] || "").length} / {opt.maxChars} chars remaining
                                </span>
                              </div>
                            )}
                          </div>
                        )}

                        {opt.type === "textarea" && (
                          <s-text-area
                            value={shopperValues[opt.id] || ""}
                            onChange={(e: any) => handleShopperValueChange(opt.id, e.currentTarget.value)}
                            placeholder={opt.placeholder || "Enter details..."}
                            rows={3}
                          />
                        )}

                        {opt.type === "select" && (
                          <s-select
                            value={shopperValues[opt.id] || ""}
                            onChange={(e: any) => handleShopperValueChange(opt.id, e.currentTarget.value)}
                          >
                            <s-option value="">Choose option...</s-option>
                            {opt.choices?.split(",").map(c => (
                              <s-option key={c.trim()} value={c.trim()}>{c.trim()}</s-option>
                            ))}
                          </s-select>
                        )}

                        {opt.type === "swatch" && (
                          <div style={{ display: "flex", gap: "8px", flexWrap: "wrap", marginTop: "4px" }}>
                            {opt.choices?.split(",").map(colorHex => {
                              const cleanHex = colorHex.trim();
                              const isActive = shopperValues[opt.id] === cleanHex;
                              return (
                                <span
                                  key={cleanHex}
                                  className={`swatch-item ${isActive ? "active" : ""}`}
                                  style={{ backgroundColor: cleanHex }}
                                  onClick={() => handleShopperValueChange(opt.id, cleanHex)}
                                />
                              );
                            })}
                          </div>
                        )}

                        {opt.type === "file" && (
                          <div style={{ border: "2px dashed var(--p-color-border-muted)", padding: "16px", borderRadius: "8px", textAlign: "center", backgroundColor: "var(--p-color-bg-surface-secondary)" }}>
                            <p style={{ fontSize: "13px", color: "var(--p-color-text-secondary)", margin: 0 }}>📁 Drag & drop Decal graphics here</p>
                          </div>
                        )}

                        {opt.type === "checkbox" && (
                          <s-checkbox
                            label="Yes, I want this personalization choice!"
                            checked={!!shopperValues[opt.id]}
                            onChange={(e: any) => handleShopperValueChange(opt.id, e.currentTarget.checked)}
                          />
                        )}

                        {opt.type === "font" && (
                          <s-select
                            value={shopperValues[opt.id] || ""}
                            onChange={(e: any) => handleShopperValueChange(opt.id, e.currentTarget.value)}
                          >
                            <s-option value="Arial">Choose typography style...</s-option>
                            <s-option value="Arial">Arial</s-option>
                            <s-option value="Times New Roman">Times New Roman</s-option>
                            {fontAssets.map(f => (
                              <s-option key={f.id} value={f.name}>{f.name}</s-option>
                            ))}
                          </s-select>
                        )}

                        {opt.type === "clipart" && (
                          <div style={{ display: "flex", gap: "8px", flexWrap: "wrap", marginTop: "4px" }}>
                            {opt.choices?.split(",").map(clipartVal => {
                              const cleanVal = clipartVal.trim();
                              const isActive = shopperValues[opt.id] === cleanVal;
                              return (
                                <div key={cleanVal} style={{ display: "inline-flex" }}>
                                  <s-button
                                    variant={isActive ? "primary" : "secondary"}
                                    onClick={() => handleShopperValueChange(opt.id, cleanVal)}
                                  >
                                    {cleanVal}
                                  </s-button>
                                </div>
                              );
                            })}
                          </div>
                        )}

                        {opt.description && (
                          <p style={{ fontSize: "11px", color: "var(--p-color-text-secondary)", fontStyle: "italic", marginTop: "2px", margin: 0 }}>
                            {opt.description}
                          </p>
                        )}
                      </div>
                    );
                  })}
                </div>

                <div style={{ borderTop: "1px solid var(--p-color-border-muted)", paddingTop: "12px", marginTop: "auto" }}>
                  <div style={{ display: "flex" }}>
                    <s-button
                      variant="primary"
                      onClick={() => alert("Simulation adds this customized design to cart")}
                    >
                      🛒 Add Custom Design to Cart
                    </s-button>
                  </div>
                </div>
              </div>
            )}

          </div>
        </div>

      </div>

    </div>
  );
}
