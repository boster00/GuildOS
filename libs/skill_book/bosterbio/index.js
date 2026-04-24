/**
 * BosterBio skill book — knowledge registry for bosterbio.com2026 website migration.
 */

export const skillBook = {
  id: "bosterbio",
  title: "BosterBio.com2026 — Website Migration",
  description: "Execute BosterBio website tasks: product migration, storefront, launch prep, CMS content.",
  steps: [],
  toc: {
    migrateProducts: {
      description: "Migrate 85,929 products from Magento EAV to Medusa v2 hybrid schema.",
      howTo: `
**Hybrid schema model:**
- Type A (dedicated columns, search-critical): sku, title, handle, product_template, category, reactivity (text[]), applications (text[]), clone, host_species, badges, target_info (JSON), search_index
- Type B (flexible attributes): generic text columns attr_1...attr_25 + \`attribute_definitions\` table mapping (template, attr_key, label, type, display_order, required)

**Target info consolidation:** Merge gene/protein fields into single \`target_info\` JSON: gene_name, uniprot_id, synonyms, protein_function, gene_full_name, protein_name.

**Flexible attributes (Category 2, 14+ fields):** kit_components, cross_reactivity, reconstitution, predicted_reactivity, recommended_detection_systems, sensitivity, reproducibility, assay_range, sample_type, sequence_similarities, immunogen, purification, concentration, form, isotype, tissue_specificity, subcellular_localization, molecular_weight.

**Images:** Separate \`product_images\` table: product_id (FK), image_url, alt_text, ltx_description, position, type (hero/gallery/datasheet/swatch). Multiple products can reference same image.

**Data sources (ranked by preference):**
1. **Full product export CSV on the Magento server** — \`$MAGE_ROOT/pub/internal-export.csv\` (full path: \`/home/jetrails/bosterbio.com/html/pub/internal-export.csv\`). Auto-regenerated; ~412 MB, ~568k lines (far more lines than products — description HTML fields contain embedded newlines inside quoted strings). **100 columns.** Key ones: sku(1), status(2), name(3), url_key(4), product_category(5), gene_name(6), price(8), size_1..10 + price_for_size_1..10 (9-28), badges(29), ribbons(30), transfer_price(31), clonality(33), clone_number(34), concentration(35), conjugate(36), description(38), short_description(39), uniprot_id(41), host(42), immunogen(43), form(44), purification(45), storage(46), cross_reactivity(47), isotype(48), sensitivity(50), kit_components(51), sample_type(52), applications(54), reactivity(57), predicted_reactivity(58), images(59), image_labels(60), custom_options(62), meta_title(69), meta_keyword(70), meta_description(71), source_company(74), background(77), research_category(79), synonyms(80), gene_full_name(81), molecular_weight(82), protein_function(83), subcellular_localization(84), tissue_specificity(85), protein_name(86), recommended_detection_systems(87), sequence_similarities(88), **template(100)**. The \`template\` column holds the plan's slug values (antibodies | elisa-kits | proteins | over-expression-lysates | …) — map directly to products.product_template; do NOT derive from product_category. NOTE: the sibling file \`pub/export.csv\` (81 cols, 260MB) is an older/thinner variant without template or meta_* — prefer internal-export.csv. The file \`pub/niches.csv\` is an empty header stub; ignore. **None of these are publicly served** — access via SSH only (see \`connectSsh\`). Smoke-test pattern:
   \`\`\`bash
   ssh -p 2223 boster_ooP9u@69.27.32.101 "head -c 20000000 /home/jetrails/bosterbio.com/html/pub/internal-export.csv" > sample.csv
   \`\`\`
   Use byte-bounded head (\`-c\`) rather than line-bounded (\`-n\`), because HTML cells contain embedded newlines inside quoted strings — line count != product count. Parse the sample with a streaming CSV parser (csv-parse/stream) and stop after N product rows. Expect ~20MB ≈ 110 product rows in the ELISA-kit region of the file; for broader template coverage, pull more or seek past the first segment.
2. **Direct SQL on Magento DB** — SSH to the bosterbio.com production server (see \`connectSsh\`) and query MySQL (\`bosterbio_m2\` database). Use when you need data not in the CSV export (raw EAV rows, image blobs, custom tables).
3. **bosterbio.comLiveSite weapon (BAPI)** — only exposes gene actions today (readGenes, readGene, writeEnrichment). No product action yet; extend the BAPI PHP if you need live API-based product reads instead of a CSV snapshot.

**Migration flow:**
1. Extract products from the CSV export (or Magento EAV if CSV is missing fields)
2. Map dedicated fields (Type A)
3. Merge gene data into target_info JSON
4. Map flexible attrs to attr_1...N
5. Assign meanings via attribute_definitions table
6. Map images/LTX separately
7. Insert into Medusa
8. Validate per template

**Product options:** Use Medusa default model (115K options, 650K values). No custom consolidation.

**Dropped:** Magento system attributes, Yoast SEO, computed search weights, cost data, special pricing, related products system.

See \`docs/product-attributes-migration-plan.md\` for full schema details.
`,
    },
    buildStorefront: {
      description: "Build storefront pages (PLP, PDP, cart, checkout) following brand and Figma designs.",
      howTo: `
**Product listing page (PLP):**
- Filter by Type A attributes (category, reactivity, applications, clone, host_species)
- Preserve current URL format: \`/anti-xxx-antibody-xxxx.html\`

**Product detail page (PDP):**
- Scientific metadata, variant selection, image gallery, cart button
- Publications section (~20 entries per product, from publications table)
- Documents section (datasheets, etc.)

**Cart + Checkout:**
- Authorize.net payment (retain existing, not migrating to Stripe)
- Zoho Books = source of truth for tax

**Template system:** Template definitions drive rendering. Category must use Medusa category system (not collections).

**Brand:**
- Primary: deep blue #1a365d, Accent: warm orange #f97316
- Typography: Inter (next/font)
- Style: friendly, scientific, approachable
`,
    },
    validateFigma: {
      description: "Compare developed pages against Figma designs via screenshots.",
      howTo: `
**Process:**
1. Navigate to the developed page in Chrome
2. Take a viewport screenshot
3. Open the corresponding Figma design using the Figma weapon:
   \`\`\`javascript
   import { readExport } from '@/libs/weapon/figma';
   const png = await readExport({ fileKey, nodeId, format: 'png', scale: 2 });
   \`\`\`
4. Compare side-by-side: layout, colors, typography, spacing, component fidelity
5. Report differences with specific coordinates/elements

**Screenshot requirements:** Must provide screenshots for every page developed. Figma fidelity comparison is mandatory before marking work as complete.
`,
    },
    launchPrep: {
      description: "Handle SEO, DNS cutover, monitoring, and launch checklist.",
      howTo: `
**SEO:**
- Discard ALL Magento URL rewrites. Start clean with new routing.
- Generate XML sitemap
- Implement schema markups: Product, Organization
- NO bulk redirects — instead implement 404 monitoring system, surface high-frequency 404s, fix selectively

**GTM:** Migrate Google Tag Manager container. Validate all tags post-launch.

**Customers:** Migrate 2,352 accounts. Force password reset via email. Login requirement deferred.

**Orders:** Do NOT migrate historical orders. Zoho Books is system of record. Future: Medusa → Zoho (Phase 3).

**Images:** Migrate 171K product images from Magento server (via SSH) to CDN (R2/S3).

**Launch checklist:**
- [ ] All features tested (cart, checkout, payment, search, filters)
- [ ] No placeholder content; mobile responsive at all breakpoints
- [ ] Crawl all pages; eliminate dead/broken links
- [ ] Core Web Vitals audit
- [ ] Full backup; verify rollback procedure
- [ ] DNS cutover; re-submit sitemap; trigger reindexing
- [ ] Monitor 404s, indexing, performance for 2 weeks post-launch
`,
    },
    connectSsh: {
      description: "Connect to bosterbio.com production server via SSH, falling back through Carbon hop or Jetrails whitelist when IP-blocked.",
      howTo: `
**Primary:** \`ssh -p 2223 boster_ooP9u@69.27.32.101\`

**If blocked (connection timeout on port 2223):**

**Option 1 — Hop via Carbon:**
SSH into Carbon first, then SSH to boster from there:
\`\`\`bash
ssh carbon
ssh -p 2223 boster_ooP9u@69.27.32.101
\`\`\`
Carbon has a different outbound IP and may not be blocked.

**Option 2 — Request IP whitelist via Jetrails support:**
If Carbon also fails, get the current IP and send an email from boster@bosterbio.com to support@jetrails.com:
\`\`\`
Subject: SSH Whitelist Request — Add IP [current IP] for bosterbio.com
Body: Hi Jetrails support, please add IP address [current IP] to the SSH whitelist for bosterbio.com (port 2223, user boster_ooP9u). Thank you.
\`\`\`
Use the Gmail weapon with the boster@bosterbio.com account to send.
After sending, retry SSH in 20-minute intervals for up to 2 hours before escalating.

**Get current IP:** \`curl -s https://api.ipify.org\`
`,
    },
    migrateContent: {
      description: "Migrate CMS pages from Magento to Next.js.",
      howTo: `
**Inventory:** 755 total CMS pages from Magento.
- KEEP (migrate): 481 pages
- DROP: 7 pages (Magento system routes like no-route, enable-cookies)
- NEEDS REVIEW: 267 pages (inactive or short content — refine with Analytics/Search Console)

**URL prefix groups (by page count):** newsletter-archive (131), pathway-maps (85), protocol-and-troubleshooting (70), diseases (54), promotions (24), cell-types (23), FAQ (18), research-area (15), services/* (12+)

**URL placeholder convention:** Absolute bosterbio.com URLs in exports rewritten to \`https://SITE_ORIGIN_PLACEHOLDER\` for safe commits. Restore real origins when deploying.

**Strategy:** Migrate only high-traffic pages (per GA/BigQuery). Use template library system for CMS pages.

See \`docs/cms-html-template-guide.md\` and \`docs/cms-page-audit.md\` for full inventory.
`,
    },
  },
};
