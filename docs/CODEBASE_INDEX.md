# Codebase Index

Quick reference for project structure and where to find things. Use for navigation and AI context.

## Root config

| File | Purpose |
|------|--------|
| `config.js` | App name, Stripe plans (priceId from env), auth (loginUrl, callbackUrl), Resend, domain, colors |
| `package.json` | Scripts: `dev`, `build`, `start`, `lint`, `test` |
| `next.config.mjs` | Next.js config |
| `jsconfig.json` | JS path aliases (`@/` → project root) |
| `tsconfig.json` | TypeScript config |
| `middleware.js` | Auth / routing middleware |
| `vercel.json` | Vercel deploy config |

---

## App (Next.js App Router)

### Public pages

- `app/layout.js` – Root layout
- `app/page.js` – Home
- `app/signin/` – Sign-in
- `app/blog/` – Blog
- `app/tos/` – Terms of service
- `app/user-profile/` – User profile

### Private (auth) pages – `app/(private)/`

| Route | Page / role |
|-------|------------------|
| `layout.js` | Private layout (auth check, sidebar, DashboardContainer) |
| `dashboard/` | Dashboard – subscription CTA (ButtonAccount, ButtonCheckout), onboarding checklist |
| `content-magic/` | **Content Magic** – article list, editor, import, refinement |
| `campaigns/` | Campaigns, content ideas, satellites, wizard |
| `icps/` | ICP (Ideal Customer Profile) CRUD |
| `prompts/` | Prompts (single page) |
| `offers/` | Offers list/edit |
| `settings/` | Settings, custom CSS, page templates |
| `billing/` | Billing, credits, payg |
| `geo-seo-visibility-tracking/` | Visibility tracker – projects, runs, [slug], edit, settings |
| `tests/` | Dev-only test pages (admin email + NODE_ENV=development): stripe, eden, metering, metering-rollout, master-of-coins, production, visibility-tracking, etc. See `/tests` index. |

### Content Magic (main editor surface)

- **List / article:** `app/(private)/content-magic/[[...slug]]/page.js` → `ContentMagicList` or `ContentMagicArticlePage`
- **Article page:** `ContentMagicArticlePage.js` – title, import, copy HTML, save, editor
- **Editor:** `ContentMagicEditor.js` – TinyMCE, sections, templates
- **Import:** `ContentMagicImportModal.js` – URL / paste HTML
- **Other:** `ContentMagicContextCard`, `ContentMagicGuide`, `ContentMagicQuickActions`, `ContentMagicWizard`, `ImageBrowsePanel`, `ImageGenerationModal`, `QuickActionPopup*`, `RuleDetailPanel`, `RefinementStepper`, `shadowPreviewStyles.js`

---

## API routes – `app/api/`

### Credits & metering

| Path | Role |
|------|------|
| `credits/route.js` | GET – user credit balance (remaining, monthly, payg, reset_date, period_used) |
| `plan/route.js` | GET – current user PlanContext (tier, limits, subscription_status; use instead of querying tier in routes) |
| `metering/spend/route.js` | Deduct credits (metered actions) |
| `usage/me/route.js` | Current user usage |
| `usage/logs/route.js` | Usage logs |
| `admin/credits/adjust/route.js` | Admin credit adjustment |
| `healthz/route.js`, `healthz/metering/route.js` | Health checks |
| `test-metering/*` | Test metering (actions, ledger, set-credits, etc.) |

### Content Magic – `api/content-magic/`

| Path | Role |
|------|------|
| `crawl/`, `render-page/` | Fetch URL; Playwright render |
| `save/`, `create/`, `delete/`, `search/` | Article CRUD / search |
| `generate-outline/`, `adopt-outline/`, `outline-pull-raw/`, `outline-feedback/`, `outline-status/`, `review-outline/`, `review-sections/` | Outline lifecycle |
| `format-sections-from-markdown/` | Markdown → sections HTML |
| `article-refinement/*` | Refinement steps (summarize, keywords, QA, competitor, placement, checklist, implement, internal links, review, ux-suggestions, convert-format, convert-website, generate-seo, fit-template) |
| `prompts/*`, `suggest-prompts/`, `suggest-research-prompts/` | Prompt evaluation and suggestions |
| `topics/*`, `topic-suggestion/`, `keyword-suggestions/*`, `internal-links/suggest/`, `map-keywords/` | Topics, keywords, internal links |
| `ai-optimization-score/`, `section-ai-rating/`, `title-evaluation/` | Scoring |
| `ai-assistant/`, `ai-edit/`, `implement-suggestion/`, `implementation-suggestion/batch/`, `generate-change-candidates/`, `write-section/`, `write-sections-from-outline/` | AI writing / edits |
| `images/`, `signed-url/`, `upload-image/`, `generate-image/`, `save-generated-image/`, `save-assets/` | Images and uploads |
| `import-html/`, `import-html-cj/`, `import-html-ast/` | HTML import |
| `benchmark/`, `campaign-articles/`, `get-icp/` | Benchmark, campaign articles, ICP |
| `repurpose-content/generate/`, `draft-journey/`, `extract/` | Repurpose, draft, extract |

