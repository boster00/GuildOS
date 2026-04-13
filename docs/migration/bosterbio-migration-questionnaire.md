# BosterBio.com Migration Questionnaire

*Questions to answer before migrating the live site to bosterbio.com2026.*

---

## 1. SCOPE & TIMELINE

- [ ] What is the target launch date for the new site?
- [ ] Will this be a hard cutover (old site goes down, new site goes up) or a gradual migration (run both in parallel)?
- [ ] Are there any business events (trade shows, campaigns, product launches) we need to avoid during migration?
- [ ] Who are the stakeholders that need to sign off before go-live?

## 2. E-COMMERCE PLATFORM

- [x] Confirm: is the new backend **Medusa** (already scaffolded in the repo) or are we considering **direct Supabase/PostgreSQL** without Medusa?
  > **Medusa confirmed.** Roadmap assumes standard e-commerce backend; repo already scaffolded with Medusa v2.
- [x] Do we need a shopping cart and checkout on the new site, or will ordering continue through a separate system (Zoho Books, phone, email)?
  > **Yes — full cart + checkout on the new site.** Roadmap lists "Online payment" as a required feature.
- [ ] What payment processors are currently used? (Stripe, PayPal, PO/invoicing?)
- [ ] Will the new site handle tax calculation, or does Zoho Books handle that?

## 3. PRODUCTS (85,929 in Magento)

- [ ] Are all 85K products active, or how many are discontinued/disabled? What should we migrate?
- [x] The Magento EAV has ~150 attributes. I've proposed ~25 direct columns + JSONB `attrs` bag. Review the schema in our discussion — any attributes that MUST be filterable that I missed?
  > **Product attributes already created in Magento** (marked DONE in roadmap). Schema proposal (~25 columns + JSONB) is the migration path for these existing attributes.
- [ ] Product options (sizes, conjugates) — there are 115K options with 650K values. Are these all still valid, or can we consolidate?
- [ ] Product images — 171K media gallery entries. Where are the actual image files stored? (Magento `pub/media/` on the server, or a CDN?)
- [ ] Are there product bundles or configurable products, or is everything simple products with options?

## 4. CUSTOMERS (2,352 in Magento)

- [ ] Do customers need to log in to the new site? Or is it browse-only with quoting?
- [ ] Should we migrate customer accounts, or start fresh and let them re-register?
- [ ] Are customer passwords recoverable from Magento, or will everyone need password resets?
- [ ] Is there customer-specific pricing (contract pricing, institutional discounts)?

## 5. ORDERS (4,633 in Magento)

- [ ] Do we need to migrate historical orders for customer order history, or is Zoho Books the system of record for orders?
- [ ] Will the new site process orders directly, or will it generate quotes that convert to Zoho Books orders?
- [ ] What is the current order flow? (Website cart → Magento order → Zoho Books invoice → warehouse fulfillment?)

## 6. CONTENT (749 CMS pages, 33 blocks)

- [ ] Are all 749 CMS pages still relevant? Many may be outdated landing pages, promotions, etc.
- [ ] Which CMS pages are high-traffic / high-SEO-value and must be preserved exactly?
- [x] Will content be managed in the codebase (MDX/JSX) or do we need a CMS (like Sanity, Contentful, or Supabase-based)?
  > **Template library system.** Roadmap specifies an interactive template library for creating/editing pages, with tutorials for the team. This implies a CMS-like system (not raw MDX in the codebase).
- [ ] Are there any legal pages (privacy policy, terms) that need legal review before republishing?

## 7. PUBLICATIONS (52,403)

- [ ] Are publications (citations) displayed on product pages? How important is this feature?
- [ ] Is BizGenius still providing citation data, or has that been brought in-house?
- [ ] Should the new site have a searchable citation library?

## 8. GENES (44,816)

- [ ] What are the gene info card pages used for? Are they auto-generated landing pages for SEO?
- [ ] Should these be migrated as-is, regenerated with AI enrichment, or redesigned?
- [ ] Are gene pages linked to from product pages (product → gene target)?

## 9. SEO & URL PRESERVATION

