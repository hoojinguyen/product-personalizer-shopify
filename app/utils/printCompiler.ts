import db from "../db.server";
import { CustomizationOption, isOptionVisible } from "./configEngine";

export interface DatabaseAdapter {
  getFontValue(shop: string, fontName: string): Promise<string | null>;
}

export interface NetworkAdapter {
  fetchAsset(url: string): Promise<Buffer>;
}

export interface ManufacturingDataset {
  shopperValues: Record<string, any>;
  config?: CustomizationOption[]; // Options parsed from metafield directly
  templateId?: string;            // SQLite Template ID lookup
}

export interface CompilerOptions {
  shop?: string;                  // Shopify shop domain for SQLite queries
  orderName?: string;             // Optional metadata for rendering
  lineItemTitle?: string;         // Optional metadata for rendering
  dbAdapter?: DatabaseAdapter;    // Injectable custom database reader
  netAdapter?: NetworkAdapter;    // Injectable custom network client
}

export interface PrintFileResult {
  svgContent: string;
  filename: string;
  fileBytes: number;
  warnings: string[];
}

/**
 * Default production Database Adapter using SQLite.
 */
const defaultDatabaseAdapter: DatabaseAdapter = {
  async getFontValue(shop: string, fontName: string): Promise<string | null> {
    const fontAsset = await db.asset.findFirst({
      where: { shop, type: "FONTS", name: fontName }
    });
    return fontAsset?.value || null;
  }
};

/**
 * Default production Network Adapter using global fetch.
 */
const defaultNetworkAdapter: NetworkAdapter = {
  async fetchAsset(url: string): Promise<Buffer> {
    const res = await fetch(url);
    if (!res.ok) {
      throw new Error(`Asset download failed: ${res.statusText} (${res.status})`);
    }
    return Buffer.from(await res.arrayBuffer());
  }
};

/**
 * Headless Print File Compiler module compiling shopper personalization choices
 * into production-ready vector SVG print files.
 */
