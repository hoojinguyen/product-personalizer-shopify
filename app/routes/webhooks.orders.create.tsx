import type { ActionFunctionArgs } from "react-router";
import { OrderPrintCompiler } from "../utils/printCompiler";

export const action = async ({ request }: ActionFunctionArgs) => {
  try {
    const result = await OrderPrintCompiler.processWebhook(request);

    if (result.success) {
      console.log(`Successfully compiled print files for order ${result.orderId}. Processed items: ${result.processedItemsCount}`);
      return new Response("OK", { status: 200 });
    } else {
      console.error(`Failed to compile print files for order ${result.orderId}: ${result.error}`);
      return new Response(result.error || "Compilation failed", { status: 500 });
    }
  } catch (error: unknown) {
    console.error(`Webhook processing exception:`, error);
    return new Response(error instanceof Error ? error.message : "Internal Error", { status: 500 });
  }
};
