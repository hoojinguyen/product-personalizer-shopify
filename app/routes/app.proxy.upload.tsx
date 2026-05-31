import { ActionFunctionArgs, LoaderFunctionArgs } from "react-router";
import { authenticate } from "../shopify.server";

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

    // Step 1: Request a staged upload target from Shopify Files API
    const stagedResponse = await admin.graphql(
      `#graphql
      mutation stagedUploadsCreate($input: [StagedUploadInput!]!) {
        stagedUploadsCreate(input: $input) {
          stagedTargets {
            url
            resourceUrl
            parameters {
              name
              value
            }
          }
          userErrors {
            field
            message
          }
        }
      }`,
      {
        variables: {
          input: [
            {
              filename,
              httpMethod: "POST",
              mimeType,
              resource: "FILE",
              fileSize: String(fileSize),
            },
          ],
        },
      }
    );

    const stagedJson = await stagedResponse.json();
    const stagedErrors = stagedJson.data?.stagedUploadsCreate?.userErrors;
    if (stagedErrors && stagedErrors.length > 0) {
      console.error("stagedUploadsCreate errors:", stagedErrors);
      return json({ error: stagedErrors[0].message }, { status: 400 });
    }

    const target = stagedJson.data?.stagedUploadsCreate?.stagedTargets?.[0];
    if (!target) {
      return json({ error: "Could not create staging target" }, { status: 500 });
    }

    // Step 2: Build multipart form data and POST upload the file buffer to Shopify's storage bucket
    const uploadForm = new FormData();
    target.parameters.forEach((param: { name: string; value: string }) => {
      uploadForm.append(param.name, param.value);
    });
    // Append the file field
    uploadForm.append("file", file);

    const uploadResponse = await fetch(target.url, {
      method: "POST",
      body: uploadForm,
    });

    if (!uploadResponse.ok) {
      const uploadText = await uploadResponse.text();
      console.error("Shopify storage upload failed:", uploadText);
      return json({ error: "Uploading file to storage provider failed" }, { status: 500 });
    }

    console.log(`Staged upload succeeded. Registering file in Shopify Files API...`);

    // Step 3: Register the file in the merchant's Files library
    const fileCreateResponse = await admin.graphql(
      `#graphql
      mutation fileCreate($files: [FileCreateInput!]!) {
        fileCreate(files: $files) {
          files {
            id
            fileStatus
            alt
            ... on MediaImage {
              image {
                url
              }
            }
          }
          userErrors {
            field
            message
          }
        }
      }`,
      {
        variables: {
          files: [
            {
              originalSource: target.resourceUrl,
              contentType: "IMAGE",
              filename,
            },
          ],
        },
      }
    );

    const fileCreateJson = await fileCreateResponse.json();
    const createErrors = fileCreateJson.data?.fileCreate?.userErrors;
    if (createErrors && createErrors.length > 0) {
      console.error("fileCreate errors:", createErrors);
      return json({ error: createErrors[0].message }, { status: 400 });
    }

    const createdFile = fileCreateJson.data?.fileCreate?.files?.[0];
    if (!createdFile) {
      return json({ error: "File creation failed in Shopify Files catalog" }, { status: 500 });
    }

    // Step 4: Proactively poll to resolve the public CDN URL (files process asynchronously)
    let publicUrl = createdFile.image?.url;
    let pollCount = 0;
    const fileId = createdFile.id;

    while (pollCount < 6 && !publicUrl) {
      console.log(`Polling Shopify for public CDN URL (attempt ${pollCount + 1})...`);
      await new Promise((resolve) => setTimeout(resolve, 800));
      
      const checkResponse = await admin.graphql(
        `#graphql
        query getFile($id: ID!) {
          node(id: $id) {
            ... on MediaImage {
              image {
                url
              }
            }
          }
        }`,
        { variables: { id: fileId } }
      );
      const checkJson = await checkResponse.json();
      publicUrl = checkJson.data?.node?.image?.url;
      pollCount++;
    }

    if (!publicUrl) {
      console.warn("Public CDN URL did not resolve in time. Falling back to resourceUrl.");
    }

    return json({
      success: true,
      fileId,
      url: publicUrl || target.resourceUrl,
    });
  } catch (error: any) {
    console.error("Unexpected error in App Proxy Upload:", error);
    return json({ error: error.message || "Internal server error" }, { status: 500 });
  }
};
