import db from "../db.server";
import { PersonalizationConfig } from "./configEngine";
import type { CustomizationOption, LayoutNode } from "./configEngine";
import { ShopifyFilePublisher } from "./shopifyFilePublisher";
import { VisualLayoutRenderer } from "./renderingSeam";
import type { FontDatabasePort, NetworkFetcherPort } from "./renderingSeam";
import { PassThrough, Readable } from "stream";
import * as archiverModule from "archiver";
import fs from "fs";
import path from "path";
import os from "os";
import crypto from "crypto";

const archiver = ((archiverModule as any).default || archiverModule) as any;

export interface SimpleOrderContext {
  shop: string;
  orderId: string;
}

export interface PrintCompilationResult {
  success: boolean;
  orderId: string;
  processedItemsCount: number;
  publicUrls: string[];
  warnings: string[];
  error?: string;
}

export interface FulfillmentPackage {
  stream: Readable;
  filename: string;
  contentType: string;
}

export interface FolderStructureBuilder {
  buildMetadataPath(): string;
  buildSpecsPath(itemId: string): string;
  buildUploadPath(itemId: string, filename: string): string;
  buildPrintLayoutPath(itemId: string, filename: string, extension: string): string;
}

export interface ShopifyGraphQLClient {
  graphql(query: string, variables?: { variables: Record<string, unknown> }): Promise<{
    json(): Promise<any>;
  }>;
}

export interface DatabaseAdapter extends FontDatabasePort {
  getFontValue(shop: string, fontName: string): Promise<string | null>;
  getTemplateOptions(templateId: string, shop: string): Promise<string | null>;
  createProcessingLog(shop: string, orderId: string): Promise<{ id: string }>;
  updateProcessingLog(
    logId: string,
    status: "PENDING" | "PROCESSING" | "COMPLETED" | "FAILED",
    printFileUrl?: string | null,
    error?: string | null
  ): Promise<void>;
}

export interface NetworkFetcher extends NetworkFetcherPort {
  fetchAsset(url: string): Promise<Buffer>;
}

export interface PersonalizationCompilerOptions {
  adminClient?: ShopifyGraphQLClient;
  dbAdapter?: DatabaseAdapter;
  networkFetcher?: NetworkFetcher;
  errorStrategy?: "fail-fast" | "ignore-failures" | "log-errors-inline";
  outputFormat?: "zip" | "tar";
  compressionLevel?: number;
  folderStructureBuilder?: FolderStructureBuilder;
}

// ==========================================
// Default Implementations (Fallback Seams)
// ==========================================

export class DefaultDatabaseAdapter implements DatabaseAdapter {
  async getFontValue(shop: string, fontName: string): Promise<string | null> {
    const asset = await db.asset.findFirst({
      where: { shop, type: "FONTS", name: fontName }
    });
    return asset?.value || null;
  }

  async getTemplateOptions(templateId: string, shop: string): Promise<string | null> {
    const template = await db.template.findFirst({
      where: { id: templateId, shop }
    });
    return template?.options || null;
  }

  async createProcessingLog(shop: string, orderId: string): Promise<{ id: string }> {
    return db.orderProcessingLog.create({
      data: { shop, orderId, status: "PENDING" }
    });
  }

  async updateProcessingLog(
    logId: string,
    status: "PENDING" | "PROCESSING" | "COMPLETED" | "FAILED",
    printFileUrl?: string | null,
    error?: string | null
  ): Promise<void> {
    await db.orderProcessingLog.update({
      where: { id: logId },
      data: { status, printFileUrl: printFileUrl || null, error: error || null }
    });
  }
}

export class DefaultNetworkFetcher implements NetworkFetcher {
  private cacheDir: string;

  constructor() {
    const baseTempDir = process.env.TMPDIR || os.tmpdir() || "/tmp";
    this.cacheDir = path.join(baseTempDir, "personalizer-assets");
    try {
      if (!fs.existsSync(this.cacheDir)) {
        fs.mkdirSync(this.cacheDir, { recursive: true });
      }
    } catch (err) {
      console.warn("Failed to create asset cache directory:", err);
    }
  }

