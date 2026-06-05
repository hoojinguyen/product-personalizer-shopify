import type { ActionFunctionArgs } from "react-router";
import { authenticate } from "../shopify.server";
import db from "../db.server";
import {
  PrintFileCompilerImpl,
  ShopifyAdminClientGraphQLAdapter,
  PrismaDatabaseAdapter,
  HttpNetworkAdapter
} from "../utils/printCompiler";

export const action = async ({ request }: ActionFunctionArgs) => {
  const { shop, admin, payload, topic } = await authenticate.webhook(request);

  console.log(`Received ${topic} webhook for order #${payload.name} (${payload.id}) on shop ${shop}`);

  if (!admin) {
    console.error("Webhook Admin context is missing. Cannot process order details.");
    return new Response("Admin context missing", { status: 400 });
  }

  // Iterate over line items to see if any are personalized
  interface WebhookProperty {
    name: string;
    value: unknown;
  }
  interface WebhookLineItem {
    id: string | number;
    product_id: string | number;
    title: string;
    variant_title?: string | null;
    properties?: WebhookProperty[] | null;
  }
  const lineItems = (payload.line_items || []) as WebhookLineItem[];
  const personalizedItems = lineItems.filter((item) => {
    return item.properties && item.properties.some((prop) => !prop.name.startsWith("_") && prop.name !== "priceUpcharge");
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

  const compiler = new PrintFileCompilerImpl();
  const adapters = {
    shopifyClient: new ShopifyAdminClientGraphQLAdapter(admin),
    database: new PrismaDatabaseAdapter(db),
    network: new HttpNetworkAdapter(),
  };

  try {
    const manufacturingFiles: string[] = [];

    for (const item of personalizedItems) {
      console.log(`Processing personalized item: ${item.title} (${item.variant_title || "Default Variant"})`);

      // Compile the manufacturing-ready vector SVG print file using the deep Print File Compiler module
      const result = await compiler.compileAndPublish(
        {
          shop,
          orderId: String(payload.id),
          orderName: `#${payload.name}`,
          lineItem: {
            id: String(item.id),
            product_id: String(item.product_id),
            title: item.title,
            variant_title: item.variant_title,
            properties: item.properties?.map((p) => ({ name: p.name, value: p.value })) || [],
          },
        },
        adapters
      );

      if (result.warnings.length > 0) {
        console.warn(`Print compilation warnings for order item ${item.id}:`, result.warnings);
      }

      console.log(`Manufacturing print file generated successfully: ${result.publicUrl}`);
      manufacturingFiles.push(result.publicUrl);
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
  } catch (error: unknown) {
    console.error(`Failed to generate high-resolution print files for Order #${payload.name}:`, error);
    await db.orderProcessingLog.update({
      where: { id: logEntry.id },
      data: {
        status: "FAILED",
        error: error instanceof Error ? error.message : "Unknown rendering exception",
      },
    });
  }

  return new Response("Webhook processed", { status: 200 });
};
