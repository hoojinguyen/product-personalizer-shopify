# Best UI Libraries for Shopify React Router v7 Apps

When building a Shopify Admin app with a modern React stack (React Router v7, Vite), choosing the right UI library comes down to a fundamental trade-off: **native merchant experience vs. modern developer experience**.

Based on an analysis of Shopify's current architecture (App Bridge Web Components) and community practices, here is an evaluation of the best UI library paths.

## Executive Summary
For the vast majority of Shopify Admin apps, **Shopify Polaris** remains the best and safest choice, especially given its recent migration toward Web Components. However, if your team is deeply entrenched in Tailwind CSS, using **Shadcn UI** paired with App Bridge is a highly viable alternative that does not block you from App Store approval.

## Option 1: The Native Path (Shopify Polaris)
Shopify Polaris is the official design system for the Shopify ecosystem.

**Why it’s the best default:**
- **Native Look & Feel:** Merchants trust interfaces that look exactly like the Shopify admin. It reduces the learning curve.
- **Built for Shopify Badge:** Adhering strictly to App Design Guidelines makes getting the coveted "Built for Shopify" badge significantly easier.
- **Unified Ecosystem:** Polaris has recently gone "stable" as a suite of Web Components (replacing the legacy React components), making it lighter and framework-agnostic. 

**Integration with React Router v7 & Vite:**
Shopify officially supports React Router v7 and Vite. However, the migration to Web Components is currently incomplete. Some components (like `IndexTable` or `DropZone`) are still only available in the legacy `@shopify/polaris` React package. Therefore, in a React Router v7 app, you will likely need to run both Polaris Web Components and Polaris React in parallel.

## Option 2: The Modern Developer Path (Shadcn UI + Tailwind)
Shadcn UI (and by extension, Tailwind CSS) is the most popular community alternative for developers who find Polaris too restrictive.

**Why you might choose it:**
- **Developer Velocity:** Teams already experienced with Tailwind can build much faster than learning Polaris's abstractions.
- **Customizability:** Polaris is notoriously difficult to override if your app requires bespoke UI patterns not found in Shopify's design system.
- **Future-Proofing:** Shadcn integrates perfectly with Vite and React Router v7 without the hybrid Web-Component/React baggage currently found in Polaris.

**App Bridge Compatibility:**
Choosing Shadcn UI **does not** mean you lose Shopify integration. Your app lives inside an iframe in the Shopify Admin. You can build the entire contents of that iframe using Shadcn/Tailwind, while simultaneously using Shopify App Bridge Web Components (`<ui-title-bar>`, `<ui-nav-menu>`, `<ui-modal>`) to control the native Shopify shell surrounding your app.

## Option 3: The Middle Ground (Community "Polaris-Tailwind" Ports)
If you want the speed of Tailwind but the look of Polaris, the community has created ports (such as `@dtewary/tw-polaris`) that map Polaris design tokens to Tailwind utility classes. This provides a middle ground, though it comes with the risk of falling out of sync with official Shopify design updates.

## Critical Integration Considerations

Regardless of which UI library you choose, you must adhere to **App Bridge** for core Shopify interactions:
1. **Navigation:** Do not use Polaris `<Navigation>` (it is deprecated). You must use the App Bridge `<ui-nav-menu>`.
2. **React Router v7 Routing Quirks:** When using App Bridge navigation with an SPA router like React Router v7, clicking a navigation item defaults to a full page reload. You must manually intercept the click event, prevent the default action, and use the React Router `useNavigate` hook to preserve SPA state.
3. **Modals and Title Bars:** Always use App Bridge components for Modals, Toasts, and Title Bars, even if the rest of your app uses Mantine or Shadcn. This ensures these elements break out of the iframe and render natively over the Shopify Admin.

## Open Questions
- As Polaris continues its transition entirely to Web Components, it is unclear how long the legacy React components will be supported, which may impact maintenance for apps taking the hybrid approach.