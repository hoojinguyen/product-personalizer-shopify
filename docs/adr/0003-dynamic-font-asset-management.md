# Dynamic Font Asset Management

## Context

To provide premium, custom branding options, merchants can upload custom `.ttf`/`.otf`/`.woff` font files. These files must load correctly in the storefront canvas, the admin dashboard editor, and the headless print file compiler. Font files are large (typically 50KB to 250KB). Storing them as Base64 strings inside the database or metafields would bloat database query payloads and exceed Shopify's metafield storage limits.

## Decision

We will store and serve custom font files dynamically using Shopify's CDN and load them asynchronously in the rendering engines:

1. **Storage:** Custom font files are uploaded to the merchant's Shopify Files catalog via the `stagedUploadsCreate` API, leveraging Shopify's free and global CDN.
2. **Storefront Injector:** The app injects `@font-face` rules in a stylesheet block pointing to the Shopify CDN URLs. The storefront JavaScript (`personalizer.js`) utilizes `document.fonts.load()` to wait for the font file to load completely before drawing the canvas, preventing fallback font rendering.
3. **Headless Server-Side Cache:** The order processing webhook dynamically fetches the CDN font file, caches it in the server's temp directory, and registers it with `canvas.registerFont()` before print-file generation.

This avoids database bloat and ensures high-speed, accurate typography rendering in both browser and server environments.
