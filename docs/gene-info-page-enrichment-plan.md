# Gene Info Page Enrichment — Smoke Test Plan

## Priority Checklist (previously failed — must pass this time)

- [ ] 1. Agent creates quest via createQuest action (not reusing old quests)
- [ ] 2. Cat provides feedback on first purrview submission (per-item, not rubber-stamp)
- [ ] 3. Agent works on feedback, replaces screenshots, resubmits to purrview
- [ ] 4. Agent asks Cat for credentials when needed (not escalating to GM directly)

## Standard Checklist

- [ ] 5. Chat msg received by agent
- [ ] 6. Agent msg showing it started working
- [ ] 7. Quest created in execute stage
- [ ] 8. Agent makes changes to repo
- [ ] 9. Quest has screenshots in inventory (Supabase Storage URLs)
- [ ] 10. Agent moves quest to purrview with inventory verified via SELECT
- [ ] 11. Cat reviews ALL inventory items with per-item pass/fail + notes
- [ ] 12. Cat's per-item feedback visible on GM desk carousel
- [ ] 13. After iteration loop, Cat approves → quest to review
- [ ] 14. Quest on GM desk for user review

---

## Goal

Establish an auto-running pipeline that enriches gene-info pages on bosterbio.com. Smoke test with the first 5 genes.

## Context

(to be filled — need details on:)
- Where do gene-info pages live currently? (Magento CMS? static pages? database?)
- What does "enrichment" mean? (AI-generated content? data from external APIs? formatting?)
- What is the target output? (updated HTML pages? database records? markdown?)
- Which 5 genes to test with?
- What does "auto-running pipeline" look like? (cron? triggered by event? manual kick-off?)
- Which agent should own this? (BosterBio Website Dev? Nexus Armor Dev? New agent?)
- Which repo does this live in? (bosterbio.com2026? boster_nexus? new repo?)

## WBS

(to be defined after context is filled)

## Deliverables

(to be defined)

## Reporting Target

Asana task: (to be assigned)
