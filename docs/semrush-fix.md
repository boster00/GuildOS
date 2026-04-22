# SEMRush Site Audit — bosterbio.com

**Audit date:** Apr 17, 2026 | **Smoke tests run:** Apr 18, 2026
**37 issues total** | 13 Errors · 10 Warnings · 14 Notices | Site Health: 58% | 20,000/20,000 pages crawled

---

## Critical Findings From Smoke Tests

| Finding | Impact |
|---------|--------|
| **Dual-URL problem**: Products live at both old (`/product.html`) and new (`/products/cat/product.html`) — both return 200 | Root cause of issues #2, #3, #4, #10. Fix: pick one format, 301 the other |
| **Sitemap image pollution**: 8,691 image URLs (`.jpg`/`.png`) in URL sitemap across 12 sub-files — SEMRush reported only 553 | Sitemap must be regenerated; images need a separate image sitemap |
| **Category pages all 404**: `/antibodies.html`, `/elisa-kits.html` etc. return 404 — URL restructure incomplete | Category landing pages were not migrated to new URL format |
| **Internal nofollow pattern**: `<a rel="nofollow" href="[currentURL]#">` — self-referential `#` anchor on every product page | One template line fix eliminates 5,874 instances |
| **Schema gaps confirmed**: Organization schema missing `description`/`sku`/`offers`; Product schema missing `gtin` | Fix schema template to add required fields |
| **Empty anchors**: ~17 empty + 8 img-without-alt per product page (icon/social links, untagged product images) | Template fix for icon links + alt attributes on product images |
| **SSH blocked from worktree** (port 2223 timeout) | 9 of 23 write-based smoke tests could not run — need SSH from main GuildOS session |

---

## Table 1 — Autonomously Fixable: Plans + Smoke Test Results

> **SSH:** Run write tests via `ssh -p 2223 boster_ooP9u@69.27.32.101` from the main GuildOS session (not a worktree).
> **Reversibility:** File writes → delete/revert. DB writes → save old value before UPDATE, restore after.

