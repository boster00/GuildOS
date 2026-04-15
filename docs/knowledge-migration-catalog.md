# Knowledge Migration Catalog

Audit of all instruction/rule docs across 4 repos. Each point categorized:
1. **GLOBAL** → `docs/global-instructions.md`
2. **SYSTEM_PROMPT** → adventurer's `system_prompt` in DB
3. **SKILL_BOOK** → skill book action-level instructions
4. **OBSOLETE** → remove
5. **KEEP** → out of scope, stays where it is

---

## GuildOS (`C:\Users\xsj70\GuildOS\docs\`)

### project-architecture-documentation.md
| Point | Category | Notes |
|-------|----------|-------|
| Fantasy-to-programming dictionary (quest=task, weapon=connector, etc.) | GLOBAL | Core entity model |
| NPCs vs adventurers distinction | GLOBAL | Critical system knowledge |
| Quest lifecycle (7+1 stages) | GLOBAL | Already in global-instructions.md |
| Preparation cascade (no match → forge weapon → skill book → adventurer) | OBSOLETE | Old pipeline, replaced by live agents |
| Quest chaining via next_steps | OBSOLETE | Old pipeline mechanism |
| Action naming conventions (6 verbs) | GLOBAL | Already in global-instructions.md |
| Skill book TOC standard (input/output format) | GLOBAL | How to read/write skill books |
| Stage machine dispatch (server.js) | OBSOLETE | Being replaced by live session dispatch |
| Common misunderstandings | GLOBAL | Merge relevant ones, discard old-pipeline ones |

### skill-book-guideline.md
| Point | Category | Notes |
|-------|----------|-------|
| Skill book module shape (id, title, description, toc) | GLOBAL | How skill books are structured |
| TOC format rules (6 verbs, multipurpose actions) | GLOBAL | Already covered in action naming |
| Weapon-based implementation pattern | SKILL_BOOK | How to build a new skill book |
| Adventurer boast mechanics | OBSOLETE | Old assignment mechanism |

### weapon-crafting-guideline.md
| Point | Category | Notes |
|-------|----------|-------|
| 6-step weapon lifecycle (plan, review, forge, test, pigeon, close) | SKILL_BOOK | "forgeWeapon" action instructions |
| File rules (max 2 files per weapon) | GLOBAL | Weapon architecture rule |
| Credential check patterns | GLOBAL | How weapons handle auth |
| Pigeon letter templates | SKILL_BOOK | "dispatchBrowserAction" action |

### adventurer-creed.md
| Point | Category | Notes |
|-------|----------|-------|
| Fetch quest context workflow | OBSOLETE | Old CLI-based workflow, replaced by live sessions |
| Read system_prompt from DB | GLOBAL | Part of session init |
| Check available skill books | GLOBAL | Already in global-instructions.md |
| Output results as JSON items | GLOBAL | Part of submit_results |

### adventurer-claude-non-development-guideline.md
| Point | Category | Notes |
|-------|----------|-------|
| Deliverables go to Supabase Storage (not local disk) | GLOBAL | Universal rule for all adventurers |
| Must not modify GuildOS codebase | SYSTEM_PROMPT | Only for non-dev adventurers |
| Self-review output before delivery | GLOBAL | Already in global-instructions.md |
| Curl templates for uploading/commenting | OBSOLETE | Replaced by weapon imports |

### cursor-cloud-agent-capabilities.md
| Point | Category | Notes |
|-------|----------|-------|
| Environment details (Linux, X11, Node 22, Chrome) | GLOBAL | Cursor agent environment |
| Headed browsers work via DISPLAY=:1 | GLOBAL | Screenshot/browser instructions |
| No mouse/keyboard GUI API — must use Playwright | GLOBAL | Agent limitation |
| Cannot see user's screen | GLOBAL | Agent limitation |
| Push reminder needed | GLOBAL | Already learned — agents forget to push |

### browser-automation-guideline.md
| Point | Category | Notes |
|-------|----------|-------|
| Chrome Extension vs Browserclaw decision matrix | OBSOLETE | Extension approach deprecated |
| Browserclaw for autonomous/unattended tasks | SKILL_BOOK | "dispatchBrowserAction" |
| Testing features → headed browser | GLOBAL | When to use browser |

