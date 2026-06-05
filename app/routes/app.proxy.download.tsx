import type { LoaderFunctionArgs } from "react-router";
import { OrderPersonalizationCompiler } from "../utils/orderPersonalizationCompiler";
import { authenticate } from "../shopify.server";

// App Proxy dynamic manufacturing ZIP downloader matching ADR 0004
export const loader = async ({ request }: LoaderFunctionArgs) => {
  const urlObj = new URL(request.url);
  const orderId = urlObj.searchParams.get("orderId");

  if (!orderId) {
    return new Response("Missing orderId parameter", { status: 400 });
  }

  let adminClient: any = null;
  let shop: string | undefined;

  try {
    const authResult = await authenticate.admin(request);
    adminClient = authResult.admin;
    shop = authResult.session?.shop;
  } catch (adminErr) {
    try {
      const authResult = await authenticate.public.appProxy(request);
      adminClient = authResult.admin;
      shop = authResult.session?.shop;
    } catch (proxyErr) {
      console.error("Authentication failed for zip download", adminErr, proxyErr);
      return new Response("Unauthorized download access", { status: 401 });
    }
  }

  if (!adminClient) {
    return new Response("Shopify API context unavailable", { status: 500 });
  }

  try {
    const result = await OrderPersonalizationCompiler.packageFulfillment(
      { shop: shop || "", orderId },
      { adminClient }
    );

    return new Response(result.stream as any, {
      headers: {
        "Content-Type": result.contentType,
        "Content-Disposition": `attachment; filename="${result.filename}"`,
        "Cache-Control": "no-store, no-cache, must-revalidate",
      },
    });
  } catch (error: any) {
    console.error("Unexpected error compiling fulfillment package:", error);
    return new Response(`Fulfillment compiling failed: ${error.message || error}`, { status: 500 });
  }
};
