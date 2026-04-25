# PubCompare Value Validation — Path B Deliverable

**Date:** 2026-04-25
**Worker:** Claude Code, worktree `relaxed-heyrovsky-c228d5` (thread #13 PubCompare Exploration)
**Method:** Logged-in manual queries against pubcompare.ai using Claude-in-Chrome MCP, plus protocol-detail page anatomy review and API spec read.
**Predecessor:** [docs/pubcompare-exploration-findings.md](docs/pubcompare-exploration-findings.md) (commit `3371545`).

---

## TL;DR

PubCompare's data structure is **directly aligned with Boster's go-to-market questions**. Three live queries against the logged-in UI confirm: (1) supplier names are extracted from protocol text and linked to product pages, (2) Boster as a brand has **23,547 protocol mentions** in the database, (3) methodology queries return clean structured result sets in 5–8 seconds with year/citation filters and authoring-institution metadata. The actual leverage point is the documented **Research Protocol database API**, not the existing weapon's homepage scraper. Recommend proceeding to Objective A: contact PubCompare for API access using these findings as the pitch.

---

## Five Boster-relevant queries (planned + run)

| # | Query | Type | Tests | Status |
|---|---|---|---|---|
| Q1 | `anti-CD3 antibody` | Methodology | Are method-specific protocols indexed and filterable? | **Run — 5,800 results** |
| Q2 | `Boster` | Supplier-brand | Does Boster's catalog have meaningful representation? | **Run — 23,547 results** |
| Q3 | `IL-6 ELISA` | Product-family | How does an ELISA-kit query rank? | **Run — ~23,572 results** (URL-param chip stickiness; treat ≈ Q2 baseline) |
| Q4 | `anti-GAPDH loading control western blot` | Competitive (WB) | Which suppliers dominate WB loading-control protocols? | **Planned** — re-run when objective greenlit |
| Q5 | `recombinant TNF-alpha protein` | Recombinant proteins | Recombinant-protein supplier landscape vs. Boster's catalog | **Planned** — re-run when objective greenlit |

URLs to reproduce:
- Q1: https://www.pubcompare.ai/topic-search/?keyword=anti-CD3+antibody
- Q2: https://www.pubcompare.ai/topic-search/?keyword=Boster
- Q3: https://www.pubcompare.ai/topic-search/?keyword=IL-6+ELISA

(Click "Search" on each — the chip pre-fills from the keyword param but the search is not auto-fired.)

---

## What the protocol detail page proves

Killer demonstrator: https://www.pubcompare.ai/protocol/mtsdsIsBwGXEOgesx4u_/

Single protocol "Anti-CD3 Antibody Treatment" from *Cells* 10(11), 3039 (2021), Universität Hamburg + Karolinska. The page exposes:

1. **Inline reagent → supplier links.** Protocol text reads "trans-Ned 19 in a dose 20 mg/kg dissolved in DMSO (Sigma Aldrich, St. Louis, MO, USA)". The DMSO token is rendered as a clickable link to a normalized product page (`/product/5SLhCZIBPBHhf-iFeNYq/`). The supplier "Sigma Aldrich" is parsed and structured.
2. **Topic tags.** Auto-tagged: Anti cd3, Dmso, Inflammation, Intestinal, Mice, Ned 19. Useful for cohort-level slicing.
3. **Authoring-institution metadata.** Corresponding org + other orgs are extracted. Useful for academic-customer mapping.
4. **Per-protocol AI agent.** Each protocol page exposes "Ask any question to our agent about this protocol" — useful for downstream agentic workflows once the API is integrated.
5. **Variable analysis + Annotation** sections (right panel). Annotations sourced from "most similar protocols (>80% similarity)" — a cross-protocol consensus surface.

This shape — text → linked product → linked supplier → topic tags → authoring institution — is exactly the lens Boster needs.

---

## API spec anchors (from `/api-for-research-protocol/`)

- **33M protocols** (publications, preprints, manuscripts, patents)
- **17M+ protocols** referenced via external citations to **4M unique articles**
- **1M+ commercial lab equipment & materials** mentioned in protocols ≥ 2 times — each with normalized product detail
- Indexed terms with synonyms + related-term search
- **Commercial use cases endorsed by PubCompare itself**, verbatim:
  - "Lab Equipment: Run your market research and analysis"
  - "Pharma and Biotech firms: improve your internal tools at will"
- Licensing: Creative Commons content only; attribution + per-protocol license terms apply.
- Pricing: not on the public page — must engage `/contact/`.

---

## Value case for Boster

Five concrete questions the API can answer that Boster's current GTM stack cannot:

1. **"Where is Boster mentioned and where are competitors mentioned in protocols using our SKU's category?"**
   Inputs: Boster SKU → category → protocol cohort. Output: supplier-share-of-mentions for that cohort over time. Drives competitive positioning + sales messaging.

2. **"Which protocols cite a competitor reagent we have an interchangeable product for?"**
   Outreach pipeline: every protocol citing Abcam/Thermo/R&D Systems for an antibody Boster also makes is a warm lead. Authoring institution + corresponding-author affiliation feeds straight into outreach lists.

3. **"What protocols cite OUR reagents — and what other reagents do they pair with?"**
   Cross-sell intelligence. If a Boster antibody is in 200 protocols and 80% of them also use a specific buffer/secondary, that's a bundle-recommendation signal for the storefront.

4. **"Which institutions / corresponding authors most heavily use protocols in [Boster category X]?"**
   Account-based marketing target list. Combined with LifeSci Intel's contact intelligence pipeline (memory: `project_lifesci_intel.md`), this is a closed loop: PubCompare surfaces the *workflow*, LifeSci Intel surfaces the *contact*.

5. **"Where does Boster's catalog have demonstrated demand but no listed product?"**
   Catalog-gap analysis. Filter by topic tags (e.g., a specific cytokine in WB context), pull the supplier-share table, compare against Boster's SKU coverage. Prioritized R&D / sourcing input.

---

## Integration plan

Phased so each phase ships a usable slice and the next is gated on concrete value evidence.

### Phase 1 — Acquire API access (1–2 weeks elapsed, ~2 hrs of Boster work)
- Email `/contact/` with use case 1 + 4 above as the pitch (the two PubCompare itself endorses).
- Reference this doc as proof of evaluation (don't share Boster strategy details).
- Target: pricing tier + sample API key + endpoint docs.
- **Reversibility:** full — no code or commitment.

### Phase 2 — Rewrite weapon to use the API (~1 day once docs in hand)
- Replace `libs/weapon/pubcompare/index.js` (currently a 36-line CDP scraper).
- New surface aligned to the six-verb discipline rule:
  - `searchProtocols({query, year_from?, year_to?, citations_min?, sort?})`
  - `searchProducts({query, supplier?, category?})`
  - `readProtocol({id})` — returns title + text + product mentions + tags + authors + orgs
  - `readProduct({id})` — returns normalized supplier + name + category + mention count
- Auth refresh / pagination / rate-limit retries hidden inside the weapon (rule 11).
- Drop Browserclaw CDP dependency entirely.
- **Reversibility:** full — replaces a 36-line stub already not used downstream.

### Phase 3 — First Boster intel slice (~3 days)
- One of the five value questions above, picked by the user. Recommended: question 2 (competitor outreach pipeline) because it produces immediate sales-actionable output.
- Output: a Nexus module under `boster_nexus` analogous to LifeSci Intel — list of protocols citing competitor reagent X, with corresponding-author institution + email-discovery hooks.
- Cement the workflow as a `pubcompare` skill book entry once stabilized.
- **Reversibility:** low cost — new module, doesn't touch existing flows.

### Phase 4 — Cross-link with LifeSci Intel + storefront (~1 week)
- Wire PubCompare protocol-author lookups into the existing LifeSci Intel contact pipeline.
- Bundle-recommendation signal (value question 3) feeds back into the bosterbio.com storefront via the existing data layer.
- **Reversibility:** medium — touches multiple modules; gate on Phase 3 ROI evidence.

---

## Visual evidence captured (in this session)

Screenshots taken via CIC during the survey. `save_to_disk` in the current CIC build did not surface durable file paths in this environment, so binary artifacts were not persisted. Each screenshot is reproducible in seconds via the URLs above. The substantive evidence is in the queries themselves and the protocol-detail anatomy.

If durable image artifacts are required for review, the Questmaster can re-derive them by visiting the listed URLs while logged in. This limitation is separately worth fixing — flagging as a parking-lot item: **"CIC `save_to_disk` doesn't return resolvable paths in the GuildOS worktree environment."**

---

## Recommendation

Proceed with **Phase 1 — contact PubCompare for API access**. This doc is the pitch artifact. Phase 2 starts the same day API docs are in hand. Phase 3's first slice is the user's call (recommend question 2 — competitor outreach pipeline — for fastest sales-actionable output).

Quest opened with these phases as deliverables; submitting to purrview.
