# Smoke Test Summary

Last updated: 2026-04-16

---

## Decision Questions

*Answered 2026-04-16*

1. **purrview_count tracking** ✅ **Decision:** Do not add a dedicated column. Use total quest comment count as the purrview_count proxy. Cat must comment on each inventory item; the running total of comments is the submission count. Cat is required to reject and give feedback if comment count == 1 (first submission).

2. **CURSOR_API_KEY on agents** ✅ **Decision:** Direct communication matters. CURSOR_API_KEY has been manually added to all Cursor env profiles. Workers can now call seekHelp via API.

3. **FIGMA_ACCESS_TOKEN on agents** ✅ **Decision:** The Figma file is public-accessible. No token provisioning needed — agents can access reference frames via the public Figma URL.

4. **Raw GitHub URLs vs Supabase Storage** ✅ **Decision:** Not acceptable. Supabase Storage public URLs only. Hard-fail if no storage URL is present in inventory.

5. **Quest weapon** ✅ **Decision:** Quest operations stay in the housekeeping skill book (not a separate weapon). When agents can use native DB/API calls directly, that is fine.

6. **Cat → Asana on closing** ✅ **Decision:** Not yet verified. Add to next smoke test: move a real quest to closing and observe whether Cat successfully writes to Asana.

7. **Auth state sharing for cloud agents** ✅ **Decision:** Send auth state to Cat (Questmaster) first. Cat holds it. Agents request it from Cat via seekHelp when they need browser auth. Wire into initAgent: agents ask Cat for auth state on init.

---

## Next Smoke Tests (priority order)

### 1. UI Smoke Test — 37 tests across /town/*
**Status:** Never run.
**Why it matters:** The full UI restructure (Inn → Tavern, GM Desk → GM Room, Kanban board) has no end-to-end verification. This is the highest-risk untested surface.
**Pre-conditions:** Needs an agent with auth state sharing working, OR run as the user manually.
**Key things to verify:**
- Navigation: no "Inn"/"Upstairs"/"GM Desk" links remain
- Tavern: adventurer list, chat (send + polling), chat UI busy indicator
- Quest Board: Kanban columns, stage dropdown, comment CRUD
- GM Room: review carousel with pass/fail badges, feedback ping, escalation triage + resolve
- All 37 WBS items from the deleted smoke-test-quest-2.md

### 2. createQuest in real flow
**Status:** Never passed. Bundle & Save test (round 1) saw agent reuse pre-existing quest.
**Why it matters:** Quest creation is a fundamental action. If untested, we don't know if new agents can bootstrap correctly.
**Test:** Dispatch to a fresh agent with no existing quests; task must create its own quest as step 1.

### 3. Feedback → iterate → resubmit loop with code changes
**Status:** Partially tested (camping research showed screenshot replacement working). Never tested with actual code modifications.
**Why it matters:** The core quality gate depends on Cat rejecting, agent writing real code fixes, and resubmitting with proof. Screenshots-only tests don't cover this.
**Test:** A task that produces a visible code change (UI tweak), Cat rejects for specific reason, agent edits code and replaces screenshots.

### 4. Closing stage — Cat → Asana
**Status:** Never verified end-to-end.
**Why it matters:** Closing is the final stage. If Cat can't write to Asana, quests pile up in closing forever.
**Test:** Move a real quest to closing, observe Cat's cron nudge handling, verify Asana task receives the summary comment.

### 5. Escalation end-to-end
**Status:** Never tested.
**Why it matters:** Escalation is the safety valve when agents are blocked. If it doesn't work, agents get stuck silently.
**Test:** Create a quest with a deliberate blocker; verify agent escalates with specific description; Guildmaster resolves; quest returns to execute; agent resumes.

---

## Test Run: Bundle & Save (2026-04-16)

**Agent:** Nexus Armor Dev (bc-49acdc4a) | **Cat:** bc-1a4bfbeb
**Task:** Vendor setup, product ingestion via GUI, storefront display, cart flow for Obatala Sciences products.

### What passed
- Agent uploaded 79 screenshots to Supabase Storage; all URLs in quest inventory
- Agent verified DB writes with SELECT before moving to purrview
- Cat reviewed all 79 items with per-item pass/fail and WBS-referencing notes
- GM desk carousel shows pass/fail badges on screenshots
- Vercel cron nudged both agents correctly
- Full execute → purrview → review flow completed autonomously

