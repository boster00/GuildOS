# BIC Salvage Audit

**Source:** `bic_articles` table in boster_nexus Supabase (live query, 2026-04-24)
**Repo:** `C:\Users\xsj70\boster_nexus`
**UI:** `app/(private)/bic/[[...slug]]/page.js` + `components/bic/`
**Migrations audited:**
- `019_migrate_wiki_content.sql` (legacy MDX wiki, 23 rows, generated 2025-12-23)
- `020_migrate_google_drive_bic.sql` (Google Drive docs, 28 rows)

> Note: 23 + 28 = 51 INSERTs in the migration files but the live table has **50 rows**. One slug must collide between the two migrations (the `ON CONFLICT (url) DO UPDATE` clause overwrites silently). Most likely candidate: a Marketing/Support template that exists in both sources.

---

## 1. Inventory (live)

| Metric | Count |
|---|---|
| Total articles | **50** |
| With placeholder content (`"to be migrated"` / `"to be populated"` / `"needs to be converted"`) | **24 (48%)** |
| Short stubs (<500 chars of HTML) | **36 (72%)** |
| Substantive articles (>=500 chars, no placeholder marker) | **14 (28%)** |
| Whitelist-only (`is_whitelist_only = true`) | **7** |

### Articles by category (live)

| # | Category | Notes |
|---|---|---|
| 7 | Paperwork | All stubs. All but two are placeholders pointing to source PDFs/DOCX never extracted. |
| 6 | Marketing | Five "ABC AI" landing/satellite/keyword stubs + 1 conference template stub. All placeholders. |
| 6 | Orders, Shipping & Warehousing | All stubs (5 short, 1 borderline). Real ops knowledge but content is one paragraph each. |
| 5 | Support | All five email-template stubs, all placeholders. |
| 4 | Legal | Four contract-template stubs, all placeholders. |
| 4 | Marketing & Email | Mix: 3 substantive (Add Mailbox to Zoho, Email Deliverability Glossary, Newsletter How-To) + 1 stub. |
| 3 | Governance & Contacts | All substantive: internal POCs, secrets-and-access policy, SMART workflow. |
| 3 | Services | 1 substantive (Resources/Templates checklist), 2 stubs. |
| 2 | Customer Support | Support Workflow (substantive) + DZ Antibody Response (placeholder). |
| 2 | IT | Two web-dev roadmap stubs (placeholders). |
| 2 | Overview | "Boster Info Center" (substantive index page) + "Main Doc" placeholder duplicate. |
| 2 | Product Management | Both stubs / placeholders. |
| 2 | Project Management System | Both substantive: Pipeline System + Pipeline Instructions. |
| 2 | Website & Internal Tools | "Browser Shortcuts" placeholder + "Linked Tutorials" 177-char stub. |

### Source breakdown (from migration files)

- **Wiki MDX migration (019):** 23 articles. These are the "real" wiki — actual converted markdown with paragraphs, lists, internal `<a href="/wiki/...">` cross-links. Contains every substantive article in the table (governance/, project-management/, marketing/{add-mailbox, email-deliverability, newsletter}, ops/orders-processing, services/{resources, service-timeline, service-faqs}, customer-support/support-workflow, overview/boster-info-center).
- **Google Drive migration (020):** 28 articles. These are placeholder shells generated from Google Drive filenames — every one says some variant of "Content to be migrated from source document. **Source:** [filename.docx]. **Note:** This document needs to be converted from .docx and content extracted." Categories: Paperwork, Legal, Support templates, Marketing ABC-AI, Product Management, IT/web-dev. **No actual document content was extracted** — only filenames + URLs to the source Google Doc.

### Whitelist-only articles (all 7 in Paperwork)

All seven `is_whitelist_only` articles are **shells**:

- `paperwork/bank-info-chase` — 362 chars, points to Chase bank docs.
- `paperwork/boster-w9-2025` — 320 chars, points to `Boster_W9_20251104.pdf`.
- `paperwork/ca-registration` — 330 chars, points to CA registration doc.
- `paperwork/info-security-policies` — 396 chars, placeholder.
- `paperwork/iso27001-boster-bio` — 410 chars, placeholder.
- `paperwork/iso9001-certificate-2025` — 367 chars, points to ISO 9001 cert.
- `paperwork/seller-permit` — 347 chars, points to CA seller permit.

The whitelist flag is applied correctly in principle, but **none of these contain the actual sensitive content** — they're just file pointers. RLS protects empty rows.

---

## 2. Triage buckets

