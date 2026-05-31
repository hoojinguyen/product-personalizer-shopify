# Upcharge Cart Coupling Validation

## Context

To charge fees for premium personalization options (e.g. `+$5.00` for engraving), the app adds a hidden **Upcharge Item** priced at $1.00 in a matching quantity (e.g. quantity of 5). 
However, standard Shopify checkouts allow customers to increase, decrease, or delete line items in the cart or checkout. Without active guardrails, shoppers could increase the parent product's quantity without updating the upcharge, or remove the parent product entirely while leaving the $1.00 upcharge in the cart, leading to orphaned items or unpaid customization fees.

## Decision

To ensure broad compatibility across all Shopify merchant plans (Basic to Advanced) while maintaining absolute cart integrity, we will implement a dual-layer **Cart Sync** guardrail system:

1. **AJAX Theme Sync Listeners (Storefront):** We inject event listeners into the storefront theme that intercept Shopify's `/cart/change.js` and `/cart/update.js` calls. If a parent product variant is modified in quantity or removed, our script instantly calculates the new required upcharge quantity and submits a synced AJAX update to keep them perfectly paired.
2. **Checkout UI Extension Validation (Checkout):** Inside our checkout UI extension (`extensions/checkout-personalization`), we implement a real-time validation check. The extension subscribes to checkout lines, verifies that the ratio of personalized products to their corresponding Upcharge Items is exactly correct, and automatically adds, adjusts, or deletes Upcharge Items directly within the checkout context if a drift is detected.

This guarantees robust, leakproof monetization of personalization fees across all Shopify plans without requiring enterprise-level Shopify Plus Cart Transform APIs.
