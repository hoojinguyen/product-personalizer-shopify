import { CustomizationOption } from "./configEngine";
import { PersonalizationLayoutEngine } from "./layoutEngine";
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

  /**
   * Updates the order's manufacturing files metafield with the given URLs.
   */
  updateOrderMetafield(orderId: string, publicUrls: string[]): Promise<void>;
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

  /**
   * Creates an initial pending processing log.
   */
  createProcessingLog(shop: string, orderId: string): Promise<{ id: string }>;

  /**
   * Updates an existing processing log.
   */
  updateProcessingLog(
    logId: string,
    status: "PENDING" | "COMPLETED" | "FAILED",
    printFileUrl?: string | null,
    error?: string | null
  ): Promise<void>;
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
  orderProcessingLog: {
    create(args: { data: { shop: string; orderId: string; status: string } }): Promise<{ id: string }>;
    update(args: { where: { id: string }; data: { status: string; printFileUrl?: string | null; error?: string | null } }): Promise<{ id: string }>;
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

  async createProcessingLog(shop: string, orderId: string): Promise<{ id: string }> {
    return this.prisma.orderProcessingLog.create({
      data: {
        shop,
        orderId,
        status: "PENDING",
      },
    });
  }

  async updateProcessingLog(
    logId: string,
    status: "PENDING" | "COMPLETED" | "FAILED",
    printFileUrl?: string | null,
    error?: string | null
  ): Promise<void> {
    await this.prisma.orderProcessingLog.update({
      where: { id: logId },
      data: {
        status,
        printFileUrl: printFileUrl || null,
        error: error || null,
      },
    });
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

  async updateOrderMetafield(orderId: string, publicUrls: string[]): Promise<void> {
    const orderGid = orderId.startsWith("gid://shopify/Order/") ? orderId : `gid://shopify/Order/${orderId}`;
    const response = await this.adminClient.graphql(
      `#graphql
      mutation setOrderMetafield($metafields: [MetafieldsSetInput!]!) {
        metafieldsSet(metafields: $metafields) {
          metafields {
            id
            value
          }
          userErrors {
            field
            message
          }
        }
      }`,
      {
        variables: {
          metafields: [
            {
              ownerId: orderGid,
              namespace: "app",
              key: "manufacturing_files",
              type: "json",
              value: JSON.stringify(publicUrls),
            },
          ],
        },
      }
    );
    const json = (await response.json()) as {
      data?: {
        metafieldsSet?: {
          userErrors?: Array<{ field: string; message: string }>;
        };
      };
    };
    const errors = json.data?.metafieldsSet?.userErrors;
    if (errors && errors.length > 0) {
      throw new Error(`Failed to update order metafields: ${errors.map((e) => e.message).join(", ")}`);
    }
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

    // 3. Compile Layout Tree
    const nodes = PersonalizationLayoutEngine.compileLayout(configOptions, shopperValues);

    // 4. Render Layout Nodes to SVG
    for (const node of nodes) {
      if (node.type === "text" || node.type === "textarea") {
        const fontName = node.fontFamily || "Arial";
        const fontColor = node.color || "#000000";

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
      } else if ((node.type === "clipart" || node.type === "file") && node.imageUrl) {
        const w = node.width;
        const h = node.height;
        let imageHref = node.imageUrl;

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

export interface OrderPrintCompilerResult {
  success: boolean;
  orderId: string;
  processedItemsCount: number;
  warnings: string[];
  publicUrls: string[];
  error?: string;
}

export interface CompileOrderOptions {
  shop: string;
  orderId: string;
  orderName?: string;
  admin: ShopifyGraphQLClient;
  db?: PrismaClientSubset;
  network?: NetworkAdapter;
}

export class OrderPrintCompiler {
  /**
   * Compiles the manufacturing-ready vector SVG print files for all personalized items in the order.
   */
  static async compileOrder(options: CompileOrderOptions): Promise<OrderPrintCompilerResult> {
    const dbModule = await import("../db.server");
    const resolvedDb = options.db || dbModule.default;
    const resolvedNetwork = options.network || new HttpNetworkAdapter();

    const shopifyClient = new ShopifyAdminClientGraphQLAdapter(options.admin);
    const database = new PrismaDatabaseAdapter(resolvedDb);
    
    // Initialize processing log entry
    const logEntry = await database.createProcessingLog(options.shop, options.orderId);
    
    try {
      const orderGid = options.orderId.startsWith("gid://shopify/Order/") 
        ? options.orderId 
        : `gid://shopify/Order/${options.orderId}`;

      const orderQuery = `#graphql
        query getOrderDetails($id: ID!) {
          order(id: $id) {
            name
            lineItems(first: 50) {
              nodes {
                id
                title
                productId
                variant {
                  title
                }
                customAttributes {
                  key
                  value
                }
              }
            }
          }
        }
      `;
      const response = await options.admin.graphql(orderQuery, { variables: { id: orderGid } });
      const responseJson = (await response.json()) as {
        data?: {
          order?: {
            name: string;
            lineItems?: {
              nodes?: Array<{
                id: string;
                title: string;
                productId?: string | null;
                variant?: {
                  title: string;
                } | null;
                customAttributes?: Array<{ key: string; value: string | null }> | null;
              }>;
            };
          };
        };
      };

      const orderData = responseJson.data?.order;
      if (!orderData) {
        throw new Error(`Order ${orderGid} not found.`);
      }

      const orderName = orderData.name || options.orderName || `#${options.orderId}`;
      const rawLineItems = orderData.lineItems?.nodes || [];

      // Filter personalized line items
      const personalizedItems = rawLineItems.filter((item) => {
        return item.customAttributes && item.customAttributes.some((attr) => !attr.key.startsWith("_") && attr.key !== "priceUpcharge");
      });

      if (personalizedItems.length === 0) {
        await database.updateProcessingLog(logEntry.id, "COMPLETED", null, "No personalized options found for this order.");
        return {
          success: true,
          orderId: options.orderId,
          processedItemsCount: 0,
          warnings: [],
          publicUrls: [],
        };
      }

      const compiler = new PrintFileCompilerImpl();
      const adapters = {
        shopifyClient,
        database,
        network: resolvedNetwork,
      };

      const publicUrls: string[] = [];
      const warnings: string[] = [];

      for (const item of personalizedItems) {
        const productIdRaw = item.productId || "";
        const productId = productIdRaw.split("/").pop() || "";

        const properties = item.customAttributes?.map((attr) => ({
          name: attr.key,
          value: attr.value,
        })) || [];

        const result = await compiler.compileAndPublish(
          {
            shop: options.shop,
            orderId: options.orderId,
            orderName: orderName,
            lineItem: {
              id: item.id.split("/").pop() || item.id,
              product_id: productId,
              title: item.title,
              variant_title: item.variant?.title || null,
              properties,
            },
          },
          adapters
        );

        if (result.warnings.length > 0) {
          warnings.push(...result.warnings);
        }
        publicUrls.push(result.publicUrl);
      }

      // Save public urls back to Shopify Order Metafields
      await shopifyClient.updateOrderMetafield(options.orderId, publicUrls);

      // Update log state
      await database.updateProcessingLog(logEntry.id, "COMPLETED", publicUrls[0]);

      return {
        success: true,
        orderId: options.orderId,
        processedItemsCount: personalizedItems.length,
        warnings,
        publicUrls,
      };
    } catch (error: unknown) {
      const errorMsg = error instanceof Error ? error.message : "Unknown compilation error";
      await database.updateProcessingLog(logEntry.id, "FAILED", null, errorMsg);
      return {
        success: false,
        orderId: options.orderId,
        processedItemsCount: 0,
        warnings: [],
        publicUrls: [],
        error: errorMsg,
      };
    }
  }

  /**
   * Primary entry point for Shopify webhooks.
   * Auto-resolves authentication, database instance, and Shopify client context from the Remix request.
   */
  static async processWebhook(request: Request): Promise<OrderPrintCompilerResult> {
    const shopifyModule = await import("../shopify.server");
    const { authenticate } = shopifyModule;
    const { shop, admin, payload } = await authenticate.webhook(request);

    if (!admin) {
      throw new Error("Webhook Admin context is missing. Cannot process order details.");
    }

    return this.compileOrder({
      shop,
      orderId: String(payload.id),
      orderName: payload.name ? `#${payload.name}` : undefined,
      admin,
    });
  }
}
