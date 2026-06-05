import type { ActionFunctionArgs } from "react-router";
import { OrderPersonalizationCompiler } from "../utils/orderPersonalizationCompiler";
import db from "../db.server";
import { authenticate } from "../shopify.server";

export const action = async ({ request }: ActionFunctionArgs) => {
  try {
    const { shop, admin, payload } = await authenticate.webhook(request);

    if (!admin) {
      return new Response("Webhook Admin context is missing. Cannot process order details.", { status: 400 });
    }

    const orderId = String(payload.id);
    const result = await OrderPersonalizationCompiler.enqueueWebhookJob({
      shop,
      orderId,
      adminClient: admin,
      dbClient: db,
    });

    if (result.success) {
      console.log(`Order ${result.orderId} enqueued for background print file compilation.`);
      return new Response("Accepted", { status: 202 });
    } else {
      console.error(`Failed to enqueue print compilation: ${result.error}`);
      return new Response(result.error || "Compilation failed to enqueue", { status: 500 });
    }
  } catch (error: unknown) {
    console.error(`Webhook processing exception:`, error);
    return new Response(error instanceof Error ? error.message : "Internal Error", { status: 500 });
  }
};
