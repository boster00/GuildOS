# Monthly Monitors & BI — Pre-greenlight Delta Analysis

**Date:** 2026-04-25
**Scope:** Smoke test against the *existing* monthly-report pipeline before building the proposed `monitors` skill book + scheduled task + "Boster sales monthly" quest template.
**Question:** What does the new build add over what already exists, and what does it risk losing?

---

## 1. State of the world today

**Source of truth:** Google Drive folder `Monthly Reports/<YYYY-MM>/` (folder id `1mKyc3mzeTi4cmSDnbHgL-RhIiBvn7EDT`).
**Cadence:** monthly subfolders going back at least to `2025-06`. Most recent complete: `2026-03`.
**Format:** 7–8 hand-built `.pptx` decks per month, each owned by a named operator.

### Most recent month (2026-03) inventory

| File | Owner | Character |
|---|---|---|
| Service Department Integrated Report_2026.03.pptx | Tracy Salyard | mixed |
| Product Management Report 2026-4-7.pptx | Product team | narrative |
| Online marketing analytics report-2026.4.pptx | Marketing | numeric |
| Monthly Reports for Cold Email Campaigns 2026.4.pptx | Outreach | numeric |
| Distributor Management Report Template-26.3.pptx | Evan | mixed |
| 260328-Content marketing report for March By Jiaying Liu and Lin.pptx | Content | narrative |
| 2026-3月度工作汇报-陈焱.pptx | Chen Yan | narrative |
| 2026-3-31-Monthly Design Report-Lin Ye.pptx | Lin Ye | narrative |

### Sample read — Distributor Management Report (Evan, 9 slides, 2026.3)

- **Page 5 has charts + narrative side-by-side:**
  - Two bar charts of distributor monthly sales for 2024 vs 2025 (Jan→Dec, e.g. 2024: 4008, 4951.8, 4143.6, … ; 2025: 4114.6, 5263.2, …, 1075.5)
  - Strategy / Progress / Meeting-notes table for "Strengthening BosterBio Brand Promotion in Europe"
  - Tebubio quarterly sales breakout
- Numbers exist but are **manually typed into PowerPoint each month** — not pulled from a system.
- The qualitative cells (`Strategy: Offer competitive pricing in exchange for deep cooperation…` / `Meeting notes: Tebubio is not interested in antibody promotion, prefers ELISA…`) are the **unique human value** in the deck. No system today captures this.

### Gaps in the existing pipeline (relative to a "Boster sales monthly")

1. **No dedicated sales deck.** Sales-relevant data is fragmented across Distributor, Online marketing, Cold Email, and individual work reports. There is no single "what did Boster sell this month, by channel, with MoM/YoY" view.
2. **Lag.** 2026-03 reports are dated 2026-04-07 to 2026-04-14 — i.e. 1–2 weeks after month close.
3. **Numbers re-keyed by hand.** Distributor charts are screenshots/typed into PPT; numbers are not feedable to GuildOS for alerting.
4. **No structured KPI substrate.** Cannot do MoM threshold alerts, YoY indexing, or a sales dashboard against the existing decks.
5. **Direct/ecom channel weakly represented.** Online-marketing covers top-of-funnel; no consolidated view of paid orders by channel × SKU.

---

## 2. Proposed `monitors` build (per prior thread / rollcall log)

> "monitors skill book + scheduled task designed; greenlight pending. Pre-reboot dispatch: smoke-test against existing monthly report; report delta analysis before we build."

Inferred shape from naming + GuildOS conventions:

- **`libs/skill_book/monitors/`** — new skill book. Action set likely: `runMonthlyMonitor`, `readMonitorResult`, `summarizeMonth`. **Confirmed not yet in repo** (registry scan of `libs/skill_book/index.js`).
- **Scheduled task** — cron entry that fires monthly (likely day 2, 9am) and dispatches a quest from the "Boster sales monthly" template.
- **Quest template "Boster sales monthly"** — drives an adventurer to pull KPIs (BigQuery + Zoho), generate the deck, drop it in `Monthly Reports/<YYYY-MM>/`, and post a summary.

---

## 3. Value delta

| Dimension | Existing (.pptx by owner) | Proposed (monitors) | Net |
|---|---|---|---|
| Latency to month-close | 7–14 days | ~24h | **+** real value |
| Sales channel coverage | fragmented across 4 decks | one consolidated deck | **+** fills the actual gap |
| Numbers feedable to GuildOS | no | yes (structured) | **+** unlocks alerting / dashboards |
| Reproducibility / audit trail | manual; per-owner spreadsheet upstream | pulls from BigQuery + Zoho weapons (already built) | **+** no re-keying errors |
| Headcount cost / month | ~6–10 person-hours across owners | minutes of compute | **+** real saving |
| Qualitative narrative (strategy, meeting notes, distributor relationship state) | high — exec-grade signal | low — agents shouldn't fabricate | **−** must NOT replace the human-narrative decks |
| Stakeholder buy-in / disruption | none | risk of "is this replacing my report?" pushback | **−** comms risk |

---

## 4. Recommendation

**GO**, but scope v1 narrowly:

1. **Build the sales-only deck.** Channel × SKU × MoM/YoY KPIs sourced from `bigquery` + `zoho` weapons. Drop into `Monthly Reports/<YYYY-MM>/Sales Monthly <YYYY-MM>.pptx`.
2. **Do NOT replace any existing dept report.** The Distributor / Service / Marketing decks each carry irreducible human narrative (strategy, meeting notes, relationship state). The monitor adds a *new* deck; it does not retire any of them.
3. **Wire structured KPIs to GuildOS.** Same agent that builds the deck should write a row to a `kpi_monthly` table so future monitors can do MoM-threshold alerts without re-pulling.
4. **Schedule.** Cron monthly, day 2 of the next month, 09:00. (Day 2 not day 1 — Zoho close-of-month commonly settles by EOD day 1.)
5. **Comms.** Before rollout, post once in the dept channel: "this is *additive* — your existing deck is not affected."

**Defer to v2:** auto-narrative, threshold alerts, Slack push, multi-quarter rollups.

---

## 5. Open questions for user

- Which sales channels must v1 cover? (proposed: Direct/online + Distributor + Marketplace if any)
- Which KPIs are non-negotiable for v1? (proposed: gross revenue, order count, AOV, top-10 SKUs by revenue, MoM and YoY for each)
- Naming: confirm `Sales Monthly <YYYY-MM>.pptx` slot name for the Drive folder.
- Should the monitor also email the deck link to a list, or just drop it in Drive and leave it?