### What failed
- **createQuest not tested** — agent reused a pre-existing quest instead of creating one
- **Self-evaluation skipped** — agent went straight to purrview without self-review pass
- **Feedback → iterate loop not tested** — Cat approved on first pass (treated it as re-submission), bypassing the "must give feedback on first purrview" rule

### Recommended changes
| # | Change | Where |
|---|--------|-------|
| 1 | Add `purrview_count` to quests; Cat must reject if count == 1 | DB migration + questmaster skill book |
| 2 | Start next test from zero — no pre-made quests | Next test setup |
| 3 | Accept CDP scripting (DISPLAY=:1 Chrome via DevTools Protocol) as standard in CLAUDE.md | CLAUDE.md |
| 4 | GuildOS Supabase credentials must be provisioned during initAgent (every run hit this blocker) | housekeeping initAgent |
| 5 | Escalation fallback needed if agent can't write to quest_comments (no GuildOS DB access) | housekeeping escalate |

---

## Test Run: Camping Research / Yosemite (2026-04-16)

**Agent:** Neo | **Task:** Research Yosemite lodging options, produce screenshots of accommodation pages.

### What passed
- Agent created quest via `createQuest` — first time this worked end-to-end
- Cat provided feedback on first purrview submission (first-pass feedback rule worked)
- Agent replaced screenshots (not duplicated) after feedback — iteration loop worked
- 5 screenshots uploaded to Supabase Storage; all URLs in inventory
- Quest moved to purrview correctly with inventory verified via SELECT

### What is still pending (as of writing)
- Cat second review (steps 11–14 of checklist incomplete)
- Per-item feedback visible on GM desk carousel
- Final approval → review stage transition

### Key finding
The feedback → replace → resubmit loop works when the rule is enforced by Cat. The critical pattern: Cat rejects, agent replaces specific items (not appends), resubmits.

---

## Test Run: GuildOS UI (2026-04-15, partial)

**Agent:** Neo / Forge Keeper (mock run) | **Task:** End-to-end UI walkthrough.

### Context
Run as part of the initial refactor acceptance test, not a formal smoke test. Agent had difficulty with:
- Auth state: hit sign-in screens on all pages (no auth sharing wired)
- Build errors from uncommitted skill book modules (fixed in main)
- Agent didn't read the "Chrome on DISPLAY=:1" instructions proactively

### Full UI WBS (37 tests) was never executed
The structured test plan (Inn→Tavern rename, Kanban board, GM Room, all nav changes) has not been run. See "Next Smoke Tests → UI Smoke Test" above.

---

## System-wide Issues Found Across Tests

| Issue | Status | Fix |
|-------|--------|-----|
| Agents don't re-read instructions after nudge | Partially fixed (CLAUDE.md has "re-read on every nudge" rule) | Add to cron nudge message explicitly |
| Cat's DB writes fail silently | Fixed (service role key confirmed) | Monitor in future tests |
| Auth state not shared to cloud agents | Open | Wire auth_state weapon into initAgent |
| Agents pile on duplicate screenshots instead of replacing | Partially fixed (rule in submitForPurrview) | See questmaster skill book — enforce at review time too |
| Agents forget to git push | Rule in CLAUDE.md | Included in nudge message |

---

## Quest Board Review — Screenshot Audit (2026-04-16)

Guildmaster review of all active quests in review stage. Screenshots pulled directly from Supabase Storage and GitHub and inspected.

---

### Quest: Yosemite Camping Research — Memorial Day 2026
**Stage:** review | **Agent:** Neo Golden Finger | **Screenshots:** 5

**What they did well**
- 4 of 5 screenshots show real, working booking pages: Tenaya Lodge (SynXis booking engine), Scenic Wonders search results with filters, Booking.com Rush Creek Lodge amenities page, Redwoods in Yosemite cabin grid with prices and ratings.
- Screenshots are clear, full-page, and show actual content rather than placeholder states.
- The iteration loop worked — Cat rejected first submission, agent replaced screenshots and resubmitted. This is the system functioning correctly.

