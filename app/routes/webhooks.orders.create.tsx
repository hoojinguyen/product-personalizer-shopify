import type { ActionFunctionArgs } from "react-router";
import { authenticate } from "../shopify.server";
import db from "../db.server";
import { compilePrintFile } from "../utils/printCompiler";
import { ShopifyFilePublisher } from "../utils/shopifyFilePublisher";

export const action = async ({ request }: ActionFunctionArgs) => {
  const { shop, admin, payload, topic } = await authenticate.webhook(request);

  console.log(`Received ${topic} webhook for order #${payload.name} (${payload.id}) on shop ${shop}`);

  if (!admin) {
    console.error("Webhook Admin context is missing. Cannot process order details.");
    return new Response("Admin context missing", { status: 400 });
  }

  // Iterate over line items to see if any are personalized
  const lineItems = payload.line_items || [];
  const personalizedItems = lineItems.filter((item: any) => {
    return item.properties && item.properties.some((prop: any) => !prop.name.startsWith("_") && prop.name !== "priceUpcharge");
  });

  if (personalizedItems.length === 0) {
    console.log("No personalized options found for this order. Skipping print file generation.");
    return new Response("No customization needed", { status: 200 });
  }

  // Initialize processing log entry
  const logEntry = await db.orderProcessingLog.create({
    data: {
      shop,
      orderId: String(payload.id),
      status: "PENDING",
    },
  });

  try {
    const manufacturingFiles: string[] = [];

    for (const item of personalizedItems) {
      console.log(`Processing personalized item: ${item.title} (${item.variant_title || "Default Variant"})`);

      // Extract custom properties
      const propertiesMap: Record<string, string> = {};
      item.properties.forEach((p: any) => {
        propertiesMap[p.name] = p.value;
      });

      // Retrieve product detail via GraphQL to fetch featured product image and customization metafield for context
      const productResponse = await admin.graphql(
        `#graphql
        query getProductData($id: ID!) {
          product(id: $id) {
            featuredImage {
              url
            }
            metafield(namespace: "app", key: "customization_config") {
              value
            }
          }
        }`,
        { variables: { id: `gid://shopify/Product/${item.product_id}` } }
      );
      const productJson = await productResponse.json();
      const baseProductImageUrl = productJson.data?.product?.featuredImage?.url || "";
      const configMetafield = productJson.data?.product?.metafield?.value || "";

      let config: any = null;
      try {
        if (configMetafield) config = JSON.parse(configMetafield);
      } catch (e) {
        console.warn("Failed to parse product customization config:", e);
      }

      // Compile the manufacturing-ready vector SVG print file using the deep Print File Compiler module
      const { svgContent, warnings } = await compilePrintFile(
        {
          shopperValues: propertiesMap,
          config: config?.options || [],
        },
        {
          shop,
          orderName: `#${payload.name}`,
          lineItemTitle: item.title,
        }
      );

      if (warnings.length > 0) {
        console.warn(`Print compilation warnings for order item ${item.id}:`, warnings);
      }

      // Step 1: Securely stage and publish the high-res SVG upload via Shopify Files API
      const filename = `print_${payload.id}_${item.id}.svg`;
      console.log(`Publishing compiled SVG print layout to Shopify: ${filename}`);

      const publisher = new ShopifyFilePublisher();
      const published = await publisher.publish(
        admin,
        {
          content: svgContent,
          filename,
          mimeType: "image/svg+xml"
        }
      );

      const finalUrl = published.publicUrl;
      console.log(`Manufacturing print file generated successfully: ${finalUrl}`);
      manufacturingFiles.push(finalUrl);
    }

    // Step 5: Save high-res URL back to Shopify Order Metafields
    const metafieldResponse = await admin.graphql(
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
              ownerId: `gid://shopify/Order/${payload.id}`,
              namespace: "app",
              key: "manufacturing_files",
              type: "json",
              value: JSON.stringify(manufacturingFiles),
            },
          ],
        },
      }
    );

    const metafieldJson = await metafieldResponse.json();
    const metaErrors = metafieldJson.data?.metafieldsSet?.userErrors;
    if (metaErrors && metaErrors.length > 0) {
      console.error("Failed to update order metafields:", metaErrors);
    }

    // Update log state
    await db.orderProcessingLog.update({
      where: { id: logEntry.id },
      data: {
        status: "COMPLETED",
        printFileUrl: manufacturingFiles[0],
      },
    });

    console.log(`Successfully completed print compilation for Order #${payload.name}`);
  } catch (error: any) {
    console.error(`Failed to generate high-resolution print files for Order #${payload.name}:`, error);
    await db.orderProcessingLog.update({
      where: { id: logEntry.id },
      data: {
        status: "FAILED",
        error: error.message || "Unknown rendering exception",
      },
    });
  }

  return new Response("Webhook processed", { status: 200 });
};
