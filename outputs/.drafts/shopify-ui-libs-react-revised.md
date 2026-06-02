# Best UI Libraries for Shopify React Router v7 Apps

When building a Shopify Admin app with a modern React stack (React Router v7, Vite), choosing the right UI library comes down to a fundamental trade-off: **native merchant experience vs. modern developer experience**.

Based on an analysis of Shopify's current architecture (App Bridge Web Components vs Polaris React) and community practices, here is an evaluation of the best UI library paths.

## Executive Summary
For the vast majority of Shopify Admin apps, **Shopify Polaris** (the React library) remains the best and safest choice for internal app UI. However, if your team is deeply entrenched in Tailwind CSS, using **Shadcn UI** paired with App Bridge Web Components for the surrounding shell is a highly viable alternative that does not block you from App Store approval.

## Option 1: The Native Path (Shopify Polaris React)
Shopify Polaris is the official design system and UI library for the Shopify ecosystem.

**Why it’s the best default:**
- **Native Look & Feel:** Merchants trust interfaces that look exactly like the Shopify admin. It reduces the learning curve.
- **Built for Shopify Badge:** Adhering strictly to App Design Guidelines makes getting the coveted "Built for Shopify" badge significantly easier.
- **Comprehensive UI Toolkit:** It provides a vast set of highly specific commerce components (e.g., `IndexTable`, `ResourceList`, `DropZone`) that are difficult to rebuild from scratch.

**Integration with React Router v7 & Vite:**
Shopify officially supports React Router v7 and Vite via their official app templates. The key distinction to understand is that **Polaris is the React library for your app's internal UI**, while **App Bridge uses Web Components for the outer admin shell**. 

## Option 2: The Modern Developer Path (Shadcn UI + Tailwind)
Shadcn UI (and by extension, Tailwind CSS) is the most popular community alternative for developers who find Polaris too restrictive.

**Why you might choose it:**
- **Developer Velocity:** Teams already experienced with Tailwind can build much faster than learning Polaris's specific abstractions.
- **Customizability:** Polaris is notoriously difficult to override if your app requires bespoke UI patterns not found in Shopify's design system.
- **Modern Ecosystem:** Shadcn integrates perfectly with Vite and React Router v7.

**App Bridge Compatibility:**
Choosing Shadcn UI **does not** mean you lose Shopify integration. Your app lives inside an iframe in the Shopify Admin. You can build the entire contents of that iframe using Shadcn/Tailwind, while simultaneously using **Shopify App Bridge Web Components** (`<ui-title-bar>`, `<ui-nav-menu>`, `<ui-modal>`) to control the native Shopify shell surrounding your app.

## Critical Integration Considerations

Regardless of which UI library you choose for the app's *contents*, you must adhere to **App Bridge** for core Shopify shell interactions:
1. **Navigation:** Do not use the legacy Polaris React `<Navigation>` component (it is deprecated). You must use the App Bridge `<ui-nav-menu>` Web Component.
2. **React Router v7 Routing Quirks:** When using App Bridge navigation with an SPA router like React Router v7, clicking a navigation item defaults to a full page reload. You must manually intercept the click event, prevent the default action, and use the React Router `useNavigate` hook to preserve SPA state.
3. **Modals and Title Bars:** Always use App Bridge components for Modals, Toasts, and Title Bars, even if the rest of your app uses Mantine or Shadcn. This ensures these elements break out of the iframe and render natively over the Shopify Admin rather than being trapped inside your app's iframe window.