  private getCachePath(url: string): string {
    const hash = crypto.createHash("md5").update(url).digest("hex");
    const urlPath = url.split("?")[0] || "";
    const ext = path.extname(urlPath);
    return path.join(this.cacheDir, `${hash}${ext}`);
  }

  async fetchAsset(url: string): Promise<Buffer> {
    const cachePath = this.getCachePath(url);
    try {
      if (fs.existsSync(cachePath)) {
        return fs.readFileSync(cachePath);
      }
    } catch (err) {
      console.warn(`Failed to read cached asset at ${cachePath}:`, err);
    }

    const maxRetries = 3;
    let attempt = 0;
    let lastError: any = null;

    while (attempt < maxRetries) {
      try {
        const response = await fetch(url);
        if (!response.ok) {
          throw new Error(`Asset download failed: ${response.statusText} (${response.status})`);
        }
        const buffer = Buffer.from(await response.arrayBuffer());
        try {
          fs.writeFileSync(cachePath, buffer);
        } catch (writeErr) {
          console.warn(`Failed to write asset cache for ${url}:`, writeErr);
        }
        return buffer;
      } catch (err) {
        attempt++;
        lastError = err;
        if (attempt < maxRetries) {
          const delay = Math.pow(2, attempt) * 250;
          await new Promise((resolve) => setTimeout(resolve, delay));
        }
      }
    }

    throw new Error(`Failed to fetch asset from ${url} after ${maxRetries} attempts. Last error: ${lastError?.message || lastError}`);
  }
}

export class DefaultShopifyGraphQLClient implements ShopifyGraphQLClient {
  constructor(private shop: string, private injectedClient?: any) {}

  async graphql(query: string, variables?: { variables: Record<string, unknown> }): Promise<{ json(): Promise<any> }> {
    if (this.injectedClient) {
      return this.injectedClient.graphql(query, variables);
    }
    const { unauthenticated } = await import("../shopify.server");
    const authResult = await unauthenticated.admin(this.shop);
    return authResult.admin.graphql(query, variables);
  }
}

export class DefaultFolderStructureBuilder implements FolderStructureBuilder {
  buildMetadataPath(): string {
    return "customizations.json";
  }

  buildSpecsPath(itemId: string): string {
    return `item_${itemId}/specifications.txt`;
  }

  buildUploadPath(itemId: string, filename: string): string {
    const cleanFilename = filename.replace(/\s+/g, "_");
    return `item_${itemId}/uploads/${cleanFilename}`;
  }

  buildPrintLayoutPath(itemId: string, filename: string, extension: string): string {
    const name = filename.includes(".") ? filename : `${filename}.${extension}`;
    return `item_${itemId}/print_layouts/${name}`;
  }
}

// ==========================================
// Combined Order Personalization Compiler
// ==========================================

export class OrderPersonalizationCompiler {
  private static workerActive = false;

