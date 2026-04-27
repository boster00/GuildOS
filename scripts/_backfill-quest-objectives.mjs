// Restore objective-style quest descriptions on the 16 quests where the
// 2026-04-26 verification scripts overwrote `quests.description` with status
// text. Per the (newly-locked) contract: description is the OBJECTIVE,
// never the status. Source for each objective: the Asana task title +
// CJ's GuildOS-sync comment + items.expectation (read by hand earlier this
// session — every artifact directly inspected via Read tool).
//
// Idempotent: only writes if current description matches the
// "Quest in the review|escalated stage" overwrite pattern.

const KEY = process.env.SUPABASE_SECRETE_KEY;
const SUP = process.env.NEXT_PUBLIC_SUPABASE_URL;
const H = { apikey: KEY, Authorization: "Bearer " + KEY, "Content-Type": "application/json" };
async function get(p) { const r = await fetch(SUP+"/rest/v1/"+p, { headers: H }); return r.json(); }
async function patch(p, body) {
  const r = await fetch(SUP+"/rest/v1/"+p, { method:"PATCH", headers:{...H, Prefer:"return=representation"}, body: JSON.stringify(body) });
  return [r.status, await r.json()];
}

// title_pattern → authored objective. Matches by title prefix to avoid id drift.
const objectives = {
  "1. CRM Gap Analysis Tool": `## Goal
Build a \`/pim/gap-analysis\` UI that runs niche set-difference between two SKU groups (a niche = species × application × biomarker/gene). Output: niches present in the "treatment" group but absent in the "foundation" group — surfaces catalog gaps relative to demonstrated demand.

## Approach
Backed by a new \`attribute_definitions\` + \`product_images\` schema (migration 076) that the ingest pipeline populates from Magento.

## Deliverables to confirm during review
1. Schema migration applied to boster_nexus (\`attribute_definitions\` + \`product_images\` tables visible).
2. Ingest pipeline e2e smoke run: 100 products + 200 product_images written from elisa-kits template, 0 errors.
3. Gap-analysis UI shows 5 identified niches when sample SKUs (Treatment EK0302..EK0307 vs Foundation EK0308..EK0313) are loaded.

## Asana
Task: "Develop gap analysis tool on crm marketing dashboard, get back to biorbyt" (\`1206766948204742\`).`,

  "2. Server-side Tracking (CRITICAL)": `## Goal
Build a Tier-1 ~10-event server-side tracking MVP that lands events into BigQuery (\`boster-cbi.CDB.events_serverside_mvp\`), parallel to the existing GA4 export so per-event counts can be diffed for dedup planning.

## Why CRITICAL
GA4 client-side tracking is fragile (ad-blockers, iOS, double-firing). Server-side gives canonical event truth — required before we can rely on tracking for any decision.

## Deliverables to confirm during review
1. \`/api/track\` returns HTTP 200 with \`{inserted:8, rejected:[], errors:[]}\` shape.
2. 8 rows landed in \`boster-cbi.CDB.events_serverside_mvp\` for the smoke run, with event_names matching the Tier-1+2 allowlist (page_view, session_start, purchase, form_submit, GAds Conversion, P1.Search, P2.ClickProductLink, P3.1.AddToCart, P4.AddToCart, etc.).
3. End-to-end loop verified across the full chain (route-fire → BQ → 5 acceptance gates: inserted==8, rejected==[], errors==[], BQ row count==8, public path exempt).

## Asana
Task: "Build server side tracking MVP" (\`1214203727707465\`).`,

  "3. Loyalty System": `## Goal
Build a v1 loyalty-system module inside \`boster_nexus\` (route \`/loyalty-system\`) that scans \`bs_orders\`, extracts end-user emails, accrues points (1 point per $1 spent), and writes a transaction ledger.

## Scope
v1 = the data substrate. Tier ladder + reward redemption is the long-term vision; the substrate is what's needed before Magento is replaced.

## Deliverables to confirm during review
1. Schema migration applied (\`loyalty_extraction_runs\` table visible in Pipeline Runs tab).
2. Module renders inside Nexus dashboard with 4 stat cards populated (End Users, Total Points, Total Spent, Ledger Entries).
3. Pipeline runs successfully: scanned 14 orders, found 13 candidates, wrote 13 ledgers — and is idempotent on re-run with 0 writes.
4. End Users tab shows the extracted email (xsj706@gmail.com) with points + spend.
5. Recent Activity ledger lists individual orders mapped to points with confidence score.

## Asana
Task: "Develop the loyalty system" (\`1210644588224004\`).`,

  "4. Monthly Monitors & BI → GuildOS": `## Goal
Smoke-test the existing Boster monthly-report pipeline (Google Drive \`Monthly Reports/<YYYY-MM>/\`, 7-8 hand-built PowerPoints per month) against a proposed \`monitors\` skill book + scheduled task + "Boster sales monthly" quest template. Deliver delta analysis identifying gaps and recommend GO / NO-GO before building the auto-monitor.

## Deliverables to confirm during review
1. Delta analysis MD covering: current state (decks per month, owners, lag, gaps), proposed monitors build, value-delta table (latency, channel coverage, KPI substrate, qualitative narrative tradeoff), GO recommendation with v1 scope (sales-only deck, defer narrative+alerts to v2), 5 open questions for user.
2. Sample-evidence pulls from the existing pipeline — Drive folder snapshot showing 6 .pptx for 2026-03, sample report cover slide (Distributor Mgmt Template), sample numeric content (BIOZOL 2024-vs-2025 monthly bar charts on page 5).

## Asana
Task: "Make a monthly report reader, compare submitted reports with requirements/templates and highlight things I need to pay attention to" (\`1213503063566339\`).`,

  "5. eVoice → New PBX Migration": `## Goal
Migrate Boster's main phone line off eVoice onto a Telnyx-backed PBX with a Press-1-to-cell IVR flow.

## Status: ESCALATED — user-only blocker
Telnyx requires Paid criteria 2/4 met (verified phone + 2FA enabled) before outbound traffic can route. Both steps require the user's physical phone — agent cannot complete them.

## Deliverables to confirm during review
1. Telnyx account-levels portal screenshot showing the 2/4 Paid criteria state (✅ service address, ✅ card on file, ❌ verified phone, ❌ 2FA TOTP). **Note: the current artifact for this item appears to show a different work session, not the Telnyx portal — likely needs retake.**
2. Telnyx API diagnostic JSON dump confirming +16189529022 ownership, BosterBio IVR TeXML application active, default outbound voice profile, and connection routing.

## User action required to unblock
- Verify phone (SMS code) in Telnyx portal.
- Enable 2FA TOTP for the Telnyx account.

## Asana
Task: "Migrate eVoice to a different phone handling system" (\`1214051915917226\`).`,

  "6. Nexus Armor": `## Goal
Validate that the migrated **Send-As-Draft** button on Zoho Books invoice email forms works end-to-end through the live boster_nexus production server (\`https://bosternexus.vercel.app/nexus-armor?action=voidThenDraftInvoice\`). Test_CJ test order on Zoho invoice 53695 is the validation vehicle.

## Deliverables to confirm during review
1. **Live evidence link** to Zoho invoice 53695 with the Comments+History audit trail (open with your Zoho session — the URL artifact is a login-redirect HTML when fetched without auth, so the audit trail is only visible to logged-in users).
2. End-to-end test summary MD: PASS verdict, full Zoho audit trail (6 events: invoice updated → webhook → emailed → voided → drafted → webhook), and the click-test log evidence.
3. Click-test JSON log capturing send → after-wait → result transitions ({ok:true, voided:true, drafted:true}).
4. Bug analysis MD detailing the 4 selector bugs found in books-augment.js and fixed in commit \`007b31f\`.

## Outstanding user action
Reload the Nexus Armor extension in \`chrome://extensions/\` to pick up the new manifest registration of \`books-augment.js\` as a content script.

## Asana
Task: "Nexus Armor master task" (\`1214022703138877\`).`,

  "7. Nexus Workflows — slice 1 (notification channels)": `## Goal
Slice 1 of the Nexus Workflows distribution-layer build (Phase 2 adapter bus): three outbound notification channels — email, asana_comment, webhook — wired so that a workflow firing emits to all configured destinations with independent status tracking per adapter.

## Deliverables to confirm during review
1. Slice-1 evidence image: live run output showing successful reporting for all three notification channels with the expected payload shape (HTTP 200 + per-channel status flags), plus implementation block referencing the channel adapters.

## Parent
Asana task "2. Build the workflow automation module that pipes into downstream adapters" (\`1214241273651996\`).`,

  "7. Nexus Workflows — slice 2 (uptime watchdog)": `## Goal
Slice 2: Uptime watchdog producer that probes a URL list, fires \`/api/workflows/uptime-down\` on non-2xx responses, and routes through an AI urgency-triage gate before the alert adapter runs.

## Deliverables to confirm during review
1. Slice-2 evidence image: live run output probing 2 URLs (https://httpbin.org/status/200 → 200 in ~362ms, https://httpbin.org/status/503 → 503 in ~749ms), POST /api/workflows/uptime-down 200 with run_id + status:"success", probed=2 down=1 summary, plus implementation block (producer at \`scripts/watchdogs/uptime-check.mjs\`, workflow definition seeded by \`scripts/seed-workflows.mjs\`).

## Parent
Asana task \`1214241273651996\`.`,

  "7. Nexus Workflows — slice 3 (code-managed)": `## Goal
Slice 3: Code-managed example workflow with signal-dedupe — workflows defined as code (vs DB rows) and deduplicating identical incoming payloads within a window so duplicate fires are suppressed at ingest.

## Deliverables to confirm during review
1. Slice-3 evidence image: live run output showing two identical-payload fires (only first emitted, second suppressed = "deduped"), plus implementation block (module path, dedupe key construction, window definition, default config).

## Parent
Asana task \`1214241273651996\`.`,

  "7. Nexus Workflows — slice 4 (Anthropic provider)": `## Goal
Slice 4: Add Anthropic as a provider in the workflow's \`ai\` node (alongside the existing OpenAI provider) — credit accounting respected, request/response normalized so downstream adapters see the same envelope regardless of provider.

## Deliverables to confirm during review
1. Slice-4 evidence image: live run output showing a successful Anthropic API request with valid request_id, content blocks returned, and credit consumed; implementation block referencing the provider config + run shape.

## Parent
Asana task \`1214241273651996\`.`,

  "8. Pillar 3 — Platform Play": `## Goal
Build v1 of the Pillar 3 chat-agents module in \`boster_nexus\`: a public, embeddable AI agent that answers prospective-customer questions about Boster's rare-species custom antibody service (fish, amphibians, reptiles, invertebrates, livestock, exotic mammals, plants).

## Two routes
- \`/chat-agents\` — private admin demo (under (private) shell)
- \`/embed/chat-agent\` — public, no auth, the route bosterbio.com would iframe

## Deliverables to confirm during review
1. Build summary MD: file inventory (\`app/(private)/chat-agents/page.js\`, \`ChatClient.js\`, \`app/(public)/embed/chat-agent/page.js\`, \`app/api/chat-agents/route.js\`, \`libs/modules.js\` entry), system-prompt scope-guard, smoke-test acceptance criteria.
2. Conversation screenshot: agent UI with user prompt "tell me more about Boster's rare species custom antibody service" and on-topic structured assistant reply (workflow, hosts, validation, timelines, applications).
3. Empty-state UI screenshot: same chat surface before any message, agent dropdown selected.
4. Full text transcript of the smoke conversation.

## Known limitations called out in the build summary
- Single agent only (rare-species). Architecture supports more.
- No persistence — chat history resets on reload.
- No rate limiting / origin allowlist on the public embed (must be added before bosterbio.com production embedding).`,

  "9. Merchant Center Audit": `## Goal
Audit Boster's Google Merchant Center account for disapproved listings, propose a delist plan + the website edits required to satisfy MC's verification crawler. Recurring 2-hour-tick monitor lives on top once these drafts ship.

## Deliverables to confirm during review
1. **Delist plan MD**: 1 hard-delist (\`enz1064\` — "GLRX Mouse Recombinant Protein", dead URL) + 43 SKUs flagged Healthcare-Rx misclassified (research reagents whose gene/protein names match drug-target keywords). Recommended path: APPEAL not delist — same one-click "I disagree for all products" mechanic that worked for prior Healthcare buckets. All 43 offerIds listed for the appeal.
2. **Boster Guarantee edit memo MD**: identifies that the current /boster-guarantee page does not state return-policy specifics (which Google's verifier compares against the published MC return policy). Proposes new section: 30-day return window, customer-pays-shipping for non-defective, 15% restocking fee, 10-day refund processing.

## Asana
Task: "Research/Audit Merchant center, starting from this link" (\`1211295918958446\`).`,

  "10. CJGEO Full Auto Mode": `## Goal
Build Phase 1 of the CJGEO full-auto content-generation engine, anchored to biomarkers — a unified async execution layer that scales to 20,000+ queued topics with consistent metering, typed content, source-URL rewrite, and proxy metrics. All triggers (UI, API, cron, demo mode) route through one execution path.

## Architectural decisions (locked)
- Strict separation: trigger logic ≠ execution logic. All triggers call \`POST /api/jobs\`.
- Metering: single credit deduction at job status → running.
- Async-first: every trigger returns jobId. Clients poll \`GET /api/jobs/[id]\`.
- Demo mode unified: \`demo_jobs\` deprecated; demo run = one \`generation_jobs\` row + downstream adapters.

## Deliverables to confirm during review (5 milestones)
1. **M1 — Schema foundations** applied: \`generation_jobs\` (14 cols) + \`topic_queue\` (12 cols) tables, RLS enabled, migration \`20260424000000\`.
2. **M2 — computeMetrics()** Phase 4 populating \`article.metrics\` JSONB with readability / seoStructure / clarityScore / structuralImprovements.
3. **M3 — Unified \`/api/jobs\` API** with all 9 test cases passing (auth, dedupe, validation: invalid JSON 400, empty body 400, valid 202, sameJob dedupe 200, full status, 404 not_found, 400 batch param, 401×2 unauth).
4. **M4 — Cron** \`processTopicQueueTick\` claiming 5 rows per tick atomically (\`UPDATE…WHERE status='queued'\` row-level lock).
5. **M5 — Live** \`/content-magic/bulk\` page rendered for an authenticated adventurer (bulk topic queue interface, batch counter, 3954 credits).

## Asana
Task: "1. Build the full auto pipeline, start with biomarkers" (\`1214241273651994\`).`,

  "11. Close Old Orders (>2 years)": `## Goal
Programmatically close all aged Zoho Books orders (≤ 2022-12-31). Paced runner over the chain \`purchase_orders → sales_orders → bills → invoices\` at 1000 ops/day, with API verification of every claimed cancellation. Resumable; alive-check cron refreshes every 30 min.

## Deliverables to confirm during review
1. **Live runner state JSON snapshot** at submission time (PO completed/queued/failed counts, runner PID, ~86s/op pacing, 15 most recent cancelled PO numbers). Note: stateful — the runner has progressed since this snapshot.
2. **API verification JSON**: 8 sample POs cross-verified by issuing GET \`/purchaseorders/{id}\` against Zoho — every \`logged_action='cancelled'\` matches \`api_status='cancelled'\` with vendor + total + 2021-2022 dates.
3. **Runner-pace dashboard image**: Close Old Orders header, 4 category cards (Purchase Orders, Sales Orders, Bills, Invoices) showing current counts, recent runner log (12 cancelled PO IDs), Verification 8/8 strip.

## Status note
Pipeline-proven, not pipeline-complete. Runner stays alive in background; PO chain expected to take ~2.5 days total at 1000/day pacing.

## Asana
Task: "Programmatically close all past open orders and unpaid invoices" (\`1203644300997696\`).`,

  "12. pubcompare": `## Goal
Explore \`pubcompare.ai\` (curated research-protocol database — 33M protocols, 17M+ via citations, 1M+ commercial lab equipment normalized) as a potential Boster intel source. Assess data quality for Boster's actual SKUs and propose an integration plan if value is confirmed.

## Approach: Path B → A
Path B (manual UI exploration with logged-in queries) before Path A (commercial API access) — gives PubCompare's sales team a concrete pitch and gives Boster a clear ROI estimate before paying for commercial tier.

## Deliverables to confirm during review
1. **Survey findings doc**: site description, scale (33M protocols / 1M+ commercial lab equipment), 3 candidate objectives (A: API access, B: manual UI exploration, C: port scraper to CIC), recommendation (B → A).
2. **Path B value validation doc**: 5 live queries (anti-CD3, Boster brand, IL-6 ELISA, anti-GAPDH, recombinant TNF-alpha) with result counts, killer demonstrator (Trans-Ned 19 protocol page proves reagent → supplier inline links), API spec anchors, 5 concrete value questions for Boster, 4-phase integration plan.
3. **Saved-HTML evidence pages** (4): API spec page, Trans-Ned 19 protocol detail, anti-CD3 search page, Boster brand search page. *Note: dynamic search-result counts (5,800 / 23,547 etc.) are JS-rendered — not in raw HTML. Numbers are documented in the validation doc.*

## Asana
Task: "Look into https://www.pubcompare.ai/, see if we can offer them to our users" (\`1211640391302389\`).`,

  "13. LinkedIn Outreach (AI-assisted)": `## Goal
Pilot an AI-assisted LinkedIn outreach adapter (Demo mode for Phase 2 of Nexus Workflows). Smoke Test 1 anchored to NIH R01 grants — pull a sample, structure-extract biomarker / species / application from each abstract, score quality against a strict gate, then iterate the prompt for Smoke Test 2.

## Deliverables to confirm during review
1. **Step A — Sample**: 50 NIH R01 grants pulled from RePORTER v2 API (FY24-25, sorted by start date desc). Header literally claims "50 grants / $58,979,280 / 39 unique orgs". Full table of project numbers, titles, PIs, organizations, award amounts.
2. **Step B — Structured extraction**: same 50 R01 abstracts run through OpenAI tool-call extraction with biomarker / species / application columns. Per-row extraction visible.
3. **Step C — Scoring**: Quality Verdict view. **FAIL** on the strict gate: 22/50 fully-correct rows (44%). Per-field accuracy bars showing the biomarker bottleneck at 62%.
4. **Step D — Prompt v2 prep**: biomarker-focused prompt revision with diff vs v1, few-shot examples grouped by error type, open question about human review for ST2 dispatch.

## Caveat noted at submit time
Step C automated cross-grading uses gpt-4o as the judge — not literal manual scoring.

## Asana
Task: "2.1 Adaptor: Demo mode, Try linkedin outreach" (\`1208471401165971\`).`,
};

(async () => {
  let written = 0, skipped = 0;
  for (const [titleStart, objective] of Object.entries(objectives)) {
    // Encode for URL safely
    const enc = encodeURIComponent(titleStart);
    const qs = await get(`quests?title=ilike.${enc}%25&select=id,title,description&limit=2`);
    // Filter to exact prefix match
    const matched = qs.filter(q => q.title.startsWith(titleStart));
    if (matched.length === 0) { console.log("✗ NOT FOUND: "+titleStart); continue; }
    if (matched.length > 1) { console.log("⚠ ambiguous (taking first): "+titleStart); }
    const q = matched[0];
    if (!/^Quest in the (review|escalated)/.test(q.description||"")) {
      console.log("- skip (description not a status-overwrite): "+q.title);
      skipped++;
      continue;
    }
    const [s, b] = await patch("quests?id=eq."+q.id, { description: objective });
    if (s === 200) {
      console.log("✓ "+q.title);
      written++;
    } else {
      console.log("✗ "+q.title+" status="+s+" "+JSON.stringify(b).slice(0,150));
    }
  }
  console.log(`\n--- wrote ${written}, skipped ${skipped} ---`);
})();