- [ ] There are 198K URL rewrites in Magento. We need to preserve URLs for SEO.
- [ ] What is the current URL structure? (e.g., `/anti-egfr-antibody-a00001-2.html` → what should it become?)
- [ ] Will we set up 301 redirects for ALL old URLs, or only high-traffic ones?
- [x] Is the current domain `bosterbio.com` staying, or is there a new domain?
  > **Domain stays `bosterbio.com`.** Roadmap references same domain throughout.
- [ ] Google Search Console / Analytics — who has access? Need to verify indexing after migration.

## 10. INTEGRATIONS

- [x] **Forms integration** — confirmed as a required feature in roadmap.
- [ ] **Zoho Books** — currently integrated for invoicing/inventory. Will the new site connect to Zoho Books API?
- [ ] **Zoho CRM** — currently has contacts/leads. Should the new site push form submissions to CRM?
- [ ] **Google Ads** — current conversion tracking setup. Needs to be preserved on new site.
- [ ] **Google Merchant Center** — product feed needs to continue working.
- [ ] **BizGenius ChatGenius** — is the AI chatbot staying on the new site?
- [ ] **Opensend** — is the SDK being installed on the new site?
- [ ] **Smartlead / Instantly** — do these need any website integration (tracking pixels, webhooks)?
- [ ] **Any other integrations** we need to preserve? (HubSpot, Mailchimp, live chat, etc.)

## 11. INFRASTRUCTURE

- [x] Where will the new site be hosted? (Vercel, AWS, self-hosted, Jetrails?)
  > **JetRails for staging** (confirmed — roadmap references JetRails dev environment). Production hosting TBD (Vercel likely for Next.js).
- [ ] Current Magento server (c100h.bosterbio.com) — what happens to it after migration? Keep for API access? Decommission?
- [ ] Database: local PostgreSQL → Supabase (production). Confirm this path.
- [ ] CDN for images: use Supabase Storage, Cloudflare R2, or S3?
- [ ] SSL certificate — current provider? Will Vercel/hosting handle this?

## 12. DESIGN & UX

- [x] The Cursor agent built the frontend to 9/10 brand fidelity. Any specific pages or sections you want redesigned before launch?
  > **Design source is the Figma Master File.** Roadmap confirms pages to develop: homepage, product detail, product listing, nav menu, footer, search, template library. All designs live in Figma (`NMfOvoGgMVFPYM4nLtN8zD`).
- [x] Mobile experience — any specific requirements beyond responsive design?
  > **Roadmap includes "Check mobile friendliness"** as a pre-launch QC step. Figma has breakpoints at 375, 768, 1200, 1440, 1920px.
- [ ] Accessibility requirements (WCAG compliance level)?
- [ ] Multi-language support needed? (Chinese site?)

## 13. TESTING & LAUNCH

- [ ] Who will do UAT (user acceptance testing) before launch?
- [x] Do we need a staging environment? (stage.bosterbio.com already exists on Jetrails)
  > **Yes — staging on JetRails confirmed.** Roadmap references staging environment and communicating with JetRails.
- [x] Rollback plan — if the new site has critical issues, can we switch back to Magento?
  > **Yes.** Roadmap explicitly states: "Make a backup of the site, be ready to revert back to old site quickly if something goes wrong."
- [ ] Post-launch monitoring — who watches for issues in the first 48 hours?

---

---

## RESOLVED ITEMS SUMMARY (from Web Dev Master Roadmap)

**Source:** `Web Dev Master Roadmap--Bosterbio.com.txt` (Asana task 1214025303063053)

The roadmap confirms these features are in scope:
- Custom product search, mega menu, forms integration, online payment
- Site speed optimization, schema markups, sitemaps
- Product import (products, categories, customers, orders, invoices)
- Template library system for page creation + team tutorials
- Pre-launch QC: feature testing, typo check, mobile testing, link crawl, SEO audit
- Rollback plan with site backup before cutover

**Development phases from roadmap:**
1. Design theme + develop demo pages (homepage ~16h, product detail ~20h, footer ~6h)
2. Develop all pages, features, product templates, import all data
3. Content development using template library
4. Tutorials for team training
5. Pre-launch QC (features, mobile, links, SEO audit, backup)
6. Post-launch (crawl, speed, 2-week monitoring, SEO plan)

**10 of 13 sections still have open questions.** Resolved: 10 items checked across sections 2, 3, 6, 9, 10, 11, 12, 13.

---

*Fill in answers directly in this file or discuss in the Asana task. Each checked box = decision made.*
