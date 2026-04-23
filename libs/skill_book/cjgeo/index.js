/**
 * CJGEO skill book — knowledge registry for SEO content writer SaaS.
 */

export const skillBook = {
  id: "cjgeo",
  title: "CJGEO — SEO Content Writer Platform",
  description: "Run CJGEO article-pipeline and content-rendering workflows.",
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
    writeMigration: {
      description: "Write a new database migration for CJGEO and refresh the schema dump.",
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
