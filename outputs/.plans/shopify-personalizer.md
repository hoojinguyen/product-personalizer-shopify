# Deep Research Plan: Shopify Product Personalizer

## Key Questions
1. How does the "Zepto Product Personalizer" app integrate with Shopify (frontend and backend)?
2. What are the key features and capabilities of this app based on the provided documentation?
3. How to build a custom application on Shopify that replicates these features?
4. What is missing from the currently built basic app compared to Zepto?
5. What are the best practices for handling product personalization data, rendering previews, and managing orders in Shopify?

## Evidence Needed
- Details from the provided local note: `file:///Users/hoojinguyen/.gemini/antigravity/brain/f97260c1-0ff1-451b-aeb7-5d92bece970b/product_personalizer_documentation.md`
- Analysis of the current basic app repository (need to know where it is located/how to access it, assuming it's in the current workspace or needs to be found).
- Documentation on Shopify App development (App Bridge, Admin API, Storefront API, Theme App Extensions).
- Competitive analysis of Zepto Product Personalizer (features like live preview, dynamic pricing, conditional logic, image uploads).

## Scale Decision
- **Scale:** Subagents (Broad survey and implementation planning).
- **Reasoning:** This is a complex software architecture and feature gap analysis task. It requires understanding Shopify's app ecosystem, analyzing an existing competitor (Zepto), reviewing existing documentation, and formulating an implementation plan.

## Task Ledger
- [ ] Read the local documentation file provided by the user.
- [ ] Investigate the basic app repository mentioned (need to locate it).
- [ ] Research Shopify App architecture for product personalization (Theme App Extensions, Cart attributes, Draft Orders/Metafields).
- [ ] Research Zepto Product Personalizer specific features (web search).
- [ ] Synthesize findings into a feature gap analysis and architecture plan.
- [ ] Draft the report.
- [ ] Cite sources and verify technical feasibility.
- [ ] Review the draft.
- [ ] Finalize deliverables.

## Verification Log
- [ ] Confirm local document read successfully.
- [ ] Confirm basic app repository found and analyzed.
- [ ] Verify Shopify API limitations regarding personalization (e.g., maximum line item properties).

## Decision Log
- Decided to use subagents due to the multi-faceted nature of the request (competitor analysis, architecture design, gap analysis).