### pigeon-letter-drafting-guide.md
| Point | Category | Notes |
|-------|----------|-------|
| 7 browserclaw actions (navigate, get, click, typeText, etc.) | SKILL_BOOK | "dispatchBrowserAction" |
| Composing best practices (navigate first, wait+selector) | SKILL_BOOK | "dispatchBrowserAction" |
| Item storage mechanics | SKILL_BOOK | "dispatchBrowserAction" |

### dependency-loop-rollout-plan.md
| Point | Category | Notes |
|-------|----------|-------|
| Recursive dependency resolution phases | OBSOLETE | Old pipeline, not used in new model |

### manual context.md
| Point | Category | Notes |
|-------|----------|-------|
| Story walkthrough of quest system | OBSOLETE | Outdated narrative, superseded by refactor |

### quest-trace-bigquery.md
| Point | Category | Notes |
|-------|----------|-------|
| End-to-end quest trace with 18 gaps | OBSOLETE | Old pipeline trace, gaps addressed differently now |

### feature-test.md / feature-test-results.md
| Point | Category | Notes |
|-------|----------|-------|
| Test results for 4 feature branches | OBSOLETE | One-time test results, no ongoing value |

### weapon-usage-cursor.md
| Point | Category | Notes |
|-------|----------|-------|
| Cursor API auth (CURSOR_API_KEY, Basic auth) | SKILL_BOOK | "cursor" skill book |
| 6 weapon actions (readAgent, writeFollowup, etc.) | SKILL_BOOK | "cursor" skill book |
| Always use composer-2.0 model | SKILL_BOOK | "cursor" skill book |
| FINISHED agents can still receive followups | SKILL_BOOK | "cursor" skill book |
| Never create agents without user permission | GLOBAL | Safety rule |

### weapon-usage-figma.md
| Point | Category | Notes |
|-------|----------|-------|
| Figma API auth (FIGMA_ACCESS_TOKEN) | SKILL_BOOK | "figma" skill book |
| 7 weapon actions | SKILL_BOOK | "figma" skill book |
| Extract fileKey from URL pattern | SKILL_BOOK | "figma" skill book |

### weapon-usage-asana.md
| Point | Category | Notes |
|-------|----------|-------|
| 11 Asana weapon actions | SKILL_BOOK | "asana" skill book |
| Dual interface (weapon + skill book) | SKILL_BOOK | "asana" skill book |

### weapon-usage-supabase-storage.md
| Point | Category | Notes |
|-------|----------|-------|
| Path convention (channel/questId/filename) | GLOBAL | Standard for all storage |
| 7 storage actions | SKILL_BOOK | "supabase_storage" skill book |
| Default bucket is GuildOS_Bucket (public) | GLOBAL | System constant |

### weapon-usage-auth-state.md
| Point | Category | Notes |
|-------|----------|-------|
| Auth state management (playwright/.auth/user.json) | SKILL_BOOK | "auth_state" skill book |
| Refresh mechanism via scripts/auth-capture.mjs | SKILL_BOOK | "auth_state" skill book |
| Default expiry 7 days | SKILL_BOOK | "auth_state" skill book |

### weapon-usage-ssh.md
| Point | Category | Notes |
|-------|----------|-------|
| Known hosts (carbon, boster_production) | SKILL_BOOK | "ssh" skill book |
| 4 SSH actions | SKILL_BOOK | "ssh" skill book |
| Prerequisite: passwordless SSH keys | SKILL_BOOK | "ssh" skill book |

### weapon-usage-browserclaw-cdp.md
| Point | Category | Notes |
|-------|----------|-------|
| CDP auto-launch, auto-retry, storageState | SKILL_BOOK | "browserclaw" skill book |
| 12 step actions with parameters | SKILL_BOOK | "browserclaw" skill book |

### weapon-usage-gmail.md
| Point | Category | Notes |
|-------|----------|-------|
| Gmail OAuth2 refresh token flow | SKILL_BOOK | "gmail" skill book (already converted) |
| 6 weapon actions | SKILL_BOOK | "gmail" skill book |
| Triage scoring engine | SKILL_BOOK | "gmail" skill book |

