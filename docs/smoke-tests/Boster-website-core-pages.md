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
1. Pull latest from repo default branch
2. Clone/pull GuildOS, read CLAUDE.md, check Supabase credentials
3. Create quest via `createQuest` action (title: "BosterBio Core Pages Smoke Test")

### Phase 2 — Build product detail page
4. Read `apps/docs/figma/product-page-1440.json` and `apps/docs/figma/images/product-page-1440.png` to understand layout
5. Create `apps/web/src/app/(site)/products/[sku]/page.tsx` — dynamic route that:
   - Fetches product from Medusa API by SKU (or falls back to seed data)
   - Renders: product image, name, SKU, price, format variants, Add to Cart, description, breadcrumb
   - Matches Figma layout at 1440px

### Phase 3 — Build search page
6. Read `apps/docs/figma/search-page-1440.json` and `apps/docs/figma/images/search-page-1440.png`
7. Create `apps/web/src/app/(site)/search/page.tsx` — reads `?q=` query param, filters products, renders results grid matching Figma
8. Wire up the search input in the header to navigate to `/search?q=...`

### Phase 4 — Screenshot all 5 pages
9. Start dev server: `cd apps/web && npm run dev` (port 3000)
10. Start Medusa backend if needed: `cd apps/api && npm run dev` (port 9000)
11. Take full-page Playwright screenshot of each page at **1440px width**:
    - `/` → compare vs `apps/docs/figma/images/homepage-1440.png`
    - `/about-us` → compare vs `apps/docs/figma/images/about-us-1440.png`
    - `/products` → compare vs `apps/docs/figma/images/product-listing-1440.png`
    - `/products/[any-real-sku]` → compare vs `apps/docs/figma/images/product-page-1440.png`
    - `/search?q=antibody` → compare vs `apps/docs/figma/images/search-page-1440.png`

### Phase 5 — Self-review and submit
12. For each page, rate fidelity 1–10 by checking:
    - Color palette: primary blue `#004C95`, accent orange `#EA8D28` used correctly
    - Typography: Josefin Sans (headings), Mulish (body) rendering
    - Layout: column widths, spacing, component arrangement vs Figma
    - Content: real data, no placeholder text, no 404
13. If any page is < 9/10: fix and retake screenshot before submitting
14. Upload all 5 screenshots to Supabase Storage: `GuildOS_Bucket/cursor_cloud/{questId}/`
15. Write inventory: one entry per page with `{ url, description, figma_score }` 
16. Verify inventory via SELECT, then move quest to `purrview`
17. Git push all code changes

---

## Observations

*(logged as test progresses — do not edit expected steps above)*

### 2026-04-16 — Dispatch

- Quest dispatched to BosterBio Website Dev (bc-18c56ad0) via Cursor API followup at ~session start.
- Pre-conditions verified: `/about`, `/privacy`, `/terms` redirects committed to bosterbio.com2026 main. Old quest (fa9f5893) moved to complete.
- Agent is idle, awaiting first nudge from cron or manual trigger.

---

