# Metafield-Driven Storefront Styling

## Context

Merchants need detailed control over how the storefront Customizer is presented on their product pages, including layout variations (**Layout Mode** like inline stacked, dynamic tabs, or modal popup overlays) and branding palettes (colors, outlines, buttons). 
Creating multiple discrete Shopify theme app extension blocks (stacked block, tabs block, modal block) divides the merchant's configuration dashboard: they must configure customizer options inside our app admin but configure visual styles and layout choices inside Shopify's Online Store Theme Customizer. This creates confusing user flows and bloats the theme extension codebase with redundant code.

## Decision

We will implement a single, unified Shopify theme block driven by the product's **Personalization Config** JSON metafield:

1. **Single Theme Block:** We scaffold a single, high-res Theme App Extension block (`personalizer.liquid`) that embeds standard DOM target container markings.
2. **Metafield-Injected Styles:** Visual configurations (branding colors, button sizes, outlines) are stored inside the `Personalization Config` JSON metafield. The storefront script (`product-personalizer.js`) reads these settings at render time and injects them as CSS Custom Properties (CSS variables) directly on the Customizer wrapper DOM node.
3. **JS Layout Builder:** The storefront script parses the selected Layout Mode (stacked, tabbed, modal) and dynamically restructures the input layers into the appropriate container shapes (e.g. injecting tab headings, active tab toggle event handlers, or launching a fullscreen overlay modal on trigger).

This ensures complete alignment between options and styling, provides instant updates from our app dashboard, and simplifies theme block management for merchants.
