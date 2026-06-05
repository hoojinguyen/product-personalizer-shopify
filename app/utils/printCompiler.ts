import { CustomizationOption, isOptionVisible } from "./configEngine";
import { ShopifyFilePublisher } from "./shopifyFilePublisher";

export interface ShopifyOrderLineItem {
  id: string | number;
  product_id: string | number;
  title: string;
  variant_title?: string | null;
  properties?: Array<{ name: string; value: unknown }> | null;
}

export interface PrintCompileRequest {
  shop: string;
  orderId: string;
  orderName: string;
  lineItem: ShopifyOrderLineItem;
}

export interface PrintCompileResult {
  publicUrl: string;
  filename: string;
  fileBytes: number;
  warnings: string[];
}

export interface ShopifyGraphQLResponse {
  json(): Promise<unknown>;
}

export interface ShopifyGraphQLClient {
  graphql(query: string, variables?: { variables: Record<string, unknown> }): Promise<ShopifyGraphQLResponse>;
}

export interface ShopifyClientAdapter {
  /**
   * Fetches the raw string value of the Personalization Config metafield for the product.
   */
  fetchPersonalizationConfig(productId: string): Promise<string | null>;

  /**
   * Staged-uploads and registers the SVG file on Shopify's files library, polling until the CDN URL resolves.
   */
  publishPrintFile(content: string, filename: string): Promise<string>;
}

export interface DatabaseAdapter {
  /**
   * Retrieves base64 encoded font value from the Font Set storage.
   */
  getFontValue(shop: string, fontName: string): Promise<string | null>;

  /**
   * Retrieves the raw option schema for a database-stored Template.
   */
  getTemplateOptions(templateId: string, shop: string): Promise<string | null>;
}

export interface NetworkAdapter {
  /**
   * Downloads custom font files or shopper clipart graphics over the network.
   */
  fetchAsset(url: string): Promise<Buffer>;
}

export interface PrintCompileAdapters {
  shopifyClient: ShopifyClientAdapter;
  database: DatabaseAdapter;
  network: NetworkAdapter;
}

export interface PrismaClientSubset {
  asset: {
    findFirst(args: { where: { shop: string; type: string; name: string } }): Promise<{ value: string | null } | null>;
  };
  template: {
    findFirst(args: { where: { id: string; shop: string } }): Promise<{ options: string } | null>;
  };
}

export class PrismaDatabaseAdapter implements DatabaseAdapter {
  constructor(private prisma: PrismaClientSubset) {}

  async getFontValue(shop: string, fontName: string): Promise<string | null> {
    const fontAsset = await this.prisma.asset.findFirst({
      where: { shop, type: "FONTS", name: fontName }
    });
    return fontAsset?.value || null;
  }

  async getTemplateOptions(templateId: string, shop: string): Promise<string | null> {
    const template = await this.prisma.template.findFirst({
      where: { id: templateId, shop }
    });
    return template?.options || null;
  }
}

export class HttpNetworkAdapter implements NetworkAdapter {
  async fetchAsset(url: string): Promise<Buffer> {
    const res = await fetch(url);
    if (!res.ok) {
      throw new Error(`Asset download failed: ${res.statusText} (${res.status})`);
    }
    return Buffer.from(await res.arrayBuffer());
  }
}

export class ShopifyAdminClientGraphQLAdapter implements ShopifyClientAdapter {
  constructor(private adminClient: ShopifyGraphQLClient) {}

  async fetchPersonalizationConfig(productId: string): Promise<string | null> {
    const response = await this.adminClient.graphql(
      `#graphql
      query getProductConfig($id: ID!) {
        product(id: $id) {
          metafield(namespace: "app", key: "customization_config") {
            value
          }
        }
      }`,
      { variables: { id: `gid://shopify/Product/${productId}` } }
    );
    const json = (await response.json()) as {
      data?: {
        product?: {
          metafield?: {
            value: string | null;
          };
        };
      };
    };
    return json.data?.product?.metafield?.value || null;
  }

  async publishPrintFile(content: string, filename: string): Promise<string> {
    const publisher = new ShopifyFilePublisher();
    const published = await publisher.publish(
      this.adminClient,
      {
        content,
        filename,
        mimeType: "image/svg+xml"
      }
    );
    return published.publicUrl;
  }
}

