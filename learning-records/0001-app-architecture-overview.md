# The app has 5 distinct subsystems that form a pipeline

The Product Personalizer is not a single monolith — it's a pipeline of 5 cooperating subsystems, each touching different Shopify platform primitives. Understanding the pipeline order is essential before diving into any individual module:

1. **Admin Dashboard** (Remix routes) — where merchants configure templates, assets, settings
2. **Template Sync** (hexagonal adapter) — propagates configs to products as metafields
3. **Storefront Widget** (React micro-frontend) — buyer-facing customizer mounted via Theme App Extension
4. **Cart Transform** (Shopify Function / WASM) — adjusts pricing and preview images at checkout
5. **Order Compiler** (background worker) — compiles manufacturing SVGs and fulfillment ZIPs

Each subsystem communicates with the next via a specific Shopify primitive: metafields bridge admin→storefront, line-item properties bridge storefront→cart, webhooks bridge checkout→compiler.

## Evidence
Established through comprehensive codebase research across all route files, extensions, and utility modules.

## Implications
Future sessions can now teach each subsystem in isolation, using the pipeline mental model to show where data enters and exits. Start with the buyer journey (subsystems 3→4→5) since that's closest to the user's stated mission.
