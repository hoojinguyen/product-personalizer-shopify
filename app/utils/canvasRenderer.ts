import { CustomizationOption, isOptionVisible } from "./configEngine";

export interface CanvasRendererOptions {
  canvas: HTMLCanvasElement;
  options: CustomizationOption[];
  shopperValues: Record<string, any>;
  bgImage?: HTMLImageElement | null;
  mockupView?: string;
  fontAssets?: any[];
  scale?: number; // 0.5 for admin (400x400), 1.0 for storefront (800x800)
  
  // Admin-specific overlay controls
  activeLayerId?: string | null;
  hoveredOptionId?: string | null;
  showGrid?: boolean;
  livePreview?: boolean;
  loadedLayerImages?: Record<string, HTMLImageElement>; // Preloaded overlays
  overlayImage?: HTMLImageElement | null; // Custom shopper file upload overlays
}

/**
 * High-leverage, unified canvas renderer ensuring pixel-perfect parity between admin customizer mockups
 * and customer storefront previews.
 */
export function drawPersonalizerCanvas(params: CanvasRendererOptions): void {
  const {
    canvas,
    options,
    shopperValues,
    bgImage,
    mockupView = "Front Mockup View",
    scale = 1.0,
    activeLayerId = null,
    hoveredOptionId = null,
    showGrid = false,
    livePreview = false,
    loadedLayerImages = {},
    overlayImage = null
  } = params;

  const ctx = canvas.getContext("2d");
  if (!ctx) return;

  const baseWidth = 800;
  const baseHeight = 800;

  // Set logical dimensions
  canvas.width = baseWidth * scale;
  canvas.height = baseHeight * scale;

  ctx.clearRect(0, 0, canvas.width, canvas.height);

  // 1. Draw Mockup Background
  if (bgImage) {
    ctx.save();
    if (mockupView === "Back Mockup View") {
      ctx.translate(canvas.width, 0);
      ctx.scale(-1, 1);
      ctx.drawImage(bgImage, 0, 0, canvas.width, canvas.height);
    } else if (mockupView === "Engraving Close-Up") {
      // Zoom in mockup preview
      const zoomFactor = 1.25;
      const zoomOffset = -50 * scale * zoomFactor;
      ctx.drawImage(bgImage, zoomOffset, zoomOffset, canvas.width * zoomFactor, canvas.height * zoomFactor);
    } else {
      ctx.drawImage(bgImage, 0, 0, canvas.width, canvas.height);
    }
    ctx.restore();

    // Soft contrast overlay screen
    ctx.fillStyle = "rgba(255, 255, 255, 0.35)";
    ctx.fillRect(0, 0, canvas.width, canvas.height);

    // Display descriptive mode badges
    if (mockupView === "Back Mockup View") {
      ctx.fillStyle = "rgba(0, 0, 0, 0.6)";
      ctx.fillRect(10 * scale, 10 * scale, 80 * scale, 20 * scale);
      ctx.fillStyle = "#ffffff";
      ctx.font = `bold ${9 * scale}px Arial`;
      ctx.textAlign = "center";
      ctx.textBaseline = "middle";
      ctx.fillText("BACK VIEW", 50 * scale, 20 * scale);
    } else if (mockupView === "Engraving Close-Up") {
      ctx.fillStyle = "rgba(0, 0, 0, 0.6)";
      ctx.fillRect(10 * scale, 10 * scale, 80 * scale, 20 * scale);
      ctx.fillStyle = "#ffffff";
      ctx.font = `bold ${9 * scale}px Arial`;
      ctx.textAlign = "center";
      ctx.textBaseline = "middle";
      ctx.fillText("ZOOM VIEW", 50 * scale, 20 * scale);
    }
  } else {
    ctx.fillStyle = "#ffffff";
    ctx.fillRect(0, 0, canvas.width, canvas.height);
  }

  // 2. Draw Alignment Grid
  if (showGrid && !livePreview) {
    ctx.strokeStyle = "rgba(0, 128, 96, 0.08)";
    ctx.lineWidth = 0.5 * scale;
    const gridGap = 40 * scale;
    for (let x = gridGap; x < canvas.width; x += gridGap) {
      ctx.beginPath();
      ctx.moveTo(x, 0);
      ctx.lineTo(x, canvas.height);
      ctx.stroke();
    }
    for (let y = gridGap; y < canvas.height; y += gridGap) {
      ctx.beginPath();
      ctx.moveTo(0, y);
      ctx.lineTo(canvas.width, y);
      ctx.stroke();
    }
  }

  // 3. Render Customization Layers (Bottom to Top)
  options.forEach((opt) => {
    if (!isOptionVisible(opt, shopperValues)) return;

    ctx.save();
    
    // Scale coordinate placements
    const cx = (opt.canvasX ?? 400) * scale;
    const cy = (opt.canvasY ?? 400) * scale;
    ctx.translate(cx, cy);

    if (opt.canvasRotation) {
      ctx.rotate((opt.canvasRotation * Math.PI) / 180);
    }

    let renderW = 0;
    let renderH = 0;

    let activeFont = "Arial";
    let activeColor = "#000000";

    // Link Font Option selections
    const fontOption = options.find(o => o.type === "font");
    if (fontOption && shopperValues[fontOption.id]) {
      activeFont = shopperValues[fontOption.id];
    }

    // Link Swatch Option selections
    const swatchOption = options.find(o => o.type === "swatch" && shopperValues[o.id]);
    if (swatchOption && shopperValues[swatchOption.id]) {
      activeColor = shopperValues[swatchOption.id];
    } else if (shopperValues[`${opt.id}_color`]) {
      activeColor = shopperValues[`${opt.id}_color`];
    } else if (opt.choices) {
      activeColor = opt.choices.split(",")[0]?.trim() || "#000000";
    }

    if (opt.type === "text" || opt.type === "textarea") {
      ctx.fillStyle = activeColor;
      ctx.textAlign = "center";
      ctx.textBaseline = "middle";
      const fontSize = (opt.canvasFontSize ?? 48) * scale;
      ctx.font = `bold ${fontSize}px "${activeFont}", Arial, sans-serif`;

      let shopperText = shopperValues[opt.id] !== undefined ? shopperValues[opt.id] : (opt.defaultValue !== undefined ? opt.defaultValue : opt.label);
      if (opt.caseConstraint === "uppercase") shopperText = String(shopperText).toUpperCase();
      if (opt.caseConstraint === "lowercase") shopperText = String(shopperText).toLowerCase();

      ctx.fillText(shopperText, 0, 0);

      renderW = fontSize * String(shopperText).length * 0.5;
      renderH = fontSize;
    } else if (opt.type === "clipart") {
      renderW = (opt.canvasWidth ?? 250) * scale;
      renderH = (opt.canvasHeight ?? 250) * scale;

      const cacheImg = loadedLayerImages[opt.id] || null;
      if (cacheImg) {
        ctx.drawImage(cacheImg, -renderW / 2, -renderH / 2, renderW, renderH);
      } else {
        // Draw elegant mockup container
        ctx.fillStyle = "rgba(0, 128, 96, 0.08)";
        ctx.strokeStyle = "#008060";
        ctx.lineWidth = 1.5 * scale;
        ctx.fillRect(-renderW / 2, -renderH / 2, renderW, renderH);
        ctx.strokeRect(-renderW / 2, -renderH / 2, renderW, renderH);

        ctx.fillStyle = "#008060";
        ctx.font = `bold ${10 * scale}px Arial`;
        ctx.textAlign = "center";
        ctx.textBaseline = "middle";

        const clipartVal = shopperValues[opt.id] || opt.label;
        ctx.fillText(`🎨 Clipart: ${clipartVal}`, 0, 0);
      }
    } else if (opt.type === "file") {
      renderW = (opt.canvasWidth ?? 250) * scale;
      renderH = (opt.canvasHeight ?? 250) * scale;

      const uploadedImg = loadedLayerImages[opt.id] || overlayImage || null;
      if (uploadedImg) {
        ctx.drawImage(uploadedImg, -renderW / 2, -renderH / 2, renderW, renderH);
      } else {
        ctx.fillStyle = "rgba(44, 62, 80, 0.08)";
        ctx.strokeStyle = "#2c3e50";
        ctx.lineWidth = 1.5 * scale;
        ctx.fillRect(-renderW / 2, -renderH / 2, renderW, renderH);
        ctx.strokeRect(-renderW / 2, -renderH / 2, renderW, renderH);

        ctx.fillStyle = "#2c3e50";
        ctx.font = `bold ${10 * scale}px Arial`;
        ctx.textAlign = "center";
        ctx.textBaseline = "middle";
        ctx.fillText(shopperValues[opt.id] ? `📸 Loaded: Image` : `📸 Upload: ${opt.label}`, 0, 0);
      }
    }

    // 4. Draw Selected/Hovered Bounding Boxes & Rotate/Resize Controls
    const isSelected = opt.id === activeLayerId;
    const isHovered = opt.id === hoveredOptionId;

    if (!livePreview && (isSelected || isHovered)) {
      ctx.strokeStyle = isSelected ? "#008060" : "rgba(16, 185, 129, 0.6)";
      ctx.lineWidth = isSelected ? 2 * scale : 1 * scale;
      ctx.setLineDash(isSelected ? [4 * scale, 4 * scale] : [2 * scale, 2 * scale]);
      
      const margin = 6 * scale;
      ctx.strokeRect(-renderW / 2 - margin, -renderH / 2 - margin, renderW + margin * 2, renderH + margin * 2);
      ctx.setLineDash([]);

      if (isSelected) {
        // Draw rotation line hook
        ctx.beginPath();
        ctx.moveTo(0, -renderH / 2 - margin);
        ctx.lineTo(0, -renderH / 2 - 25 * scale);
        ctx.strokeStyle = "#008060";
        ctx.stroke();

        // Draw top rotation circle handle
        ctx.fillStyle = "#ffffff";
        ctx.strokeStyle = "#008060";
        ctx.lineWidth = 1.5 * scale;
        ctx.beginPath();
        ctx.arc(0, -renderH / 2 - 25 * scale, 4 * scale, 0, 2 * Math.PI);
        ctx.fill();
        ctx.stroke();

        // Draw four corner resize handle rectangles
        const handleSize = 6 * scale;
        const corners = [
          { x: -renderW / 2 - margin, y: -renderH / 2 - margin },
          { x: renderW / 2 + margin, y: -renderH / 2 - margin },
          { x: -renderW / 2 - margin, y: renderH / 2 + margin },
          { x: renderW / 2 + margin, y: renderH / 2 + margin }
        ];

        corners.forEach(corner => {
          ctx.fillStyle = "#ffffff";
          ctx.strokeStyle = "#008060";
          ctx.fillRect(corner.x - handleSize / 2, corner.y - handleSize / 2, handleSize, handleSize);
          ctx.strokeRect(corner.x - handleSize / 2, corner.y - handleSize / 2, handleSize, handleSize);
        });
      }
    }

    ctx.restore();
  });
}
