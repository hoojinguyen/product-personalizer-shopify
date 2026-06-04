# Product Personalizer

An interactive product personalization engine for Shopify stores that enables customers to customize items and compiles their choices into high-resolution manufacturing print files.

## Language

**Customizer**:
The interactive builder interface where a buyer inputs, uploads, and configures customization properties.
_Avoid_: Personalization block, personalization card, builder widget

**Personalization Config**:
The unified JSON schema defining the fields, validation constraints, and rendering layers for a customizable product.
_Avoid_: Settings schema, options template

**Manufacturing Dataset**:
The compiled set of coordinate-perfect personalization values, fonts, and customer assets required to manufacture a personalized item.
_Avoid_: Production file, design zip, order customization data

**Template**:
A reusable blueprint of customization options that can be bulk-applied to products and dynamically synced downstream when modified.
_Avoid_: Blueprint, options list, preset config

**Font Set**:
A curated group of system or uploaded typography assets accessible in customizer options.
_Avoid_: Font list, typography set, font options

**Fulfillment Package**:
A compressed ZIP archive compiled on-demand containing all manufacturing assets and customer inputs for an order.
_Avoid_: Order ZIP, manufacturing file package, download package

**Layout Mode**:
The visual presentation format of the storefront customizer, which can be inline stacked, tabbed, or a modal overlay.
_Avoid_: Theme block, visual layout, block type

**Upcharge Component**:
The additional fee associated with personalization choices, dynamically bundled and pricing-adjusted directly inside the main cart line item using Shopify's Cart Transform API.
_Avoid_: Upcharge Item, fee variant, stacked variant

**Cart Transform Sync**:
The automatic Shopify Function-driven merging of customizer choices and dynamic fees directly into the main checkout product without auxiliary items.
_Avoid_: Cart Sync, cart listener, item linkage

**Print File Compiler**:
The headless vector layout compiler module that processes a shopper's personalization choices against a Personalization Config to generate a self-contained vector SVG print file.
_Avoid_: SVG generator, print layouter, layout builder

**Shopify File Publisher**:
The unified network adapter module that handles pre-staging, storage-bucket uploads, registry mutations, and public CDN URL resolution for app assets and customer customizations.
_Avoid_: File uploader, image stages, asset poster

**Fulfillment Package Packager**:
The dynamic compilation module that aggregates order metadata, customer asset uploads, and print layouts, packaging them into a streaming ZIP archive for order fulfillment.
_Avoid_: Zip packager, package zipper, zip compiler





