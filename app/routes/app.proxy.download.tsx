import type { LoaderFunctionArgs } from "react-router";
import { authenticate } from "../shopify.server";
import * as archiverModule from "archiver";
const archiver = ((archiverModule as any).default || archiverModule) as any;
import { PassThrough } from "stream";

// App Proxy dynamic manufacturing ZIP downloader matching ADR 0004
export const loader = async ({ request }: LoaderFunctionArgs) => {
  // 1. Authenticate context (handles both storefront app proxy & admin dashboard fetches safely)
  let adminClient: any = null;
  const urlObj = new URL(request.url);
  const orderId = urlObj.searchParams.get("orderId");

  if (!orderId) {
    return new Response("Missing orderId parameter", { status: 400 });
  }

  try {
    // Attempt Admin authentication first (for downloads initiated inside dashboard)
    const authResult = await authenticate.admin(request);
    adminClient = authResult.admin;
  } catch (adminErr) {
    try {
      // Fallback to App Proxy authentication (for storefront/customer/proxy calls)
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
    // 2. Fetch order line item customization properties from Shopify GraphQL
    const orderGid = `gid://shopify/Order/${orderId}`;
    
    const response = await adminClient.graphql(
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
      return new Response(`Order #${orderId} not found in Shopify catalog`, { status: 404 });
    }

    const lineItems = order.lineItems?.edges?.map((e: any) => e.node) || [];
    const personalizedItems: any[] = [];

    // Filter items that have customizations
    lineItems.forEach((item: any) => {
      const attributes = item.customAttributes || [];
      const previewUrl = attributes.find((a: any) => a.key === "_preview_url")?.value;
      const visibleProps = attributes.filter((a: any) => !a.key.startsWith("_") && a.key !== "priceUpcharge");

      if (previewUrl || visibleProps.length > 0) {
        personalizedItems.push({
          id: item.id.split("/").pop(),
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
      return new Response("No customized items found for this order package", { status: 400 });
    }

    // 3. Initiate dynamic streaming zipping directly piped to the Response stream
    const passThrough = new PassThrough();
    const archive = archiver("zip", { zlib: { level: 9 } });

    // Handle archiver warnings/errors safely
    archive.on("warning", (err: any) => {
      console.warn("Zip compiling warning:", err);
    });
    archive.on("error", (err: any) => {
      console.error("Zip compiling error:", err);
      passThrough.destroy(err);
    });

    archive.pipe(passThrough);

    // 4. Assemble package folders structure dynamically
    
    // Add customizations metadata JSON
    const metadata = {
      orderId,
      orderName: order.name,
      createdAt: order.createdAt,
      compilationTime: new Date().toISOString(),
      personalizedItems
    };
    archive.append(JSON.stringify(metadata, null, 2), { name: "customizations.json" });

    // Background asynchronous graphic assets fetching and zipping
    (async () => {
      try {
        for (const item of personalizedItems) {
          const itemSlug = `item_${item.id}`;
          
          // Add custom choice specifications in a text summary per line item
          let specsTxt = `Personalization choices for item: ${item.title}\n`;
          specsTxt += `==================================================\n`;
          specsTxt += `Quantity: ${item.quantity}\n`;
          Object.keys(item.choices).forEach(key => {
            specsTxt += `${key}: ${item.choices[key]}\n`;
          });
          archive.append(specsTxt, { name: `${itemSlug}/specifications.txt` });

          // Stream customer uploaded graphics if dynamic uploads exist
          for (const key of Object.keys(item.choices)) {
            const val = item.choices[key];
            if (typeof val === "string" && val.startsWith("http") && val.includes("cdn.shopify.com")) {
              try {
                const imgRes = await fetch(val);
                if (imgRes.ok) {
                  const contentType = imgRes.headers.get("content-type") || "";
                  const extension = contentType.includes("png") ? "png" : contentType.includes("jpeg") ? "jpg" : "png";
                  const buffer = await imgRes.arrayBuffer();
                  archive.append(Buffer.from(buffer), { name: `${itemSlug}/uploads/${key.toLowerCase().replace(/\\s+/g, "_")}.${extension}` });
                }
              } catch (e) {
                console.error(`Failed to stream custom upload asset from ${val}`, e);
              }
            }
          }

          // Stream compiled print-ready layout file
          if (item.previewUrl) {
            try {
              const previewRes = await fetch(item.previewUrl);
              if (previewRes.ok) {
                const buffer = await previewRes.arrayBuffer();
                archive.append(Buffer.from(buffer), { name: `${itemSlug}/print_layouts/layout_design.png` });
              }
            } catch (e) {
              console.error(`Failed to stream compiled design layout from ${item.previewUrl}`, e);
            }
          }
        }
      } catch (compileErr) {
        console.error("Fulfillment compilation stream exception:", compileErr);
      } finally {
        // Finalize zipping stream cleanly
        archive.finalize();
      }
    })();

    // 5. Pipe stream directly to client browser
    return new Response(passThrough as any, {
      headers: {
        "Content-Type": "application/zip",
        "Content-Disposition": `attachment; filename="fulfillment_package_order_${order.name.replace("#", "")}.zip"`,
        "Cache-Control": "no-store, no-cache, must-revalidate"
      }
    });

  } catch (error: any) {
    console.error("Unexpected error compiling fulfillment package:", error);
    return new Response(`Fulfillment compiling failed: ${error.message || error}`, { status: 500 });
  }
};
