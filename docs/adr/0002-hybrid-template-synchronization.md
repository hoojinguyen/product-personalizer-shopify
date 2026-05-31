# Hybrid Template Synchronization

## Context

Merchants want to create modular **Templates** and bulk-apply them to hundreds of products. When templates are modified, the changes must propagate to all associated products. 
However, Shopify storefronts cannot query SQLite directly in Liquid. Making asynchronous API requests via App Proxies on storefront page load introduces visual lag and delay before the customizer widget renders, hurting merchant conversion rates.

## Decision

We will use a Hybrid Mapped-Sync model to balance storefront rendering performance with template manageability:

1. **Master Template Definition:** Stored in the SQLite database (under the `Template` table) as the source of truth.
2. **De-normalized Storefront Payload:** When a template is linked to products, the product's Shopify metafield (`app.customization_config`) stores a reference mapping: `{"template_id": "abc-123"}` *along with* a complete snapshot of the options JSON payload.
3. **Downstream Synchronization:** When a template is edited, the app spawns a background job that batches updates to all products referencing the template's ID, pushing the updated JSON to Shopify via the `metafieldsSet` mutation.

This guarantees instant, zero-latency widget rendering on the storefront while maintaining centralized administration in the dashboard.