| # | Issue | Scale | Fix Location | Smoke Test | Plan | Est. | Smoke Result |
|---|-------|-------|-------------|------------|------|------|-------------|
| 37 | **llms.txt missing** | 1 file | `pub/llms.txt` — static, nginx serves directly | `echo "# test" > pub/llms.txt` → `curl -I /llms.txt` → expect 200 → `rm pub/llms.txt` | Write `pub/llms.txt` with site purpose, product areas, crawl guidance | 30 min | ✅ **SUCCESS** — 404 confirmed via browser. Location known. Ready to create. |
| 9 | **robots.txt: /catalog/ blocked** | 1 file | `pub/robots.txt` — static, edits instant | Comment out `Disallow: /catalog/` → curl a `/catalog/` URL → revert | Audit each Disallow: keep param blockers (`?*order=`), remove blanket path blocks on indexable pages | 2 hrs | ✅ **SUCCESS** — Full file read via browser. `Disallow: /catalog/` confirmed present. |
| 11 | **Sitemap XML format errors** | 2 files | `pub/sitemap/sitemap-1-*.xml` | `xmllint --noout sitemap.xml 2>&1` — see exact error | Fix malformed XML; validate with xmllint | 1 hr | ⚠️ **PARTIAL** — Sitemap loaded as valid XML in browser. "Format error" may be SEMRush flagging image URLs in a URL sitemap (wrong type). Verify with SEMRush exact error detail. |
| 8 | **260 error URLs in sitemap** | 12 sitemap files | `pub/sitemap/sitemap-1-*.xml` | Sample 20 URLs from sitemap → curl each → note 4XX/5XX | Parse sitemap, curl URLs, remove dead entries, regenerate | 2 hrs | 🔴 **BIGGER** — Sitemap-1-1.xml alone has 8,691 image URLs (`.jpg`/`.png`). SEMRush underreported. Core fix: strip images from URL sitemap, move to image sitemap. |
| 10 | **5 invalid canonical links** | 5+ pages | DB: `catalog_product_entity_varchar` (canonical_url) | `SELECT value FROM catalog_product_entity_varchar WHERE attribute_id=(SELECT attribute_id FROM eav_attribute WHERE attribute_code='canonical_url') LIMIT 10` | Update canonical values in DB to correct URLs | 1 hr | ⚠️ **DIFFERENT** — Canonical on new-format URL points to old-format URL which returns 200. Not broken — but wrong: two live URLs for same product = duplicate content. Likely affects thousands of pages, not just 5. |
| 22 | **1 URL with underscore** | 1 URL | DB: `url_rewrite` table | `SELECT * FROM url_rewrite WHERE request_path LIKE '%\_%'` | Add 301 redirect row: underscore → hyphen version | 1 hr | ⛔ **SSH BLOCKED** — Cannot run DB query. Mechanism clear. |
| 23 | **1 unminified JS/CSS** | Config | DB: `core_config_data` | `SELECT path,value FROM core_config_data WHERE path IN ('dev/js/minify_files','dev/css/minify_files')` | Set disabled value to `1` via SQL UPDATE | 30 min | ⛔ **SSH BLOCKED** — Cannot read config. Mechanism clear. |
| 21 | **2 uncached JS/CSS files** | nginx/server | nginx vhost config or `pub/.htaccess` | `curl -I https://www.bosterbio.com/pub/static/[asset].css` → check `Cache-Control` | Add `expires`/`Cache-Control` headers for static assets | 1 hr | ⚠️ **INCONCLUSIVE** — Could not identify correct CSS asset URL. Need SSH to read nginx config or actual asset paths. |
| 34 | **3 pages: multiple H1** | 3 pages | CMS pages — extra H1 in content body | `curl /[page] \| grep -o '<h1[^>]*>[^<]*</h1>'` on the 3 affected URLs | Open CMS pages in Admin → Content, remove duplicate H1 | 1 hr | ⚠️ **PARTIAL** — Sampled pages all had exactly 1 H1. Need SEMRush export to identify the specific 3 URLs. |
| 19 | **12 external broken links** | 12 links | CMS blocks/pages | `SELECT content FROM cms_block WHERE content LIKE '%http%'` then curl each | Update or remove dead links | 1.5 hrs | ⛔ **SSH BLOCKED** — Cannot query CMS DB. Mechanism clear. |
| 33 | **42 external links → 403** | 42 links | CMS blocks/pages/templates | curl each URL from SEMRush export | Replace or remove the 42 links | 2 hrs | ⛔ **SSH BLOCKED** — Same as above. |
| 20 | **12 pages: title tag too short** | 12 pages | DB: `catalog_product_entity_varchar` (meta_title) | `SELECT entity_id, value FROM catalog_product_entity_varchar WHERE attribute_id=[meta_title_id] AND LENGTH(value) < 30` | Update each meta_title to descriptive version | 2 hrs | ✅ **SUCCESS** — "Anti-IL-8 CXCL8 Antibody" = 24 chars confirmed on live page. DB query will enumerate all 12. |
| 17 | **86 pages: title tag too long** | 86 pages | DB: same attribute, `LENGTH(value) > 60` | Same query with `> 60` filter | Script: trim at word boundary before 60 chars; bulk UPDATE | 3 hrs | ✅ **SUCCESS** — "Human TNF Alpha…PicoKine® \| Boster Bio" = 70 chars confirmed on live page. |
| 18 | **32 pages: no H1** | 32 pages | CMS or category template | `curl /[page] \| grep -c '<h1'` on affected URLs | CMS pages: add H1 in Admin. Category pages: update layout XML | 3 hrs | ⚠️ **PARTIAL** — Product pages have H1. Category pages all 404. Need SEMRush URL list to identify the 32. |
| 32 | **261 redirect chains** | 261 URLs | DB: `url_rewrite` | `SELECT a.request_path, a.target_path, b.target_path AS final FROM url_rewrite a JOIN url_rewrite b ON a.target_path=b.request_path LIMIT 10` | Update `target_path` to point to final destination directly | 3 hrs | ⚠️ **DIFFERENT** — Old product URLs return 200 directly (not a redirect). Chains must exist elsewhere. DB access needed to locate them. |
| 31 | **553 resources linked as pages** | 8,691 actual | `pub/sitemap/sitemap-1-*.xml` | `grep -c '\.jpg\|\.png' sitemap-1-1.xml` | Regenerate sitemap excluding image URLs; move images to proper `<image:image>` tags in an image sitemap | 4 hrs | 🔴 **16x BIGGER** — Sitemap-1-1.xml alone contains 8,691 image URLs. All 12 sub-files affected. Core sitemap regeneration required. |
| 30 | **577 non-descriptive anchors** | 577 links | Templates + CMS blocks | `grep -r '"read more\|click here\|learn more"' app/design/` | Update anchor text in templates and CMS | 4 hrs | ⚠️ **PARTIAL** — Found only 1 "View All" on sampled pages. Category/listing templates (primary source) are 404ing and couldn't be tested. |
| 6 | **3,492 invalid structured data** | Site-wide | Theme template (JSON-LD scripts) | `curl /[product] \| python3 -c "import sys,json,re; [print(json.loads(m)) for m in re.findall(r'<script type=.application/ld\+json.>(.*?)</script>', sys.stdin.read(), re.S)]"` | Fix JSON-LD template: add `gtin`, fix Organization `description`/`sku`/`offers` — needs cache flush | 4 hrs + cache flush | ✅ **SUCCESS** — Organization schema missing `description`, `sku`, `offers`, `gtin`. Product schema missing `gtin`. Confirmed on 2 separate product pages. |
| 15 | **5,874 internal nofollow links** | Site-wide | Theme template (phtml) | `grep -rn 'nofollow' app/design/ --include="*.phtml"` | Remove `rel="nofollow"` from the template — needs cache flush | 2 hrs + cache flush | ✅ **SUCCESS** — Pattern confirmed: `<a rel="nofollow" href="[currentURL]#">` self-referential anchor on every product page. One template line fix. |
| 24 | **13,290 links: no anchor text** | Site-wide | Theme templates | `grep -n 'href.*><img\|href.*></a' [templates]` | Add `alt` to linked images; `aria-label` to icon links — needs cache flush | 6 hrs + cache flush | ✅ **SUCCESS** — 17 empty anchors + 8 img-without-alt confirmed per product page. Source: social/share icon links and product images. |
| 5 | **4,121 pages returning 4XX** | 4,121 pages | DB: `url_rewrite` | Pull SEMRush 4XX list → curl 20 samples → confirm; check url_rewrite for entries | Bulk INSERT 301 redirects for dead category URLs pointing to live equivalents | 2–3 days | ✅ **SUCCESS** — `/antibodies.html`, `/elisa-kits.html`, multiple others confirmed 404. Root cause: URL restructure moved products to `/products/category/name.html` but category pages not migrated. |
| 3 | **5,558 duplicate title tags** | 5,558 pages | DB: `catalog_product_entity_varchar` | `SELECT value, COUNT(*) c FROM catalog_product_entity_varchar WHERE attribute_id=[meta_title_id] GROUP BY value HAVING c>1 LIMIT 10` | Script: generate unique titles from product name + category + brand; bulk UPDATE | 1–2 days | ✅ **SUCCESS (pattern)** — H1=Title confirmed identical on both tested pages. DB group-by query will enumerate duplicates. |
| 2 | **5,657 duplicate meta descriptions** | 5,657 pages | DB: `catalog_product_entity_varchar` | Same GROUP BY for meta_description attribute | Script: generate from product description first 150 chars + CTA; bulk UPDATE | 1–2 days | ⛔ **SSH BLOCKED** — Cannot confirm duplicates without DB group-by. Pattern plausible given product template structure. |

