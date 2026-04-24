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
1. **Full product export CSV** — \`https://www.bosterbio.com/pub/export-internal.csv\` contains the complete product export straight from Magento. For any smoke test, fetch the first N+1 rows (first row is the header). Example for 100 products: \`curl -s https://www.bosterbio.com/pub/export-internal.csv | head -n 101\`. This is the fastest path and avoids SSH/DB round-trips.
2. **Direct SQL on Magento DB** — SSH to the bosterbio.com production server (see \`connectSsh\` action) and query MySQL (\`bosterbio_m2\` database) directly. Use when you need data not in the CSV export (e.g. raw EAV rows, image blobs, custom tables).
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
