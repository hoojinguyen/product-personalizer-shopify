# Shopify Product Personalizer Implementation Strategy

## Evidence Table

| # | Source | URL | Key claim | Type | Confidence |
|---|--------|-----|-----------|------|------------|
| 1 | Shopify Dev: Theme app extensions | https://shopify.dev/docs/apps/build/online-store/theme-app-extensions/build | Theme app extensions are the standard way to inject UI (live previews) on product pages without editing liquid code. | primary | high |
| 2 | Shopify Dev: Update cart attributes | https://shopify.dev/docs/storefronts/headless/hydrogen/cart/attributes | Cart attributes allow storing custom data (like file upload references) as key/value string pairs on the cart. | primary | high |
| 3 | Shopify Dev: Attributes API | https://shopify.dev/docs/api/checkout-ui-extensions/latest/target-apis/checkout-apis/attributes-api | Cart attributes persist through checkout and can be accessed by checkout UI extensions and merchant workflows. | primary | high |
| 4 | Shopify Community: File uploads on cart | https://community.shopify.dev/t/handle-file-uploaded-on-cart/22678 | Uploaded files can be attached to orders by storing external file URLs as cart attributes. | secondary | high |
| 5 | Shopify Dev: DraftOrderCreate GraphQL | https://shopify.dev/docs/api/admin-graphql/latest/mutations/draftOrderCreate | The DraftOrder API allows adding "custom items" to represent upcharges or additional costs dynamically. | primary | high |
| 6 | Zepto Product Personalizer Docs | https://productpersonalizer.com/docs/conditional-logic-rule/ | Conditional logic for personalization is commonly implemented via a rules engine linking options (e.g. "If This, Then That"). | secondary | high |

## Findings

### Live Preview Rendering
To implement live previews on the product page safely and in compliance with modern Shopify standards, the app should use **Theme App Extensions** [1]. App blocks allow injecting customized UI directly onto the product page without modifying the merchant's liquid templates. The React/JS-based customizer frontend will be hosted within this block and rendered client-side, hooking into the product's variant data.

### Custom File Uploads
Custom file uploads (e.g., user-provided images for printing) should be handled by an external storage service (like AWS S3 or a custom app backend). Once the file is uploaded, the resulting public URL must be saved as a **Cart Attribute** (line item property) on the specific product being added to the cart [2, 3, 4]. These attributes are stored as key-value strings and persist through to the final order, allowing the merchant to access the customized files.

### Upcharges and Price Adjustments
Shopify's base variant pricing is static. To add dynamic upcharges based on customizations (e.g., +$5 for premium material), developers generally use one of two methods:
1. **Hidden Variants/Products**: Creating background products for upcharges and adding them to the cart alongside the main item.
2. **Draft Orders API**: For highly custom pricing, the app can intercept the checkout process and use the GraphQL `draftOrderCreate` mutation [5]. This mutation supports adding "custom items" to represent the exact additional costs of the user's personalization choices.

### Conditional Logic
Conditional logic (showing/hiding options based on previous selections) must be implemented primarily in the app's configuration dashboard and evaluated on the frontend [6]. The backend will store a JSON structure representing rules (e.g., "if Option A == 'Red', show FileUpload B"). The theme app block will read this JSON configuration and dynamically re-render the customization form as the user interacts with it.

## Coverage Status
- **Live Preview:** Checked (Theme app extensions are the standard).
- **File Uploads:** Checked (Upload externally, save URL as Cart Attribute).
- **Conditional Logic:** Checked (JSON rule schema evaluated on the client).
- **Draft Order/Upcharges:** Checked (Draft orders support custom items for upcharges).

## Sources
1. Shopify Dev: Theme app extensions — https://shopify.dev/docs/apps/build/online-store/theme-app-extensions/build
2. Shopify Dev: Update cart attributes — https://shopify.dev/docs/storefronts/headless/hydrogen/cart/attributes
3. Shopify Dev: Attributes API — https://shopify.dev/docs/api/checkout-ui-extensions/latest/target-apis/checkout-apis/attributes-api
4. Shopify Community: File uploads on cart — https://community.shopify.dev/t/handle-file-uploaded-on-cart/22678
5. Shopify Dev: DraftOrderCreate GraphQL — https://shopify.dev/docs/api/admin-graphql/latest/mutations/draftOrderCreate
6. Zepto Product Personalizer Docs — https://productpersonalizer.com/docs/conditional-logic-rule/