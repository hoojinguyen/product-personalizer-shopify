# Best UI Libraries for Shopify React Router v7 Apps

When building a Shopify Admin app with a modern React stack (React Router v7, Vite), choosing the right UI library comes down to a fundamental trade-off: **native merchant experience vs. modern developer experience**.

Based on an analysis of Shopify's current architecture (App Bridge Web Components) and community practices, here is an evaluation of the best UI library paths.

## Executive Summary
For the vast majority of Shopify Admin apps, **Shopify Polaris** remains the best and safest choice, especially given its recent migration toward Web Components [1, 2]. However, if your team is deeply entrenched in Tailwind CSS, using **Shadcn UI** paired with App Bridge is a highly viable alternative that does not block you from App Store approval [3, 4, 5, 6].

## Option 1: The Native Path (Shopify Polaris)
Shopify Polaris is the official design system for the Shopify ecosystem [7, 8].

**Why it’s the best default:**
- **Native Look & Feel:** Merchants trust interfaces that look exactly like the Shopify admin. It reduces the learning curve [7, 9, 10, 11].
- **Built for Shopify Badge:** Adhering strictly to App Design Guidelines makes getting the coveted "Built for Shopify" badge significantly easier [12].
- **Unified Ecosystem:** Polaris has recently gone "stable" as a suite of Web Components (replacing the legacy React components), making it lighter and framework-agnostic [1, 2]. 

**Integration with React Router v7 & Vite:**
Shopify officially supports React Router v7 and Vite [13]. However, the migration to Web Components is currently incomplete. Some components (like `IndexTable` or `DropZone`) are still only available in the legacy `@shopify/polaris` React package [14]. Therefore, in a React Router v7 app, you will likely need to run both Polaris Web Components and Polaris React in parallel [15, 16].

## Option 2: The Modern Developer Path (Shadcn UI + Tailwind)
Shadcn UI (and by extension, Tailwind CSS) is the most popular community alternative for developers who find Polaris too restrictive [5, 6].

**Why you might choose it:**
- **Developer Velocity:** Teams already experienced with Tailwind can build much faster than learning Polaris's abstractions [5].
- **Customizability:** Polaris is notoriously difficult to override if your app requires bespoke UI patterns not found in Shopify's design system [4].
- **Future-Proofing:** Shadcn integrates perfectly with Vite and React Router v7 without the hybrid Web-Component/React baggage currently found in Polaris [5, 13].

**App Bridge Compatibility:**
Choosing Shadcn UI **does not** mean you lose Shopify integration. Your app lives inside an iframe in the Shopify Admin. You can build the entire contents of that iframe using Shadcn/Tailwind, while simultaneously using Shopify App Bridge Web Components (`<ui-title-bar>`, `<ui-nav-menu>`, `<ui-modal>`) to control the native Shopify shell surrounding your app [17, 18, 19].

## Option 3: The Middle Ground (Community "Polaris-Tailwind" Ports)
If you want the speed of Tailwind but the look of Polaris, the community has created ports (such as `@dtewary/tw-polaris`) that map Polaris design tokens to Tailwind utility classes [20]. This provides a middle ground, though it comes with the risk of falling out of sync with official Shopify design updates.

## Critical Integration Considerations

Regardless of which UI library you choose, you must adhere to **App Bridge** for core Shopify interactions:
1. **Navigation:** Do not use Polaris `<Navigation>` (it is deprecated) [21]. You must use the App Bridge `<ui-nav-menu>` [18].
2. **React Router v7 Routing Quirks:** When using App Bridge navigation with an SPA router like React Router v7, clicking a navigation item defaults to a full page reload. You must manually intercept the click event, prevent the default action, and use the React Router `useNavigate` hook to preserve SPA state [22].
3. **Modals and Title Bars:** Always use App Bridge components for Modals, Toasts, and Title Bars, even if the rest of your app uses Mantine or Shadcn. This ensures these elements break out of the iframe and render natively over the Shopify Admin [17, 19].

## Open Questions
- As Polaris continues its transition entirely to Web Components, it is unclear how long the legacy React components will be supported, which may impact maintenance for apps taking the hybrid approach.

## Sources
1. [Polaris Goes Stable - The Future of Shopify App Development is Here (2025)](https://www.shopify.com/partners/blog/polaris-goes-stable-the-future-of-shopify-app-development-is-here)
2. [Polaris—unified and for the web (2025)](https://www.shopify.com/partners/blog/polaris-unified-and-for-the-web)
3. [Built for Shopify - is it necessary to use the latest version of Polaris?](https://community.shopify.com/t/built-for-shopify-is-it-necessary-to-use-the-latest-version-of-polaris-to-be-elegible/281557)
4. [Is Polaris Web Components mandatory for Shopify apps? Can I use TailwindCSS?](https://community.shopify.dev/t/is-polaris-web-components-mandatory-for-shopify-apps-can-i-use-tailwindcss-and-other-libraries-in-a-react-router-app/26734)
5. [Headless Shop (Next.js, Tailwind CSS, Shadcn-UI)](https://github.com/madeelchaudhary/headless-shop)
6. [Shadcn UI Block: Integration Shopify Setup](https://www.shadcn.io/blocks/integration-shopify-setup)
7. [Polaris 101 — Shopify Polaris React](https://polaris-react.shopify.com/getting-started/polaris-101)
8. [Polaris References](https://shopify.dev/docs/api/polaris)
9. [App Design Guidelines](https://shopify.dev/docs/apps/design/index)
10. [App Design Guidelines Layout](https://shopify.dev/docs/apps/design/layout)
11. [Spacial Organization - Shopify Polaris React](https://polaris.shopify.com/design/layout/spacial-organization)
12. [New Built for Shopify design requirements](https://shopify.dev/changelog/new-built-for-shopify-design-requirements)
13. [Upgrading from Remix - Shopify App Template React Router](https://github-wiki-see.page/m/Shopify/shopify-app-template-react-router/wiki/Upgrading-from-Remix)
14. [React Router v7 Migration Feedback](https://github.com/Shopify/shopify-app-template-react-router/issues/20)
15. [Using both Polaris web components & Polaris React](https://github.com/Shopify/shopify-app-template-react-router/wiki/Using-both-Polaris-web-components--Polaris-React)
16. [Is there an easy way to migrate Polaris UI incrementally?](https://github.com/Shopify/shopify-app-template-react-router/issues/23)
17. [App Bridge Web Components](https://shopify.dev/docs/api/app-home/app-bridge-web-components)
18. [App nav (App Bridge Web Components)](https://shopify.dev/docs/api/app-home/app-bridge-web-components/app-nav)
19. [How to use App Bridge in standalone webapps](https://github.com/Shopify/polaris-react/issues/12681)
20. [NPM: @dtewary/tw-polaris](https://registry.npmjs.org/%40dtewary%2Ftw-polaris)
21. [Navigation — Shopify Polaris React](https://polaris-react.shopify.com/components/navigation)
22. [Issue with Navigation Menu Reloading Before Redirecting](https://community.shopify.dev/t/issue-with-navigation-menu-reloading-before-redirecting/7435)
