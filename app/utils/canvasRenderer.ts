import type { CustomizationOption } from "./configEngine";
import { PersonalizationLayoutEngine } from "./layoutEngine";

export interface CanvasRendererOptions {
  canvas: HTMLCanvasElement;
  options: CustomizationOption[];
  shopperValues: Record<string, unknown>;
  bgImage?: HTMLImageElement | null;
  mockupView?: string;
  fontAssets?: unknown[];
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

  // 3. Compile Layout nodes from unified layout engine
  const nodes = PersonalizationLayoutEngine.compileLayout(options, shopperValues);

  // 4. Render Customization Layers (Bottom to Top)
  nodes.forEach((node) => {
    ctx.save();
    
    // Scale coordinate placements
    const cx = node.x * scale;
    const cy = node.y * scale;
    ctx.translate(cx, cy);

    if (node.rotation) {
      ctx.rotate((node.rotation * Math.PI) / 180);
    }

    let renderW = 0;
    let renderH = 0;

    if (node.type === "text" || node.type === "textarea") {
      ctx.fillStyle = node.color || "#000000";
      ctx.textAlign = "center";
      ctx.textBaseline = "middle";
      const fontSize = (node.fontSize ?? 48) * scale;
      ctx.font = `bold ${fontSize}px "${node.fontFamily}", Arial, sans-serif`;

      const shopperText = node.text || "";
      ctx.fillText(shopperText, 0, 0);

      renderW = fontSize * shopperText.length * 0.5;
      renderH = fontSize;
    } else if (node.type === "clipart") {
      renderW = node.width * scale;
      renderH = node.height * scale;

      const cacheImg = loadedLayerImages[node.id] || null;
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

        const clipartVal = node.imageUrl || node.label;
        ctx.fillText(`🎨 Clipart: ${clipartVal}`, 0, 0);
      }
    } else if (node.type === "file") {
      renderW = node.width * scale;
      renderH = node.height * scale;

      const uploadedImg = loadedLayerImages[node.id] || overlayImage || null;
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
        ctx.fillText(node.imageUrl ? `📸 Loaded: Image` : `📸 Upload: ${node.label}`, 0, 0);
      }
    }

    // 5. Draw Selected/Hovered Bounding Boxes & Rotate/Resize Controls
    const isSelected = node.id === activeLayerId;
    const isHovered = node.id === hoveredOptionId;

    if (!livePreview && (isSelected || isHovered)) {
      ctx.strokeStyle = isSelected ? "#008060" : "rgba(0, 128, 96, 0.4)";
      ctx.lineWidth = isSelected ? 1.5 * scale : 1 * scale;
      
      const margin = 6 * scale;
      ctx.strokeRect(-renderW / 2 - margin, -renderH / 2 - margin, renderW + margin * 2, renderH + margin * 2);

      if (isSelected) {
        // Draw rotation line hook
        ctx.beginPath();
        ctx.moveTo(0, -renderH / 2 - margin);
        ctx.lineTo(0, -renderH / 2 - 22 * scale);
        ctx.strokeStyle = "#008060";
        ctx.lineWidth = 1.5 * scale;
        ctx.stroke();

        // Draw top rotation circle handle
        ctx.fillStyle = "#ffffff";
        ctx.strokeStyle = "#008060";
        ctx.lineWidth = 1.5 * scale;
        ctx.beginPath();
        ctx.arc(0, -renderH / 2 - 22 * scale, 5 * scale, 0, 2 * Math.PI);
        ctx.fill();
        ctx.stroke();

        // Draw four corner resize handle circles
        const corners = [
          { x: -renderW / 2 - margin, y: -renderH / 2 - margin },
          { x: renderW / 2 + margin, y: -renderH / 2 - margin },
          { x: -renderW / 2 - margin, y: renderH / 2 + margin },
          { x: renderW / 2 + margin, y: renderH / 2 + margin }
        ];

        corners.forEach(corner => {
          ctx.fillStyle = "#ffffff";
          ctx.strokeStyle = "#008060";
          ctx.lineWidth = 1.5 * scale;
          ctx.beginPath();
          ctx.arc(corner.x, corner.y, 5 * scale, 0, 2 * Math.PI);
          ctx.fill();
          ctx.stroke();
        });
      }
    }

    ctx.restore();
  });
}
