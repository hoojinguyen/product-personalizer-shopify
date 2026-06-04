import { ActionFunctionArgs, LoaderFunctionArgs } from "react-router";
import { authenticate } from "../shopify.server";
import { ShopifyFilePublisher } from "../utils/shopifyFilePublisher";

const json = (data: any, init?: ResponseInit) => new Response(JSON.stringify(data), { ...init, headers: { "Content-Type": "application/json", ...init?.headers } });

// Standard App Proxy GET Loader (for healthchecks/validation)
export const loader = async ({ request }: LoaderFunctionArgs) => {
  try {
    const { session } = await authenticate.public.appProxy(request);
    return json({ status: "ok", shop: session?.shop || "unknown" });
  } catch (error) {
    return json({ status: "unauthenticated" }, { status: 401 });
  }
};

// App Proxy POST Action (processes storefront file uploads securely)
export const action = async ({ request }: ActionFunctionArgs) => {
  // Support CORS or preflight if needed, but App Proxies are routed on-domain by Shopify, so simple handling works.
  if (request.method !== "POST") {
    return json({ error: "Method not allowed" }, { status: 405 });
  }

  try {
    // Authenticate storefront context via standard Shopify App Proxy validation
    const { admin, session } = await authenticate.public.appProxy(request);

    if (!admin || !session) {
      console.error("App Proxy: Unauthenticated access attempt.");
      return json({ error: "Unauthorized storefront access" }, { status: 401 });
    }

    // Parse the incoming multipart form data containing the file
    const formData = await request.formData();
    const file = formData.get("file") as File;

    if (!file) {
      return json({ error: "No file was uploaded" }, { status: 400 });
    }

    const filename = file.name || `buyer_${Date.now()}.png`;
    const mimeType = file.type || "image/png";
    const fileSize = file.size;

    console.log(`Received file upload request from ${session.shop}: ${filename} (${fileSize} bytes, ${mimeType})`);

    // Stage, upload, register, and poll the buyer's file using the consolidated publisher
    const publisher = new ShopifyFilePublisher();
    const published = await publisher.publish(
      admin,
      {
        content: file,
        filename,
        mimeType,
      }
    );

    return json({
      success: true,
      fileId: published.fileId,
      url: published.publicUrl,
    });
  } catch (error: any) {
    console.error("Unexpected error in App Proxy Upload:", error);
    return json({ error: error.message || "Internal server error" }, { status: 500 });
  }
};