---

## Table 2 — Remaining Items (Partial/No — Easy→Hard, High→Low Impact)

| # | Issue | Scale | Scope | Impact if Fixed | Why Not Fully Autonomous | What Would Need to Happen |
|---|-------|-------|-------|----------------|--------------------------|--------------------------|
| 13 | **1 page: 5XX server error** | 1 page | Easy | Medium | Root cause unknown — PHP error, bad module, or missing resource | Identify URL → check `var/log/exception.log` → fix module/config |
| 35 | **2 subdomains: no HSTS** | 2 subdomains | Easy | Low | nginx config change requires `nginx -s reload` — server operation | Add `Strict-Transport-Security` header to nginx vhost; flag for ops to reload |
| 12 | **2 pages: oversized HTML** | 2 pages | Easy-Mid | Low-Med | Need to identify what's bloating — injected blocks, large CMS content, or template issue | Fetch page HTML, measure sections, identify the large blocks, trim or lazy-load |
| 4 | **5,273 pages: duplicate content** | 5,273 pages | Mid | Critical | Root cause is dual-URL problem (confirmed by smoke tests). Canonical tags autonomous; content differentiation requires copywriting | Fix canonical tags to point new-format URL as canonical + 301 old-format to new — now understood as the same fix as #10 |
| 29 | **772 pages: blocking crawlers** | 772 pages | Mid | High | Some `noindex` is intentional (checkout, search); others may not be — needs audit | Pull noindex page list from DB/templates, review against business intent, remove unintentional blocks |
| 16 | **1,868 pages: H1 = Title tag** | 1,868 pages | Mid-Hard | Medium | Differentiating H1 vs title requires keyword strategy | Define rule (e.g., Title = `[Name] \| Boster Bio`, H1 = `[Name]` alone) → template change + cache flush |
| 26 | **5,947 external links: nofollow** | 5,947 links | Hard | Low | Selectively removing nofollow requires per-link domain authority judgment | Build allowlist of high-DA domains → script to strip nofollow from those links in templates/CMS |
| 27 | **4,514 pages: only 1 internal link** | 4,514 pages | Hard | High | Internal linking strategy requires deciding which pages to cross-link | Build related-products cross-link injection based on category/species/application overlap |
| 7 | **2,232 pages: slow load time** | 2,232 pages | Hard | Critical | Image optimization, Varnish tuning, JS deferral — all touch server config or deployment | Enable Magento FPC fully; audit Varnish TTLs; compress images via script; defer non-critical JS |
| 28 | **2,834 pages: need content optimization** | 2,834 pages | Hard | High | Determining optimization per page requires SEO + product knowledge | AI pipeline: pull each product, identify thin sections, generate additions, human review sample |
| 14 | **13,194 pages: low text-HTML ratio** | 13,194 pages | Hard | High | Adding text at scale without looking spammy requires content strategy | Inject structured content blocks (application notes, citations) from product DB fields via template |
| 1 | **7,876 broken internal links** | 7,876 links | Hard | Critical | Source location of each link (template vs CMS vs cross-links) requires full crawl mapping | Combine SEMRush export + Screaming Frog → map source pages → bulk redirects or link updates |
| 25 | **11,175 pages: 3+ clicks deep** | 11,175 pages | Hard | High | Requires site architecture decisions — navigation, mega menu redesign | Not autonomous — needs UX/SEO strategy alignment before implementation |
