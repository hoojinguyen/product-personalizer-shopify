import type { LayoutNode } from "./configEngine";

export interface FontDatabasePort {
  getFontValue(shop: string, fontName: string): Promise<string | null>;
}

export interface NetworkFetcherPort {
  fetchAsset(url: string): Promise<Buffer>;
}

export interface RendererDependencies {
  database?: FontDatabasePort;
  network?: NetworkFetcherPort;
}

export interface CanvasRenderOptions {
  scale?: number;
  activeLayerId?: string | null;
  hoveredOptionId?: string | null;
  livePreview?: boolean;
  loadedLayerImages?: Record<string, HTMLImageElement>;
  overlayImage?: HTMLImageElement | null;
}

export interface SvgRenderOptions {
  width?: number;
  height?: number;
  embedFonts?: boolean;
  inlineImages?: boolean;
  includeCutLines?: boolean;
}

export interface RenderResult {
  warnings: string[];
}

export interface SvgRenderResult extends RenderResult {
  svg: string;
}

export class VisualLayoutRenderer {
  constructor(private readonly dependencies?: RendererDependencies) {}

  /**
   * Client-side canvas drawing loop. Synchronously translates coordinates,
   * scales dimensions, draws text alignment, and preloads/draws image layers.
   */
  public drawToCanvas(
    ctx: CanvasRenderingContext2D,
    nodes: LayoutNode[],
    options: CanvasRenderOptions
  ): RenderResult {
    const scale = options.scale ?? 1.0;
    const warnings: string[] = [];

    nodes.forEach((node) => {
      this.setupNodeTransform(ctx, node, scale, options, (renderW, renderH) => {
        if (node.type === "text" || node.type === "textarea") {
          ctx.fillStyle = node.color || "#000000";
          ctx.textAlign = "center";
          ctx.textBaseline = "middle";
          const fontSize = (node.fontSize ?? 48) * scale;
          ctx.font = `bold ${fontSize}px "${node.fontFamily}", Arial, sans-serif`;

          const shopperText = node.text || "";
          ctx.fillText(shopperText, 0, 0);
        } else if (node.type === "clipart") {
          const cacheImg = options.loadedLayerImages?.[node.id] || null;
          if (cacheImg) {
            ctx.drawImage(cacheImg, -renderW / 2, -renderH / 2, renderW, renderH);
          } else {
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
          const uploadedImg = options.loadedLayerImages?.[node.id] || options.overlayImage || null;
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
      });
    });

    return { warnings };
  }

  private setupNodeTransform(
    ctx: CanvasRenderingContext2D,
    node: LayoutNode,
    scale: number,
    options: CanvasRenderOptions,
    drawBody: (renderW: number, renderH: number) => void
  ) {
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
      const fontSize = (node.fontSize ?? 48) * scale;
      const shopperText = node.text || "";
      renderW = fontSize * shopperText.length * 0.5;
      renderH = fontSize;
    } else {
      renderW = (node.width ?? 250) * scale;
      renderH = (node.height ?? 250) * scale;
    }

    drawBody(renderW, renderH);

    // Draw Selected/Hovered Bounding Boxes & Rotate/Resize Controls
    const isSelected = node.id === options.activeLayerId;
    const isHovered = node.id === options.hoveredOptionId;

    if (!options.livePreview && (isSelected || isHovered)) {
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
  }

  /**
   * Server-side SVG compiler. Asynchronously fetches typography binaries and clipart assets,
   * encodes them as base64 data URIs, and serializes coordinate-perfect vector XML.
   */
  public async compileToSvg(
    shop: string,
    orderName: string,
    lineItemTitle: string,
    nodes: LayoutNode[],
    options?: SvgRenderOptions
  ): Promise<SvgRenderResult> {
    const warnings: string[] = [];
    const embedFonts = options?.embedFonts ?? true;
    const inlineImages = options?.inlineImages ?? true;
    const includeCutLines = options?.includeCutLines ?? true;
    const svgWidth = options?.width ?? 800;
    const svgHeight = options?.height ?? 800;

    let svgLayers = "";
    let base64Fonts = "";
    const embeddedFontsSet = new Set<string>();

    for (const node of nodes) {
      if (node.type === "text" || node.type === "textarea") {
        const fontName = node.fontFamily || "Arial";
        const fontColor = node.color || "#000000";

        if (embedFonts && this.dependencies?.database && this.dependencies?.network &&
            fontName !== "Arial" && fontName !== "Georgia" && !embeddedFontsSet.has(fontName)) {
          try {
            const fontValue = await this.dependencies.database.getFontValue(shop, fontName);
            if (fontValue) {
              const assetData = JSON.parse(fontValue);
              if (assetData.url) {
                const fontBuffer = await this.dependencies.network.fetchAsset(assetData.url);
                const b64 = fontBuffer.toString("base64");
                base64Fonts += `
                  @font-face {
                    font-family: "${fontName}";
                    src: url("data:font/truetype;charset=utf-8;base64,${b64}") format("truetype");
                  }
                `;
                embeddedFontsSet.add(fontName);
              }
            }
          } catch (err: unknown) {
            warnings.push(`Failed to embed font ${fontName}: ${err instanceof Error ? err.message : String(err)}`);
          }
        }

        svgLayers += `
          <g transform="translate(${node.x}, ${node.y}) rotate(${node.rotation})">
            <text
              text-anchor="middle"
              alignment-baseline="middle"
              dominant-baseline="central"
              font-family="'${fontName}', Arial, sans-serif"
              font-size="${node.fontSize ?? 48}"
              fill="${fontColor}"
              font-weight="bold"
            >${node.text}</text>
          </g>
        `;
      } else if (node.type === "clipart" || node.type === "file") {
        if (!node.imageUrl) continue;

        const w = node.width ?? 250;
        const h = node.height ?? 250;
        let imageHref = node.imageUrl;

        if (inlineImages && this.dependencies?.network && imageHref.startsWith("http")) {
          try {
            const imgBuffer = await this.dependencies.network.fetchAsset(imageHref);
            const contentType = imageHref.includes("png") ? "image/png" : "image/jpeg";
            imageHref = `data:${contentType};base64,${imgBuffer.toString("base64")}`;
          } catch (err: unknown) {
            warnings.push(`Failed to inline image asset ${imageHref}: ${err instanceof Error ? err.message : String(err)}`);
          }
        }

        svgLayers += `
          <g transform="translate(${node.x}, ${node.y}) rotate(${node.rotation})">
            <image
              href="${imageHref}"
              x="-${w / 2}"
              y="-${h / 2}"
              width="${w}"
              height="${h}"
            />
          </g>
        `;
      }
    }

    if (!svgLayers) {
      warnings.push("Empty rendering input: no renderable layout nodes resolved.");
    }

    const cutLinesMarkup = includeCutLines ? `
      <rect x="10" y="10" width="${svgWidth - 20}" height="${svgHeight - 20}" fill="none" stroke="#008060" stroke-width="1" stroke-dasharray="3,3" />
      <text x="25" y="35" font-family="Helvetica, Arial, sans-serif" font-size="12" fill="#008060" font-weight="bold">
        PRODUCTION READY — Infinite Vector Scale
      </text>
      <text x="25" y="55" font-family="Helvetica, Arial, sans-serif" font-size="10" fill="#6d7175">
        Order: ${orderName} | Item: ${lineItemTitle}
      </text>
    ` : "";

    const svg = `
      <svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 ${svgWidth} ${svgHeight}" width="${svgWidth}" height="${svgHeight}">
        <defs>
          <style>
            ${base64Fonts}
          </style>
        </defs>
        <rect width="100%" height="100%" fill="#ffffff" />
        ${svgLayers}
        ${cutLinesMarkup}
      </svg>
    `.trim();

    return { svg, warnings };
  }
}
