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

**Upcharge Item**:
A hidden Shopify product variant priced at $1.00 added to the cart in multiples to represent the customization fee.
_Avoid_: Fee variant, personalization cost product

**Cart Sync**:
The real-time coordination of quantities between a personalized product and its associated Upcharge Item in the shopping cart.
_Avoid_: Cart listener, item linkage





