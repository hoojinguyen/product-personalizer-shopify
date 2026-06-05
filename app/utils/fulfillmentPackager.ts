import { PassThrough, Readable } from "stream";
import * as archiverModule from "archiver";
const archiver = ((archiverModule as any).default || archiverModule) as any;

export interface PersonalizedItem {
  id: string; // Line item ID
  title: string;
  quantity: number;
  previewUrl: string; // Raster preview PNG URL
  choices: Record<string, string>; // Shopper customization choices
}

export interface PackagerContext {
  admin: any; // Shopify GraphQL API client
  orderId: string;
  shop?: string; // Target Shopify store domain
  db?: any; // Prisma database client
  manufacturingFiles?: string[]; // Pre-resolved vector SVG layout URLs
}

/**
 * Delegate responsible for constructing the file path layout inside the archive.
 * Satisfies the requirement for customizable folder structure.
 */
export interface FolderStructureBuilder {
  buildMetadataPath(): string;
  buildSpecsPath(item: PersonalizedItem): string;
  buildUploadPath(item: PersonalizedItem, filename: string): string;
  buildPrintLayoutPath(item: PersonalizedItem, filename: string, extension: string): string;
}

/**
 * Delegate responsible for resolving and compiling print layout assets.
 * Satisfies the requirement for custom compiler delegates.
 */
export interface PrintCompilerDelegate {
  compile(
    item: PersonalizedItem,
    context: Required<PackagerContext>,
    options: PackagerOptions
  ): Promise<Array<{
    content: Buffer | Readable;
    filename: string;
    pathType: "specs" | "upload" | "layout";
  }>>;
}

/**
 * Delegate responsible for compiling and streaming the packaged file stream.
 * Satisfies the requirement for multiple output formats (ZIP, TAR, etc.).
 */
export interface OutputPacker {
  contentType: string;
  fileExtension: string;
  pack(
    files: AsyncIterable<{ path: string; content: Buffer | Readable }>,
    options: PackagerOptions
  ): Promise<Readable>;
}

export interface PackagerOptions {
  compressionLevel?: number; // 0 to 9 for ZIP archives
  downloadTimeoutMs?: number; // network request timeout limit
  folderStructureBuilder?: FolderStructureBuilder;
  compilers?: PrintCompilerDelegate[];
  outputPacker?: OutputPacker;
  errorStrategy?: "fail-fast" | "ignore-failures" | "log-errors-inline";
}

export interface FulfillmentPackageResult {
  stream: Readable;
  filename: string;
  contentType: string;
}

// ==========================================
// Default Implementations (Seam Overrides)
// ==========================================

export class DefaultFolderStructureBuilder implements FolderStructureBuilder {
  buildMetadataPath(): string {
    return "customizations.json";
  }

  buildSpecsPath(item: PersonalizedItem): string {
    return `item_${item.id}/specifications.txt`;
  }

  buildUploadPath(item: PersonalizedItem, filename: string): string {
    const cleanFilename = filename.replace(/\s+/g, "_");
    return `item_${item.id}/uploads/${cleanFilename}`;
  }

  buildPrintLayoutPath(item: PersonalizedItem, filename: string, extension: string): string {
    const name = filename.includes(".") ? filename : `${filename}.${extension}`;
    return `item_${item.id}/print_layouts/${name}`;
  }
}

export class DefaultSpecsCompiler implements PrintCompilerDelegate {
  async compile(item: PersonalizedItem): Promise<Array<{ content: Buffer | Readable; filename: string; pathType: "specs" | "upload" | "layout" }>> {
    let specsTxt = `Personalization choices for item: ${item.title}\n`;
    specsTxt += `==================================================\n`;
    specsTxt += `Quantity: ${item.quantity}\n`;
    Object.keys(item.choices).forEach((key) => {
      specsTxt += `${key}: ${item.choices[key]}\n`;
    });
    return [{
      content: Buffer.from(specsTxt, "utf-8"),
      filename: "specifications.txt",
      pathType: "specs"
    }];
  }
}

