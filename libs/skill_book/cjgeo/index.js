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
    generateImage: {
      description: "Generate or restyle a UI image using gpt-image-2 via the openai_images weapon.",
      howTo: `
Use \`openai_images\` weapon (\`@/libs/weapon/openai_images\`).

**Generate (text → image):**
\`\`\`js
import { generate } from "@/libs/weapon/openai_images";
const [b64] = await generate({ prompt, size: "1024x1024", quality: "medium" }, userId);
// b64 is a base64 PNG string — decode with Buffer.from(b64, "base64")
\`\`\`

**Edit / style-transfer (image(s) + prompt → image):**
\`\`\`js
import { edit } from "@/libs/weapon/openai_images";
const imageBuffer = Buffer.from(existingB64, "base64");
const [b64] = await edit({ images: [imageBuffer], prompt, size: "1024x1024", quality: "medium" }, userId);
\`\`\`

**Model:** \`gpt-image-2\` — released April 2026, best text rendering, real-world visual fidelity.
**Sizes:** \`1024x1024\` | \`1024x1536\` (portrait) | \`1536x1024\` (landscape) | \`auto\`
**Quality:** \`low\` ($0.011/img) | \`medium\` ($0.042/img) | \`high\` ($0.167/img) — all per 1024×1024.
**DO NOT** pass \`response_format\` — unsupported param, causes error; b64_json is always returned.
**Credential:** OPENAI_API_KEY in profiles.env_vars → process.env fallback.
**Org verification:** gpt-image-2 requires OpenAI org verification; if the call returns a model-access error, the org must be verified at platform.openai.com before this works.

**CJGEO image editor context:**
The CJGEO main editor has an AI image generation panel previously powered by DALL-E
(\`dall-e-3\` or \`dall-e-2\`). The upgrade path is:
1. Find the API route or server action that calls OpenAI for image generation.
2. Change the model from \`dall-e-3\` (or \`dall-e-2\`) to \`gpt-image-2\`.
3. Remove \`response_format: "b64_json"\` from the request body if present — gpt-image-2 ignores it and may error; the response already contains b64_json.
4. Remove the \`style\` param if present — not supported by gpt-image-2.
5. Update supported size options if the UI exposes them (add \`1024x1536\`, \`1536x1024\`; remove \`1792x1024\` / \`1024x1792\` which were DALL-E 3 only).
6. Smoke-test: generate one image end-to-end from the editor UI and confirm it renders.
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
