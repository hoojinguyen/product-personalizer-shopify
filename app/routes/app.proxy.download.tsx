import type { LoaderFunctionArgs } from "react-router";
import { authenticate } from "../shopify.server";
import { FulfillmentPackagePackager } from "../utils/fulfillmentPackager";

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
    const packager = new FulfillmentPackagePackager();
    const result = await packager.compile(adminClient, orderId);

    // 5. Pipe stream directly to client browser
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
};
