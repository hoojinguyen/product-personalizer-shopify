import { useEffect, useState, useRef } from "react";
import { CustomizationOption, PersonalizationConfig } from "../../utils/configEngine";
import { drawPersonalizerCanvas } from "../../utils/canvasRenderer";
import { CloseIcon } from "./Icons";

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

  const config = new PersonalizationConfig(options);

  // Dirty flag, Warning modal & Horizontal tab states
  const [isDirty, setIsDirty] = useState(false);
  const [linkedTemplateId, setLinkedTemplateId] = useState<string>("");
  const [showWarningModal, setShowWarningModal] = useState(false);
  const [activeLayerTab, setActiveLayerTab] = useState<"properties" | "placements" | "logic">("properties");

  // Canvas Alignment and Drag States
  const [showGrid, setShowGrid] = useState(true);
  const [livePreview, setLivePreview] = useState(false);
  const [mockupView, setMockupView] = useState("Front Mockup View");
  const canvasRef = useRef<HTMLCanvasElement | null>(null);
  const [bgImage, setBgImage] = useState<HTMLImageElement | null>(null);
  const [activeLayerId, setActiveLayerId] = useState<string | null>(null);
  const [hoveredOptionId, setHoveredOptionId] = useState<string | null>(null);
  const [scale, setScale] = useState(0.7);

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
      let loadedOptions: CustomizationOption[] = [];
      if (configVal) {
        try {
          const config = JSON.parse(configVal);
          setLinkedTemplateId(config.templateId || "");
          if (config.options) {
            loadedOptions = config.options;
            setOptions(config.options);
            setEnabled(config.enabled ?? false);
            setUpchargeVariantId(config.upchargeVariantId || "");
          } else {
            loadedOptions = [getDefaultTextOption()];
            setOptions(loadedOptions);
            setEnabled(config.enabled ?? false);
            setUpchargeVariantId("");
          }
        } catch (e) {
          setLinkedTemplateId("");
          loadedOptions = [getDefaultTextOption()];
          setOptions(loadedOptions);
          setEnabled(false);
          setUpchargeVariantId("");
        }
      } else {
        setLinkedTemplateId("");
        setEnabled(false);
        setUpchargeVariantId("");
        loadedOptions = [getDefaultTextOption()];
        setOptions(loadedOptions);
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
      const initialValues: Record<string, any> = {};
      loadedOptions.forEach((opt: CustomizationOption) => {
        if (opt.defaultValue !== undefined) {
          initialValues[opt.id] = opt.defaultValue;
        }
      });
      setShopperValues(initialValues);
      setIsDirty(false); // Initial loaded state is clean
    }
  }, [product]);

  // Reset horizontal configuration tab when active layer changes
  useEffect(() => {
    if (activeLayerId) {
      setActiveLayerTab("properties");
    }
  }, [activeLayerId]);

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
      scale, // Admin canvas workspace scale
      activeLayerId: rightSidebarMode === "designer" ? activeLayerId : null, // Hide active outline bounds in storefront preview mode
      hoveredOptionId,
      showGrid,
      livePreview
    });
  }, [options, bgImage, showGrid, livePreview, activeLayerId, hoveredOptionId, shopperValues, mockupView, rightSidebarMode, scale]);

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
    setIsDirty(true);
    setActiveLayerId(newOption.id);
    setRightSidebarMode("designer");
    setIsAddMenuOpen(false);
  };

  const handleRemoveOption = (id: string) => {
    if (confirm("Are you sure you want to remove this option layer?")) {
      setOptions(options.filter(o => o.id !== id));
      setIsDirty(true);
      if (activeLayerId === id) setActiveLayerId(null);
    }
  };

  const handleUpdateOption = (id: string, updates: Partial<CustomizationOption>) => {
    setIsDirty(true);
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
    setIsDirty(true);
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
    const x = ((e.clientX - rect.left) / rect.width) * 800;
    const y = ((e.clientY - rect.top) / rect.height) * 800;
    return { x, y };
  };

  // Interactive bounding box selections, rotate & dragging handlers
  const handleCanvasMouseDown = (e: React.MouseEvent<HTMLCanvasElement>) => {
    if (rightSidebarMode !== "designer") return; // Prevent edits in shopper mode
    const { x, y } = getCanvasMousePos(e);
    const mappedX = x;
    const mappedY = y;

    if (activeLayerId) {
      const opt = options.find(o => o.id === activeLayerId);
      if (opt && config.isOptionVisible(opt, shopperValues)) {
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
      if (!config.isOptionVisible(opt, shopperValues)) continue;
      
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
    const mappedX = x;
    const mappedY = y;

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
        if (!config.isOptionVisible(o, shopperValues)) continue;
        
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
    if (linkedTemplateId) {
      setShowWarningModal(true);
    } else {
      performSave();
    }
  };

  const performSave = () => {
    onSave({
      enabled,
      options,
      upchargeVariantId
    });
    setIsDirty(false);
    setShowWarningModal(false);
  };

  const handleExit = () => {
    if (isDirty) {
      if (confirm("You have unsaved changes. Are you sure you want to exit without saving?")) {
        onBack();
      }
    } else {
      onBack();
    }
  };

  // Get active layer details
  const activeLayer = options.find(o => o.id === activeLayerId);

  // Extract variants from product if loaded
  const variants = product.variants?.edges?.map((e: any) => e.node) || [];

  const shopName = shop.replace("https://", "").replace("http://", "").split(".")[0];
  const numericProductId = product?.id?.split("/").pop() || "";
  const adminProductUrl = `https://admin.shopify.com/store/${shopName}/products/${numericProductId}`;
  const storefrontProductUrl = `https://${shop}/products/${product.handle}`;

  return (
    <div className="editor-modal-backdrop">
      
      {/* Styles Injections for Fluid 3-Column Polaris UI */}
      <style>{`
        .editor-modal-backdrop {
          position: fixed;
          top: 0; left: 0; right: 0; bottom: 0;
          background-color: var(--p-color-bg-surface-secondary, #f6f6f7);
          z-index: 999;
          display: flex;
          align-items: stretch;
          justify-content: stretch;
          font-family: -apple-system, BlinkMacSystemFont, "San Francisco", "Segoe UI", Roboto, "Helvetica Neue", sans-serif;
          animation: workspaceFadeIn 0.25s ease-out forwards;
        }
        @keyframes workspaceFadeIn {
          from { opacity: 0; }
          to { opacity: 1; }
        }
        .editor-modal-card {
          width: 100%;
          height: 100%;
          max-width: none;
          background-color: var(--p-color-bg-surface-secondary, #f6f6f7);
          border: none;
          border-radius: 0;
          box-shadow: none;
          display: flex;
          flex-direction: column;
          overflow: hidden;
        }
        .editor-header {
          height: 64px;
          background-color: var(--p-color-bg-surface, #ffffff);
          border-bottom: 1px solid var(--p-color-border-muted, #e1e3e5);
          display: flex;
          align-items: center;
          justify-content: space-between;
          padding: 0 24px;
          box-shadow: 0 1px 2px rgba(0,0,0,0.02);
        }
        /* Title styling */
        .header-title-container {
          display: flex;
          align-items: center;
          gap: 20px;
        }
        .header-title-divider {
          width: 1px;
          height: 28px;
          background-color: var(--p-color-border-muted, #e1e3e5);
        }
        .header-title-info {
          display: flex;
          flex-direction: column;
          gap: 2px;
        }
        .header-title-label {
          font-size: 11px;
          font-weight: 600;
          color: var(--p-color-text-secondary, #6d7175);
          text-transform: uppercase;
          letter-spacing: 0.05em;
          line-height: 1;
        }
        .header-title-row {
          display: flex;
          align-items: center;
          gap: 10px;
        }
        .header-title-product {
          font-size: 15px;
          font-weight: 600;
          color: var(--p-color-text, #202223);
          line-height: 1.2;
        }
        .header-badge {
          display: inline-flex;
          align-items: center;
          padding: 3px 8px;
          font-size: 11px;
          font-weight: 600;
          line-height: 1;
          color: #008060;
          background-color: #eafbf4;
          border-radius: 12px;
          border: 1px solid #82e3b9;
        }
        
        /* Custom Buttons */
        .btn-primary {
          display: inline-flex;
          align-items: center;
          justify-content: center;
          gap: 8px;
          height: 36px;
          padding: 0 16px;
          background-color: #008060;
          color: #ffffff;
          border: 1px solid #007f5f;
          border-radius: 6px;
          font-size: 14px;
          font-weight: 600;
          cursor: pointer;
          transition: background-color 0.15s ease, box-shadow 0.15s ease;
          box-shadow: 0 1px 0 rgba(0,0,0,0.05);
        }
        .btn-primary:hover {
          background-color: #006e52;
        }
        .btn-primary:active {
          background-color: #005e46;
        }
        .btn-secondary {
          display: inline-flex;
          align-items: center;
          justify-content: center;
          gap: 8px;
          height: 36px;
          padding: 0 14px;
          background-color: #ffffff;
          color: var(--p-color-text, #202223);
          border: 1px solid var(--p-color-border-muted, #babfc3);
          border-radius: 6px;
          font-size: 14px;
          font-weight: 500;
          cursor: pointer;
          transition: background-color 0.15s ease, border-color 0.15s ease;
          box-shadow: 0 1px 0 rgba(0,0,0,0.05);
        }
        .btn-secondary:hover {
          background-color: #fafafb;
          border-color: #8c9196;
        }
        .btn-secondary:active {
          background-color: #f1f2f4;
        }
        .btn-icon {
          width: 16px;
          height: 16px;
          fill: currentColor;
          flex-shrink: 0;
        }

        /* Toggle Switch styling */
        .toggle-switch {
          display: flex;
          align-items: center;
          gap: 10px;
          cursor: pointer;
          user-select: none;
        }
        .toggle-switch input {
          position: absolute;
          opacity: 0;
          width: 0;
          height: 0;
        }
        .toggle-slider {
          position: relative;
          display: inline-block;
          width: 36px;
          height: 20px;
          background-color: #ccc;
          border-radius: 20px;
          transition: background-color 0.2s ease;
        }
        .toggle-slider:before {
          position: absolute;
          content: "";
          height: 14px;
          width: 14px;
          left: 3px;
          bottom: 3px;
          background-color: white;
          border-radius: 50%;
          transition: transform 0.2s ease;
          box-shadow: 0 1px 3px rgba(0,0,0,0.15);
        }
        .toggle-switch input:checked + .toggle-slider {
          background-color: #008060;
        }
        .toggle-switch input:checked + .toggle-slider:before {
          transform: translateX(16px);
        }
        .toggle-label {
          font-size: 14px;
          font-weight: 500;
          color: var(--p-color-text, #202223);
        }
        .editor-body {
          flex: 1;
          display: flex;
          overflow: hidden;
        }
        .left-panel {
          width: 320px;
          background-color: var(--p-color-bg-surface, #ffffff);
          border-right: 1px solid var(--p-color-border-muted, #e1e3e5);
          display: flex;
          flex-direction: column;
          position: relative;
          overflow: hidden;
        }
        .center-panel {
          flex: 1;
          background-color: var(--p-color-bg-surface-secondary, #f6f6f7);
          background-image: radial-gradient(var(--p-color-border-muted, #e1e3e5) 1px, transparent 1px);
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
          background-color: var(--p-color-bg-surface, #ffffff);
          border-left: 1px solid var(--p-color-border-muted, #e1e3e5);
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
          background-color: var(--p-color-bg-surface, #ffffff);
          border: 1px solid var(--p-color-border-muted, #e1e3e5);
          border-radius: 8px;
          margin-bottom: 8px;
          cursor: grab;
          transition: all 0.15s ease;
        }
        .layer-card:hover {
          background-color: var(--p-color-bg-surface-hover, #fafafb);
          border-color: var(--p-color-border-hover, #babfc3);
        }
        .layer-card.selected {
          background-color: var(--p-color-bg-surface-active, #f1f2f4);
          border-color: var(--p-color-border-active, #008060);
          box-shadow: 0 0 0 1px var(--p-color-border-active, #008060);
        }
        .canvas-container {
          position: relative;
          background-color: var(--p-color-bg-surface, #ffffff);
          border-radius: 16px;
          box-shadow: 0 20px 40px -15px rgba(0, 0, 0, 0.12), 0 1px 3px rgba(0, 0, 0, 0.05);
          border: 1px solid var(--p-color-border-muted, #e1e3e5);
          padding: 16px;
        }
        .floating-toolbar {
          position: absolute;
          top: 20px;
          display: flex;
          gap: 16px;
          background-color: rgba(255, 255, 255, 0.85);
          backdrop-filter: blur(12px);
          -webkit-backdrop-filter: blur(12px);
          padding: 8px 18px;
          border-radius: 32px;
          box-shadow: 0 10px 25px -5px rgba(0, 0, 0, 0.05), 0 8px 16px -6px rgba(0, 0, 0, 0.05), 0 0 0 1px rgba(0, 0, 0, 0.025);
          border: 1px solid rgba(255, 255, 255, 0.6);
          z-index: 10;
          align-items: center;
          flex-wrap: nowrap;
          white-space: nowrap;
          transition: all 0.2s ease;
        }
        .floating-toolbar:hover {
          background-color: rgba(255, 255, 255, 0.95);
          box-shadow: 0 12px 30px -5px rgba(0, 0, 0, 0.08), 0 8px 20px -6px rgba(0, 0, 0, 0.08);
          transform: translateY(-1px);
        }
        .hint-capsule {
          background-color: var(--p-color-bg-surface, #ffffff);
          border: 1px solid var(--p-color-border-muted, #e1e3e5);
          padding: 6px 16px;
          border-radius: 20px;
          display: inline-flex;
          align-items: center;
          gap: 8px;
          box-shadow: 0 2px 8px rgba(0,0,0,0.04);
          font-size: 13px;
          color: var(--p-color-text-secondary, #6d7175);
          transition: all 0.2s ease;
        }
        .hint-capsule:hover {
          box-shadow: 0 4px 12px rgba(0,0,0,0.08);
          border-color: #008060;
          color: #202223;
        }
        .floating-toolbar > * {
          flex-shrink: 0;
        }
        .floating-toolbar s-select {
          width: 130px;
        }
        .tab-header {
          display: flex;
          border-bottom: 1px solid var(--p-color-border-muted, #e1e3e5);
          background-color: var(--p-color-bg-surface-secondary, #f6f6f7);
        }
        .tab-button {
          flex: 1;
          padding: 12px;
          background: none;
          border: none;
          font-weight: 600;
          font-size: 13px;
          cursor: pointer;
          color: var(--p-color-text-secondary, #6d7175);
          border-bottom: 2px solid transparent;
          transition: all 0.15s ease;
          display: inline-flex;
          align-items: center;
          justify-content: center;
          gap: 6px;
        }
        .tab-button:hover {
          color: var(--p-color-text, #202223);
          background-color: var(--p-color-bg-surface-hover, #fafafb);
        }
        .tab-button.active {
          color: var(--p-color-text-active, #008060);
          border-bottom-color: var(--p-color-border-active, #008060);
          background-color: var(--p-color-bg-surface, #ffffff);
        }
        .tab-icon {
          width: 16px;
          height: 16px;
          fill: currentColor;
          flex-shrink: 0;
        }
        .sub-tab-header {
          display: flex;
          border-bottom: 1px solid var(--p-color-border-muted, #e1e3e5);
          background-color: var(--p-color-bg-surface, #ffffff);
          margin-bottom: 12px;
        }
        .sub-tab-button {
          flex: 1;
          padding: 10px 4px;
          background: none;
          border: none;
          font-weight: 600;
          font-size: 12px;
          cursor: pointer;
          color: var(--p-color-text-secondary, #6d7175);
          border-bottom: 2px solid transparent;
          transition: all 0.15s ease;
          display: inline-flex;
          align-items: center;
          justify-content: center;
          gap: 6px;
        }
        .sub-tab-button:hover {
          color: var(--p-color-text, #202223);
        }
        .sub-tab-button.active {
          color: var(--p-color-text-active, #008060);
          border-bottom-color: var(--p-color-border-active, #008060);
        }
        .section-title-badge {
          display: inline-flex;
          align-items: center;
          padding: 2px 6px;
          font-size: 9px;
          font-weight: 700;
          line-height: 1;
          color: var(--p-color-text-success, #008060);
          background-color: var(--p-color-bg-success-subdued, #eafbf4);
          border: 1px solid #82e3b9;
          border-radius: 4px;
          text-transform: uppercase;
          letter-spacing: 0.05em;
        }
        .warning-modal-backdrop {
          position: fixed;
          top: 0; left: 0; right: 0; bottom: 0;
          background: rgba(0,0,0,0.5);
          backdrop-filter: blur(4px);
          z-index: 2000;
          display: flex;
          align-items: center;
          justify-content: center;
        }
        .warning-modal-card {
          background: #ffffff;
          border-radius: 8px;
          width: 480px;
          max-width: 90%;
          display: flex;
          flex-direction: column;
          overflow: hidden;
          box-shadow: 0 4px 12px rgba(0,0,0,0.15);
          border: 1px solid var(--p-color-border-muted, #e1e3e5);
        }
        .warning-modal-header {
          display: flex;
          justify-content: space-between;
          align-items: center;
          padding: 16px 20px;
          border-bottom: 1px solid var(--p-color-border-muted, #e1e3e5);
        }
        .warning-modal-header h3 {
          margin: 0;
          font-size: 16px;
          font-weight: 600;
          color: #de3618;
        }
        .warning-modal-body {
          padding: 20px;
          font-size: 14px;
          color: var(--p-color-text, #202223);
          display: flex;
          flex-direction: column;
          gap: 12px;
        }
        .warning-modal-footer {
          display: flex;
          justify-content: flex-end;
          gap: 8px;
          padding: 16px 20px;
          border-top: 1px solid var(--p-color-border-muted, #e1e3e5);
          background: var(--p-color-bg-surface-secondary, #f6f6f7);
        }
        .warning-banner {
          background-color: #fff4f4;
          border-left: 4px solid #de3618;
          padding: 12px;
          border-radius: 4px;
          color: #de3618;
          font-weight: 600;
          font-size: 13px;
        }
        .settings-section-title {
          font-weight: 700;
          font-size: 11px;
          text-transform: uppercase;
          color: var(--p-color-text-secondary, #6d7175);
          letter-spacing: 0.08em;
          margin-bottom: 8px;
          margin-top: 12px;
          display: flex;
          align-items: center;
          justify-content: space-between;
        }
        .settings-group {
          display: flex;
          flex-direction: column;
          gap: 12px;
          padding: 12px;
          background-color: var(--p-color-bg-surface-secondary, #f6f6f7);
          border-radius: 8px;
          border: 1px solid var(--p-color-border-muted, #e1e3e5);
          margin-bottom: 12px;
        }
        .swatch-item {
          width: 28px;
          height: 28px;
          border-radius: 50%;
          border: 2px solid var(--p-color-border-muted, #e1e3e5);
          cursor: pointer;
          transition: all 0.15s ease;
        }
        .swatch-item.active {
          transform: scale(1.1);
          border-color: var(--p-color-border-active, #008060);
          box-shadow: 0 0 0 2px var(--p-color-bg-surface, #ffffff);
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
          background-color: var(--p-color-bg-success-subdued, #eafbf4);
          color: var(--p-color-text-success, #008060);
          padding: 2px 8px;
          border-radius: 12px;
          font-size: 11px;
          font-weight: 700;
        }
        .add-layer-dropdown {
          position: absolute;
          right: 0;
          top: 38px;
          background: #ffffff;
          border: 1px solid #e1e3e5;
          border-radius: 8px;
          box-shadow: 0 10px 20px rgba(0, 0, 0, 0.08), 0 2px 6px rgba(0, 0, 0, 0.04);
          z-index: 101;
          width: 220px;
          display: flex;
          flex-direction: column;
          padding: 6px;
          gap: 2px;
          animation: popoverFadeIn 0.15s ease-out;
        }
        @keyframes popoverFadeIn {
          from { opacity: 0; transform: translateY(-4px); }
          to { opacity: 1; transform: translateY(0); }
        }
        .add-layer-item {
          display: flex;
          align-items: center;
          gap: 10px;
          padding: 8px 12px;
          background: none;
          border: none;
          border-radius: 6px;
          text-align: left;
          width: 100%;
          cursor: pointer;
          font-weight: 500;
          font-size: 13px;
          color: var(--p-color-text, #202223);
          transition: background-color 0.15s ease, color 0.15s ease;
        }
        .add-layer-item:hover {
          background-color: #f1f2f4;
          color: #008060;
        }
        .layer-type-icon {
          width: 16px;
          height: 16px;
          fill: currentColor;
          color: #6d7175;
          flex-shrink: 0;
          transition: color 0.15s ease;
        }
        .add-layer-item:hover .layer-type-icon {
          color: #008060;
        }
        .layers-count-badge {
          display: inline-flex;
          align-items: center;
          justify-content: center;
          padding: 2px 6px;
          font-size: 11px;
          font-weight: 600;
          line-height: 1;
          color: #6d7175;
          background-color: #f1f2f4;
          border-radius: 10px;
          border: 1px solid #e1e3e5;
          margin-left: 6px;
        }
        .btn-delete {
          display: inline-flex;
          align-items: center;
          justify-content: center;
          width: 32px;
          height: 32px;
          background: none;
          border: none;
          border-radius: 6px;
          color: #8c9196;
          cursor: pointer;
          transition: background-color 0.15s ease, color 0.15s ease;
        }
        .btn-delete:hover {
          background-color: #fff4f4;
          color: #de3618;
        }
        .drag-handle-icon {
          width: 12px;
          height: 18px;
          color: #babfc3;
          cursor: grab;
          flex-shrink: 0;
          transition: color 0.15s ease;
        }
        .layer-card:hover .drag-handle-icon {
          color: #8c9196;
        }
      `}</style>

      <div className="editor-modal-card">

        {/* 🟢 TOP ACTION BAR */}
        <div className="editor-header">
          <div className="header-title-container">
            <button className="btn-secondary" onClick={handleExit}>
              <svg viewBox="0 0 20 20" className="btn-icon" focusable="false" aria-hidden="true">
                <path d="M19 9h-14.17l5.59-5.59-1.42-1.41-8 8 8 8 1.41-1.41-5.58-5.59h14.17v-2z"></path>
              </svg>
              Exit Editor
            </button>
            <div className="header-title-divider" />
            <div className="header-title-info">
              <span className="header-title-label">Template Designer</span>
              <div className="header-title-row">
                <span className="header-title-product">{product.title}</span>
                <span className="header-badge">Customizer Active</span>
                <a
                  href={adminProductUrl}
                  target="_blank"
                  rel="noopener noreferrer"
                  className="btn-secondary"
                  style={{
                    padding: "0 10px",
                    height: "24px",
                    fontSize: "12px",
                    textDecoration: "none",
                    display: "inline-flex",
                    alignItems: "center",
                    gap: "4px"
                  }}
                >
                  Edit Product
                  <svg viewBox="0 0 20 20" className="btn-icon" style={{ width: "12px", height: "12px" }}>
                    <path d="M13 12a1 1 0 0 1 1 1v3.5a1.5 1.5 0 0 1-1.5 1.5h-9A1.5 1.5 0 0 1 2 16.5v-9A1.5 1.5 0 0 1 3.5 6H7a1 1 0 0 1 0 2H3.5v9h9V13a1 1 0 0 1 1-1zm1.5-8.5H11a1 1 0 0 1 0-2h4.5A1.5 1.5 0 0 1 17 3v4.5a1 1 0 0 1-2 0V4.5L10.7 8.8a1 1 0 0 1-1.4-1.4l4.2-4.3z"></path>
                  </svg>
                </a>
                <a
                  href={storefrontProductUrl}
                  target="_blank"
                  rel="noopener noreferrer"
                  className="btn-secondary"
                  style={{
                    padding: "0 10px",
                    height: "24px",
                    fontSize: "12px",
                    textDecoration: "none",
                    display: "inline-flex",
                    alignItems: "center",
                    gap: "4px"
                  }}
                >
                  Preview Product
                  <svg viewBox="0 0 20 20" className="btn-icon" style={{ width: "12px", height: "12px" }} fill="currentColor">
                    <path d="M10 4.5c-3.6 0-6.8 2.2-8.5 5.5 1.7 3.3 4.9 5.5 8.5 5.5s6.8-2.2 8.5-5.5c-1.7-3.3-4.9-5.5-8.5-5.5zm0 9c-1.9 0-3.5-1.6-3.5-3.5s1.6-3.5 3.5-3.5 3.5 1.6 3.5 3.5-1.6 3.5-3.5 3.5zm0-5.5c-1.1 0-2 .9-2 2s.9 2 2 2 2-.9 2-2-.9-2-2-2z"></path>
                  </svg>
                </a>
              </div>
            </div>
          </div>

          <div style={{ display: "flex", alignItems: "center", gap: "20px" }}>
            <label className="toggle-switch">
              <input
                type="checkbox"
                checked={enabled}
                onChange={(e: any) => { setEnabled(e.target.checked); setIsDirty(true); }}
              />
              <span className="toggle-slider"></span>
              <span className="toggle-label">Enable Customizer</span>
            </label>
            <button className="btn-primary" onClick={saveConfiguration}>
              <svg viewBox="0 0 20 20" className="btn-icon" focusable="false" aria-hidden="true">
                <path d="M17.28 5.28a.75.75 0 0 0-1.06 0L8.5 12.94 4.78 9.22a.75.75 0 1 0-1.06 1.06l4.25 4.25a.75.75 0 0 0 1.06 0l8.25-8.25a.75.75 0 0 0 0-1.06z"></path>
              </svg>
              Save Settings
            </button>
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
            <div style={{ display: "flex", alignItems: "center" }}>
              <h3 style={{ fontSize: "14px", fontWeight: 600, margin: 0 }}>Layers Hierarchy</h3>
              <span className="layers-count-badge">{options.length}</span>
            </div>
            
            <div style={{ position: "relative" }}>
              <button className="btn-secondary" style={{ padding: "0 10px", height: "30px", fontSize: "13px", gap: "4px" }} onClick={() => setIsAddMenuOpen(!isAddMenuOpen)}>
                <svg viewBox="0 0 20 20" className="btn-icon" style={{ width: "14px", height: "14px" }} focusable="false" aria-hidden="true">
                  <path d="M10.75 4.75a.75.75 0 0 0-1.5 0v4.5h-4.5a.75.75 0 0 0 0 1.5h4.5v4.5a.75.75 0 0 0 1.5 0v-4.5h4.5a.75.75 0 0 0 0-1.5h-4.5v-4.5z"></path>
                </svg>
                Add Layer
              </button>

              {isAddMenuOpen && (
                <>
                  <div
                    style={{ position: "fixed", top: 0, left: 0, right: 0, bottom: 0, zIndex: 100 }}
                    onClick={() => setIsAddMenuOpen(false)}
                  />
                  <div className="add-layer-dropdown">
                    <button className="add-layer-item" onClick={() => handleAddElementOption("text")}>
                      <svg viewBox="0 0 20 20" className="layer-type-icon">
                        <path d="M4.5 5.5a.5.5 0 0 1 .5-.5h10a.5.5 0 0 1 .5.5v2.5a.75.75 0 0 0 1.5 0v-3a1 1 0 0 0-1-1H4a1 1 0 0 0-1 1v3a.75.75 0 0 0 1.5 0v-2.5zm5.5 1.25a.75.75 0 0 0-1.5 0v7.5h-1a.75.75 0 0 0 0 1.5h3.5a.75.75 0 0 0 0-1.5h-1v-7.5z"></path>
                      </svg>
                      Short Text Input
                    </button>
                    <button className="add-layer-item" onClick={() => handleAddElementOption("textarea")}>
                      <svg viewBox="0 0 20 20" className="layer-type-icon">
                        <path d="M2.75 4.5a.75.75 0 0 1 .75-.75h13a.75.75 0 0 1 0 1.5H3.5a.75.75 0 0 1-.75-.75zm0 3.75a.75.75 0 0 1 .75-.75h13a.75.75 0 0 1 0 1.5H3.5a.75.75 0 0 1-.75-.75zm0 3.75a.75.75 0 0 1 .75-.75h9a.75.75 0 0 1 0 1.5H3.5a.75.75 0 0 1-.75-.75zm0 3.75a.75.75 0 0 1 .75-.75h5a.75.75 0 0 1 0 1.5H3.5a.75.75 0 0 1-.75-.75z"></path>
                      </svg>
                      Text Area Block
                    </button>
                    <button className="add-layer-item" onClick={() => handleAddElementOption("select")}>
                      <svg viewBox="0 0 20 20" className="layer-type-icon">
                        <path d="M4.5 4.75a.75.75 0 0 1 .75-.75h9.5a.75.75 0 0 1 0 1.5H5.25A.75.75 0 0 1 4.5 4.75zm0 4.5a.75.75 0 0 1 .75-.75h9.5a.75.75 0 0 1 0 1.5H5.25A.75.75 0 0 1 4.5 9.25zm0 4.5a.75.75 0 0 1 .75-.75h9.5a.75.75 0 0 1 0 1.5H5.25a.75.75 0 0 1-.75-.75z"></path>
                      </svg>
                      Select Dropdown
                    </button>
                    <button className="add-layer-item" onClick={() => handleAddElementOption("swatch")}>
                      <svg viewBox="0 0 20 20" className="layer-type-icon">
                        <path d="M12.44 2.14a4 4 0 0 1 5.42 5.42L9.2 16.22l-4.14.77a1.5 1.5 0 0 1-1.72-1.72l.77-4.14L12.44 2.14zm4.36 4.36a2.5 2.5 0 0 0-3.36-3.36L4.82 11.76l-.42 2.27a.5.5 0 0 0 .57.57l2.27-.42L16.8 6.5zM6 14a1 1 0 1 1-2 0 1 1 0 0 1 2 0z"></path>
                      </svg>
                      Swatches Color
                    </button>
                    <button className="add-layer-item" onClick={() => handleAddElementOption("file")}>
                      <svg viewBox="0 0 20 20" className="layer-type-icon">
                        <path d="M4.5 3A1.5 1.5 0 0 0 3 4.5v11A1.5 1.5 0 0 0 4.5 17h11a1.5 1.5 0 0 0 1.5-1.5v-7A1.5 1.5 0 0 0 15.5 7h-4L9.8 4.7A1.5 1.5 0 0 0 8.6 4H4.5zM4.5 5.5h3.6a.5.5 0 0 1 .4.2L10.2 8h5.3v8h-11v-10.5z"></path>
                      </svg>
                      Decal File Upload
                    </button>
                    <button className="add-layer-item" onClick={() => handleAddElementOption("checkbox")}>
                      <svg viewBox="0 0 20 20" className="layer-type-icon">
                        <path fill-rule="evenodd" d="M16 4.5a1.5 1.5 0 0 0-1.5-1.5h-9A1.5 1.5 0 0 0 4 4.5v11A1.5 1.5 0 0 0 5.5 17h9a1.5 1.5 0 0 0 1.5-1.5v-11zm-1.5 0h-9v11h9v-11zm-2.03 2.97a.75.75 0 0 1 0 1.06l-4.5 4.5a.75.75 0 0 1-1.06 0l-2-2a.75.75 0 1 1 1.06-1.06l1.47 1.47 3.97-3.97a.75.75 0 0 1 1.06 0z"></path>
                      </svg>
                      Option Checkbox
                    </button>
                    <button className="add-layer-item" onClick={() => handleAddElementOption("clipart")}>
                      <svg viewBox="0 0 20 20" className="layer-type-icon">
                        <path d="M15.5 3a1.5 1.5 0 0 1 1.5 1.5v11a1.5 1.5 0 0 1-1.5 1.5h-11A1.5 1.5 0 0 1 3 15.5v-11A1.5 1.5 0 0 1 4.5 3h11zm0 1.5h-11v8.29l2.65-2.65a1.5 1.5 0 0 1 2.12 0l1.84 1.84 1.34-1.34a1.5 1.5 0 0 1 2.12 0l.93.93V4.5zm-3 3a1.5 1.5 0 1 1 0-3 1.5 1.5 0 0 1 0 3z"></path>
                      </svg>
                      Clipart Graphic
                    </button>
                    <button className="add-layer-item" onClick={() => handleAddElementOption("font")}>
                      <svg viewBox="0 0 20 20" className="layer-type-icon">
                        <path d="M15.5 3a.5.5 0 0 1 .5.5v2a.75.75 0 0 1-1.5 0V4.5H10.75v11h1a.75.75 0 0 1 0 1.5h-3.5a.75.75 0 0 1 0-1.5h1v-11H5.5v1A.75.75 0 0 1 4 4V3.5a.5.5 0 0 1 .5-.5h11z"></path>
                      </svg>
                      Typography Font
                    </button>
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
                    <svg viewBox="0 0 20 20" className="drag-handle-icon" fill="currentColor">
                      <path d="M7 6a1.5 1.5 0 1 1-3 0 1.5 1.5 0 0 1 3 0zm0 4a1.5 1.5 0 1 1-3 0 1.5 1.5 0 0 1 3 0zm-1.5 5.5a1.5 1.5 0 1 0 0-3 1.5 1.5 0 0 0 0 3zm7-9.5a1.5 1.5 0 1 1-3 0 1.5 1.5 0 0 1 3 0zm0 4a1.5 1.5 0 1 1-3 0 1.5 1.5 0 0 1 3 0zm-1.5 5.5a1.5 1.5 0 1 0 0-3 1.5 1.5 0 0 0 0 3zm7-9.5a1.5 1.5 0 1 1-3 0 1.5 1.5 0 0 1 3 0zm0 4a1.5 1.5 0 1 1-3 0 1.5 1.5 0 0 1 3 0zm-1.5 5.5a1.5 1.5 0 1 0 0-3 1.5 1.5 0 0 0 0 3z"></path>
                    </svg>
                    <div style={{ flex: 1, minWidth: 0 }}>
                      <p style={{ fontSize: "13px", fontWeight: 600, margin: 0, overflow: "hidden", textOverflow: "ellipsis", whiteSpace: "nowrap" }}>
                        {opt.label}
                      </p>
                      <span style={{ fontSize: "11px", color: "var(--p-color-text-secondary)", textTransform: "uppercase" }}>
                        {opt.type} {opt.priceUpcharge > 0 && `• +$${opt.priceUpcharge.toFixed(2)}`}
                      </span>
                    </div>
                    
                    <button
                      className="btn-delete"
                      title="Delete Option"
                      onClick={(e: any) => {
                        e.stopPropagation();
                        handleRemoveOption(opt.id);
                      }}
                    >
                      <svg viewBox="0 0 20 20" style={{ width: "16px", height: "16px", fill: "currentColor" }}>
                        <path d="M13.5 4H16a.75.75 0 0 1 0 1.5h-.75v10.75A2.25 2.25 0 0 1 13 18.5H7a2.25 2.25 0 0 1-2.25-2.25V5.5H4a.75.75 0 0 1 0-1.5h2.5A2.5 2.5 0 0 1 9 1.5h2A2.5 2.5 0 0 1 13.5 4zm-5 4.5a.75.75 0 0 0-1.5 0v5.5a.75.75 0 0 0 1.5 0v-5.5zm4 0a.75.75 0 0 0-1.5 0v5.5a.75.75 0 0 0 1.5 0v-5.5zM9 3a1 1 0 0 0-1 1h4a1 1 0 0 0-1-1H9z"></path>
                      </svg>
                    </button>
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
            <span style={{ color: "var(--p-color-border-muted)" }}>|</span>

            <div style={{ display: "flex", alignItems: "center", gap: "6px" }}>
              <button
                className="btn-secondary"
                style={{
                  width: "28px",
                  height: "28px",
                  padding: 0,
                  borderRadius: "50%",
                  display: "flex",
                  alignItems: "center",
                  justifyContent: "center",
                  fontWeight: "bold",
                  fontSize: "16px",
                  cursor: scale <= 0.4 ? "not-allowed" : "pointer"
                }}
                disabled={scale <= 0.4}
                onClick={() => setScale(prev => Math.max(0.4, parseFloat((prev - 0.1).toFixed(1))))}
              >
                -
              </button>
              <span
                className="section-title-badge"
                style={{
                  backgroundColor: "#e0f2fe",
                  color: "#0369a1",
                  border: "1px solid #bae6fd",
                  fontSize: "11px",
                  padding: "4px 8px",
                  textTransform: "none",
                  fontWeight: 600,
                  minWidth: "70px",
                  textAlign: "center"
                }}
              >
                Scale: {Math.round(scale * 100)}%
              </span>
              <button
                className="btn-secondary"
                style={{
                  width: "28px",
                  height: "28px",
                  padding: 0,
                  borderRadius: "50%",
                  display: "flex",
                  alignItems: "center",
                  justifyContent: "center",
                  fontWeight: "bold",
                  fontSize: "16px",
                  cursor: scale >= 1.0 ? "not-allowed" : "pointer"
                }}
                disabled={scale >= 1.0}
                onClick={() => setScale(prev => Math.min(1.0, parseFloat((prev + 0.1).toFixed(1))))}
              >
                +
              </button>
            </div>
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
              if (!opt || !config.isOptionVisible(opt, shopperValues)) return null;
              const isText = opt.type === "text" || opt.type === "textarea";
              return (
                <div className="coordinates-overlay">
                  X: {opt.canvasX} | Y: {opt.canvasY} {isText ? `| Font Size: ${opt.canvasFontSize ?? 48}px` : (opt.canvasWidth ? `| W: ${opt.canvasWidth} H: ${opt.canvasHeight}` : "")} | Rotation: {opt.canvasRotation ?? 0}°
                </div>
              );
            })()}
          </div>

          <div style={{ marginTop: "16px", textAlign: "center" }}>
            <span className="hint-capsule">
              <span>💡</span>
              <span>Drag layers to reposition, rotate using the top circular handle, and resize via corners!</span>
            </span>
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
              <svg viewBox="0 0 20 20" className="tab-icon" focusable="false" aria-hidden="true">
                <path d="M16.98 2.05a3 3 0 0 0-4.24 0L10.35 4.44l-.7-.7a1 1 0 0 0-1.4 0l-4.2 4.2a1 1 0 0 0 0 1.4l.7.7-1.7 1.7a2 2 0 0 0-.5.83l-1 3.5a1 1 0 0 0 1.22 1.22l3.5-1a2 2 0 0 0 .83-.5l1.7-1.7.7.7a1 1 0 0 0 1.4 0l4.2-4.2a1 1 0 0 0 0-1.4l-.7-.7 2.39-2.39a3 3 0 0 0 0-4.24zM11.41 5.5l1.34-1.34a1.5 1.5 0 0 1 2.12 2.12L13.53 7.62 11.41 5.5zm-3.3 3.3l1.06 1.06-4.5 4.5-.35-.35.35-1.22 1.22-1.22.35.35 1.87-1.87-.35-.35 1.22-1.22-.87.87z"></path>
              </svg>
              Layer Configuration
            </button>
            <button
              className={`tab-button ${rightSidebarMode === "shopper" ? "active" : ""}`}
              onClick={() => setRightSidebarMode("shopper")}
            >
              <svg viewBox="0 0 20 20" className="tab-icon" focusable="false" aria-hidden="true">
                <path fill-rule="evenodd" d="M13 5.5a3 3 0 1 0-6 0v.5h6v-.5zm1.5.5V5.5a4.5 4.5 0 0 0-9 0V6H2.75A1.75 1.75 0 0 0 1 7.75v8.5c0 .966.784 1.75 1.75 1.75h14.5A1.75 1.75 0 0 0 19 16.25v-8.5A1.75 1.75 0 0 0 17.25 6H14.5zm-9 1.5a.75.75 0 0 1 1.5 0v1a.75.75 0 0 1-1.5 0v-1zm7.5.75a.75.75 0 1 0-1.5 0v1a.75.75 0 0 0 1.5 0v-1z"></path>
              </svg>
              Storefront Preview
            </button>
          </div>

          <div className="panel-content">
            
            {/* 🛠️ DESIGNER CONFIGURATION MODE */}
            {rightSidebarMode === "designer" && (
              <>
                {activeLayer ? (
                  <div style={{ display: "flex", flexDirection: "column", gap: "16px" }}>
                    
                    {/* Horizontal sub-tabs for active layer configuration */}
                    <div className="sub-tab-header">
                      <button
                        className={`sub-tab-button ${activeLayerTab === "properties" ? "active" : ""}`}
                        onClick={() => setActiveLayerTab("properties")}
                      >
                        <svg viewBox="0 0 20 20" className="tab-icon" focusable="false" aria-hidden="true">
                          <path fill-rule="evenodd" d="M10 2a1.75 1.75 0 0 1 1.73 1.45l.18.91c.26.1.51.23.75.38l.84-.42a1.75 1.75 0 0 1 2.33.62l1 1.73a1.75 1.75 0 0 1-.36 2.37l-.74.56c.03.13.05.26.05.4a1.8 1.8 0 0 1-.05.4l.74.56c.6.45.74 1.3.36 2.37l-1 1.73a1.75 1.75 0 0 1-2.33.62l-.84-.42c-.24.15-.49.28-.75.38l-.18.91A1.75 1.75 0 0 1 11.73 18h-3.46a1.75 1.75 0 0 1-1.73-1.45l-.18-.91a4.62 4.62 0 0 1-.75-.38l-.84.42a1.75 1.75 0 0 1-2.33-.62l-1-1.73a1.75 1.75 0 0 1 .36-2.37l.74-.56A4.52 4.52 0 0 1 2.5 10c0-.14.02-.27.05-.4l-.74-.56a1.75 1.75 0 0 1-.36-2.37l1-1.73a1.75 1.75 0 0 1 2.33-.62l.84.42c.24-.15.49-.28.75-.38l.18-.91A1.75 1.75 0 0 1 8.27 2h3.46zM10 7a3 3 0 1 0 0 6 3 3 0 0 0 0-6z"></path>
                        </svg>
                        Properties
                      </button>
                      <button
                        className={`sub-tab-button ${activeLayerTab === "placements" ? "active" : ""}`}
                        onClick={() => setActiveLayerTab("placements")}
                      >
                        <svg viewBox="0 0 20 20" className="tab-icon" focusable="false" aria-hidden="true">
                          <path d="M4 3a2 2 0 0 0-2 2v10a2 2 0 0 0 2 2h12a2 2 0 0 0 2-2V5a2 2 0 0 0-2-2H4zm0 1.5h1v2H4V4.5zm2.5 0h1v1h-1v-1zm2.5 0h1v2H9v-2zm2.5 0h1v1h-1v-1zm2.5 0h1v2h-1v-2zm-10 11v-5.5h11v5.5H4z"></path>
                        </svg>
                        Placements
                      </button>
                      <button
                        className={`sub-tab-button ${activeLayerTab === "logic" ? "active" : ""}`}
                        onClick={() => setActiveLayerTab("logic")}
                      >
                        <svg viewBox="0 0 20 20" className="tab-icon" focusable="false" aria-hidden="true">
                          <path d="M12.3 3.7a3.9 3.9 0 0 0-5.5 0L5 5.5a3.9 3.9 0 0 0 0 5.5.8.8 0 1 0 1.1-1.1 2.3 2.3 0 0 1 0-3.3l1.8-1.8a2.3 2.3 0 0 1 3.3 0 2.3 2.3 0 0 1 0 3.3l-.5.5a.8.8 0 1 0 1.1 1.1l.5-.5a3.9 3.9 0 0 0 0-5.5zm-3.5 5.3a.8.8 0 0 0-1.1 1.1l.5.5a2.3 2.3 0 0 1 0 3.3l-1.8 1.8a2.3 2.3 0 0 1-3.3 0 2.3 2.3 0 0 1 0-3.3l.5-.5a.8.8 0 1 0-1.1-1.1l-.5.5a3.9 3.9 0 0 0 0 5.5 3.9 3.9 0 0 0 5.5 0l1.8-1.8a3.9 3.9 0 0 0 0-5.5l-.5-.5z"></path>
                        </svg>
                        Logic
                      </button>
                    </div>

                    {activeLayerTab === "properties" && (
                      <>
                        <div className="settings-section-title">
                          <span>Layer Properties</span>
                          <span className="section-title-badge">Properties</span>
                        </div>
                        <div className="settings-group">
                          <s-text-field
                            label="Option Label Title"
                            value={activeLayer.label}
                            onChange={(e: any) => handleUpdateOption(activeLayer.id, { label: e.currentTarget.value })}
                          />
                          
                          <div style={{ display: "flex", alignItems: "center", padding: "4px 0" }}>
                            <label className="toggle-switch">
                              <input
                                type="checkbox"
                                checked={activeLayer.required}
                                onChange={(e: any) => handleUpdateOption(activeLayer.id, { required: e.target.checked })}
                              />
                              <span className="toggle-slider"></span>
                              <span className="toggle-label" style={{ fontSize: "13px" }}>Shopper validation required</span>
                            </label>
                          </div>

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
                              <s-text-field
                                label="Default Value"
                                value={activeLayer.defaultValue || ""}
                                onChange={(e: any) => handleUpdateOption(activeLayer.id, { defaultValue: e.currentTarget.value })}
                                placeholder="Enter default text..."
                              />
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
                      </>
                    )}

                    {activeLayerTab === "placements" && (
                      <>
                        <div className="settings-section-title">
                          <span>Canvas Placements</span>
                          <span className="section-title-badge">Placements</span>
                        </div>
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
                      </>
                    )}

                    {activeLayerTab === "logic" && (
                      <>
                        <div className="settings-section-title">
                          <span>Visibility Conditional Logic</span>
                          <span className="section-title-badge">Logic</span>
                        </div>
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
                      </>
                    )}

                  </div>
                ) : (
                  <div style={{ display: "flex", flexDirection: "column", gap: "16px" }}>
                    <div className="settings-section-title">
                      <span>Template Configuration</span>
                      <span className="section-title-badge">Config</span>
                    </div>
                    <div className="settings-group">
                      <s-checkbox
                        label="Storefront customizable widget enabled"
                        checked={enabled}
                        onChange={(e: any) => { setEnabled(e.currentTarget.checked); setIsDirty(true); }}
                      />

                      {variants.length > 0 ? (
                        <s-select
                          label="Synced Upcharge Variant"
                          details="Sync customization fees directly inside the main cart line item using Cart Transform API"
                          value={upchargeVariantId}
                          onChange={(e: any) => { setUpchargeVariantId(e.currentTarget.value); setIsDirty(true); }}
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
                          onChange={(e: any) => { setUpchargeVariantId(e.currentTarget.value); setIsDirty(true); }}
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
                    + ${config.calculateTotalUpcharges(shopperValues).toFixed(2)} Fee
                  </span>
                </div>

                <s-divider />

                <div style={{ display: "flex", flexDirection: "column", gap: "16px", flex: 1 }}>
                  {options.map((opt) => {
                    if (!config.isOptionVisible(opt, shopperValues)) return null;

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

      {showWarningModal && (
        <div className="warning-modal-backdrop">
          <div className="warning-modal-card">
            <div className="warning-modal-header">
              <h3>⚠️ Shared Template Connection</h3>
              <button
                className="modal-close"
                onClick={() => setShowWarningModal(false)}
                style={{ display: "flex", alignItems: "center", justifyContent: "center" }}
              >
                <CloseIcon />
              </button>
            </div>
            <div className="warning-modal-body">
              <div className="warning-banner">
                Warning: Editing directly will disconnect this product from the template!
              </div>
              <p style={{ margin: 0, lineHeight: "1.5" }}>
                This product options configuration is currently synchronized with a shared template. 
                Saving custom option changes directly on this product will detach it from the template, 
                and future updates to the template will no longer apply.
              </p>
              <p style={{ margin: 0, fontWeight: "bold" }}>
                Would you like to edit the shared template instead or overwrite the settings for this product?
              </p>
            </div>
            <div className="warning-modal-footer">
              <div style={{ display: "inline-flex" }}>
                <s-button variant="secondary" onClick={() => setShowWarningModal(false)}>
                  Cancel
                </s-button>
              </div>
              <div style={{ display: "inline-flex" }}>
                <s-button variant="secondary" onClick={() => window.location.href = "/app/templates"}>
                  🔗 Go to template page
                </s-button>
              </div>
              <div style={{ display: "inline-flex" }}>
                <s-button variant="primary" onClick={() => { setLinkedTemplateId(""); performSave(); }}>
                  Overwrite Configuration
                </s-button>
              </div>
            </div>
          </div>
        </div>
      )}

      </div>
    </div>
  );
}
