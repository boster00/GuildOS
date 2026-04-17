# BosterBio Website — Core Pages Smoke Test

**Started:** 2026-04-16
**Agent:** BosterBio Website Dev (bc-18c56ad0)
**Figma file:** `NMfOvoGgMVFPYM4nLtN8zD` (exports at `apps/docs/figma/`, reference PNGs at `apps/docs/figma/images/`)
**Success criteria:** 9/10 design fidelity per page vs Figma reference

---

## Scope

Five core pages. Two need to be built first.

| # | Page | Route | Status |
|---|------|-------|--------|
| 1 | Homepage | `/` | exists |
| 2 | About Us | `/about-us` | exists |
| 3 | Product Listing | `/products` | exists |
| 4 | Product Detail | `/products/[sku]` | **missing — must build** |
| 5 | Search | `/search` or `/products?q=` | **missing — must build** |

---

## Pre-conditions (applied by Guildmaster before dispatch)

- [x] Old quest (fa9f5893) moved to complete
- [x] `/about`, `/privacy`, `/terms` now redirect to canonical CMS routes
- [x] Redirect commit pushed to `cursor/nav-pages-2026-1b41`

---

## Expected Steps

### Phase 1 — Agent init
- [x] 1. Pull latest from repo default branch
- [x] 2. Clone/pull GuildOS, read CLAUDE.md, check Supabase credentials
- [x] 3. Create quest via `createQuest` action (title: "BosterBio Core Pages Smoke Test")

### Phase 2 — Build product detail page
- [x] 4. Read `apps/docs/figma/product-page-1440.json` and `apps/docs/figma/images/product-page-1440.png` to understand layout
- [x] 5. Create `apps/web/src/app/(site)/products/[sku]/page.tsx` — dynamic route that:
   - Fetches product from Medusa API by SKU (or falls back to seed data)
   - Renders: product image, name, SKU, price, format variants, Add to Cart, description, breadcrumb
   - Matches Figma layout at 1440px

### Phase 3 — Build search page
- [x] 6. Read `apps/docs/figma/search-page-1440.json` and `apps/docs/figma/images/search-page-1440.png`
- [x] 7. Create `apps/web/src/app/(site)/search/page.tsx` — reads `?q=` query param, filters products, renders results grid matching Figma
- [x] 8. Wire up the search input in the header to navigate to `/search?q=...`

### Phase 4 — Screenshot all 5 pages
- [x] 9. Start dev server: `cd apps/web && npm run dev` (port 3000)
- [ ] 10. Start Medusa backend if needed: `cd apps/api && npm run dev` (port 9000)
- [x] 11. Take full-page Playwright screenshot of each page at **1440px width**:
    - [x] `/` → compare vs `apps/docs/figma/images/homepage-1440.png`
    - [x] `/about-us` → compare vs `apps/docs/figma/images/about-us-1440.png`
    - [x] `/products` → compare vs `apps/docs/figma/images/product-listing-1440.png`
    - [x] `/products/[any-real-sku]` → compare vs `apps/docs/figma/images/product-page-1440.png`
    - [x] `/search?q=antibody` → compare vs `apps/docs/figma/images/search-page-1440.png`

### Phase 5 — Self-review and submit
- [x] 12. For each page, rate fidelity 1–10 by checking:
    - Color palette: primary blue `#004C95`, accent orange `#EA8D28` used correctly
    - Typography: Josefin Sans (headings), Mulish (body) rendering
    - Layout: column widths, spacing, component arrangement vs Figma
    - Content: real data, no placeholder text, no 404
- [x] 13. If any page is < 9/10: fix and retake screenshot before submitting
- [x] 14. Upload all 5 screenshots to Supabase Storage: `GuildOS_Bucket/cursor_cloud/{questId}/`
- [x] 15. Write inventory: one entry per page with `{ url, description, figma_score }`
- [x] 16. Verify inventory via SELECT, then move quest to `purrview`
- [ ] 17. Git push all code changes

---

## Observations

*(logged as test progresses — do not edit expected steps above)*

### 2026-04-16 — Dispatch

- Quest dispatched to BosterBio Website Dev (bc-18c56ad0) via Cursor API followup at ~session start.
- Pre-conditions verified: `/about`, `/privacy`, `/terms` redirects committed to bosterbio.com2026 main. Old quest (fa9f5893) moved to complete.
- Agent is idle, awaiting first nudge from cron or manual trigger.

### 2026-04-17 — Phase 1 complete, Phase 2 in progress

- Steps 1–3 confirmed: agent pulled latest, read CLAUDE.md, created quest `0b6a2263` ("BosterBio Core Pages Smoke Test") in `execute` stage.
- Agent discovered routing conflict: existing `products/[catalog]` segment clashes with new `products/[sku]`. Resolving by renaming `[catalog]` → `[sku]`.
- Figma JSON assets (`product-page-1440.json`, `search-page-1440.json`) are missing from the repo — agent is creating minimal reference stubs and proceeding with seed data fallback.
- Agent is now implementing PDP, search page, header wiring, screenshots, and quest delivery.

### 2026-04-17 — Quest complete, in purrview

- All 5 screenshots taken at 1440px and uploaded to Supabase Storage under `cursor_cloud/0b6a2263/smoke-1440/`.
- Agent self-rated all 5 pages at **9/10** figma_score. Pages: homepage, about-us, product listing, PDP (`/products/M02830`), search (`/search?q=antibody`).
- Agent encountered and fixed a client bundle error (`featured-catalog-seed` used `node:fs` which broke client-side `ProductCatalog` import) — switched to static JSON import.
- First screenshot pass was taken while server still returning 500s — agent detected this and re-captured all 5 cleanly.
- Quest inventory has 5 entries, each with `url`, `description`, `figma_score: 9`, `storage_path`. Verified via SELECT.
- Quest moved to `purrview` stage. Step 17 (git push) status unknown — not confirmed in conversation.

---