### gmail-processing-preferences.md
| Point | Category | Notes |
|-------|----------|-------|
| Two-step email sorting workflow | SKILL_BOOK | "gmail" triageInbox action |
| Skip rules (shared mailbox, Asana, orders, etc.) | SKILL_BOOK | "gmail" triageInbox action |
| Positive signals (+1 to +10 scoring) | SKILL_BOOK | "gmail" triageInbox action |
| Decision framework (when unsure, don't star) | SKILL_BOOK | "gmail" triageInbox action |

### GuildOS-refactor.md
| Point | Category | Notes |
|-------|----------|-------|
| Refactor rationale and decisions | KEEP | Active project doc, remove when done |

### global-instructions.md
| Point | Category | Notes |
|-------|----------|-------|
| All content | GLOBAL | This IS the global doc |

### refactor-progress.md
| Point | Category | Notes |
|-------|----------|-------|
| Progress tracking | KEEP | Active project doc, remove when done |

---

## CJGEO (`C:\Users\xsj70\cjgeo\`)

### .cursorrules
| Point | Category | Notes |
|-------|----------|-------|
| Product definition (SEO content writer SaaS) | SYSTEM_PROMPT | CJGEO Dev identity |
| MVP scope boundaries (in/out) | SYSTEM_PROMPT | CJGEO Dev context |
| Pricing plans ($99/$399, credits) | SYSTEM_PROMPT | CJGEO Dev context |
| Next.js 15 + React 19 + Tailwind v4 + DaisyUI v5 | GLOBAL | Shared stack |
| Always await cookies/headers | GLOBAL | Shared convention |
| No hardcoded URLs/ports | GLOBAL | Shared convention |
| Monkey AI module (centralized, runTask) | SYSTEM_PROMPT | CJGEO-specific |
| PlanContext pattern (getPlanContext) | SYSTEM_PROMPT | CJGEO-specific |
| Content Magic asset whitelisting (4 keys only) | SKILL_BOOK | "writePipeline" action |
| Browser reality check (retry 5x) | GLOBAL | Verify in browser after UI changes |
| DaisyUI v5 class names (card-border not card-bordered) | GLOBAL | Shared convention |

### _archive/.claude-instructions.md
| Point | Category | Notes |
|-------|----------|-------|
| Async cookies/headers warning fix | GLOBAL | Already identified |
| Unused import elimination | GLOBAL | Already identified |
| React hook dependency patterns | GLOBAL | Move Supabase inside useEffect |
| Success metrics (build passes, no warnings) | GLOBAL | Verify before commit |

### docs/CODE_RESPONSIBILITY_MAP.md
| Point | Category | Notes |
|-------|----------|-------|
| 8-step article pipeline with file paths | SKILL_BOOK | "writePipeline" action |
| Data structures (IntentModel, TalkPoint, etc.) | SKILL_BOOK | "writePipeline" action |
| Manual override instructions per step | SKILL_BOOK | "writePipeline" action |

### docs/DATABASE_CONVENTIONS.md
| Point | Category | Notes |
|-------|----------|-------|
| Migration patterns (ADD COLUMN IF NOT EXISTS) | GLOBAL | Shared convention |
| Profiles schema (subscription_plan, credits) | SYSTEM_PROMPT | CJGEO-specific |
| Tier definitions in code only, not DB | SYSTEM_PROMPT | CJGEO-specific |

### docs/BILLING_ARCHITECTURE.md
| Point | Category | Notes |
|-------|----------|-------|
| Stripe provisioning flow | SKILL_BOOK | "manageBilling" action |
| PlanContext usage in API routes | SYSTEM_PROMPT | CJGEO-specific |
| Credit philosophy (what consumes credits) | SYSTEM_PROMPT | CJGEO-specific |

### docs/MVP_SCOPE.md
| Point | Category | Notes |
|-------|----------|-------|
| MVP feature boundaries | SYSTEM_PROMPT | CJGEO Dev context |

### docs/CODEBASE_INDEX.md
| Point | Category | Notes |
|-------|----------|-------|
| Project structure and navigation | SYSTEM_PROMPT | CJGEO Dev orientation |

### .cursor/rules/billing-stripe.mdc
| Point | Category | Notes |
|-------|----------|-------|
| Stripe webhook → provisioner flow | SKILL_BOOK | "manageBilling" action |
| Credit ledger (not api_usage_logs) | SKILL_BOOK | "manageBilling" action |

### .cursor/rules/database-migrations.mdc
| Point | Category | Notes |
|-------|----------|-------|
| Migration patterns | GLOBAL | Already identified |
| Schema sync command after changes | SKILL_BOOK | "databaseMigration" action |

### .cursor/rules/shadow-dom-css.mdc
| Point | Category | Notes |
|-------|----------|-------|
| No @scope CSS; use Shadow DOM | SKILL_BOOK | "renderContent" action |
| Shadow DOM CSS injection pattern | SKILL_BOOK | "renderContent" action |

---

## Boster Nexus (`C:\Users\xsj70\boster_nexus\`)

### .claude-instructions.md
| Point | Category | Notes |
|-------|----------|-------|
| Next.js 15 + Tailwind v4 + DaisyUI v5 patterns | GLOBAL | Shared stack |
| Async cookies/headers | GLOBAL | Already identified |
| Unused imports | GLOBAL | Already identified |
| React hook dependencies | GLOBAL | Already identified |
| Server vs client Supabase patterns | GLOBAL | Shared convention |
| Pre-commit checklist (build, lint, console) | GLOBAL | Verify before commit |

### context/rules.md
| Point | Category | Notes |
|-------|----------|-------|
| Rule routing model (.mdc files as source of truth) | SYSTEM_PROMPT | Nexus Dev workflow |
| By-area routing (zoho → .mdc, runpod → .mdc) | SYSTEM_PROMPT | Nexus Dev workflow |

### .cursor/rules/agent-context-index.mdc
| Point | Category | Notes |
|-------|----------|-------|
| Read context/rules.md before edits | SYSTEM_PROMPT | Nexus Dev workflow |
| Read context/current.md for initiative notes | SYSTEM_PROMPT | Nexus Dev workflow |
| Task Monkey report format (reports/latest.md) | SYSTEM_PROMPT | Nexus Dev workflow |
| Never commit secrets | GLOBAL | Already identified |

### .cursor/rules/zoho-data-layers.mdc
| Point | Category | Notes |
|-------|----------|-------|
| All Zoho HTTP via Zoho class (never direct fetch) | SKILL_BOOK | "syncZohoData" action |
| 5-layer architecture (API → service → repo → domain → entity) | SKILL_BOOK | "syncZohoData" action |
| Entity extractFromResponse / transformToDbRecord | SKILL_BOOK | "syncZohoData" action |

### .cursor/rules/runpod-push.mdc
| Point | Category | Notes |
|-------|----------|-------|
| RunPod push sequence (commit → docker build → push) | SKILL_BOOK | "deployRunPod" action |
| Prerequisites (RUNPOD_IMAGE_REGISTRY, Docker login) | SKILL_BOOK | "deployRunPod" action |

### docs/agent-ide-best-practices.md
| Point | Category | Notes |
|-------|----------|-------|
| Scoped .mdc files over one giant file | SYSTEM_PROMPT | Nexus Dev workflow |
| Small reviewable diffs | GLOBAL | Shared convention |
| Verification before done | GLOBAL | Shared convention |
| Code references over paraphrase | GLOBAL | Shared convention |

---

## BosterBio.com2026 (`C:\Users\xsj70\bosterbio.com2026\`)

### docs/migration-plan.md
| Point | Category | Notes |
|-------|----------|-------|
| Work distribution (Claude Code vs Cursor Agent) | SYSTEM_PROMPT | BosterBio Dev role |
| Communication protocol (15-min check-in, screenshots) | SYSTEM_PROMPT | BosterBio Dev workflow |
| Phase 1 tasks (Medusa setup, product model, Magento extract) | SKILL_BOOK | "migrateProducts" action |
| Phase 2 tasks (PLP, PDP, cart, checkout, CMS) | SKILL_BOOK | "buildStorefront" action |
| Phase 3 tasks (SEO, sitemap, schema markup, GTM) | SKILL_BOOK | "launchPrep" action |
| Phase 4 tasks (QC, DNS cutover, monitoring) | SKILL_BOOK | "launchPrep" action |
| No new features during migration | SYSTEM_PROMPT | BosterBio Dev constraint |

### docs/migration-questionnaire-answers.md
| Point | Category | Notes |
|-------|----------|-------|
| Hard cutover strategy (8 weeks, no parallel) | SYSTEM_PROMPT | BosterBio Dev context |
| Medusa v2 + Authorize.net confirmed | SYSTEM_PROMPT | BosterBio Dev context |
| 85,929 products, all migrate | SYSTEM_PROMPT | BosterBio Dev context |
| No historical order migration | SYSTEM_PROMPT | BosterBio Dev context |
| Gene pages deferred | SYSTEM_PROMPT | BosterBio Dev context |
| 404 monitoring instead of bulk redirects | SKILL_BOOK | "launchPrep" action |
| Product URL format preserved (.html) | SKILL_BOOK | "buildStorefront" action |

### docs/product-attributes-migration-plan.md
| Point | Category | Notes |
|-------|----------|-------|
| Hybrid schema (Type A dedicated + Type B attr_1..25) | SKILL_BOOK | "migrateProducts" action |
| Target info JSON consolidation | SKILL_BOOK | "migrateProducts" action |
| Attribute definitions table | SKILL_BOOK | "migrateProducts" action |
| Images table (product_images) | SKILL_BOOK | "migrateProducts" action |
| Template system as control layer | SKILL_BOOK | "buildStorefront" action |

### docs/migration-questionnaire.md
| Point | Category | Notes |
|-------|----------|-------|
| Pre-migration requirements checklist | SYSTEM_PROMPT | BosterBio Dev context |

### docs/cms-html-template-guide.md / cms-page-audit.md
| Point | Category | Notes |
|-------|----------|-------|
| 755 CMS pages: 481 keep, 7 drop, 267 review | SKILL_BOOK | "migrateContent" action |
| URL prefix grouping (newsletter-archive, pathway-maps, etc.) | SKILL_BOOK | "migrateContent" action |
| URL placeholder convention (SITE_ORIGIN_PLACEHOLDER) | SKILL_BOOK | "migrateContent" action |

---

## Summary: What goes where

### → GLOBAL (add to global-instructions.md)
- Always await `cookies()` and `headers()` in Next.js 15
- Remove unused imports before committing
- Move Supabase client inside useEffect for hook deps
- Tailwind v4 + DaisyUI v5 only (never v3/v4 syntax; `card-border` not `card-bordered`)
- No hardcoded URLs/ports — use env vars
- Never commit secrets (.env, API keys)
- Always git push when done
- Verify in browser after UI changes
- Pre-commit: `npm run build` + `npm run lint` + browser console check
- Deliverables go to Supabase Storage, not local disk
- Migration patterns: `ADD COLUMN IF NOT EXISTS`, idempotent
- Small reviewable diffs; code references over paraphrase
- Never create Cursor agents without user permission
- Storage path convention: channel/questId/filename
- Default bucket: GuildOS_Bucket (public)
- Weapon architecture: max 2 files per weapon, one per external service
- Credential check patterns (weapons handle auth internally)
- Fantasy dictionary (quest=task, adventurer=agent, weapon=connector, skill book=knowledge registry)
- NPCs vs adventurers distinction
- Cursor agent environment (Linux, X11, Node 22, Chrome, no GUI API)

### → SYSTEM_PROMPT (per adventurer, already mostly done)
- CJGEO: product def, MVP scope, pricing, Monkey AI module, PlanContext, codebase index
- Nexus: context/rules.md routing workflow, Task Monkey report format, Zoho integrations context
- BosterBio: role distribution, migration scope (85K products, 8 weeks, hard cutover), brand, no new features rule

### → SKILL_BOOK (action-level, need to create)
- cjgeo: writePipeline (8-step), manageBilling (Stripe/credits), renderContent (Shadow DOM), databaseMigration
- nexus: syncZohoData (5-layer architecture), deployRunPod (docker build+push)
- bosterbio: migrateProducts (hybrid schema, attributes), buildStorefront (PLP/PDP/cart), launchPrep (SEO/DNS/monitoring), migrateContent (755 CMS pages)
- All weapon-usage docs → their respective skill books

### → OBSOLETE (remove)
- dependency-loop-rollout-plan.md — old pipeline
- manual context.md — outdated narrative
- quest-trace-bigquery.md — old pipeline trace
- feature-test.md / feature-test-results.md — one-time results
- adventurer-creed.md — replaced by global-instructions.md
- Preparation cascade docs — replaced by live agents
- Quest chaining via next_steps — old mechanism
- adventurer-claude-non-development-guideline.md curl templates — replaced by weapons
- browser-automation-guideline.md Chrome Extension comparison — extension approach deprecated

### → KEEP (out of scope)
- GuildOS-refactor.md — active project doc
- refactor-progress.md — active tracking
- global-instructions.md — this IS the target
- All docs in external repos (.cursorrules, .mdc files, migration plans) — stay in their repos, referenced by system_prompt
