# Gap Analysis: Zepto Product Personalizer vs Current Local Repo

## 1. Overview
This document analyzes the gap between the current local repository structure and the full feature set of **Zepto Product Personalizer**, a widely-used Shopify app for customizable products. The goal is to identify missing components and outline requirements to bridge this gap.

## 2. Zepto Product Personalizer Features
Based on research [1][2], Zepto Product Personalizer offers the following core features:
- **Unlimited Custom Product Options:** Image & color swatches, dropdown menus, buttons, text/monogram inputs, custom fonts/colors, upload fields.
- **Live Preview:** Real-time visual representation of user selections on the product page.
- **Conditional Logic:** Show or hide options based on previous selections.
- **Dynamic Pricing:** Price add-ons/increases based on selected customizations.
- **Multi-component Customization:** "Build Your Own Product" experience.
- **Cart & Checkout Integration:** Passing customizations clearly through the cart and to the final order.

## 3. Current Local Repo State
An inspection of the local repository reveals the following structure and implemented features:

### General Architecture
- Built on **Remix** (`app/`, `vite.config.ts`, `shopify.server.ts`).
- Uses **Prisma** for database access (`prisma/`).
- Shopify app configuration (`shopify.app.toml`, `shopify.web.toml`).

### App Routes (`app/routes/`)
- Webhook handlers (`webhooks.app.*`, `webhooks.gdpr.*`).
- Basic app views (`app._index.tsx`, `app.settings.tsx`, `app.additional.tsx`).
- Missing: Dedicated UI routes for managing complex product customizations, conditional logic builders, and dynamic pricing rules.

### Extensions (`extensions/`)
- **Theme Extension (`extensions/theme-extension/`)**:
  - Contains a block `personalizer.liquid`. This suggests the foundation for displaying customizer options on the storefront is present.
  - Missing: Robust front-end JS/React components in the theme extension to handle "Live Preview", conditional logic evaluation on the client side, and dynamic price calculations.
- **Checkout Personalization (`extensions/checkout-personalization/`)**:
  - Contains `src/Checkout.ts`. This indicates some level of checkout UI extension, likely to display customized details.
  - Missing: Full handling of dynamic pricing cart transformations (usually done via Shopify Functions or Cart Transform API if modifying line item prices based on properties).

## 4. Gap Analysis & Missing Components

| Feature Category | Zepto Feature | Current Repo State | Gap / Missing Implementation |
| :--- | :--- | :--- | :--- |
| **Option Types** | Text, dropdowns, swatches, image uploads, fonts, colors. | Unknown / Basic. | Needs robust backend schema (Prisma) to store various option types and their specific settings (e.g., swatch images, font files). Needs admin UI to configure these. |
| **Live Preview** | Real-time visual updates. | Basic `personalizer.liquid` block. | Missing client-side engine (JS/Canvas/CSS layering) injected via theme app extension to overlay customizations on base product images. |
| **Conditional Logic** | Show/hide based on rules. | None observed. | Needs backend data model for rules, Admin UI for a rule builder, and front-end logic parser in the theme extension. |
| **Dynamic Pricing** | Price adjustments per option. | None observed. | Needs data model for price add-ons. Critically, needs a mechanism to apply these to the cart (e.g., Draft Orders API, adding a dummy product, or using the new Cart Transform API). |
| **Admin Interface** | Manage products, rules, options. | Basic boilerplate routes. | Needs extensive React UI in `app/routes/` to let merchants build customization templates and assign them to products. |

## 5. Requirements to Bridge the Gap

1.  **Database Expansion (Prisma):**
    *   Create models for `CustomizationTemplate`, `OptionField` (type, label, required), `OptionChoice` (value, price_addon, image_url), and `LogicRule`.
    *   Link templates to Shopify Product IDs.

2.  **Admin UI Development (Remix):**
    *   Build a drag-and-drop or structured form interface to create custom fields.
    *   Implement a "Live Preview" builder in the admin so merchants can test rules.

3.  **Storefront Engine (Theme App Extension):**
    *   Develop a robust vanilla JS or Preact widget to embed in `personalizer.liquid`.
    *   This widget must fetch the customization rules for the current product via App Proxy.
    *   Implement live image manipulation (CSS overlays or Canvas) for the live preview.

4.  **Cart & Pricing Logic:**
    *   Implement a strategy for price add-ons. If using standard Shopify line item properties, the price doesn't change automatically.
    *   *Recommended approach:* Investigate building a **Shopify Function (Cart Transform)** to combine base products with add-on prices, or use the older method of modifying the product price dynamically via a hidden variant/product.

5.  **Asset Handling:**
    *   Mechanism to handle customer image uploads securely (e.g., direct upload to AWS S3 or Shopify Files API) and attach URLs as line item properties.

## Sources
1. Zepto Product Personalizer - App Store Listing — https://apps.shopify.com/product-personalizer
2. Zepto Product Personalizer Official Website — https://productpersonalizer.com/