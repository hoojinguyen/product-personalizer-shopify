import type { ActionFunctionArgs } from "react-router";
import { OrderPrintCompiler } from "../utils/printCompiler";

export const action = async ({ request }: ActionFunctionArgs) => {
  try {
    const result = await OrderPrintCompiler.processWebhook(request);

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
