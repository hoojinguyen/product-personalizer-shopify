import type { CustomizationOption } from "./configEngine";
import { PersonalizationConfig } from "./configEngine";
import { VisualLayoutRenderer } from "./renderingSeam";

export interface CanvasRendererOptions {
  canvas: HTMLCanvasElement;
  options: CustomizationOption[];
  shopperValues: Record<string, unknown>;
  bgImage?: HTMLImageElement | null;
  mockupView?: string;
  fontAssets?: unknown[];
  scale?: number;
  activeLayerId?: string | null;
  hoveredOptionId?: string | null;
  showGrid?: boolean;
  livePreview?: boolean;
  loadedLayerImages?: Record<string, HTMLImageElement>;
  overlayImage?: HTMLImageElement | null;
}

export function drawPersonalizerCanvas(params: CanvasRendererOptions): void {
  const {
    canvas,
    options,
    shopperValues,
    bgImage,
    mockupView = "Front Mockup View",
    scale = 1.0,
    showGrid = false,
    livePreview = false
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
      const zoomFactor = 1.25;
      const zoomOffset = -50 * scale * zoomFactor;
      ctx.drawImage(bgImage, zoomOffset, zoomOffset, canvas.width * zoomFactor, canvas.height * zoomFactor);
    } else {
      ctx.drawImage(bgImage, 0, 0, canvas.width, canvas.height);
    }
    ctx.restore();

    ctx.fillStyle = "rgba(255, 255, 255, 0.35)";
    ctx.fillRect(0, 0, canvas.width, canvas.height);

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

  // 3. Compile Layout nodes from resolved customizer configuration
  const config = new PersonalizationConfig(options);
  const resolved = config.resolve(shopperValues);

  // 4. Render Layout nodes via Seam Renderer
  const renderer = new VisualLayoutRenderer();
  renderer.drawToCanvas(ctx, resolved.layoutNodes, params);
}
