# Provenance: Shopify UI Libraries with React Router v7

- **Date:** 2026-06-02
- **Rounds:** 1
- **Sources consulted:** 2 subagents used (Polaris official vs Custom UI libs)
- **Sources accepted:** Official Shopify Dev documentation, App Bridge Docs, Community consensus on Shadcn/Tailwind.
- **Sources rejected:** Initial hallucinated links regarding Polaris fully becoming Web Components were rejected and stripped from the final artifact by the Reviewer agent.
- **Verification:** PASS WITH NOTES
- **Plan:** outputs/.plans/shopify-ui-libs-react.md
- **Research files:** 
  - outputs/.drafts/shopify-ui-libs-react-research-1.md
  - outputs/.drafts/shopify-ui-libs-react-research-2.md
  - outputs/.drafts/shopify-ui-libs-react-verification.md

**Verification Notes**: The initial subagent draft hallucinated a narrative that Polaris UI was being entirely replaced by Web Components. The reviewer agent correctly caught this FATAL error (conflating App Bridge Web Components with Polaris React). The final revised artifact (`outputs/.drafts/shopify-ui-libs-react-revised.md`) corrected this by explicitly distinguishing between App Bridge (for the shell) and Polaris (for the internal iframe UI), and removed the hallucinated citations.