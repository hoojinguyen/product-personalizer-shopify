# Product Personalizer Glossary

Canonical terminology for understanding the Zepto Product Personalizer Shopify app. All explainers and learning records use these terms.

## Shopify Platform Terms

**Metafield**:
A key-value store attached to a Shopify resource (product, variant, shop) that holds custom data beyond Shopify's built-in fields.
_Avoid_: Custom field, extra data, product attribute

**App Proxy**:
A Shopify-hosted URL route that forwards requests from the storefront domain to the app's backend server, enabling server-side logic without CORS issues.
_Avoid_: API endpoint, proxy route, backend relay

**Webhook**:
An HTTP callback Shopify sends to the app when a specific event occurs (e.g., order created, app uninstalled).
_Avoid_: Event listener, notification, callback hook

**Theme App Extension**:
An app-provided block that merchants drop into their Shopify theme via the theme editor, rendering custom UI on the storefront without modifying theme source files.
_Avoid_: Theme block, widget injection, storefront script

**Shopify Function**:
Server-side logic that runs inside Shopify's infrastructure at specific extension points (e.g., cart transform, discounts, payment customization) — not on the app's server.
_Avoid_: Backend function, serverless function, API hook

**Cart Transform**:
A Shopify Function extension point that lets apps modify cart line items during checkout — merging, splitting, or re-pricing items programmatically.
_Avoid_: Cart modifier, checkout hook, price adjuster

## App Domain Terms

**Customizer**:
The interactive builder interface where a buyer inputs, uploads, and configures customization properties on a storefront product page.
_Avoid_: Personalization block, personalization card, builder widget

**Personalization Config**:
The unified JSON schema defining the fields, validation constraints, and rendering layers for a customizable product — stored as a product metafield.
_Avoid_: Settings schema, options template

**Template**:
A reusable blueprint of customization options that can be bulk-applied to products and dynamically synced downstream when modified.
_Avoid_: Blueprint, options list, preset config

**Manufacturing Dataset**:
The compiled set of coordinate-perfect personalization values, fonts, and customer assets required to manufacture a personalized item.
_Avoid_: Production file, design zip, order customization data

**Fulfillment Package**:
A compressed ZIP archive compiled on-demand containing all manufacturing assets and customer inputs for an order.
_Avoid_: Order ZIP, manufacturing file package, download package

**Font Set**:
A curated group of system or uploaded typography assets accessible in customizer options.
_Avoid_: Font list, typography set, font options

**Upcharge Component**:
The additional fee associated with personalization choices, dynamically bundled and pricing-adjusted directly inside the main cart line item using Shopify's Cart Transform API.
_Avoid_: Upcharge Item, fee variant, stacked variant

**Template Sync**:
The synchronization module that persists template option schemas to the local database and propagates corresponding Personalization Config payloads downstream to linked storefront products.
_Avoid_: Template Synchronizer, options pusher, config updater

**Order Personalization Compiler**:
The consolidated manufacturing compilation module that processes order personalization properties, compiles coordinate-perfect vector SVG print layouts, and aggregates them alongside customer asset uploads into streaming fulfillment packages.
_Avoid_: Order compiler, personalization service, package zip builder

**Shopify File Publisher**:
The unified network adapter module that handles pre-staging, storage-bucket uploads, registry mutations, and public CDN URL resolution for app assets and customer customizations.
_Avoid_: File uploader, image stages, asset poster
