# Bundle & Save — Smoke Test Plan

## Questions for User

| # | Question |
|---|----------|
| 1 | What port does the boster_nexus dev server run on? (3000? 3001?) |
| 2 | Does the Nexus Armor Dev agent have boster_nexus Supabase credentials in its environment? |
| 3 | The storefront embed is designed for iframe. For testing, should the agent use the internal storefront at /nexus-armor/bundle-save or the embed at /embed/bundle-save? |

---

Asana task: 1214051919668596 (Bundle & Save master task)
Agent: Nexus Armor Dev (bc-49acdc4a)
Quality bar: 9+/10 (project-specific, in quest description)
Iteration limit: 20 review cycles before escalation

## Test Products (from obatalasciences.com)

| # | Product | URL |
|---|---------|-----|
| 1 | ObaCell® ASC Fat-on-a-Chip Kit | https://obatalasciences.com/obacell-asc-fatonachip-kit |
| 2 | ObaGel® | https://obatalasciences.com/obagel |
| 3 | Human Adipose-Derived Stem Cells | https://obatalasciences.com/human-adiposederived-stem-cells |
| 4 | AdipoQual™ | https://obatalasciences.com/adipoqual |
| 5 | ObaCell® SVF Fat-on-a-Chip Kit | https://obatalasciences.com/obacell-svf-fatonachip-kit |

## WBS

### 1. Vendor Setup
1.1 Create vendor profile for obatalasciences.com in the admin UI
1.2 Configure global HTML stripping if needed
**Deliverable:** Screenshot of vendor profile page showing domain, config

### 2. Product Ingestion
2.1 Use the crawl tab to fetch each of the 5 product URLs above
2.2 Use the ingest function to extract product data via AI
2.3 Review ingested products — verify sku, name, price, description, images extracted correctly
2.4 Publish all 5 products (set status from draft to published)
**Deliverable:** Screenshot of admin product list showing 5 published Obatala products with correct data

### 3. Storefront — Product Display
3.1 Navigate to the public storefront (embed or internal)
3.2 Verify all 5 products appear in the product listing
3.3 Search for "ObaCell" — verify search returns relevant products
3.4 Click one product — verify detail page shows correct info (name, price, description, images)
**Deliverable:** Screenshot of storefront listing with 5 products, screenshot of search results, screenshot of product detail page

### 4. Vendor Profile Page
4.1 Navigate to vendor/partner page for Obatala Sciences
4.2 Verify it shows vendor info and their product listing
**Deliverable:** Screenshot of vendor page with products

### 5. Cart Flow
5.1 Add a product to cart from the storefront
5.2 View cart — verify item appears with correct name, price, quantity
5.3 Navigate to checkout page — verify form renders (DO NOT submit checkout)
**Deliverable:** Screenshot of cart with item, screenshot of checkout page (unfilled)

## Success Criteria

Each deliverable screenshot must show:
- Real product data from Obatala Sciences (not placeholder/test data)
- Working UI (not error pages, not login screens, not blank pages)
- The specific content described in the deliverable spec

Quality bar: 9+/10 fidelity. The Questmaster (Cat) will review each screenshot and judge if it proves the deliverable. If Cat is not 90%+ satisfied, it will send feedback and the agent iterates.

## Reporting Target

Asana task: Bundle & Save master task (1214051919668596)
On closing, update the Asana task description with a summary of what was tested and the current status.