export class DefaultAssetUploadCompiler implements PrintCompilerDelegate {
  async compile(
    item: PersonalizedItem,
    context: Required<PackagerContext>,
    options: PackagerOptions
  ): Promise<Array<{ content: Buffer | Readable; filename: string; pathType: "specs" | "upload" | "layout" }>> {
    const results: Array<{ content: Buffer | Readable; filename: string; pathType: "specs" | "upload" | "layout" }> = [];
    const downloadTimeoutMs = options.downloadTimeoutMs ?? 8000;

    const fetchWithTimeout = async (url: string): Promise<Response> => {
      const controller = new AbortController();
      const timeoutId = setTimeout(() => controller.abort(), downloadTimeoutMs);
      try {
        const res = await fetch(url, { signal: controller.signal });
        clearTimeout(timeoutId);
        return res;
      } catch (err) {
        clearTimeout(timeoutId);
        throw err;
      }
    };

    for (const key of Object.keys(item.choices)) {
      const val = item.choices[key];
      if (typeof val === "string" && val.startsWith("http") && val.includes("cdn.shopify.com")) {
        try {
          const imgRes = await fetchWithTimeout(val);
          if (imgRes.ok) {
            const contentType = imgRes.headers.get("content-type") || "";
            const extension = contentType.includes("png") ? "png" : contentType.includes("jpeg") ? "jpg" : "png";
            const buffer = await imgRes.arrayBuffer();
            results.push({
              content: Buffer.from(buffer),
              filename: `${key.toLowerCase().replace(/\s+/g, "_")}.${extension}`,
              pathType: "upload"
            });
          } else {
            console.warn(`CDN asset fetch returned status ${imgRes.status} for ${val}`);
          }
        } catch (e) {
          console.error(`Failed to stream custom upload asset from ${val}`, e);
          results.push({
            content: Buffer.from(`Failed to download asset: ${val}`, "utf-8"),
            filename: `ERROR_${key}.txt`,
            pathType: "upload"
          });
        }
      }
    }

    return results;
  }
}

export class DefaultPrintLayoutCompiler implements PrintCompilerDelegate {
  async compile(
    item: PersonalizedItem,
    context: Required<PackagerContext>,
    options: PackagerOptions
  ): Promise<Array<{ content: Buffer | Readable; filename: string; pathType: "specs" | "upload" | "layout" }>> {
    const results: Array<{ content: Buffer | Readable; filename: string; pathType: "specs" | "upload" | "layout" }> = [];
    const downloadTimeoutMs = options.downloadTimeoutMs ?? 8000;

    const fetchWithTimeout = async (url: string): Promise<Response> => {
      const controller = new AbortController();
      const timeoutId = setTimeout(() => controller.abort(), downloadTimeoutMs);
      try {
        const res = await fetch(url, { signal: controller.signal });
        clearTimeout(timeoutId);
        return res;
      } catch (err) {
        clearTimeout(timeoutId);
        throw err;
      }
    };

    // 1. Download raster PNG preview if available
    if (item.previewUrl) {
      try {
        const previewRes = await fetchWithTimeout(item.previewUrl);
        if (previewRes.ok) {
          const buffer = await previewRes.arrayBuffer();
          results.push({
            content: Buffer.from(buffer),
            filename: "layout_design.png",
            pathType: "layout"
          });
        }
      } catch (e) {
        console.error(`Failed to stream compiled design layout from ${item.previewUrl}`, e);
        results.push({
          content: Buffer.from(`Failed to download layout: ${item.previewUrl}`, "utf-8"),
          filename: "ERROR_layout.txt",
          pathType: "layout"
        });
      }
    }

    // 2. Fetch or compile vector SVG print file
    try {
      let svgUrl = context.manufacturingFiles.find(url => url.toLowerCase().includes(item.id.toLowerCase())) || null;

      if (!svgUrl) {
        // Trigger compile order metafield on-demand using Print File Compiler module
        const { OrderPrintCompiler } = await import("./printCompiler");
        const compileResult = await OrderPrintCompiler.compileOrder({
          shop: context.shop,
          orderId: context.orderId,
          admin: context.admin,
          db: context.db,
        });
        if (compileResult.success && compileResult.publicUrls) {
          svgUrl = compileResult.publicUrls.find(url => url.toLowerCase().includes(item.id.toLowerCase())) || null;
        }
      }

      if (svgUrl) {
        const svgRes = await fetchWithTimeout(svgUrl);
        if (svgRes.ok) {
          const buffer = await svgRes.arrayBuffer();
          results.push({
            content: Buffer.from(buffer),
            filename: "vector_print_layout.svg",
            pathType: "layout"
          });
        }
      }
    } catch (e) {
      console.error(`Failed to retrieve vector SVG print file for item ${item.id}`, e);
    }

    return results;
  }
}

export class ZipOutputPacker implements OutputPacker {
  contentType = "application/zip";
  fileExtension = "zip";