  static async compilePrintFiles(
    context: SimpleOrderContext,
    options?: PersonalizationCompilerOptions
  ): Promise<PrintCompilationResult> {
    const shop = context.shop;
    const orderId = context.orderId;
    
    const dbAdapter = options?.dbAdapter ?? new DefaultDatabaseAdapter();
    const network = options?.networkFetcher ?? new DefaultNetworkFetcher();
    const shopifyClient = options?.adminClient ?? new DefaultShopifyGraphQLClient(shop, options?.adminClient);

    const logEntry = await dbAdapter.createProcessingLog(shop, orderId);

    try {
      const orderGid = orderId.startsWith("gid://shopify/Order/") 
        ? orderId 
        : `gid://shopify/Order/${orderId}`;

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
      const response = await shopifyClient.graphql(orderQuery, { variables: { id: orderGid } });
      const responseJson = await response.json();

      const orderData = responseJson.data?.order;
      if (!orderData) {
        throw new Error(`Order ${orderGid} not found.`);
      }

      const orderName = orderData.name || `#${orderId}`;
      const rawLineItems = orderData.lineItems?.nodes || [];

      const personalizedItems = rawLineItems.filter((item: any) => {
        return item.customAttributes && item.customAttributes.some((attr: any) => !attr.key.startsWith("_") && attr.key !== "priceUpcharge");
      });

      if (personalizedItems.length === 0) {
        await dbAdapter.updateProcessingLog(logEntry.id, "COMPLETED", null, "No personalized options found for this order.");
        return {
          success: true,
          orderId,
          processedItemsCount: 0,
          warnings: [],
          publicUrls: [],
        };
      }

      const publicUrls: string[] = [];
      const warnings: string[] = [];

      for (const item of personalizedItems) {
        const productIdRaw = item.productId || "";
        const productId = productIdRaw.split("/").pop() || "";

        const properties = item.customAttributes?.map((attr: any) => ({
          name: attr.key,
          value: attr.value,
        })) || [];

        // Retrieve config
        let configOptions: CustomizationOption[] = [];
        const query = `#graphql
          query getProductConfig($id: ID!) {
            product(id: $id) {
              metafield(namespace: "app", key: "customization_config") {
                value
              }
            }
          }
        `;
        
        const configResponse = await shopifyClient.graphql(query, { variables: { id: `gid://shopify/Product/${productId}` } });
        const configJson = await configResponse.json();
        const configMetafield = configJson.data?.product?.metafield?.value || null;

        if (configMetafield) {
          try {
            const parsed = JSON.parse(configMetafield);
            if (parsed.options && parsed.options.length > 0) {
              configOptions = parsed.options;
            } else if (parsed.templateId) {
              try {
                const templateOptions = await dbAdapter.getTemplateOptions(parsed.templateId, shop);
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

        const shopperValues: Record<string, unknown> = {};
        properties.forEach((p: any) => {
          shopperValues[p.name] = p.value;
        });

        const personalizationConfig = new PersonalizationConfig(configOptions);
        const resolved = personalizationConfig.resolve(shopperValues);

        // Render to SVG using VisualLayoutRenderer
        const compiler = new VisualLayoutRenderer({
          database: dbAdapter,
          network
        });

        const compileResult = await compiler.compileToSvg(
          shop,
          orderName,
          item.title || "Personalized Item",
          resolved.layoutNodes
        );

        if (compileResult.warnings.length > 0) {
          warnings.push(...compileResult.warnings);
        }

        const publisher = new ShopifyFilePublisher();
        const filename = `print_${orderId}_${item.id.split("/").pop() || item.id}.svg`;
        const published = await publisher.publish(
          shopifyClient as any,
          {
            content: compileResult.svg,
            filename,
            mimeType: "image/svg+xml"
          }
        );

        publicUrls.push(published.publicUrl);
      }

      const setMetafieldMutation = `#graphql
        mutation setOrderMetafield($metafields: [MetafieldsSetInput!]!) {
          metafieldsSet(metafields: $metafields) {
            userErrors {
              field
              message
            }
          }
        }
      `;
      await shopifyClient.graphql(setMetafieldMutation, {
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
      });

      await dbAdapter.updateProcessingLog(logEntry.id, "COMPLETED", publicUrls[0]);

      return {
        success: true,
        orderId,
        processedItemsCount: personalizedItems.length,
        warnings,
        publicUrls,
      };
    } catch (error: unknown) {
      const errorMsg = error instanceof Error ? error.message : "Unknown compilation error";
      await dbAdapter.updateProcessingLog(logEntry.id, "FAILED", null, errorMsg);
      return {
        success: false,
        orderId,
        processedItemsCount: 0,
        warnings: [],
        publicUrls: [],
        error: errorMsg,
      };
    }
  }

  static async packageFulfillment(
    context: SimpleOrderContext,
    options?: PersonalizationCompilerOptions
  ): Promise<FulfillmentPackage> {
    const shop = context.shop;
    const orderId = context.orderId;
    
    const dbAdapter = options?.dbAdapter ?? new DefaultDatabaseAdapter();
    const network = options?.networkFetcher ?? new DefaultNetworkFetcher();
    const shopifyClient = options?.adminClient ?? new DefaultShopifyGraphQLClient(shop, options?.adminClient);
    const pathBuilder = options?.folderStructureBuilder ?? new DefaultFolderStructureBuilder();
    const errorStrategy = options?.errorStrategy ?? "log-errors-inline";
    const compressionLevel = options?.compressionLevel ?? 9;
    const outputFormat = options?.outputFormat ?? "zip";

    const orderGid = orderId.startsWith("gid://shopify/Order/") 
      ? orderId 
      : `gid://shopify/Order/${orderId}`;

    const query = `#graphql
      query getOrderDetails($id: ID!) {
        order(id: $id) {
          name
          createdAt
          manufacturingFiles: metafield(namespace: "app", key: "manufacturing_files") {
            value
          }
          lineItems(first: 50) {
            nodes {
              id
              title
              quantity
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

    const response = await shopifyClient.graphql(query, { variables: { id: orderGid } });
    const responseJson = await response.json();
    const order = responseJson.data?.order;

    if (!order) {
      throw new Error(`Order #${orderId} not found in Shopify catalog`);
    }

    let manufacturingFiles: string[] = [];
    if (order.manufacturingFiles?.value) {
      try {
        manufacturingFiles = JSON.parse(order.manufacturingFiles.value);
      } catch (e) {
        console.warn("Failed to parse manufacturing files metafield JSON", e);
      }
    }

    const lineItems = order.lineItems?.nodes || [];
    const personalizedItems: Array<{
      id: string;
      title: string;
      productId: string;
      variantTitle: string | null;
      quantity: number;
      choices: Record<string, string>;
      previewUrl: string;
    }> = [];

    lineItems.forEach((item: any) => {
      const attributes = item.customAttributes || [];
      const previewUrl = attributes.find((a: any) => a.key === "_preview_url")?.value || "";
      const visibleProps = attributes.filter((a: any) => !a.key.startsWith("_") && a.key !== "priceUpcharge");

      if (previewUrl || visibleProps.length > 0) {
        const prodIdRaw = item.productId || "";
        const prodId = prodIdRaw.split("/").pop() || "";
        
        personalizedItems.push({
          id: item.id.split("/").pop() || item.id,
          title: item.title,
          productId: prodId,
          variantTitle: item.variant?.title || null,
          quantity: item.quantity,
          previewUrl,
          choices: visibleProps.reduce((acc: any, attr: any) => {
            acc[attr.key] = attr.value;
            return acc;
          }, {})
        });
      }
    });

    if (personalizedItems.length === 0) {
      throw new Error("No customized items found for this order package");
    }

    const metadata = {
      orderId: orderGid,
      orderName: order.name,
      createdAt: order.createdAt,
      compilationTime: new Date().toISOString(),
      personalizedItems
    };

    const fileGenerator = async function* () {
      yield {
        path: pathBuilder.buildMetadataPath(),
        content: Buffer.from(JSON.stringify(metadata, null, 2), "utf-8")
      };

      for (const item of personalizedItems) {
        let specsTxt = `Personalization choices for item: ${item.title}\n`;
        specsTxt += `==================================================\n`;
        specsTxt += `Quantity: ${item.quantity}\n`;
        Object.keys(item.choices).forEach((key) => {
          specsTxt += `${key}: ${item.choices[key]}\n`;
        });
        yield {
          path: pathBuilder.buildSpecsPath(item.id),
          content: Buffer.from(specsTxt, "utf-8")
        };

        for (const key of Object.keys(item.choices)) {
          const val = item.choices[key];
          if (typeof val === "string" && val.startsWith("http") && val.includes("cdn.shopify.com")) {
            try {
              const buffer = await network.fetchAsset(val);
              const ext = val.toLowerCase().includes("png") ? "png" : "jpg";
              yield {
                path: pathBuilder.buildUploadPath(item.id, `${key.toLowerCase().replace(/\s+/g, "_")}.${ext}`),
                content: buffer
              };
            } catch (err: any) {
              console.error(`Failed to download custom upload asset ${val}`, err);
              if (errorStrategy === "fail-fast") {
                throw err;
              } else if (errorStrategy === "log-errors-inline") {
                yield {
                  path: `item_${item.id}/ERROR_upload_${key.toLowerCase().replace(/\s+/g, "_")}.txt`,
                  content: Buffer.from(`Failed to download asset: ${val}\nError: ${err.message || err}`, "utf-8")
                };
              }
            }
          }
        }

        if (item.previewUrl) {
          try {
            const buffer = await network.fetchAsset(item.previewUrl);
            yield {
              path: pathBuilder.buildPrintLayoutPath(item.id, "layout_design.png", "png"),
              content: buffer
            };
          } catch (err: any) {
            console.error(`Failed to download layout preview ${item.previewUrl}`, err);
          }
        }

        try {
          let svgUrl = manufacturingFiles.find(url => url.toLowerCase().includes(item.id.toLowerCase())) || null;
          let svgBuffer: Buffer;

          if (svgUrl) {
            svgBuffer = await network.fetchAsset(svgUrl);
          } else {
            // Compile SVG on-the-fly locally in-memory using collapsed VisualLayoutRenderer!
            let configOptions: CustomizationOption[] = [];
            const query = `#graphql
              query getProductConfig($id: ID!) {
                product(id: $id) {
                  metafield(namespace: "app", key: "customization_config") {
                    value
                  }
                }
              }
            `;
            
            const response = await shopifyClient.graphql(query, { variables: { id: `gid://shopify/Product/${item.productId}` } });
            const json = await response.json();
            const configMetafield = json.data?.product?.metafield?.value || null;

            if (configMetafield) {
              try {
                const parsed = JSON.parse(configMetafield);
                if (parsed.options && parsed.options.length > 0) {
                  configOptions = parsed.options;
                } else if (parsed.templateId) {
                  try {
                    const templateOptions = await dbAdapter.getTemplateOptions(parsed.templateId, shop);
                    if (templateOptions) {
                      const templateParsed = JSON.parse(templateOptions);
                      configOptions = templateParsed.options || [];
                    }
                  } catch (e) {}
                }
              } catch (e) {}
            }

            const shopperValues: Record<string, unknown> = {};
            Object.keys(item.choices).forEach(k => {
              shopperValues[k] = item.choices[k];
            });

            const personalizationConfig = new PersonalizationConfig(configOptions);
            const resolved = personalizationConfig.resolve(shopperValues);

            const compiler = new VisualLayoutRenderer({
              database: dbAdapter,
              network
            });

            const compileResult = await compiler.compileToSvg(
              shop,
              order.name,
              item.title || "Personalized Item",
              resolved.layoutNodes
            );

            svgBuffer = Buffer.from(compileResult.svg, "utf-8");
          }

          yield {
            path: pathBuilder.buildPrintLayoutPath(item.id, "vector_print_layout.svg", "svg"),
            content: svgBuffer
          };
        } catch (err: any) {
          console.error(`Failed to compile or retrieve SVG for item ${item.id}`, err);
          if (errorStrategy === "fail-fast") {
            throw err;
          } else if (errorStrategy === "log-errors-inline") {
            yield {
              path: `item_${item.id}/ERROR_print_layout.txt`,
              content: Buffer.from(`Failed to compile layout: ${err.message || err}`, "utf-8")
            };
          }
        }
      }
    };

    const passThrough = new PassThrough();
    const archive = archiver(outputFormat, outputFormat === "zip" ? { zlib: { level: compressionLevel } } : {});

    archive.on("warning", (err: any) => {
      console.warn(`${outputFormat.toUpperCase()} packaging warning:`, err);
    });

    archive.on("error", (err: any) => {
      console.error(`${outputFormat.toUpperCase()} packaging error:`, err);
      passThrough.destroy(err);
    });

    archive.pipe(passThrough);

    (async () => {
      try {
        for await (const file of fileGenerator()) {
          archive.append(file.content, { name: file.path });
        }
      } catch (err: any) {
        archive.emit("error", err);
      } finally {
        archive.finalize();
      }
    })();

    const cleanOrderName = order.name.replace("#", "");
    const filename = `fulfillment_package_order_${cleanOrderName}.${outputFormat}`;
    const contentType = outputFormat === "zip" ? "application/zip" : "application/x-tar";

    return {
      stream: passThrough,
      filename,
      contentType
    };
  }

  static async ensureWorkerRunning(adminClient?: any): Promise<void> {
    if (this.workerActive) return;
    this.workerActive = true;

    setImmediate(async () => {
      try {
        await this.processQueue({ adminClient });
      } catch (err) {
        console.error("[Worker Queue] Loop exception:", err);
      } finally {
        this.workerActive = false;
      }
    });
  }

  static async processQueue(options?: PersonalizationCompilerOptions): Promise<void> {
    const dbAdapter = options?.dbAdapter ?? new DefaultDatabaseAdapter();
    const network = options?.networkFetcher ?? new DefaultNetworkFetcher();
    
    while (true) {
      const pendingTask = await db.orderProcessingLog.findFirst({
        where: { status: "PENDING" },
        orderBy: { createdAt: "asc" }
      });

      if (!pendingTask) break;

      const lockedTask = await db.orderProcessingLog.update({
        where: { id: pendingTask.id },
        data: { status: "PROCESSING" }
      });

      try {
        const client = options?.adminClient ?? new DefaultShopifyGraphQLClient(lockedTask.shop, options?.adminClient);
        await this.compilePrintFiles(
          {
            shop: lockedTask.shop,
            orderId: lockedTask.orderId
          },
          {
            adminClient: client,
            dbAdapter,
            networkFetcher: network
          }
        );
      } catch (err: any) {
        const errorMsg = err?.message || String(err);
        console.error(`[Worker Queue] Task ${lockedTask.id} failed:`, errorMsg);
        await db.orderProcessingLog.update({
          where: { id: lockedTask.id },
          data: { status: "FAILED", error: errorMsg }
        });
      }
    }
  }

  static async recoverStuckJobs(): Promise<void> {
    try {
      const stuckLogs = await db.orderProcessingLog.findMany({
        where: { status: { in: ["PENDING", "PROCESSING"] } }
      });

      if (stuckLogs.length === 0) return;

      console.log(`[Queue Recovery] Recovering ${stuckLogs.length} stuck jobs.`);

      for (const log of stuckLogs) {
        await db.orderProcessingLog.update({
          where: { id: log.id },
          data: {
            status: "PENDING",
            error: log.status === "PROCESSING" ? "Recovered after process interrupt" : log.error
          }
        });
      }

      await this.ensureWorkerRunning();
    } catch (err) {
      console.error("[Queue Recovery] Failed to recover pending tasks:", err);
    }
  }

  static async enqueueWebhookJob(params: {
    shop: string;
    orderId: string;
    adminClient: any;
    dbClient: any;
  }): Promise<PrintCompilationResult> {
    const { shop, orderId, adminClient, dbClient } = params;

    const existingLog = await dbClient.orderProcessingLog.findFirst({
      where: { shop, orderId }
    });

    let logId: string;
    if (existingLog) {
      logId = existingLog.id;
      if (existingLog.status === "FAILED") {
        await dbClient.orderProcessingLog.update({
          where: { id: logId },
          data: { status: "PENDING", error: null }
        });
      }
    } else {
      const logEntry = await dbClient.orderProcessingLog.create({
        data: {
          shop,
          orderId,
          status: "PENDING"
        }
      });
      logId = logEntry.id;
    }

    this.ensureWorkerRunning(adminClient).catch((err) => {
      console.error("[Webhook Queue] Worker launch exception:", err);
    });

    return {
      success: true,
      orderId,
      processedItemsCount: 1,
      warnings: [],
      publicUrls: []
    };
  }
}
