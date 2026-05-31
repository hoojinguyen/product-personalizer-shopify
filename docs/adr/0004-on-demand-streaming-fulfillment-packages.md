# On-Demand Streaming Fulfillment Packages

## Context

Merchants need to download a complete ZIP package (the **Fulfillment Package**) containing X/Y coordinates, original customer graphics uploads, and print-ready vector/raster layouts to start manufacturing. Downloading and compressing these high-resolution assets (often 10MB to 50MB per file) inside the incoming order webhooks creates severe CPU/memory spikes and risks hitting Shopify's 5-second webhook timeout limit. Conversely, pre-compiling and storing ZIP files for all orders on an external cloud storage bucket indefinitely creates high persistent hosting and storage costs.

## Decision

We will implement an **On-Demand Streaming** architecture to compile and deliver Fulfillment Packages:

1. **Webhook Role:** The `orders/create` webhook only saves lightweight order metadata, coordinate mappings, and public CDN URLs for print files in the SQLite database, returning an instant `200 OK` response to Shopify.
2. **Streaming Compiler:** When the merchant requests a package download from the admin dashboard, the app server initiates an on-demand streaming zip process (using a library like `archiver`).
3. **Piped Delivery:** Rather than writing files to local disk or a cloud bucket first, the zip streams are piped chunk-by-chunk directly into the HTTP response. Big graphics assets are streamed straight from the Shopify CDN into the zip archiver stream.

This eliminates storage overhead, prevents webhook timeout failures, keeps server memory usage constant, and provides a secure, reliable delivery method for merchants.
