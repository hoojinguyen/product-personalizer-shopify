import { PassThrough, Readable } from "stream";
import * as archiverModule from "archiver";
const archiver = ((archiverModule as any).default || archiverModule) as any;

export interface PackagerOptions {
  compressionLevel?: number;
  downloadTimeoutMs?: number;
}

export interface FulfillmentPackageResult {
  stream: Readable;
  filename: string;
  contentType: string;
}

interface PersonalizationItem {
  id: string;
  title: string;
  quantity: number;
  previewUrl: string;
  choices: Record<string, string>;
}

/**
 * Deep module responsible for compiling and streaming the compressed 
 * Fulfillment Package ZIP archive on-the-fly.
 */
export class FulfillmentPackagePackager {
  /**
   * Compiles the Manufacturing Dataset and CDN layouts into a streaming ZIP archive.
   */
  async compile(
    admin: any,
    orderId: string,
    options?: PackagerOptions
  ): Promise<FulfillmentPackageResult> {
    const compressionLevel = options?.compressionLevel ?? 9;
    const downloadTimeoutMs = options?.downloadTimeoutMs ?? 8000;

    const orderGid = `gid://shopify/Order/${orderId}`;

    // 1. Query order and line-item customization attributes from Shopify GraphQL
    const response = await admin.graphql(
      `#graphql
      query getOrderDetails($id: ID!) {
        order(id: $id) {
          name
          createdAt
          lineItems(first: 20) {
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
      throw new Error(`Order #${orderId} not found in Shopify catalog`);
    }

    const lineItems = order.lineItems?.edges?.map((e: any) => e.node) || [];
    const personalizedItems: PersonalizationItem[] = [];

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

    // 2. Setup streaming zip pipeline
    const passThrough = new PassThrough();
    const archive = archiver("zip", { zlib: { level: compressionLevel } });

    archive.on("warning", (err: any) => {
      console.warn("Zip packaging warning:", err);
    });

    archive.on("error", (err: any) => {
      console.error("Zip packaging error:", err);
      passThrough.destroy(err);
    });

    archive.pipe(passThrough);

    // 3. Assemble zip package contents asynchronously
    const metadata = {
      orderId,
      orderName: order.name,
      createdAt: order.createdAt,
      compilationTime: new Date().toISOString(),
      personalizedItems
    };

    archive.append(JSON.stringify(metadata, null, 2), { name: "customizations.json" });

    // Asynchronously fetch assets and append to zip stream
    (async () => {
      try {
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

        for (const item of personalizedItems) {
          const itemSlug = `item_${item.id}`;

          // Create specifications text manifest
          let specsTxt = `Personalization choices for item: ${item.title}\n`;
          specsTxt += `==================================================\n`;
          specsTxt += `Quantity: ${item.quantity}\n`;
          Object.keys(item.choices).forEach((key) => {
            specsTxt += `${key}: ${item.choices[key]}\n`;
          });
          archive.append(specsTxt, { name: `${itemSlug}/specifications.txt` });

          // Stream customer uploaded graphic assets
          for (const key of Object.keys(item.choices)) {
            const val = item.choices[key];
            if (typeof val === "string" && val.startsWith("http") && val.includes("cdn.shopify.com")) {
              try {
                const imgRes = await fetchWithTimeout(val);
                if (imgRes.ok) {
                  const contentType = imgRes.headers.get("content-type") || "";
                  const extension = contentType.includes("png") ? "png" : contentType.includes("jpeg") ? "jpg" : "png";
                  const buffer = await imgRes.arrayBuffer();
                  const filename = `${key.toLowerCase().replace(/\s+/g, "_")}.${extension}`;
                  archive.append(Buffer.from(buffer), { name: `${itemSlug}/uploads/${filename}` });
                } else {
                  console.warn(`CDN asset fetch returned status ${imgRes.status} for ${val}`);
                }
              } catch (e) {
                console.error(`Failed to stream custom upload asset from ${val}`, e);
                // Append warning log inside the zip folder to notify merchant of download failures
                archive.append(`Failed to download asset: ${val}`, { name: `${itemSlug}/uploads/ERROR_${key}.txt` });
              }
            }
          }

          // Stream compiled print-ready layout file
          if (item.previewUrl) {
            try {
              const previewRes = await fetchWithTimeout(item.previewUrl);
              if (previewRes.ok) {
                const buffer = await previewRes.arrayBuffer();
                archive.append(Buffer.from(buffer), { name: `${itemSlug}/print_layouts/layout_design.png` });
              } else {
                console.warn(`CDN print layout fetch returned status ${previewRes.status} for ${item.previewUrl}`);
              }
            } catch (e) {
              console.error(`Failed to stream compiled design layout from ${item.previewUrl}`, e);
              archive.append(`Failed to download layout: ${item.previewUrl}`, { name: `${itemSlug}/print_layouts/ERROR_layout.txt` });
            }
          }
        }
      } catch (compileErr) {
        console.error("Fulfillment compilation stream exception:", compileErr);
      } finally {
        archive.finalize();
      }
    })();

    const cleanOrderName = order.name.replace("#", "");
    const filename = `fulfillment_package_order_${cleanOrderName}.zip`;

    return {
      stream: passThrough,
      filename,
      contentType: "application/zip",
    };
  }
}
