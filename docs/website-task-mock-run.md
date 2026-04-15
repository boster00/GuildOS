# Mock Run: BosterBio Website Dev Quest

Simulating user-to-agent conversation for Asana task 1214025303063053:
"Develop the website on cloud cursor"

---

## Phase 1: User initiates chat

**User:**
> I need you to work on the BosterBio website. Here's the task:
> Figma: https://www.figma.com/design/NMfOvoGgMVFPYM4nLtN8zD/Boster-Design-Master-File
> Goals: (1) Every Figma page at 9+/10 fidelity, (2) responsive at 968/1200/1400/mobile, (3) 5 antibody products searchable in catalog via Medusa.
> Priority: high

**Agent:**
> Let me review the Figma file and repo state, then present a plan.

**[COMMENT: Agent should run initAgent if not initialized. Should read system_prompt which points to docs/migration-plan.md.]**
**[ISSUE 1: Agent must read Figma BEFORE planning, not after. It needs to know what pages exist to create an accurate WBS.]**

**Agent reads Figma (readFile), enumerates pages, reviews repo. Then presents:**

> **WBS Plan:**
> 1. Audit & Gap Analysis
>    1.1 Compare Figma pages vs existing code
>    1.2 REPORT: Comment listing all pages with status
> 2. Page Conversion — Batch 1 (Homepage, About, Contact)
>    2.1 Convert/refine to 9+/10 Figma fidelity
>    2.2 REPORT: Screenshots at 1400px + Figma comparison
> 3. Page Conversion — Batch 2 (Services x4, Resources)
>    3.1 Convert/refine
>    3.2 REPORT: Screenshots of all 5
> 4. Product Catalog + Detail
>    4.1 Select 5 antibodies, set up Medusa, build catalog + detail page
>    4.2 REPORT: Screenshots of catalog + 1 detail page
> 5. Responsive Design Pass
>    5.1 Test all pages at 4 breakpoints, fix issues
>    5.2 REPORT: 3 pages at all 4 breakpoints
> 6. Design Guide
>    6.1 Document design system
>    6.2 REPORT: Screenshot
>
> Reporting target: Asana task 1214025303063053
> Priority: High
>
> Pre-exec checklist: deliverables ✓, Asana target ✓, priority ✓
> Shall I create this quest and start working?

**[COMMENT: Pre-exec checklist works. Agent verified all 3 items.]**

**User:** Yes, go ahead.

---

## Phase 2: Agent works, hits Figma image issue

Agent creates quest in execute stage, starts working.

**Agent (milestone comment):**
> Phase 1 complete. 10 Figma pages identified. All exist in codebase but need refinement.

During Phase 2, agent tries to export hero image from Figma — gets permission error.

**Agent → Cat (seekHelp):**
> I am BosterBio Website Dev, working on quest "BosterBio Website — Figma Conversion" (id: xxx). I need help: Figma readExport returns permission error on hero image.

**Cat:** Do you have everything you need to proceed?

**Agent:** I can use a placeholder and continue. Hero image is the only blocker.

**Cat:** Then proceed with the placeholder. Note it in comments for later resolution.

**[COMMENT: Correct flow. Agent didn't formally escalate because workaround exists. Cat correctly tells it to continue.]**
**[ISSUE 2: Global instructions should clarify: "Escalate (move stage) only when truly blocked. If workaround exists, note in comments and continue."]**

---

## Phase 3: Agent seeks Questmaster review

**Agent → Cat (seekHelp):**
> All 6 phases complete. 10 pages converted, responsive at all breakpoints, 5 products in catalog. Please review. Screenshots:
> - homepage: https://storage.../homepage.png
> - catalog: https://storage.../catalog.png
> - detail: https://storage.../detail.png
> (... all URLs listed)

**[ISSUE 3: seekHelp howTo doesn't instruct the agent to include screenshot URLs in the review request. Without URLs, Cat can't evaluate. Must update seekHelp to say: "When seeking review, include all deliverable URLs in your message."]**

**Cat reviews (sees screenshots via URLs):**
> 85% satisfied. Issues:
> 1. Mobile nav overlaps logo at 375px
> 2. Product detail missing "Related Products" section from Figma
> Fix and resubmit.

**[COMMENT: Cat enforces 90% bar correctly. Found real issues.]**
**[ISSUE 4: Can Cat actually view images from URLs? Cursor agents can — they fetch and render images. But this should be tested in practice.]**

Agent fixes, resubmits. Cat approves at 92%. Moves quest to review.

---

## Phase 4: User review + Closing

User sees quest on GM desk with screenshot carousel. Reviews. Clicks "Mark done" → closing.

Cron notifies Cat of closing quest. Cat reads quest, writes summary to Asana task 1214025303063053:

> "Website development complete. 10 pages converted from Figma at 9+/10 fidelity. Responsive at 4 breakpoints. 5 antibody products in catalog. Design guide documented. Known: hero image uses placeholder. Screenshots in GuildOS quest inventory."

Quest → complete. Done.

---

## Issues Summary

### Must fix before real run

| # | Issue | Where to fix |
|---|-------|-------------|
| 1 | Agent must read external resources (Figma) BEFORE presenting plan | Global instructions: add rule |
| 2 | "Escalate vs workaround" not clarified | Global instructions: "Escalate only when truly blocked. If workaround exists, note in comments and continue." |
| 3 | seekHelp for review must include deliverable URLs | housekeeping.seekHelp howTo: "When seeking review, include all screenshot/deliverable URLs" |
| 4 | Figma URL → fileKey parsing undocumented | Global or bosterbio skill book: "fileKey = segment after /design/ or /file/ in Figma URL" |

### Should fix (not blocking)

| # | Issue | Notes |
|---|-------|-------|
| 5 | 40+ screenshots in desk carousel overwhelming | Group by phase. UI improvement, defer. |
| 6 | initAgent trigger for first chat | Agent should self-init when lacking context. Add to global. |
| 7 | Cat reviewing screenshots — verify capability | Test: send Cat a message with image URLs, confirm it can evaluate them. |