export async function compilePrintFile(
  dataset: ManufacturingDataset,
  options?: CompilerOptions
): Promise<PrintFileResult> {
  const shop = options?.shop || "";
  const orderName = options?.orderName || "Draft";
  const lineItemTitle = options?.lineItemTitle || "Personalized Item";

  const dbAdapter = options?.dbAdapter || defaultDatabaseAdapter;
  const netAdapter = options?.netAdapter || defaultNetworkAdapter;

  const warnings: string[] = [];
  let configOptions: CustomizationOption[] = [];

  // 1. Resolve configuration options (Metafield payload or SQLite lookup)
  if (dataset.config && dataset.config.length > 0) {
    configOptions = dataset.config;
  } else if (dataset.templateId) {
    try {
      const template = await db.template.findFirst({
        where: { id: dataset.templateId, shop }
      });
      if (template) {
        const parsed = JSON.parse(template.options);
        configOptions = parsed.options || [];
      } else {
        warnings.push(`Template ${dataset.templateId} not found in database.`);
      }
    } catch (e: any) {
      warnings.push(`Failed to load template ${dataset.templateId}: ${e.message}`);
    }
  }

  const svgWidth = 800;
  const svgHeight = 800;
  let svgLayers = "";
  let base64Fonts = "";
  const embeddedFontsSet = new Set<string>();

  // 2. Iterate personalization choices and generate SVG elements
  if (configOptions.length > 0) {
    for (const opt of configOptions) {
      // Evaluate conditional option visibility
      if (!isOptionVisible(opt, dataset.shopperValues)) {
        continue;
      }

      // Check values mapped by option label
      const val = dataset.shopperValues[opt.label];
      if (val === undefined || val === null || val === "") {
        continue;
      }

      const cx = opt.canvasX ?? 400;
      const cy = opt.canvasY ?? 400;
      const rot = opt.canvasRotation ?? 0;

      if (opt.type === "text" || opt.type === "textarea") {
        let fontName = "Arial";
        let fontColor = "#000000";

        // Extract linked font/color settings dynamically from shopper inputs
        for (const otherOpt of configOptions) {
          const otherVal = dataset.shopperValues[otherOpt.label];
          if (otherOpt.label.toLowerCase().includes("font") || otherOpt.label.toLowerCase().includes("style")) {
            fontName = otherVal || "Arial";
          }
          if (otherOpt.label.toLowerCase().includes("color") || otherOpt.type === "swatch") {
            fontColor = otherVal || "#000000";
          }
        }

        // Fetch and base64 embed custom font if needed
        if (fontName !== "Arial" && fontName !== "Georgia" && !embeddedFontsSet.has(fontName)) {
          try {
            const fontValue = await dbAdapter.getFontValue(shop, fontName);
            if (fontValue) {
              const assetData = JSON.parse(fontValue);
              if (assetData.url) {
                const fontBuffer = await netAdapter.fetchAsset(assetData.url);
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
          } catch (err: any) {
            warnings.push(`Failed to embed font ${fontName}: ${err.message}`);
          }
        }

        const fontSize = opt.canvasFontSize ?? 48;
        let shopperText = val;
        if (opt.caseConstraint === "uppercase") shopperText = String(shopperText).toUpperCase();
        if (opt.caseConstraint === "lowercase") shopperText = String(shopperText).toLowerCase();

        svgLayers += `
          <g transform="translate(${cx}, ${cy}) rotate(${rot})">
            <text
              text-anchor="middle"
              alignment-baseline="middle"
              dominant-baseline="central"
              font-family="'${fontName}', Arial, sans-serif"
              font-size="${fontSize}"
              fill="${fontColor}"
              font-weight="bold"
            >${shopperText}</text>
          </g>
        `;
      } else if ((opt.type === "clipart" || opt.type === "file") && val) {
        const w = opt.canvasWidth ?? 250;
        const h = opt.canvasHeight ?? 250;
        let imageHref = String(val);

        if (imageHref.startsWith("http")) {
          try {
            const imgBuffer = await netAdapter.fetchAsset(imageHref);
            const contentType = imageHref.includes("png") ? "image/png" : "image/jpeg";
            imageHref = `data:${contentType};base64,${imgBuffer.toString("base64")}`;
          } catch (err: any) {
            warnings.push(`Failed to inline image asset ${imageHref}: ${err.message}`);
          }
        }

        svgLayers += `
          <g transform="translate(${cx}, ${cy}) rotate(${rot})">
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
  }

  // 3. Fallback to legacy single text rendering if no options were rendered
  if (!svgLayers) {
    const customText = dataset.shopperValues["Custom Engraving Text"] || dataset.shopperValues["Engraving Text"] || "";
    const fontStyle = dataset.shopperValues["Font Style"] || dataset.shopperValues["Font"] || "Arial";
    const textColor = dataset.shopperValues["Engraving Color"] || dataset.shopperValues["Text Color"] || "#000000";
    
    if (customText) {
      svgLayers = `
        <g transform="translate(400, 400)">
          <text
            text-anchor="middle"
            alignment-baseline="middle"
            dominant-baseline="central"
            font-family="${fontStyle}, Arial, sans-serif"
            font-size="80"
            fill="${textColor}"
            font-weight="bold"
          >${customText}</text>
        </g>
      `;
    }
  }

  // 4. Assemble the final vector SVG print file
  const svgContent = `
    <svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 ${svgWidth} ${svgHeight}" width="${svgWidth}" height="${svgHeight}">
      <defs>
        <style>
          ${base64Fonts}
        </style>
      </defs>
      <!-- Base background context -->
      <rect width="100%" height="100%" fill="#ffffff" />
      
      <!-- Precise customized options layers -->
      ${svgLayers}
      
      <!-- Precise bounding boxes & production details (at top boundary) -->
      <rect x="10" y="10" width="780" height="780" fill="none" stroke="#008060" stroke-width="1" stroke-dasharray="3,3" />
      <text x="25" y="35" font-family="Helvetica, Arial, sans-serif" font-size="12" fill="#008060" font-weight="bold">
        PRODUCTION READY — Infinite Vector Scale
      </text>
      <text x="25" y="55" font-family="Helvetica, Arial, sans-serif" font-size="10" fill="#6d7175">
        Order: ${orderName} | Item: ${lineItemTitle}
      </text>
    </svg>
  `.trim();

  const fileBytes = Buffer.byteLength(svgContent, "utf-8");
  // Standardized naming schema matching webhooks creation
  const filename = `print_${orderName.replace("#", "")}_${Date.now()}.svg`;

  return {
    svgContent,
    filename,
    fileBytes,
    warnings
  };
}
