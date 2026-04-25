# PubCompare Exploration — Survey Findings

**Date:** 2026-04-25
**Author:** Claude Code worker (worktree `relaxed-heyrovsky-c228d5`)
**Trigger:** Thread #13 "PubCompare Exploration" had no user-supplied objective in `docs/thread-restart-prompts.md`. Surveyed the site to recommend candidate objectives.

---

## What PubCompare actually is

`pubcompare.ai` (Swiss-hosted) is a curated research-protocol database. Self-description: "We Dissect Protocols. Buffers, concentrations, incubation times — extracted and compared across papers. Zero interpretation. Pure data."

Confirmed scale (from `/api-for-research-protocol/`):
- **33M protocols** extracted from patents, publications, preprints, author manuscripts
- **17M+ protocols** referenced via external citations to **4M unique articles**
- **1M+ commercial lab equipment & materials** mentioned in protocols at least twice — each with product-level detail
- Indexed terms with synonym + related-term search
- Browse taxonomy: Anatomy, Chemicals & Drugs, Devices, Disorders, Genes & Molecular Sequences, Lab Equipment & Softwares, Living Beings, Objects, Phenomena, Physiology, Procedures

User (Sijie) is logged in; account exists. Site has a chat interface ("Hey Sijie, what should we look up across the literature?") and a Manual search dropdown (Protocol search + Lab product search).

## Why this matters for Boster

PubCompare's own listed commercial use cases include, verbatim from the API page:
- **"Lab Equipment: Run your market research and analysis"**
- **"Pharma and Biotech firms: improve your internal tools"**

Boster sells antibodies and lab reagents. PubCompare's "1M+ commercial lab equipment & materials mentioned in protocols at least twice" is the exact dataset that answers questions like:
- Which competitor antibodies appear in protocols our products could replace?
- Which protocols (and therefore which customer workflows) are dominated by which suppliers?
- Where does Boster's catalog have coverage gaps vs. demonstrated demand?
- Which preprints + recent papers cite competitors in protocol sections — leads for outreach?

This intersects directly with the existing **LifeSci Intel** initiative in `boster_nexus` (memory: `project_lifesci_intel.md`).

## Current GuildOS state

- `libs/weapon/pubcompare/index.js` — 36-line stub. Scrapes the public homepage via Browserclaw CDP. Two functions: `readSearch({query})`, `checkCredentials()`.
- `libs/weapon/registry.js:221` — registered, no auth flag, marked "Public site — no auth needed."
- **The weapon does not use the API.** It does HTML extraction of the homepage body — low-value relative to the API.
- **CDP path is deprecated.** CLAUDE.md insights `[2026-04-23]`: Browserclaw CDP is "deprecated for new local work." So the current weapon is built on a path the project has retired.

No prior thread artifacts found in `libs/`, `scripts/`, `docs/`. The thread is genuinely greenfield.

## Recommended candidate objectives (pick one)

### Objective A — Acquire API access, build proper weapon (highest leverage)
- Contact PubCompare via `/contact/` requesting API access + commercial pricing for "lab supplier market intelligence" use case.
- Once granted, rewrite `libs/weapon/pubcompare/` to use the REST API (drop Browserclaw CDP dependency).
- New weapon surface: `searchProtocols({query, filters})`, `searchProducts({query, supplier?, category?})`, `getProtocolDetail({id})`, `getProductMentions({productName})`.
- Deliverable: working weapon + smoke test against 5 Boster product names showing protocol mentions.
- **Reversibility:** medium — depends on PubCompare granting access and on commercial terms.

### Objective B — Manual UI exploration, validate value first
- Run 10–20 manual queries via the logged-in chat/search UI for Boster's top-selling antibodies + competitors.
- Document what data quality looks like for Boster's actual product lines before committing to API integration.
- Output: a markdown report `docs/pubcompare-value-validation.md` with side-by-side competitor coverage.
- **Reversibility:** full — read-only investigation.
- **Best fit if** the user wants evidence the data is good *for Boster's specific catalog* before paying for API access.

### Objective C — Port existing scraper to CIC, leave API for later
- Smallest scope: rewrite the existing weapon to use Claude-in-Chrome instead of deprecated Browserclaw CDP.
- Keep the same `readSearch`/`checkCredentials` contract.
- Useful if PubCompare's chat UI is the actual integration surface (vs. the API).
- **Reversibility:** full — pure code refactor.
- **Lowest leverage** — keeps a homepage scraper that has limited downstream use.

## Recommendation

**Sequence B → A.** Run Objective B first (1–2 days of UI exploration with Boster's actual products) to confirm data quality and document specific use cases. Use that report as input to the API-access conversation in Objective A — gives PubCompare's sales team a concrete pitch and gives Boster's team a clear ROI estimate before paying for commercial API tier.

Drop Objective C unless the user wants the existing scraper functioning right now for some near-term need.

## Visual evidence

Screenshots were captured during this survey (logged-in dashboard, footer with API link, API details page). They're in browser memory from `save_to_disk` calls; if the user wants them on disk under `docs/screenshots/`, can re-run the captures and persist.

## Status

**Documented and escalating to user.** Quest not created — the existing thread #13 needs a user-greenlit objective from A/B/C (or a different framing) before a quest with unambiguous deliverables can be opened. This is exactly the case `housekeeping.createQuest` says to clarify before creating.

Next user action: pick A / B / C / other, then dispatch back into the existing thread or this worktree with the choice.
