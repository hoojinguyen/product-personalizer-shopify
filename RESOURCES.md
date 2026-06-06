# Product Personalizer Resources

## Knowledge

- [Docs: Zepto Product Personalizer Feature Guide](file:///Users/hoojinguyen/Hooji/tools/product-personalizer-shopify/docs/product-personalizer_zepto_spike.md)
  Comprehensive feature documentation covering all 8 major areas: dashboard, customizer editor, templates, assets, orders, pricing, settings, and developer options. Use for: understanding what the app does from a merchant's perspective.

- [Code: CONTEXT.md — Domain Language](file:///Users/hoojinguyen/Hooji/tools/product-personalizer-shopify/CONTEXT.md)
  Canonical domain terminology. Use for: ensuring consistent language when discussing app concepts.

- [Code: Prisma Schema](file:///Users/hoojinguyen/Hooji/tools/product-personalizer-shopify/prisma/schema.prisma)
  Database models and relationships. Use for: understanding data persistence layer.

- [Code: App Routes](file:///Users/hoojinguyen/Hooji/tools/product-personalizer-shopify/app/routes/)
  Remix route files implementing all admin dashboard pages and API endpoints. Use for: tracing specific feature implementations.

- [Code: Storefront Widget](file:///Users/hoojinguyen/Hooji/tools/product-personalizer-shopify/app/storefront-widget/)
  The buyer-facing customizer that renders on product pages. Use for: understanding the storefront experience.

- [Code: Extensions](file:///Users/hoojinguyen/Hooji/tools/product-personalizer-shopify/extensions/)
  Shopify extensions (Theme App Extension, Cart Transform Function). Use for: understanding Shopify platform integrations.

- [Shopify Docs: Metafields](https://shopify.dev/docs/apps/custom-data/metafields)
  Official Shopify documentation on metafields. Use for: understanding how custom data is stored on Shopify resources.

- [Shopify Docs: Cart Transform API](https://shopify.dev/docs/api/functions/reference/cart-transform)
  Official reference for Cart Transform Shopify Functions. Use for: understanding how upcharge pricing is injected.

- [Shopify Docs: App Proxies](https://shopify.dev/docs/apps/online-store/app-proxies)
  How app proxies forward storefront requests to the app backend. Use for: understanding upload/download flows.

## Gaps

- No resource yet for how the storefront widget JavaScript is bundled and injected via the theme app extension
- No resource yet for the Shopify Admin GraphQL mutations used for metafield writes

## Wisdom (Communities)

- [Shopify Community Forums](https://community.shopify.com/c/shopify-community/ct-p/en)
  Official Shopify community. Use for: platform-specific questions about metafields, extensions, and billing.

- [r/shopifyDev](https://reddit.com/r/shopifyDev)
  Developer-focused subreddit. Use for: real-world patterns and gotchas from other Shopify app developers.
