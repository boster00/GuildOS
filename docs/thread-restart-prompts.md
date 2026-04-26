# Thread Restart Prompts (terse)

Bare-minimum starters — just enough to get the agent oriented and waiting for specifics. Detailed instructions get dispatched later via CIC.

Each prompt: 1 line of identity/scope, 1 line of last-state context, dispatch envelope, "await specifics."

---

## 1. CRM Gap Analysis Tool

```
You're picking up the CRM Gap Analysis Tool quest. Prior thread shipped /api/gap-analysis + /pim/gap-analysis (5/5 niches verified). Your scope: build the deferred items — attribute_definitions + product_images tables + full Magento ingestion (~100 cols → attr_N). Read CLAUDE.md. Standard verification: screenshot in quest inventory, close CIC tabs when done. Await specifics.
```

## 2. Server-side Tracking (CRITICAL)

```
You're picking up Server-side Tracking (CRITICAL). Prior audit complete; 3 artifacts in docs/tracking-audit/ — start with mvp-recommendations.md. Your scope: build Tier-1 ~10-event MVP, then GA4 event-name dupe cleanup. Read CLAUDE.md. Standard verification: screenshot in quest inventory, close CIC tabs when done. Await specifics.
```

## 3. Loyalty System

```
You're picking up Loyalty System v1. Prior thread fully designed the extraction pipeline + loyalty_transactions ledger (default 1pt/$1, Mode A). Your scope: build v1 as a new Nexus module "loyalty system" (same embedded pattern as the chat agents module). Read CLAUDE.md. Standard verification: screenshot in quest inventory, close CIC tabs when done. Await specifics.
```

## 4. Monthly Monitors & BI → GuildOS

```
You're picking up Monthly Monitors & BI → GuildOS. Prior thread designed the monitors skill book entry + scheduled task + "Boster sales monthly" quest template. Your scope: pre-greenlight smoke test — read the existing monthly report and report the delta in value before we build. Read CLAUDE.md. Standard verification: screenshot in quest inventory, close CIC tabs when done. Await specifics.
```

## 5. eVoice → New PBX Migration

```
You're picking up eVoice → New PBX Migration. Prior diagnosis: Telnyx trial gates inbound calls (Q.850=17) until card on file; user tried adding a card but it failed (mode unspecified). Your scope: re-diagnose the card-add failure → unblock trial → verify Press-1-to-cell flow on +1 (618) 952-9022. Read CLAUDE.md. Standard verification: screenshot in quest inventory, close CIC tabs when done. Await specifics.
```

## 6. Nexus Armor

```
You're picking up Nexus Armor — Send-As-Draft for Boster invoices. Prior thread shipped the browsercontrol skill book + gmail draft pathway; Gmail draft r2753459344909854508 is awaiting click-test. Your scope: create a Test_CJ test order in Magento (NOT a real invoice — would void it) → Send-As-Draft against it. Prior agent hit Cloudflare-mitigated 404 on /admin_1xw0di/. Read CLAUDE.md. Standard verification: screenshot in quest inventory, close CIC tabs when done. Await specifics.
```

## 7. Nexus Workflows

```
You're picking up Nexus Workflows. Engine v1 done on boster_nexus/main (6 nodes green, end-to-end demonstrated). Inventory at docs/workflows-rollout.md. Your scope: continue down the slice list — (1) notification channels in `output`, (2) uptime watchdog producer, (3) code-managed example, (4) Anthropic in `ai`. Read CLAUDE.md. Standard verification: screenshot in quest inventory, close CIC tabs when done. Await specifics.
```

## 8. Pillar 3 — Platform Play

```
You're picking up Pillar 3 — Platform Play v1. Prior thread delivered the architecture for an agentic quote chat for bosterbio.com (GTM widget → app/api/quote_chat → LLM with 4 tools). Your scope: v1 = rare-species custom-antibody chat agent ONLY, embedded in a new Nexus "chat agents" module (Nexus first; GTM widget comes later). Read CLAUDE.md. Standard verification: screenshot in quest inventory, close CIC tabs when done. Await specifics.
```

## 9. Merchant Center Audit

```
You're picking up [Recur] Merchant Center Audit. Prior thread runs the 2h sit rep loop (Job 6e0c6073). Two drafts user-approved: delist_draft.md + boster_guarantee_edit.md. Your scope: ship both, then continue the 2h sit rep loop until appeal rulings land or the user says "pause loop". Read CLAUDE.md. Standard verification: screenshot in quest inventory, close CIC tabs when done. Await specifics.
```

## 11. Close Old Orders (>2 years)

```
You're picking up Close Old Orders (>2 years) — closing aged Zoho Books records (POs → SOs → Bills → Invoices) dated on or before 2022-12-31 across all non-closed parent statuses. Audit + cleanup scripts already drafted under `scripts/zoho-*`: `zoho-aged-audit.mjs` (classify), `zoho-cleanup-runner.mjs` (paced runner, 1000/day, ~90s between ops, resumable via `data/zoho-cleanup-progress.json`), plus `zoho-close-probe.mjs` / `zoho-close-smoke.mjs` for safe trial closes. Your scope: validate the audit numbers, run the smoke probe end-to-end on a small batch, then chain through `po → so → bill → invoice` per `CHAIN_NEXT` in the runner. Credentials live in `potions` (kind=zoho_books) + `profiles.env_vars`; do NOT hardcode. Read CLAUDE.md. Standard verification: screenshot of progress JSON + Zoho Books UI showing closed status, attached to quest inventory. Close CIC tabs when done. Await specifics.
```

## 12. Carbon

```
You're picking up Carbon — PMC backfill on the remote Carbon SSH server. Prior session: edge_article_authors 1.55M → 1.6M+, ~6.6% of corpus with authors, climbing through PMC008+. Your scope: continue the backfill autonomously, sit-rep when crossing PMC010+. The user has flagged this thread for strategic-direction discussion later. Read CLAUDE.md. Standard verification: screenshot/log in quest inventory, close CIC tabs when done. Await specifics.
```

---

## NEW threads — need user-supplied objective

For these I have only the name. Each needs a one-line objective before I can write a starter.

- **#10 CJGEO full auto dev** — objective?
- **#13 PubCompare Exploration** — objective?
- **#14 LinkedIn Outreach (AI-assisted)** — objective?