  async pack(
    files: AsyncIterable<{ path: string; content: Buffer | Readable }>,
    options: PackagerOptions
  ): Promise<Readable> {
    const passThrough = new PassThrough();
    const archive = archiver("zip", { zlib: { level: options.compressionLevel ?? 9 } });

    archive.on("warning", (err: any) => {
      console.warn("Zip packaging warning:", err);
    });

    archive.on("error", (err: any) => {
      console.error("Zip packaging error:", err);
      passThrough.destroy(err);
    });

    archive.pipe(passThrough);

    (async () => {
      try {
        for await (const file of files) {
          archive.append(file.content, { name: file.path });
        }
      } catch (err: any) {
        archive.emit("error", err);
      } finally {
        archive.finalize();
      }
    })();

    return passThrough;
  }
}

export class TarOutputPacker implements OutputPacker {
  contentType = "application/x-tar";
  fileExtension = "tar";

  async pack(
    files: AsyncIterable<{ path: string; content: Buffer | Readable }>,
    options: PackagerOptions
  ): Promise<Readable> {
    const passThrough = new PassThrough();
    const archive = archiver("tar");

    archive.on("warning", (err: any) => {
      console.warn("Tar packaging warning:", err);
    });

    archive.on("error", (err: any) => {
      console.error("Tar packaging error:", err);
      passThrough.destroy(err);
    });

    archive.pipe(passThrough);

    (async () => {
      try {
        for await (const file of files) {
          archive.append(file.content, { name: file.path });
        }
      } catch (err: any) {
        archive.emit("error", err);
      } finally {
        archive.finalize();
      }
    })();

    return passThrough;
  }
}

/**
 * Deep module responsible for compiling and streaming the compressed
 * Fulfillment Package archive on-the-fly.
 */
export class FulfillmentPackagePackager {
  /**
   * Static entry point for route loader calls. Authenticates and streams download.
   */
  static async downloadResponse(request: Request): Promise<Response> {
    const urlObj = new URL(request.url);
    const orderId = urlObj.searchParams.get("orderId");

    if (!orderId) {
      return new Response("Missing orderId parameter", { status: 400 });
    }

    const shopifyModule = await import("../shopify.server");
    const { authenticate } = shopifyModule;

    let adminClient: any = null;
    try {
      const authResult = await authenticate.admin(request);
      adminClient = authResult.admin;
    } catch (adminErr) {
      try {
        const authResult = await authenticate.public.appProxy(request);
        adminClient = authResult.admin;
      } catch (proxyErr) {
        console.error("Authentication failed for zip download", adminErr, proxyErr);
        return new Response("Unauthorized download access", { status: 401 });
      }
    }

    if (!adminClient) {
      return new Response("Shopify API context unavailable", { status: 500 });
    }

    try {
      const packager = new FulfillmentPackagePackager();
      const result = await packager.compile({ admin: adminClient, orderId });

      return new Response(result.stream as any, {
        headers: {
          "Content-Type": result.contentType,
          "Content-Disposition": `attachment; filename="${result.filename}"`,
          "Cache-Control": "no-store, no-cache, must-revalidate"
        }
      });
    } catch (error: any) {
      console.error("Unexpected error compiling fulfillment package:", error);
      return new Response(`Fulfillment compiling failed: ${error.message || error}`, { status: 500 });
    }
  }