### KEEP (12 articles, ~24% of pile)

The substantive core, all from the wiki MDX migration. These have real content and reflect Boster's actual operations:

**Governance / contacts (3):**
- `governance/internal-pocs` — sales/marketing/product/orders/IT contact emails. Useful directory.
- `governance/secrets-and-access` — policy stating secrets live elsewhere; pointer to Login Credentials Doc.
- `governance/smart-workflow` — workflow description.

**Project management (2):**
- `project-management/pipeline-instructions` — actual content on pipeline usage.
- `project-management/pipeline-system` — pipeline system description.

**Customer support / support workflow (1):**
- `customer-support/support-workflow` — General Support Principles, Order Status Workflow, Lead Times, Product Recommendations. The most substantive single article (2,359 chars).

**Marketing & email (3):**
- `marketing/add-mailbox-to-zoho` — Zoho mailbox provisioning steps.
- `marketing/email-deliverability-glossary` — DKIM/SPF/DMARC etc.
- `marketing/newsletter-how-to` — Zoho CRM + Campaigns workflow.

**Services / overview (3):**
- `services/resources-and-templates` — checklist of service-launch assets (NDA, pitch deck, inquiry form, video, SOW, decision guide). Useful template even if links are stubbed.
- `services/service-timeline` — 542 chars, real content.
- `overview/boster-info-center` — landing/index page that references the rest of the wiki. Keep as the BIC homepage.

### REWRITE (12 articles, ~24% of pile)

Real topics that the team actually does, but content is so thin it's effectively a heading. Worth fleshing out one round at a time:

**Ops (all 6 in this category):** `ops/bogo-sku-processing`, `ops/delay-shipments-and-replacements`, `ops/freezer-monitoring`, `ops/orders-processing` (only 568 chars), `ops/shipping-arrangements`, `ops/transfer-orders` (just 124 chars — one paragraph). These are core warehouse/fulfillment SOPs and the topics are correct; the content needs to be authored from interviews with Nikki/Lin.

**Paperwork that the company genuinely needs to share internally (4):**
- `paperwork/bank-info-chase` — keep as a whitelist article, but actually paste the wire/ACH details (or a link to the Login Credentials Doc).
- `paperwork/boster-w9-2025` — embed the W9 PDF or link to source-of-truth.
- `paperwork/ca-registration` + `paperwork/seller-permit` — real legal status references; embed cert numbers + expiration dates.

**Other (2):**
- `it/browser-shortcuts` — placeholder shell of what looks like a real tutorial topic; either flesh out or discard.
- `it/linked-tutorials` — 177-char "[List of Loom tutorial links with descriptions]"; promising idea, content missing.

### DISCARD (26 articles, ~52% of pile)

Effectively all of the Google Drive migration that wasn't promoted to Rewrite. These are filename-pointers with no extracted content; recreating them in BIC duplicates effort and clutters navigation. Better to delete and re-add only when someone has a real reason to surface a document inside BIC.

**Marketing ABC-AI (5)** — `marketing/abc-ai/animal-model-landing`, `animal-model-satellite`, `antibody-discovery-satellite`, `general-tox-keywords`, `general-tox-landing`. Marketing content briefs that belong in a marketing brief tool, not a wiki.

**Support email templates (5)** — `support/templates/antibody-testing-program`, `dz-antibody-emails`, `free-samples`, `paperwork-request`, `product-performance-support`. Email templates belong in a CRM template library (Zoho Campaigns / Zoho Desk macros), not a wiki — the wiki copy will drift.

**Legal contract templates (4)** — `legal/contract-templates/distributor-authorization-letter-2024`, `oem-partner-terms-2024`, `pdp-premium-distributor-agreement`, `pdp-premium-distributor-kvalitex`. Contract templates belong in a contract management system or shared Google Drive folder under access control. Embedding stubs here adds nothing.

**Product management (2)** — `product-management/product-review-guidelines`, `product-management/sop-bad-stock`. Both placeholders.

**Other duplicates / placeholders (5):**
- `overview/boster-info-center-main-doc` — duplicates `overview/boster-info-center`.
- `customer-support/dz-antibody-response` — placeholder; partially redundant with the deeper `customer-support/support-workflow`.
- `paperwork/info-security-policies`, `paperwork/iso27001-boster-bio`, `paperwork/iso9001-certificate-2025` — three overlapping ISO/security shells. Pick one canonical "Compliance & certifications" article in Rewrite or link to source-of-truth.
- `it/web-dev-master-contents` + `it/web-dev-master-roadmap` — engineering-roadmap shells; that material belongs in GitHub / project plans, not BIC.
- `marketing/marketing-resources` — 390-char shell of generic links.
- `marketing/templates/neuro-conference-email` — single conference email template, belongs in CRM.
- `services/faqs` — 118-char placeholder.