export class PrintFileCompilerImpl {
  /**
   * Compiles the customizer shopper choices and publishes the vector SVG print file.
   */
  async compileAndPublish(
    request: PrintCompileRequest,
    adapters: PrintCompileAdapters
  ): Promise<PrintCompileResult> {
    const { shop, orderId, orderName, lineItem } = request;
    const { shopifyClient, database, network } = adapters;
    
    const warnings: string[] = [];

    // 1. Flatten properties map
    const shopperValues: Record<string, unknown> = {};
    if (lineItem.properties) {
      lineItem.properties.forEach((p) => {
        if (p.name && p.value !== undefined && p.value !== null) {
          shopperValues[p.name] = p.value;
        }
      });
    }

    // 2. Fetch config from product metafield via Shopify adapter
    let configOptions: CustomizationOption[] = [];
    const configMetafield = await shopifyClient.fetchPersonalizationConfig(String(lineItem.product_id));
    if (configMetafield) {
      try {
        const parsed = JSON.parse(configMetafield);
        if (parsed.options && parsed.options.length > 0) {
          configOptions = parsed.options;
        } else if (parsed.templateId) {
          try {
            const templateOptions = await database.getTemplateOptions(parsed.templateId, shop);
            if (templateOptions) {
              const templateParsed = JSON.parse(templateOptions);
              configOptions = templateParsed.options || [];
            } else {
              warnings.push(`Template ${parsed.templateId} not found in database.`);
            }
          } catch (e: unknown) {
            warnings.push(`Failed to load template ${parsed.templateId}: ${e instanceof Error ? e.message : String(e)}`);
          }
        }
      } catch (e: unknown) {
        warnings.push(`Failed to parse product customization config: ${e instanceof Error ? e.message : String(e)}`);
      }
    }

    const svgWidth = 800;
    const svgHeight = 800;
    let svgLayers = "";
    let base64Fonts = "";
    const embeddedFontsSet = new Set<string>();

    // 3. Iterate personalization choices and generate SVG elements
    if (configOptions.length > 0) {
      for (const opt of configOptions) {
        if (!isOptionVisible(opt, shopperValues)) {
          continue;
        }

        const val = shopperValues[opt.label];
        if (val === undefined || val === null || val === "") {
          continue;
        }

        const cx = opt.canvasX ?? 400;
        const cy = opt.canvasY ?? 400;
        const rot = opt.canvasRotation ?? 0;

        if (opt.type === "text" || opt.type === "textarea") {
          let fontName = "Arial";
          let fontColor = "#000000";

          for (const otherOpt of configOptions) {
            const otherVal = shopperValues[otherOpt.label];
            if (otherOpt.label.toLowerCase().includes("font") || otherOpt.label.toLowerCase().includes("style")) {
              fontName = String(otherVal) || "Arial";
            }
            if (otherOpt.label.toLowerCase().includes("color") || otherOpt.type === "swatch") {
              fontColor = String(otherVal) || "#000000";
            }
          }

          if (fontName !== "Arial" && fontName !== "Georgia" && !embeddedFontsSet.has(fontName)) {
            try {
              const fontValue = await database.getFontValue(shop, fontName);
              if (fontValue) {
                const assetData = JSON.parse(fontValue);
                if (assetData.url) {
                  const fontBuffer = await network.fetchAsset(assetData.url);
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
              const imgBuffer = await network.fetchAsset(imageHref);
              const contentType = imageHref.includes("png") ? "image/png" : "image/jpeg";
              imageHref = `data:${contentType};base64,${imgBuffer.toString("base64")}`;
            } catch (err: unknown) {
              warnings.push(`Failed to inline image asset ${imageHref}: ${err instanceof Error ? err.message : String(err)}`);
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

    if (!svgLayers) {
      const customText = shopperValues["Custom Engraving Text"] || shopperValues["Engraving Text"] || "";
      const fontStyle = shopperValues["Font Style"] || shopperValues["Font"] || "Arial";
      const textColor = shopperValues["Engraving Color"] || shopperValues["Text Color"] || "#000000";
      
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

    const lineItemTitle = lineItem.title || "Personalized Item";
    const svgContent = `
      <svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 ${svgWidth} ${svgHeight}" width="${svgWidth}" height="${svgHeight}">
        <defs>
          <style>
            ${base64Fonts}
          </style>
        </defs>
        <rect width="100%" height="100%" fill="#ffffff" />
        ${svgLayers}
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
    const filename = `print_${orderId}_${lineItem.id}.svg`;

    const publicUrl = await shopifyClient.publishPrintFile(svgContent, filename);

    return {
      publicUrl,
      filename,
      fileBytes,
      warnings
    };
  }
}