**What sucked**
- **One screenshot is a broken error page.** `rush-official-booking-v2.png` returns "INVALID REQUEST :(" — a dead booking URL. This should have been caught before submitting to purrview. The agent screenshotted a failure state and submitted it as a deliverable.
- **Wrong dates.** The task is specifically about Memorial Day 2026 (late May). The Tenaya screenshot shows April 16–17 dates in the booking calendar. The agent didn't set the target dates before screenshotting.
- **No availability data.** The deliverable spec implies finding cabin availability for Memorial Day. The screenshots show search pages and booking entry forms, not actual available cabin results for the specified dates. The agent proved it can navigate to these sites but not that it answered the research question.

**How to improve**
1. Before screenshotting any booking/search page, set the actual target dates (Memorial Day weekend: May 23–26, 2026) and run the search. Screenshot the results page, not the empty search form.
2. Self-check: any screenshot that is an error page or empty form should be retaken before submitting.
3. Quest deliverable spec should explicitly say "screenshot must show availability results for May 23–26, 2026" so the agent has a measurable target.

---

### Quest: Bundle & Save — E-commerce Smoke Test
**Stage:** review | **Agent:** Nexus Armor Dev | **Screenshots:** 79

**What they did well**
- Extremely thorough step-by-step coverage: crawl tab, vendor modal, HTML boundary config, ingest form, published product list, storefront, product detail, cart sidebar, checkout. Every WBS section is represented.
- Naming convention is excellent (`01-native-vendor-step06-saved-to-database.png`) — tells you exactly what each screenshot proves.
- The storefront screenshot shows a clean, functional-looking product catalog UI with 23 products, images, pricing, and vendor labels. Looks real and polished.
- Product detail page for ObaGel® shows correct name, SKU, price ($60.64), format variants, quantity input, Add To Cart button, and product images. Genuinely convincing.
- Cart sidebar correctly shows item, price, subtotal, and "Log in required" warning (expected behavior for unauthenticated session).
- Checkout page renders with full contact + shipping form and a correct order summary (item, shipping, tax, total).

**What sucked**
- **The ingest result screenshot doesn't show extracted product data.** Step 5 of ingest is supposed to show "sku, name, price, description, images extracted correctly." What the screenshot actually shows is the ingest form with stripped HTML in the right panel (24,101 chars of raw HTML) — not the structured extraction output. The WBS deliverable spec was not met for this step.
- **Yellow warning banner during ingest.** "Set up vendor global HTML in the Crawl tab first." appears on the ingest screen — the agent ran ingest before completing vendor HTML config in the correct order. It worked anyway, but this is a workflow violation that would confuse a real user.
- **Checkout has a persistent loading error.** "Loading user info... Attempt 2 of 2" appears in the contact section. The user info failed to load. The "1 Issue" badge is visible. This is a real bug that slipped through.
- **79 screenshots is too many.** The WBS asked for one screenshot per step — the agent captured 3–4 per product (step01, step02, step03, step04) for 5 products during crawl and ingest. That's ~40 nearly identical screenshots. Per the replace-not-pile-on rule, each deliverable item should have one representative screenshot.
- **createQuest was not tested** — agent reused a pre-existing quest. This is the core gap noted in the smoke test observations.

**How to improve**
1. Ingest result screenshots must show the AI's extracted output (the JSON/structured data with name, SKU, price, description fields visible) — not the raw HTML input.
2. Fix the checkout "Loading user info" bug before approving.
3. Cut screenshot count to one per WBS deliverable, not one per step per product.
4. Ensure vendor HTML is configured before running ingest so the workflow warning doesn't appear.

---

### Quest: Smoke Test GuildOS (Asana)
**Stage:** review | **Agent:** Forge Keeper | **Screenshots:** 25

**What they did well**
- Good breadth: covers Tavern, Town Map, Quest Board, GM Room, GM Desk, Proving Grounds, Town Square, Council Hall, World Map, Sign-in, and individual interactive elements (popup, quest detail, stage dropdown).
- Town Map screenshot is clean and shows all expected locations with descriptions.
- Quest Board shows the Kanban layout with correct stage columns (EXECUTING, ESCALATED, IN REVIEW, CLOSING, COMPLETE) and quests in the right places.
- The "Add Adventurer" popup screenshot correctly shows the "coming in a future update" message.
- Quest detail screenshot shows the full WBS description, stage badge, assignee, and inventory items rendered correctly.
- GM Desk screenshot (interactive-05) shows a real escalated quest with triage content visible.