### Stripe & webhooks

- **Flow**: Checkout → webhook → provisioner → profiles → PlanContext
- `stripe/create-checkout/route.js` – Checkout session (payment or subscription)
- `stripe/create-portal/route.js` – Customer portal (billing management)
- `webhook/stripe/route.js` – Stripe events (checkout.session.completed, customer.subscription.deleted, invoice.paid → provisionSubscription / cancelSubscription)
- **Key files**: webhook/stripe/route.js, libs/monkey/subscriptionProvisioner.js, libs/monkey/planContext.js, libs/monkey/registry/subscriptionTiers.js

### Visibility tracker – `api/visibility_tracker/`

| Path | Role |
|------|------|
| `project/`, `projects/`, `projects/[projectId]/report-history/`, `projects/[projectId]/run-status/` | Projects |
| `keywords/`, `prompts/`, `schedule/`, `assign/` | Keywords, prompts, schedule |
| `runs/`, `runs/manual/`, `runs/[runId]/jobs/`, `execute/`, `validate-run/` | Runs and execution |
| `results/overview/`, `results/seo/`, `results/ai/` | Results |
| `cron/tick/`, `cron/run-now/`, `worker/poll/` | Cron and worker |
| `archive/`, `log-results/`, `debug/tables/` | Archive, log, debug |

### Monkey (landing/article pipeline) – `api/monkey/`

- `route.js` – Monkey entry
- `landing-page/` – step1, step2, step4, write-article, write-article-open, review-research, generate-prompt, convert-idea
- `campaign-with-details/`, `run-task/` – Campaign details, run task

### Eden & V0

- `eden/chat/`, `eden/image/`, `eden/models/`, `eden/tts/`, `eden/video/` – Eden APIs
- `v0/fetch-chat/`, `v0/generate-page/`, `v0/generate-with-files/` – V0 generation

### Other API groups

- `api/agents/run/` – Agent run
- `api/ai/route.js` – AI route
- `api/campaigns/` – Campaigns, content ideas, satellites, cluster schedule
- `api/cron/` – Cron jobs, trigger, master, jobs, debug, results
- `api/dataforseo/` – keyword-position, ranking-keywords, related-keywords, search-volume, playground
- `api/planned-satellites/[id]/generate-draft/` – Satellite draft
- `api/templates/` – CRUD, import, reorder, bookmarks, list-custom
- `api/auth/callback/`, `api/user/` – Auth and user
- `api/settings/custom-css/`, `extract-css/` – Settings
- `api/healthz/`, `api/lead/`, `api/insights/`, `api/research/`, `api/monitor/` – Misc

---

## Libs – `libs/`

