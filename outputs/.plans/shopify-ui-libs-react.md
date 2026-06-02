# Deep Research Plan: shopify-ui-libs-react

## Key questions
- Which UI libraries are recommended for Shopify App development using React and React Router v7?
- How does Shopify Polaris compare to other modern React UI libraries (e.g., Tailwind UI, Radix UI, Shadcn UI, Mantine, Chakra UI) in the context of Shopify Admin apps?
- Are there specific integration considerations for App Bridge React (`@shopify/app-bridge-react`)?
- What are the trade-offs between adhering strictly to Shopify's design language vs. using a custom/brand-specific design system?
- What are the best options that can easily plug into a Vite + React Router v7 stack?

## Evidence needed
- Shopify official documentation on App Design Guidelines and Polaris.
- Community discussions/comparisons (Reddit, GitHub, dev.to) on Polaris vs. alternatives for Shopify apps.
- Examples/tutorials of using Tailwind/Shadcn with Shopify App Bridge.
- Compatibility checks for React 18+ and React Router v7 with Polaris and alternatives.

## Scale decision
This requires comparing a few well-known options (Polaris vs Shadcn/Tailwind vs Mantine/Chakra) specifically in the context of a Shopify App (App Bridge).
This is a direct comparison of 3-4 options in a specific context.
**Decision**: Use subagents to gather broad perspectives (Polaris official vs Custom UI libs). 2 `researcher` subagents.

## Task ledger
- [ ] Create subagent briefs
- [ ] Run Researcher 1: Investigate Shopify Polaris, App Bridge integration, and official design guidelines.
- [ ] Run Researcher 2: Investigate alternatives (Shadcn, Tailwind, Mantine) for Shopify apps, focusing on Vite/React Router v7 compatibility and developer experience.
- [ ] Synthesize findings into `outputs/.drafts/shopify-ui-libs-react-draft.md`
- [ ] Run Verifier to cite sources.
- [ ] Run Reviewer to verify claims.
- [ ] Finalize delivery to `outputs/shopify-ui-libs-react.md` and provenance.

## Verification log
- [ ] Plan approved
- [ ] Subagent 1 completed
- [ ] Subagent 2 completed
- [ ] Draft created
- [ ] Verifier pass
- [ ] Reviewer pass
- [ ] Final artifact written

## Decision log
- 2026-06-02: Opted for 2 researchers since this involves comparing the "default" (Polaris) against "community favorites" (Shadcn/Mantine) within a React Router v7 / Vite stack context.