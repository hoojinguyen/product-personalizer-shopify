# Deep Research Draft: Replicating Zepto Product Personalizer on Shopify

## Executive Summary
This report outlines the architectural roadmap and feature gap analysis required to build a Shopify application that replicates the functionality of the "Zepto Product Personalizer." Based on an analysis of the provided documentation, Shopify's modern App Architecture (2025), and the current local repository, we have identified the necessary steps to transition from a basic Remix app to a robust product customization engine featuring live previews, dynamic pricing, and conditional logic.

## 1. Overview of Zepto's Capabilities
Based on the documentation and App Store listing [1, 2], Zepto operates as a comprehensive customization suite offering:
- **Unlimited Input Types:** Ranging from text and swatches to dropdowns and image uploads [1].
- **Live Preview Canvas:** A real-time rendering engine that updates dynamically as the user interacts with the form [1, 2].
- **Conditional Logic:** A rules engine to show/hide options based on previous selections [1, 3].
- **Dynamic Pricing (Upcharges):** The ability to append costs to specific personalization options [1, 2].
- **Multi-component Customization:** "Build Your Own Product" experiences [1].
- **Cart & Checkout Integration:** Passing customizations clearly through the cart and to the final order [1].

## 2. Shopify Architecture Standard for Personalizers
To build a scalable and compliant app on Shopify today, the architecture must leverage specific Shopify extension points rather than legacy methods (like injecting liquid code directly).

### Storefront Integration
- **Theme App Extensions:** The customizer UI must be built as an App Block [4]. This ensures it is compatible with Online Store 2.0 and does not pollute merchant theme code [4, 5].
- **Frontend Framework:** The live preview and form interaction require a robust client-side application loaded within the App Block to handle state, conditional logic parsing, and canvas rendering without page reloads [5].

### Data Storage & Admin
- **Shopify Admin API (GraphQL):** Used for fetching product data, managing metafields, and querying orders [5].
- **Admin UI Extensions & Polaris:** The merchant-facing dashboard (for configuring templates, rules, and assets) must be built using Shopify's Polaris design system to ensure a native feel [5].
- **Metaobjects:** Custom configuration data (pricing rules, logic conditions) should ideally be structured using Metaobjects linked to specific products, allowing fast retrieval via the Storefront API [5].

### Cart and Order Flow
- **Line Item Properties:** Selected customizations must be serialized and passed into the checkout as line-item properties [5]. This attaches the data to the final order.
- **File Uploads:** Custom images uploaded by buyers should be stored on an external service, with the public URL saved as a cart attribute or line-item property [6, 7].

## 3. Handling Complex Features (The Gap)
The current local repository is a basic Remix boilerplate with Prisma and empty extensions (`theme-extension`, `checkout-personalization`). The critical gaps lie in implementing Zepto's complex features within Shopify's constraints.

### Dynamic Pricing & Upcharges
Shopify variants have static pricing. To add dynamic costs, the standard approaches are:
1.  **Draft Orders API:** Intercepting the standard checkout flow to create a Draft Order that includes the base product plus "custom items" representing the upcharges [8].
2.  **Hidden Products/Variants:** Automatically adding hidden "add-on" products to the cart simultaneously with the main product.
3.  **Shopify Functions (Cart Transform):** The modern, preferred approach for complex cart manipulations, allowing backend logic to dynamically alter line-item pricing based on properties [5]. *The current repo lacks this function entirely.*

### Live Preview Canvas
The current `personalizer.liquid` file is empty logic. It requires a client-side rendering engine [5]. For simple customizations, CSS overlays work well. For complex ones involving user-uploaded images, text curving, and masking, a HTML5 Canvas or WebGL implementation is required to render the preview before passing the flat image or configuration state to the cart [5].

### Backend Order Processing
The local app currently only has standard webhook subscriptions (`customers/data_request`, etc.). To replicate Zepto, the app must:
- Subscribe to the `orders/create` webhook [5].
- Read the line-item properties to extract customization data [5].
- Utilize a backend rendering job to generate high-resolution PDFs or PNGs based on the stored coordinates and assets, then append these links to the Shopify order via the Admin API [5].

## 4. Implementation Roadmap for the Local Repo

To bridge the gap from the current state to a Zepto competitor, the following steps must be taken:

1.  **Database Expansion:** Update Prisma schema to handle `Templates`, `OptionTypes`, `ConditionalRules`, and `AssetLibraries` (Fonts/Colors).
2.  **Admin Builder UI:** Develop the Remix admin routes using Polaris to create a visual drag-and-drop builder for customizer templates.
3.  **Client-Side Engine:** Build the JavaScript application that will live inside the `theme-extension/blocks/personalizer.liquid`. This engine must handle:
    *   Fetching product configuration via an App Proxy.
    *   Evaluating conditional logic in real-time.
    *   Rendering the Live Preview (HTML5 Canvas).
    *   Handling file uploads directly to a cloud bucket.
4.  **Cart Strategy:** Implement Shopify Functions (Cart Transform) or an Ajax Cart intercept script to manage pricing upcharges.
5.  **Render Worker:** Build a separate worker service to consume webhooks and generate high-res manufacturing files.

## Open Questions
- What rendering technology will be used for the frontend live preview (CSS layers vs Canvas)? Canvas is much harder to build but required for Zepto-level text manipulation.
- Which dynamic pricing strategy will be employed? Shopify Functions are cleaner but require a higher tier Shopify plan/understanding of Rust/WebAssembly/JS compilation.

## Sources
[1] Zepto Product Personalizer Official Website — https://productpersonalizer.com/
[2] Zepto Product Personalizer App Store Listing — https://apps.shopify.com/product-personalizer
[3] Zepto Product Personalizer Docs — https://productpersonalizer.com/docs/conditional-logic-rule/
[4] Shopify Dev: Theme app extensions — https://shopify.dev/docs/apps/build/online-store/theme-app-extensions/build
[5] Architectural Analysis: Custom Product Personalizer vs Shopify App Architecture
[6] Shopify Dev: Update cart attributes — https://shopify.dev/docs/storefronts/headless/hydrogen/cart/attributes
[7] Shopify Community: File uploads on cart — https://community.shopify.dev/t/handle-file-uploaded-on-cart/22678
[8] Shopify Dev: DraftOrderCreate GraphQL — https://shopify.dev/docs/api/admin-graphql/latest/mutations/draftOrderCreate