| Dir / file | Purpose |
|------------|--------|
| **content-magic/** | Article/outline rules, importers, utils, types |
| | `rules/` – createOutline, researchKeywords, researchPrompts, researchInternalLinks, implementKeywords, implementTopics, implementPrompts, benchmarkCompetitors, DetermineMainKeyword, addEeatCredibility, enrichOptimizeUx, repurposeForEveryChannel, addCalendarReminder, publishAsWebpage; `index.js` exports |
| | `importers/` – html-to-canonical-md (ast, cj), markdown-to-html |
| | `utils/` – cleanImageUrlsForSave, sectionKeys, campaignContextCache, addSectionKeysToHtml, uploadV0Images, processCssScoping, etc. |
| | `article-refinement/` – prompts, types, utils |
| | `class.js`, `types.ts`, `pageTypes.js`, `outlineAssembly.js` |
| **monkey.js** | Main Monkey pipeline (landing/article writing, research, steps); exports getPlanContext, assertPlan, getTierById, getTierIdByPriceId |
| **monkey/planContext.js** | PlanContext (tier, limits, has_access); getPlanContext(supabase, userId), assertPlan(plan, feature). **Rule:** API routes must not query `profiles.subscription_plan` or call getTierById for "current user" tier; use getPlanContext and consume PlanContext (and assertPlan for feature checks). |
| **monkey/registry/subscriptionTiers.js** | Tier definitions (id, name, stripe price, monthlyCreditQuota, maxPendingExternal, etc.); getTierById, getLimitsForTierId, getTierIdByPriceId (latter for Stripe webhook only) |
| **monkey/** (TS) | Pipelines (writeArticleLandingPipeline, triagePipeline, organizeOutlinePipeline, etc.), actions (writeSection, reviewArticle, etc.), tools (metering.js, metering_costs.js, external_requests.js, fetchCompetitorPageHtml, dataForSeo, renderers), runtime (callChat, callHtml, modelResolver, providers) |
| **agents/** | Agent runners, session (memory/Supabase), tools (Tavily), agents (landingPageAgent, writeArticleAgent, etc.) |
| **agent-kit/** | workflow.js, INDEX.md, SETUP_GUIDE |
| **ai/eden/** | edenClient, chatGateway, imageGateway, videoGateway, ttsGateway, modelRegistry, rateLimit |
| **cron/** | Cron config, startCron, workers |
| **campaigns/**, **icp/**, **offers/**, **prompts/**, **settings/** | Class modules for entities |
| **visibility_tracker/** | db.js, scheduler/schedule.js, jobs, runs/validate, worker, providers (aiProvider, serpProvider) |
| **supabase/** | client, server, middleware, service, serviceRole |
| **stripe.js**, **resend.js**, **seo.js**, **api.js**, **apiMiddleware.js** | Stripe, email, SEO, API client |
| **reference-for-ai/** | References for AI (entities, modules, page-component-templates, database_references, database-schema.sql, billing-subscription-flow.md, etc.) |
| **shared/** | assertPlainJson, etc. |

---

## Components – `components/`

| Category | Examples |
|----------|----------|
| **Layout / shell** | `ui/Layout/DashboardContainer.js` – Sidebar, CreditMeter, MeteringToggle, OutOfCreditsBanner; `ui/Sidebar/Sidebar.js`, `ui/TopBar/TopBar.js` |
| **Credits / billing** | `CreditMeter.js` – badge, fetches `/api/credits` on mount + throttled focus; `OutOfCreditsBanner.js` – out-of-credits banner, polls credits when visible; `CreditCostBadge.js`, `MeteringToggle.js` |
| **Account / checkout** | `ButtonAccount.js`, `ButtonCheckout.js`, `ButtonSignin.js`, `ButtonSupport.js` |
| **Marketing / landing** | `Header.js`, `Footer.js`, `Hero.js`, `CTA.js`, `Pricing.js`, `FeaturesGrid.js`, etc. |
| **Content Magic** | Used under `app/(private)/content-magic/components/` |

---

## Supabase – `supabase/migrations/`

- Credits/ledger: credit_ledger, meter_spend, meter_grant, user_credits
- Visibility tracker: vt_* tables, prompts, keywords, runs, etc.
- External requests, PAYG wallet, schema updates (see migration filenames)

### Profiles schema (key columns)

| Column | Purpose |
|--------|---------|
| `subscription_plan` | free, starter, pro (see subscriptionTiers.js) |
| `customer_id` | Stripe customer id |
| `price_id` | Stripe price id for current plan |
| `credits_reset_at` | Next monthly grant date |
| `credits_remaining`, `payg_wallet` | Ledger-derived or stored |

---

## Tests – `tests/`

- `article-refinement/` – Refinement step tests (summarize, keywords, QA, etc.), workflow-e2e
- `keyword-implementation-verification.test.js`, `import-features-api.test.js`
- `monkey/` – patch-htmlCheck, placeholder-images
- `setup.js` – Test setup

---

## Docs – `docs/`

- `CODEBASE_INDEX.md` – This file
- `DATABASE_CONVENTIONS.md` – Migration style, profiles schema, tiers vs DB
- `BILLING_ARCHITECTURE.md` – Stripe flow, provisioner, webhook events, PlanContext
- `CODE_RESPONSIBILITY_MAP.md` – Pipeline step → code map
- `AI_MODEL_CONFIGURATION.md`, `MVP_SCOPE.md`, `RETIRE_OLD_PROMPTS_MODULE_PLAN.md`, etc. – Feature and config docs

---

*Last updated from project layout. Use search (e.g. @path or grep) for specific symbols or file names.*
