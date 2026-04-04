# Feature Test Mission Overview

**Date:** 2026-04-03
**Source:** Claude Code sessions at claude.ai/code

## Project → Folder Mapping

| Session | Local Folder | Branch |
|---------|-------------|--------|
| Nexus Biomarker Research | `boster_nexus` | `claude/biomarker-entity-layer-4Rwcw` |
| Nexus Armor | `boster_nexus` | `claude/nexus-armor-integration-Ng7bn` |
| Bosterbio.com2026 | `bosterbio.com2026` | `claude/setup-nextjs-medusa-3bhX2` |
| CJ GEO next features | `cjgeo` | `claude/add-tracking-features-u21Wn` |

---

## 1. Nexus Biomarker Research

**Branch:** `claude/biomarker-entity-layer-4Rwcw` (+2511/-0)
**What was done:** Built a biomarker entity layer. Session also discussed setting up SSH between machines and a "Nexus Depot" server concept. The latest work is the entity layer code itself.
**What to test:** Verify the biomarker entity layer code — check if the app starts, any new pages/API routes function.
**Notes:** This is a new feature branch with 2511 additions and no deletions, so it's entirely new code.

## 2. Nexus Armor

**Branch:** `claude/nexus-armor-integration-Ng7bn` (+2196/-24)
**What was done:** Chrome extension integration for Zoho Books. Created:
- Cache tables migration (nexus_so_cache, nexus_po_cache, etc.)
- Stuck-orders banner, committed-qty panel, per-item open-PO-qty
- AI Order from Email feature
- Various DOM selectors for Zoho Books UI
**What to test:** This is a Chrome extension + DB migration. Test whether the migration SQL runs and the extension loads. The session notes open questions about sync mechanism and Zoho selectors.
**Notes:** Author flagged 5 clarification questions — testing may be limited without Zoho Books access.

## 3. Bosterbio.com2026

**Branch:** `claude/setup-nextjs-medusa-3bhX2` (+840/-0)
**What was done:** Setting up Next.js + Medusa e-commerce. An `apps/docs` folder was expected from a local agent push. The session was waiting for that push to complete. Ultimately 840 lines were added.
**What to test:** Check if the branch has the docs pages, verify the app starts, check page URLs.
**Notes:** Session indicated the local agent push may not have completed. Need to verify what actually landed on the branch.

## 4. CJ GEO next features

**Branch:** `claude/add-tracking-features-u21Wn` (+2152/-22)
**What was done:** 5 features implemented:
1. **Visibility Tracking** — Sidebar → "Visibility Tracking" (no longer dev-only)
2. **Competitor Research** — Sidebar → "Competitor Research"
3. **Full Agentic Creation** — Content Magic list → purple button
4. **Content Pipeline** — Sidebar → "Content Pipeline" (requires SQL migration)
5. **Custom Template from URL** — Article editor → Change Template → "Use Example Page" tab
**What to test:** Navigate to `/test-claude-features` — has self-test buttons and step-by-step guides.
**Prerequisites:**
- Run `libs/migrations/content-pipeline.sql` in Supabase SQL editor
- Env vars: `DATAFORSEO_LOGIN`, `DATAFORSEO_PASSWORD`, `EDEN_AI_API_KEY`, `CRON_SECRET`
**Notes:** Most complete session — all 5 features verified by background agents. Best candidate for thorough testing.