---

## 3. Migration / restructuring candidates

1. **Email & contract templates → CRM/contract system, not BIC.** All 5 support email-template stubs and 4 legal contract-template stubs should leave BIC and live in their authoritative tools (Zoho Desk macros / Zoho Sign templates / a Drive contracts folder). Wikis shouldn't be the canonical source for templates that already have a system of record — drift is guaranteed.

2. **`governance/internal-pocs` → adventurer-routing reference.** This contact-routing list (sales = CJ & Tracy, product = Sandy, orders = Nikki & Lin, etc.) is exactly the kind of mapping the Questmaster needs when deciding who to escalate a quest to. Worth porting into the `housekeeping` or `questmaster` skill book as a structured contact map (or referenced from there) rather than just an HTML article.

3. **`customer-support/support-workflow` + `ops/*` SOPs → adventurer skill book candidates.** Once fleshed out, the order-status / delay-shipment / replacement / freezer-monitoring procedures are the kind of stable, well-defined behaviors that fit the "stable, reliable" Cursor-dispatch criterion in CLAUDE.md. They could each become a `support` or `fulfillment` skill book whose actions are callable by an adventurer agent rather than read by a human via BIC.

(Side note: nothing in the current pile looks like *customer-facing* content suitable for porting to bosterbio.com2026 — this is all internal ops.)

---

## 4. Content gaps

Given Boster's actual operations (life-science antibody/reagent manufacturer + service provider with US + EU presence), the BIC pile is thin in several expected areas:

- **Manufacturing / QC.** Zero articles on lot release, QC pass criteria, lab equipment SOPs, reagent storage, batch records. Boster makes products; there's no manufacturing knowledge in BIC.
- **Regulatory beyond paperwork stubs.** ISO 27001 / 9001 / W9 / seller permit are listed as files but no live article on regulatory posture (FDA RUO labeling, IVD positioning, EU GDPR for site/CRM, animal-research ethics for the animal-model service). The "Information Security Policies" article is a placeholder.
- **HR / people ops.** Nothing — no onboarding, payroll, time-off policy, contractor agreements, equipment provisioning.
- **Finance / accounting.** Nothing on invoicing, payment terms, refund/credit policy, currency handling for EU customers, Zoho Books month-end close. (`paperwork/bank-info-chase` is the only finance-adjacent entry, and it's a 362-char shell.)
- **IT/security operational.** "Web Dev Master" stubs hint at it but no real content. No password manager policy, no offboarding checklist, no incident response (despite the ISO 27001 mention).
- **Sales playbook.** `governance/internal-pocs` lists sales contacts but no qualification criteria, deal-stage definitions, discount authority, RFQ workflow, or quote SLA.
- **Distributor / partner relations.** Four legal stubs but no operational distributor playbook (onboarding, MOQ, exclusivity rules, marketing co-op, CRM tagging).
- **EU-specific operations.** Boster has EU lead times referenced in `support-workflow` but no EU-specific shipping, VAT, or GDPR content.

The wiki's strongest area (Marketing & Email — Zoho Campaigns, deliverability, newsletter how-to) reflects who actually wrote articles, not what the team most needs documented. A useful next pass would author 1-2 articles per gap above, prioritizing manufacturing/QC and finance, since those tie directly to current revenue ops.

---

## 5. Recommended actions

1. **Delete the 26 Discard rows.** They add navigation noise and false signals of coverage. A `DELETE FROM bic_articles WHERE url IN (...)` migration handles it in one shot.
2. **Pick 3 Rewrite articles for a first authoring pass** — suggest: `ops/orders-processing` (highest-traffic real workflow), `governance/secrets-and-access` (already substantive, just needs the actual link to the credentials doc verified), and one Paperwork article that becomes the canonical "Compliance & certifications" page consolidating the three ISO/W9 shells.
3. **Promote `governance/internal-pocs` to a skill-book reference** so adventurer agents can resolve "who owns X" without scraping HTML.
4. **Move email/contract templates out of BIC** to their systems of record, leaving at most a single index article in BIC pointing at where templates live.
5. **Backlog the gap list (manufacturing, finance, HR, regulatory)** as named empty article slots with assigned owners — better than the current pattern of importing shells with no owner.
