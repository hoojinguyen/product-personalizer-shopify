# Deep Research Plan: Building a Shopify Product Personalizer App

**Slug:** product-personalizer-shopify-app  
**Date Created:** 2026-05-27  
**Status:** Planning Phase

---

## Key Questions

1. **What is the Product Personalizer app?** What features, functionality, and use cases does it support?
2. **What are the core capabilities?** How does personalization work? What data does it collect/use?
3. **What's the Shopify app architecture?** How do apps integrate with Shopify stores?
4. **What tech stack is used?** What frameworks, languages, APIs, and tools are typical?
5. **How do you build Shopify apps?** Step-by-step development, deployment, and store installation process.
6. **What are the key APIs needed?** Which Shopify GraphQL/REST APIs are essential for product customization?
7. **What are the limitations and gaps?** What doesn't the existing app do? What's the competitive landscape?
8. **What are best practices?** Performance, UX, security, testing, and app store compliance.

---

## Evidence Needed

### Primary Sources
- Product Personalizer app store listing and documentation
- Shopify developer documentation (Admin API, Storefront API, Functions, Extensions)
- Shopify app architecture patterns and tutorials
- GitHub repositories of similar/open-source Shopify apps
- Official Shopify CLI and scaffold tooling documentation

### Secondary Sources
- Community discussions, tutorials, and reviews of Product Personalizer
- Shopify app development best practices and design guides
- Performance and scalability considerations
- App store compliance and submission requirements

### Technical Deep-Dives
- Metafields and Metaobjects for storing custom data
- Admin UI Extensions and Checkout Extensions
- Shopify Discount API, Cart Manipulation, and Functions
- Storefront API vs Admin API trade-offs

---

## Scale Decision

**Scope:** Multi-faceted research (broad survey)  
**Complexity:** Medium-high (requires understanding app architecture, APIs, and implementation patterns)  
**Team:** Researcher-driven with 3 parallel tasks

**Rationale:**
- Research has 3 independent dimensions: (1) existing Product Personalizer app, (2) Shopify app architecture fundamentals, (3) implementation patterns for personalization
- Each dimension can be researched in parallel by separate researchers
- User needs actionable guidance on building, not just understanding one product
- This is beyond a simple "what is X" explainer—requires synthesis across app design, Shopify APIs, and development workflows

**Subagent Assignment:**
- **Researcher 1 (T1):** Product Personalizer app analysis (features, use cases, limitations)
- **Researcher 2 (T2):** Shopify app architecture and development fundamentals
- **Researcher 3 (T3):** Implementation patterns and technical deep-dives (APIs, extensions, customization)

---

## Task Ledger

| Task | Owner | Input Artifact | Output Artifact | Status |
|------|-------|----------------|-----------------|--------|
| T1: Product Personalizer app research | Researcher 1 | `outputs/.plans/product-personalizer-shopify-app-T1.md` | `outputs/.drafts/product-personalizer-shopify-app-research-app.md` | Pending |
| T2: Shopify app fundamentals | Researcher 2 | `outputs/.plans/product-personalizer-shopify-app-T2.md` | `outputs/.drafts/product-personalizer-shopify-app-research-architecture.md` | Pending |
| T3: Personalization implementation patterns | Researcher 3 | `outputs/.plans/product-personalizer-shopify-app-T3.md` | `outputs/.drafts/product-personalizer-shopify-app-research-implementation.md` | Pending |
| Synthesis & Draft | Lead | Research outputs | `outputs/.drafts/product-personalizer-shopify-app-draft.md` | Pending |
| Citation & Verification | Verifier | Draft | `outputs/.drafts/product-personalizer-shopify-app-cited.md` | Pending |
| Review & QA | Reviewer | Cited draft | `outputs/.drafts/product-personalizer-shopify-app-verification.md` | Pending |
| Final Delivery | Lead | Reviewed draft | `outputs/product-personalizer-shopify-app.md` | Pending |

---

## Verification Log

### Pre-Research Checks
- [ ] All required output directories exist
- [ ] Plan artifact is written and committed to disk

### Research Completeness Checks
- [ ] All 3 researcher tasks return evidence files
- [ ] All key questions have at least one source
- [ ] No critical sources are dead/blocked

### Citation Checks
- [ ] All URLs in final draft are reachable and verified
- [ ] Every claim is mapped to a source (inline citations)
- [ ] No invented sources, benchmarks, or figures

### Final Verification
- [ ] Draft contains no unsupported claims (per reviewer)
- [ ] All FATAL reviewer issues are fixed and re-verified on disk
- [ ] Final artifact exists at `outputs/product-personalizer-shopify-app.md`
- [ ] Provenance sidecar exists at `outputs/product-personalizer-shopify-app.provenance.md`

---

## Decision Log

| Date | Decision | Rationale | Owner |
|------|----------|-----------|-------|
| 2026-05-27 | Use 3 parallel researchers | Broad, multi-dimensional topic; parallelization reduces lead context pressure and accelerates evidence gathering | Feynman (Lead) |
| 2026-05-27 | Research existing app + Shopify fundamentals + implementation patterns | Covers user's full journey: understand existing product, learn Shopify architecture, then get actionable guidance | Feynman (Lead) |
| Pending | Citation method | Verifier subagent will add inline citations after draft is complete | TBD |
| Pending | Review method | Reviewer subagent will validate draft against evidence files | TBD |

---

## Notes

- User has provided a specific app URL (https://apps.shopify.com/product-personalizer) for reference
- Goal is actionable guidance to **build** a similar app, not just understand the existing one
- Research should include development workflow, testing, deployment, and store submission
- Should surface both opportunities (what to build) and constraints (app store policies, performance)
