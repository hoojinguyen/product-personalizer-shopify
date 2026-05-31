import type { ActionFunctionArgs } from "react-router";
import { authenticate } from "../shopify.server";
import db from "../db.server";

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

      // Retrieve product detail via GraphQL to fetch featured product image for context
      const productResponse = await admin.graphql(
        `#graphql
        query getProductImage($id: ID!) {
          product(id: $id) {
            featuredImage {
              url
            }
          }
        }`,
        { variables: { id: `gid://shopify/Product/${item.product_id}` } }
      );
      const productJson = await productResponse.json();
      const baseProductImageUrl = productJson.data?.product?.featuredImage?.url || "";

      // Construct a highly precise, crisp, scalable vector SVG for manufacturing
      // CNC, laser engravers, and print-on-demand printers require vector SVGs because they scale infinitely
      const svgWidth = 1200;
      const svgHeight = 1200;
      
      const customText = propertiesMap["Custom Engraving Text"] || propertiesMap["Engraving Text"] || "";
      const fontStyle = propertiesMap["Font Style"] || propertiesMap["Font"] || "Arial";
      const textColor = propertiesMap["Engraving Color"] || propertiesMap["Text Color"] || "#000000";

      // Build SVG nodes
      const svgContent = `
        <svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 ${svgWidth} ${svgHeight}" width="${svgWidth}" height="${svgHeight}">
          <!-- Base background context -->
          <rect width="100%" height="100%" fill="#fbfbfb" />
          
          <!-- Base product image reference (if exists) -->
          ${baseProductImageUrl ? `<image href="${baseProductImageUrl}" x="100" y="100" width="1000" height="1000" opacity="0.15" />` : ""}
          
          <!-- Precise bounding boxes & production details -->
          <rect x="50" y="50" width="1100" height="1100" fill="none" stroke="#2c6ecb" stroke-width="2" stroke-dasharray="5,5" />
          <text x="60" y="90" font-family="Helvetica, Arial, sans-serif" font-size="20" fill="#2c6ecb" font-weight="bold">
            PRODUCTION PRINT TEMPLATE — Infinite Vector Scale
          </text>
          <text x="60" y="120" font-family="Helvetica, Arial, sans-serif" font-size="16" fill="#6d7175">
            Order: #${payload.name} | Item: ${item.title}
          </text>

          <!-- The buyer's customized engraving layer, perfectly centered and razor-sharp -->
          <g transform="translate(600, 600)">
            <text
              text-anchor="middle"
              alignment-baseline="middle"
              font-family="${fontStyle}, Arial, sans-serif"
              font-size="80"
              fill="${textColor}"
              font-weight="bold"
            >${customText}</text>
          </g>
          
          <!-- Metadata footer -->
          <text x="60" y="1140" font-family="Helvetica, Arial, sans-serif" font-size="14" fill="#6d7175">
            Customer Customization choices: ${JSON.stringify(propertiesMap)}
          </text>
        </svg>
      `.trim();

      // Step 1: Securely stage the high-res SVG upload via Shopify Files API
      const filename = `print_${payload.id}_${item.id}.svg`;
      const fileBytes = Buffer.byteLength(svgContent, "utf-8");

      console.log(`Staging SVG print file upload to Shopify: ${filename} (${fileBytes} bytes)`);

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
                mimeType: "image/svg+xml",
                resource: "FILE",
                fileSize: String(fileBytes),
              },
            ],
          },
        }
      );

      const stagedJson = await stagedResponse.json();
      const stagedErrors = stagedJson.data?.stagedUploadsCreate?.userErrors;
      if (stagedErrors && stagedErrors.length > 0) {
        throw new Error(`Staged upload failed: ${stagedErrors[0].message}`);
      }

      const target = stagedJson.data?.stagedUploadsCreate?.stagedTargets?.[0];
      if (!target) {
        throw new Error("Staging target was not generated by Shopify.");
      }

      // Step 2: Upload file stream to Shopify staged target (S3/GCS bucket)
      const uploadForm = new FormData();
      target.parameters.forEach((param: { name: string; value: string }) => {
        uploadForm.append(param.name, param.value);
      });
      // Convert SVG text into blob/file parameter
      const svgBlob = new Blob([svgContent], { type: "image/svg+xml" });
      uploadForm.append("file", svgBlob, filename);

      const uploadResponse = await fetch(target.url, {
        method: "POST",
        body: uploadForm,
      });

      if (!uploadResponse.ok) {
        const errText = await uploadResponse.text();
        throw new Error(`Staged bucket upload failed: ${errText}`);
      }

      console.log(`Print file staged. Registering in Shopify catalog...`);

      // Step 3: Register high-res SVG in Shopify Files
      const fileCreateResponse = await admin.graphql(
        `#graphql
        mutation fileCreate($files: [FileCreateInput!]!) {
          fileCreate(files: $files) {
            files {
              id
              fileStatus
              ... on GenericFile {
                url
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
                contentType: "FILE",
                filename,
              },
            ],
          },
        }
      );

      const fileCreateJson = await fileCreateResponse.json();
      const createErrors = fileCreateJson.data?.fileCreate?.userErrors;
      if (createErrors && createErrors.length > 0) {
        throw new Error(`Registering file failed: ${createErrors[0].message}`);
      }

      const fileRecord = fileCreateJson.data?.fileCreate?.files?.[0];
      if (!fileRecord) {
        throw new Error("File registry returned empty records.");
      }

      // Step 4: Poll to resolve public manufacturing CDN URL
      let printFileUrl = fileRecord.url;
      let pollCount = 0;
      const fileId = fileRecord.id;

      while (pollCount < 6 && !printFileUrl) {
        console.log(`Polling for SVG print file URL (attempt ${pollCount + 1})...`);
        await new Promise((resolve) => setTimeout(resolve, 800));

        const checkResponse = await admin.graphql(
          `#graphql
          query getFile($id: ID!) {
            node(id: $id) {
              ... on GenericFile {
                url
              }
            }
          }`,
          { variables: { id: fileId } }
        );
        const checkJson = await checkResponse.json();
        printFileUrl = checkJson.data?.node?.url;
        pollCount++;
      }

      const finalUrl = printFileUrl || target.resourceUrl;
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
