/**
 * CJGEO skill book — knowledge registry for SEO content writer SaaS.
 */

export const skillBook = {
  id: "cjgeo",
  title: "CJGEO — SEO Content Writer Platform",
  description: "Tactical instructions for CJGEO development: article pipeline, billing, content rendering.",
  steps: [],
  toc: {
    writePipeline: {
      description: "Run or modify the 8-step article writing pipeline.",
      howTo: `
**Pipeline flow:**
1. Interpret Intent → IntentModel (ICP, claims, USPs, competitor hints)
2. Interpret Talk Points → TalkPoint[] (categorized, prioritized)
3. Collect & Validate Competitors → competitor URLs
4. Benchmark + Extract Competitor Talk Points → competitive analysis
5. Plan Sections → SectionPlan[]
6. Choose Sections → selected sections with rationale
7. Write Sections → prose content per section
8. Render HTML → final output

**Key files:**
- Pipeline: \`libs/monkey/pipelines/writeArticleLandingPipeline.ts\`
- Types: \`libs/monkey/references/marketingTypes.ts\` (IntentModel, TalkPoint, SectionPlan)
- Schemas: \`libs/monkey/references/marketingPageSchemas.ts\`
- See \`docs/CODE_RESPONSIBILITY_MAP.md\` for exact line numbers and manual override instructions per step.

**Content Magic asset whitelisting:** Only 4 asset keys allowed in outline generation: main_keyword, topics, keywords, prompts. Never allow arbitrary asset access.

**AI module:** All AI calls route through \`@/libs/monkey\`. Use \`runTask()\` for new features. Model tiers via env vars only, never hardcoded.
`,
    },
    manageBilling: {
      description: "Work with Stripe billing, credits, and subscription tiers.",
      howTo: `
**Stripe provisioning flow:**
Checkout → Webhook → Provisioner → profiles table → PlanContext

**API routes must use:**
\`\`\`javascript
import { getPlanContext } from '@/libs/monkey/registry/planContext';
const plan = await getPlanContext(supabase, userId);
// Use assertPlan(plan, feature) for feature checks
\`\`\`
Never query \`profiles.subscription_plan\` directly.

**Tier definitions:** Live in code ONLY (\`libs/monkey/registry/subscriptionTiers.js\`), NOT in database. Do not create tier tables or seeds.

**Credit philosophy:**
- Consumes credits: external API calls, AI generation, data enrichment
- Free: viewing, basic UI actions, navigation

**Pricing:**
- Starter $99/mo: 500 credits, PAYG $0.50/credit, 1 concurrent process, 1 project
- Pro $399/mo: 4000 credits, PAYG $0.10/credit, 3 concurrent, multi-project

**Credit ledger:** Use \`credit_ledger\` table. Do NOT reintroduce \`api_usage_logs\`.

**Webhook idempotency:** Via \`stripe_webhook_events.event_id\`.
`,
    },
    renderContent: {
      description: "Render content with Shadow DOM CSS isolation.",
      howTo: `
**No @scope CSS** — never generate @scope CSS. Use Shadow DOM for isolation.

**Deprecated functions:** \`_wrapCssInScope\`, \`renderCustomCSS\` — do not use.

**Shadow DOM CSS injection:**
- External CSS: \`<link rel="stylesheet">\` inside shadow \`<head>\`
- Inline CSS: strip scope wrappers, place in \`<style>\` inside shadow root
`,
    },
    databaseMigration: {
      description: "Create or modify database migrations for CJGEO.",
      howTo: `
**After any schema change, run:**
\`\`\`bash
supabase db dump --schema public > libs/reference-for-ai/database-schema.sql
\`\`\`

**Profiles key columns:** subscription_plan (free/starter/pro), stripe_customer_id, stripe_subscription_id, credits_remaining, payg_wallet, credits_reset_at.
`,
    },
  },
};