**What sucked**
- **Critical: Raw GitHub URLs, not Supabase Storage.** All 25 screenshots are stored at `raw.githubusercontent.com/boster00/GuildOS/cursor/project-initialization-pending-86db/...`. This violates the storage rule (must be Supabase Storage public URLs). These will go dead when the branch is deleted. The `submitForPurrview` checklist was bypassed or ignored.
- **GM Room shows empty state.** `04-guildmaster-room.png` shows "No quests need your attention right now." There were active review quests at the time — this either means the page didn't load them, or the screenshot was taken at a bad moment. Either way it's a failing screenshot for that deliverable.
- **Chat panel screenshot fails.** `20-interactive-02-chat-panel.png` shows the Tavern with no chat panel open. The chat button was either not clicked or the panel didn't render. This deliverable is unverified.
- **All screenshots are zoomed out.** The browser appears to be at ~67% zoom. Text is hard to read, UI elements are tiny. Screenshots should be at 100% or captured via Playwright viewport at standard width.
- **Not the right branch.** Screenshots were taken from localhost but stored on a feature branch, not main. The UI state they show may not reflect main.

**How to improve**
1. All screenshots must go to Supabase Storage before submitting to purrview — no exceptions, no raw GitHub fallback.
2. Retake GM Room screenshot when at least one review quest is present. If the page shows empty, investigate why before submitting.
3. For interactive elements (chat panel, dropdown), take the screenshot after the element is open, not before clicking.
4. Set browser zoom to 100% or use Playwright at a fixed 1280px viewport for consistent, readable screenshots.

---

### Quest: BosterBio Website — Figma Fidelity & Product Catalog
**Stage:** review | **Agent:** BosterBio Website Dev | **Screenshots:** 60

**What they did well**
- The home page is genuinely impressive. Full nav bar, hero section with real copy ("Trusted Antibodies for Life Science Research"), stats (15,000+ products, 600+ citations, same-day ship), category grid, institution logos, resources section, and footer — all rendered and populated.
- Mobile responsiveness (375px) looks correct: stacked layout, proper nav collapse, readable type, category cards stacked vertically.
- Design guide page is a real deliverable — shows the brand color palette (orange #E45910, navy #001234), typography scale, button styles, form controls. This is useful and well-executed.
- Breadth: 60 screenshots covering ~40 distinct pages across products, services, resources, support, static pages, and responsive breakpoints (375, 968, 1200, 1400px).
- Strong naming convention (`page-1400-home.png`, `responsive-products-968.png`) makes navigation easy.

**What sucked**
- **Product detail page is a 404.** `product-detail-1400-M02830.png` shows "404 — This page could not be found." This is the most important page in a product catalog. A 404 on the product detail deliverable is a hard fail that should have blocked purrview submission.
- **Cart is a stub.** `page-1400-cart.png` says "Your cart is empty — When Medusa checkout is wired up, line items, quantities, and totals will appear here." The entire purchase flow is unimplemented and the agent screenshotted a placeholder as a deliverable. This should have been escalated, not submitted.
- **Only 5 products in catalog.** The products page shows 5 seed products. The migration target is 85,929. While this may be expected at this stage, the quest should have stated whether seed data is acceptable for this test, and the agent should have called this out explicitly rather than silently submitting it.
- **Two near-duplicate "about" and "contact" pages.** The inventory contains both `page-1400-about.png` and `page-1400-about-us.png`, and both `page-1400-contact.png` and `page-1400-contact-us.png`. These are duplicate routes that should have been flagged as a bug, not silently screenshotted twice.

**How to improve**
1. Any 404 or obvious stub ("when X is wired up...") must block purrview submission and trigger an escalation or code fix first.
2. Agent should explicitly note when catalog is seed-only and what the expected migration state is.
3. Duplicate route pairs (about/about-us, contact/contact-us, privacy/privacy-policy, terms/terms-of-service) should be flagged as a routing bug.
4. Product detail routing needs to be verified before submitting — navigate to at least one product and confirm it loads.
