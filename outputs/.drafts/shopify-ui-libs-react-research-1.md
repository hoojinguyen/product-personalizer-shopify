# Shopify Polaris & App Bridge Integration

This report investigates the current state of Shopify Polaris and its integration with `@shopify/app-bridge-react`, specifically focusing on a modern stack using React Router v7 and Vite.

## 1. Polaris Features and Benefits
Shopify Polaris is the default design system and UI library for building experiences across the Shopify ecosystem, including the Shopify Admin [1, 2, 3]. 

**Key Benefits:**
*   **Consistency**: Polaris provides a shared language for design and development, ensuring that apps feel like a native part of the Shopify Admin [1].
*   **Unified UI Framework**: Polaris is now stable and based on Web Components. This unified toolkit works across Admin, Checkout, and Customer Accounts. Because it is built on Web Components, it is smaller, faster, and framework-agnostic [4, 5].
*   **Comprehensive Toolkit**: It provides design guidance, code libraries, over 400 commerce-focused icons, and development opinions [1, 4].

## 2. App Bridge Integration
App Bridge enables apps to integrate seamlessly into the Shopify Admin surface. 

**Navigation & App Bridge:**
*   **Legacy Polaris Navigation**: The `<Navigation>` component in Polaris React is **no longer supported** [6]. 
*   **Modern Navigation**: Developers must use the App Bridge Navigation Menu API. This is implemented via the App nav component (or `<ui-nav-menu>`) which configures navigation items in the left sidebar on desktop or a title bar dropdown on mobile [7].
*   **Integration**: App Bridge React provides wrappers for custom elements available in App Bridge, such as `Modal`, `TitleBar`, and `NavMenu`. It also provides the `useAppBridge` hook to access the `shopify` global variable [9].

## 3. Tech Stack Compatibility (React Router v7 & Vite)
Integrating Polaris and App Bridge with a modern stack like React Router v7 and Vite comes with some specific considerations and transitional challenges.

*   **Vite Adoption**: Upgrading to React Router v7 often implies moving away from legacy Remix patterns and adopting Vite. Shopify's official react-router template fully supports Vite [11].
*   **Web Components Migration**: The new Polaris Web Components are recommended, but they do not yet have 100% parity with the legacy Polaris React library. Components like `DropZone`, `IndexTable`, `Popover`, and `Tooltip` are still missing [10].
*   **Incremental Migration Strategy**: Because of the limited Web Component coverage, developers cannot completely remove the `@shopify/polaris` package yet. Shopify officially supports running both Polaris React and Polaris Web Components in parallel within the same app to allow for an incremental migration [12, 13].
*   **React 19 Blocker**: There are known issues with upgrading to React 19 because `@shopify/app-bridge-ui-types` currently requires `^18.3.1` and `@shopify/polaris` requires `^18.2.0` [10]. This shouldn't block React Router v7, but it does mean sticking to React 18 for now.
*   **Routing Quirks with NavMenu**: When using the App Bridge `ui-nav-menu` with an anchor tag, it defaults to a standard MPA (Multi-Page App) behavior, causing a full page reload. To preserve SPA navigation in React Router, developers need to handle the click event manually, prevent the default behavior, and use the framework's routing functions [14].

## 4. Design System Alignment & UX Trade-offs
Adhering strictly to Shopify's App Design Guidelines is necessary for getting "Built for Shopify" status.

**Benefits:**
*   **Predictability**: Using standard layouts (Cards, Popovers, Modals) makes the app intuitive for merchants already familiar with Shopify Admin [15, 18, 19].
*   **Trust**: A native look and feel increases merchant trust in the app.

**Trade-offs:**
*   **Brand Identity**: Strict adherence to Polaris limits how much unique brand identity an app can express in its UI.
*   **Custom UX Flows**: Bespoke or highly innovative UI paradigms might clash with the established "Shopify way," requiring developers to bend Polaris components or revert to custom HTML/CSS which risks violating "Built for Shopify" requirements.

## Coverage Status
*   **Done**: Identified core benefits of Polaris and its recent shift to Web Components.
*   **Done**: Clarified that Polaris `<Navigation>` is deprecated in favor of App Bridge navigation components.
*   **Done**: Identified Vite and React Router v7 compatibility factors, specifically the need for a hybrid Web Component/React approach and manual event handling for SPA navigation.
*   **Done**: Outlined UX trade-offs of the design system.

## Sources
1. Polaris 101 — Shopify Polaris React - https://polaris-react.shopify.com/getting-started/polaris-101
2. Polaris references - https://shopify.dev/docs/api/polaris
3. Polaris Goes Stable - The Future of Shopify App Development is Here (2025) - Shopify - https://www.shopify.com/partners/blog/polaris-goes-stable-the-future-of-shopify-app-development-is-here
4. Shopify Polaris React - https://polaris-react.shopify.com/
5. Polaris—unified and for the web (2025) - Shopify - https://www.shopify.com/partners/blog/polaris-unified-and-for-the-web
6. Navigation — Shopify Polaris React - https://polaris-react.shopify.com/components/navigation
7. App nav - Shopify Dev Docs - https://shopify.dev/docs/api/app-home/app-bridge-web-components/app-nav
8. Using both Polaris web components Polaris React · Shopify/shopify-app-template-react-router Wiki · GitHub - https://github.com/Shopify/shopify-app-template-react-router/wiki/Using-both-Polaris-web-components--Polaris-React
9. @shopify/app-bridge-react - https://www.npmjs.com/package/@shopify/app-bridge-react
10. React Router v7 Migration Feedback · Issue #20 · Shopify/shopify-app-template-react-router - https://github.com/Shopify/shopify-app-template-react-router/issues/20
11. Upgrading from Remix - Shopify/shopify-app-template-react-router GitHub Wiki - https://github-wiki-see.page/m/Shopify/shopify-app-template-react-router/wiki/Upgrading-from-Remix
12. Is there an easy way to migrate Polaris UI incrementally? · Issue #23 · Shopify/shopify-app-template-react-router - https://github.com/Shopify/shopify-app-template-react-router/issues/23
13. Using both Polaris web components Polaris React · Shopify/shopify-app-template-react-router Wiki · GitHub - https://github.com/Shopify/shopify-app-template-react-router/wiki/Using-both-Polaris-web-components--Polaris-React
14. Issue with Navigation Menu Reloading Before Redirecting - App Bridge - Shopify Developer Community Forums - https://community.shopify.dev/t/issue-with-navigation-menu-reloading-before-redirecting/7435
15. App Design Guidelines - https://shopify.dev/docs/apps/design/index
16. App Design Guidelines - Shopify Dev Docs - https://shopify.dev/docs/apps/design
17. New Built for Shopify design requirements - https://shopify.dev/changelog/new-built-for-shopify-design-requirements
18. Layout - https://shopify.dev/docs/apps/design/layout
19. Spacial organization — Shopify Polaris React - https://polaris.shopify.com/design/layout/spacial-organization