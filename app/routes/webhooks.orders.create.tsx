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

      // Construct a highly precise, crisp, scalable vector SVG for manufacturing
      // CNC, laser engravers, and print-on-demand printers require vector SVGs because they scale infinitely
      const svgWidth = 800;
      const svgHeight = 800;

      let svgLayers = "";
      let base64Fonts = "";

      if (config && Array.isArray(config.options)) {
        for (const opt of config.options) {
          const val = propertiesMap[opt.label];
          if (!val) continue;

          const cx = opt.canvasX ?? 400;
          const cy = opt.canvasY ?? 400;
          const rot = opt.canvasRotation ?? 0;

          if (opt.type === "text") {
            // Find if there is a dynamic font selected
            let fontName = "Arial";
            let fontColor = "#000000";

            // Find font and color parameters from selected properties
            for (const otherOpt of config.options) {
              const otherVal = propertiesMap[otherOpt.label];
              if (otherOpt.label.toLowerCase().includes("font") || otherOpt.label.toLowerCase().includes("style")) {
                fontName = otherVal || "Arial";
              }
              if (otherOpt.label.toLowerCase().includes("color") || otherOpt.type === "swatch") {
                fontColor = otherVal || "#000000";
              }
            }

            // Fetch and base64 embed custom font if it is not already embedded
            if (fontName !== "Arial" && fontName !== "Georgia" && !base64Fonts.includes(fontName)) {
              const fontAsset = await db.asset.findFirst({
                where: { shop, type: "FONTS", name: fontName }
              });
              if (fontAsset) {
                try {
                  const assetData = JSON.parse(fontAsset.value);
                  const fontRes = await fetch(assetData.url);
                  if (fontRes.ok) {
                    const buf = Buffer.from(await fontRes.arrayBuffer());
                    const b64 = buf.toString("base64");
                    base64Fonts += `
                      @font-face {
                        font-family: "${fontName}";
                        src: url("data:font/truetype;charset=utf-8;base64,${b64}") format("truetype");
                      }
                    `;
                  }
                } catch (err) {
                  console.warn(`Font fetch failed for ${fontName}:`, err);
                }
              }
            }

            const fontSize = opt.canvasFontSize ?? 48;
            svgLayers += `
              <g transform="translate(${cx}, ${cy}) rotate(${rot})">
                <text
                  text-anchor="middle"
                  alignment-baseline="middle"
                  dominant-baseline="central"
                  font-family="'${fontName}', Arial, sans-serif"
                  font-size="${fontSize}"
                  fill="${fontColor}"
                  font-weight="bold"
                >${val}</text>
              </g>
            `;
          } else if ((opt.type === "clipart" || opt.type === "file") && val) {
            const w = opt.canvasWidth ?? 250;
            const h = opt.canvasHeight ?? 250;
            
            // Try to download and inline image as base64 for self-contained SVG
            let imageHref = val;
            try {
              const imgRes = await fetch(val);
              if (imgRes.ok) {
                const buf = Buffer.from(await imgRes.arrayBuffer());
                const contentType = imgRes.headers.get("content-type") || "image/png";
                imageHref = `data:${contentType};base64,${buf.toString("base64")}`;
              }
            } catch (err) {
              console.warn("Failed to inline image base64, using raw URL:", err);
            }

            svgLayers += `
              <g transform="translate(${cx}, ${cy}) rotate(${rot})">
                <image
                  href="${imageHref}"
                  x="-${w / 2}"
                  y="-${h / 2}"
                  width="${w}"
                  height="${h}"
                />
              </g>
            `;
          }
        }
      }

      if (!svgLayers) {
        // Fallback to legacy single text rendering if config is not present
        const customText = propertiesMap["Custom Engraving Text"] || propertiesMap["Engraving Text"] || "";
        const fontStyle = propertiesMap["Font Style"] || propertiesMap["Font"] || "Arial";
        const textColor = propertiesMap["Engraving Color"] || propertiesMap["Text Color"] || "#000000";
        svgLayers = `
          <g transform="translate(400, 400)">
            <text
              text-anchor="middle"
              alignment-baseline="middle"
              dominant-baseline="central"
              font-family="${fontStyle}, Arial, sans-serif"
              font-size="80"
              fill="${textColor}"
              font-weight="bold"
            >${customText}</text>
          </g>
        `;
      }

      // Build SVG nodes
      const svgContent = `
        <svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 ${svgWidth} ${svgHeight}" width="${svgWidth}" height="${svgHeight}">
          <defs>
            <style>
              ${base64Fonts}
            </style>
          </defs>
          <!-- Base background context -->
          <rect width="100%" height="100%" fill="#ffffff" />
          
          <!-- Base product image reference (if exists, kept subtle as background context) -->
          ${baseProductImageUrl ? `<image href="${baseProductImageUrl}" x="50" y="50" width="700" height="700" opacity="0.1" />` : ""}
          
          <!-- Razor-sharp customized options layers -->
          ${svgLayers}
          
          <!-- Precise bounding boxes & production details (at top boundary) -->
          <rect x="10" y="10" width="780" height="780" fill="none" stroke="#008060" stroke-width="1" stroke-dasharray="3,3" />
          <text x="25" y="35" font-family="Helvetica, Arial, sans-serif" font-size="12" fill="#008060" font-weight="bold">
            PRODUCTION READY — Infinite Vector Scale
          </text>
          <text x="25" y="55" font-family="Helvetica, Arial, sans-serif" font-size="10" fill="#6d7175">
            Order: #${payload.name} | Item: ${item.title}
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