  /**
   * Compiles the Manufacturing Dataset and CDN layouts into a streaming ZIP or TAR archive.
   * Signature is backward compatible with compile(admin, orderId, options).
   */
  async compile(
    adminOrContext: any,
    orderId?: string,
    options?: PackagerOptions
  ): Promise<FulfillmentPackageResult> {
    // 1. Resolve parameters and options
    let admin: any;
    let targetOrderId: string;
    let shop: string | undefined;
    let db: any;
    let initialMfFiles: string[] | undefined;

    if (adminOrContext && typeof adminOrContext === "object" && "admin" in adminOrContext && "orderId" in adminOrContext) {
      admin = adminOrContext.admin;
      targetOrderId = adminOrContext.orderId;
      shop = adminOrContext.shop;
      db = adminOrContext.db;
      initialMfFiles = adminOrContext.manufacturingFiles;
    } else {
      admin = adminOrContext;
      targetOrderId = orderId!;
    }

    const activeOptions: PackagerOptions = options || {};
    const pathBuilder = activeOptions.folderStructureBuilder ?? new DefaultFolderStructureBuilder();
    const compilers = activeOptions.compilers ?? [
      new DefaultSpecsCompiler(),
      new DefaultAssetUploadCompiler(),
      new DefaultPrintLayoutCompiler()
    ];
    const packer = activeOptions.outputPacker ?? new ZipOutputPacker();
    const errorStrategy = activeOptions.errorStrategy ?? "log-errors-inline";

    const orderGid = targetOrderId.startsWith("gid://shopify/Order/") 
      ? targetOrderId 
      : `gid://shopify/Order/${targetOrderId}`;

    // 2. Query order and line-item customization attributes from Shopify GraphQL
    const response = await admin.graphql(
      `#graphql
      query getOrderDetails($id: ID!) {
        order(id: $id) {
          name
          createdAt
          manufacturingFiles: metafield(namespace: "app", key: "manufacturing_files") {
            value
          }
          lineItems(first: 50) {
            edges {
              node {
                id
                title
                quantity
                customAttributes {
                  key
                  value
                }
              }
            }
          }
        }
      }`,
      { variables: { id: orderGid } }
    );

    const responseJson = await response.json();
    const order = responseJson.data?.order;

    if (!order) {
      throw new Error(`Order #${targetOrderId} not found in Shopify catalog`);
    }

    // Resolve shop domain dynamically if missing
    if (!shop) {
      const shopResponse = await admin.graphql(`
        query {
          shop {
            myshopifyDomain
          }
        }
      `);
      const shopData = await shopResponse.json();
      shop = shopData.data?.shop?.myshopifyDomain || "";
    }

    // Resolve DB client dynamically if missing
    if (!db) {
      try {
        const dbModule = await import("../db.server");
        db = dbModule.default;
      } catch (err) {
        console.warn("Prisma client resolved to fallback or undefined", err);
      }
    }

    // Resolve pre-compiled SVG URLs
    let manufacturingFiles: string[] = initialMfFiles || [];
    if (!initialMfFiles && order.manufacturingFiles?.value) {
      try {
        manufacturingFiles = JSON.parse(order.manufacturingFiles.value);
      } catch (e) {
        console.warn("Failed to parse manufacturing files metafield JSON", e);
      }
    }

    const fullContext: Required<PackagerContext> = {
      admin,
      orderId: targetOrderId,
      shop: shop || "",
      db,
      manufacturingFiles
    };

    const lineItems = order.lineItems?.edges?.map((e: any) => e.node) || [];
    const personalizedItems: PersonalizedItem[] = [];

    // Filter line items containing personalization properties
    lineItems.forEach((item: any) => {
      const attributes = item.customAttributes || [];
      const previewUrl = attributes.find((a: any) => a.key === "_preview_url")?.value;
      const visibleProps = attributes.filter((a: any) => !a.key.startsWith("_") && a.key !== "priceUpcharge");

      if (previewUrl || visibleProps.length > 0) {
        personalizedItems.push({
          id: item.id.split("/").pop() || "",
          title: item.title,
          quantity: item.quantity,
          previewUrl: previewUrl || "",
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

    // 3. Assemble package metadata manifest
    const metadata = {
      orderId: targetOrderId,
      orderName: order.name,
      createdAt: order.createdAt,
      compilationTime: new Date().toISOString(),
      personalizedItems
    };

    // 4. Generate asynchronous file iterator to stream into packer
    const fileGenerator = async function* () {
      // Append metadata manifest at root
      yield {
        path: pathBuilder.buildMetadataPath(),
        content: Buffer.from(JSON.stringify(metadata, null, 2), "utf-8")
      };

      // Compile each item through the delegates
      for (const item of personalizedItems) {
        for (const compiler of compilers) {
          try {
            const compiledFiles = await compiler.compile(item, fullContext, activeOptions);
            for (const file of compiledFiles) {
              let path = "";
              if (file.pathType === "specs") {
                path = pathBuilder.buildSpecsPath(item);
              } else if (file.pathType === "upload") {
                path = pathBuilder.buildUploadPath(item, file.filename);
              } else if (file.pathType === "layout") {
                const ext = file.filename.split(".").pop() || "png";
                path = pathBuilder.buildPrintLayoutPath(item, file.filename, ext);
              }

              if (path) {
                yield { path, content: file.content };
              }
            }
          } catch (err: any) {
            console.error(`Compiler execution failed for item ${item.id}`, err);
            if (errorStrategy === "fail-fast") {
              throw err;
            } else if (errorStrategy === "log-errors-inline") {
              yield {
                path: `item_${item.id}/ERROR_COMPILATION.txt`,
                content: Buffer.from(`Compiler failed: ${err?.message || String(err)}`, "utf-8")
              };
            }
          }
        }
      }
    };

    // 5. Pack and return stream result
    const packStream = await packer.pack(fileGenerator(), activeOptions);
    const cleanOrderName = order.name.replace("#", "");
    const filename = `fulfillment_package_order_${cleanOrderName}.${packer.fileExtension}`;

    return {
      stream: packStream,
      filename,
      contentType: packer.contentType,
    };
  }
}
