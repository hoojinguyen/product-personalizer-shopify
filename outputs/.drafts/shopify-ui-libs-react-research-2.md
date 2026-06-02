# Shopify Alternative UI Libraries Research

## Evidence Table

| # | Source | URL | Key claim | Type | Confidence |
|---|--------|-----|-----------|------|------------|
| 1 | Shopify Dev Community | https://community.shopify.com/t/built-for-shopify-is-it-necessary-to-use-the-latest-version-of-polaris-to-be-elegible/281557 | Polaris is recommended but not strictly required for app approval (Built for Shopify badge accepts older versions or non-Polaris UIs if they meet UX standards). | primary | high |
| 2 | Shopify Dev Platform | https://community.shopify.dev/t/is-polaris-web-components-mandatory-for-shopify-apps-can-i-use-tailwindcss-and-other-libraries-in-a-react-router-app/26734 | Developers frequently use Tailwind CSS and other UI libraries in React Router Shopify apps instead of Polaris. | secondary | high |
| 3 | GitHub issue (polaris) | https://github.com/Shopify/polaris-react/issues/12681 | App Bridge components (navigation menus, title bars) are designed for embedded apps but can be tricky to integrate into completely standalone web apps, though it is possible. | primary | high |
| 4 | Shopify App Bridge Docs | https://shopify.dev/docs/api/app-home/app-bridge-web-components | App Bridge web components control the Shopify admin parts surrounding the iframe (navigation, page titles, save bar) and can be used regardless of the iframe's internal UI framework. | primary | high |
| 5 | NPM - @dtewary/tw-polaris | https://registry.npmjs.org/%40dtewary%2Ftw-polaris | A community Tailwind CSS implementation of Shopify Polaris exists to bridge the gap between Tailwind workflow and Polaris aesthetics. | secondary | medium |
| 6 | GitHub - headless-shop | https://github.com/madeelchaudhary/headless-shop | Next.js, Tailwind CSS, and Shadcn-UI are actively used to build Shopify storefronts/apps by the community. | secondary | high |
| 7 | Shadcn Shopify Block | https://www.shadcn.io/blocks/integration-shopify-setup | Shadcn provides a specific UI block for Shopify integration setups, demonstrating Shadcn's viability for Shopify-like interfaces. | primary | high |

## Findings

### 1. Developer Experience: Shadcn UI / Mantine vs. Polaris
Using Shadcn UI or Mantine instead of Polaris offers a more modern, flexible developer experience, particularly for teams already accustomed to Tailwind CSS [6]. Polaris is heavily opinionated and optimized strictly for the Shopify Admin aesthetic. Developers often struggle to override Polaris styles with Tailwind [2]. Shadcn provides raw components that can be customized easily, while Polaris abstracts a lot of the HTML away.

### 2. App Bridge Compatibility
You can absolutely use custom UI libraries alongside Shopify App Bridge [4]. Shopify App Bridge handles the wrapper UI (the "chrome" of the Shopify admin) like the top title bar, navigation menu, toasts, and modals [4]. Since your app renders inside an iframe, whatever UI library you choose (Shadcn, Mantine) will build the internal content of that iframe, while you use App Bridge web components (`<ui-title-bar>`, `<ui-nav-menu>`) to communicate with the host Shopify Admin. Note that Polaris Modals have been deprecated in favor of App Bridge Modals.

### 3. Tech Stack Compatibility (React Router v7 / Vite)
Custom UI libraries like Tailwind CSS, Shadcn, and Mantine have excellent, modern support for Vite and React Router v7. Shopify's default templates now use React Router and Vite as well [2]. The only "gotcha" is ensuring that App Bridge scripts and web components are correctly initialized in the root layout of your React Router app, independent of your chosen UI library [4].

### 4. Trade-offs and Risks
The primary risk of not using Polaris is visual inconsistency for merchants. Shopify users expect apps to look and feel like native parts of the Shopify Admin.
- **App Approval:** While Polaris is highly recommended, a Shopify representative confirmed it is not strictly mandatory for standard app approval or even the "Built for Shopify" badge, provided the app is fast, reliable, and provides a good user experience [1].
- **Visual Consistency:** If you use Tailwind but want the app to look like Polaris, community packages like `@dtewary/tw-polaris` offer Tailwind implementations of Polaris design tokens [5].

## Sources
1. Shopify Dev Community — https://community.shopify.com/t/built-for-shopify-is-it-necessary-to-use-the-latest-version-of-polaris-to-be-elegible/281557
2. Shopify Dev Platform — https://community.shopify.dev/t/is-polaris-web-components-mandatory-for-shopify-apps-can-i-use-tailwindcss-and-other-libraries-in-a-react-router-app/26734
3. GitHub issue (polaris) — https://github.com/Shopify/polaris-react/issues/12681
4. Shopify App Bridge Docs — https://shopify.dev/docs/api/app-home/app-bridge-web-components
5. NPM - @dtewary/tw-polaris — https://registry.npmjs.org/%40dtewary%2Ftw-polaris
6. GitHub - headless-shop — https://github.com/madeelchaudhary/headless-shop
7. Shadcn Shopify Block — https://www.shadcn.io/blocks/integration-shopify-setup

## Coverage Status
- **Checked:** App Bridge integration with custom UIs, requirements for app approval without Polaris, community usage of Tailwind/Shadcn with Shopify.
- **Uncertain/Missing:** Direct performance comparison metrics between Mantine and Polaris within the Shopify iframe. 
- **Completed:** Addressed all main prompts (Dev experience, App Bridge compatibility, Tech stack, Trade-offs).