/**
 * Archive Medium + Low confidence files from _obsolete-report.md (lines 71-233).
 * Excludes: libs/monkey.js, config/ai-models.js, libs/content-magic/rules/implementKeywords.js (in active use).
 */
const fs = require("fs");
const path = require("path");

const ROOT = path.resolve(__dirname, "..");

const EXCLUDE = new Set([
  "libs/monkey.js",
  "config/ai-models.js",
  "libs/content-magic/rules/implementKeywords.js",
]);

const FILES = [
  "app/(private)/agent-playground/components/LandingPagePipeline.js",
  "app/(private)/agent-playground/page.js",
  "app/(private)/agents-compare/page.js",
  "app/(private)/content-magic/components/ArticleContextStrip.js",
  "app/(private)/content-magic/components/ContentMagicEditorCustom.js",
  "app/(private)/content-magic/components/RefinementFullscreenLayout.js",
  "app/(private)/content-magic/components/RefinementStepper.js",
  "app/(private)/dashboard/components/OnboardingChecklist.js",
  "app/(private)/icps/components/ICPView.js",
  "app/(private)/settings/components/ComponentCustomizationTab.js",
  "app/(private)/tests/eden/utils/costPolicy.js",
  "app/api/admin/credits/adjust/route.js",
  "app/api/content-magic/prompts/evaluate-prompt/route.js",
  "app/api/usage/logs/route.js",
  "components/ButtonLead.js",
  "components/FeaturesListicle.js",
  "components/Header_App.js",
  "components/PlaygroundForTesting.js",
  "components/Testimonials11.js",
  "components/Testimonials3.js",
  "components/ui/placeholder-images/generatePlaceholders.ts",
  "config/ai-models.js",
  "libs/apiMiddleware.js",
  "libs/content-magic/article-refinement/types.ts",
  "libs/content-magic/article-refinement/utils.ts",
  "libs/content-magic/importers/html-to-canonical-md.js",
  "libs/content-magic/importers/markdown-to-html.js",
  "libs/content-magic/keywords/structure-analyzer.js",
  "libs/content-magic/rules/implementKeywords.js",
  "libs/content-magic/types.ts",
  "libs/content-magic/utils/addSectionKeysToHtml.ts",
  "libs/content-magic/utils/cleanHtmlMarkers.js",
  "libs/content-magic/utils/cleanHtmlMarkers.ts",
  "libs/content-magic/utils/migrateLegacyOutline.ts",
  "libs/monkey/actions/calculateRelevance.ts",
  "libs/monkey/actions/evaluateTalkPointsCoverage.ts",
  "libs/monkey/actions/generateClarificationQuestions.ts",
  "libs/monkey/actions/inferQuestionType.ts",
  "libs/monkey/actions/refineContentOutline.ts",
  "libs/monkey/pipelines/campaignRoadmapPlanPipeline.ts",
  "libs/monkey/pipelines/icpSuggestPipeline.ts",
  "libs/monkey/pipelines/keywordOutcomeSuggestPipeline.ts",
  "libs/monkey/pipelines/promiseSuggestPipeline.ts",
  "libs/monkey/pipelines/summarizeTalkPointsPipeline.ts",
  "libs/monkey/pipelines/triagePipeline.ts",
  "libs/monkey/pipelines/writeArticleLandingPipeline.ts",
  "libs/monkey/references/campaignSteps/registry.ts",
  "libs/monkey/references/config.ts",
  "libs/monkey/registry/subscriptionTiers.js",
  "libs/monkey/tools/fetchIcpsAndOffers.ts",
  "libs/monkey/tools/metering.js",
  "libs/monkey/tools/monthly_credits_refresh.js",
  "libs/monkey/tools/runtime/callHtml.ts",
  "libs/monkey/tools/runtime/providers/perplexity.ts",
  "libs/monkey/types/prioritization.ts",
  "libs/monkey.js",
  "libs/monkeyClient.js",
  "libs/reference-for-ai/page-component-templates/components/templates/about-page.tsx",
  "libs/reference-for-ai/page-component-templates/components/templates/comparison-page.tsx",
  "libs/reference-for-ai/page-component-templates/components/templates/contact-page.tsx",
  "libs/reference-for-ai/page-component-templates/components/templates/content-page.tsx",
  "libs/reference-for-ai/page-component-templates/components/templates/homepage.tsx",
  "libs/reference-for-ai/page-component-templates/components/templates/landing-page.tsx",
  "libs/reference-for-ai/page-component-templates/components/templates/pricing-page.tsx",
  "libs/reference-for-ai/page-component-templates/components/templates/product-page.tsx",
  "libs/reference-for-ai/page-component-templates/components/templates/resource-page.tsx",
  "libs/reference-for-ai/page-component-templates/components/templates/use-case-page.tsx",
  "libs/reference-for-ai/page-component-templates/components/theme-provider.tsx",
  "libs/reference-for-ai/page-component-templates/components/ui/accordion.tsx",
  "libs/reference-for-ai/page-component-templates/components/ui/alert-dialog.tsx",
  "libs/reference-for-ai/page-component-templates/components/ui/alert.tsx",
  "libs/reference-for-ai/page-component-templates/components/ui/aspect-ratio.tsx",
  "libs/reference-for-ai/page-component-templates/components/ui/avatar.tsx",
  "libs/reference-for-ai/page-component-templates/components/ui/badge.tsx",
  "libs/reference-for-ai/page-component-templates/components/ui/breadcrumb.tsx",
  "libs/reference-for-ai/page-component-templates/components/ui/button-group.tsx",
  "libs/reference-for-ai/page-component-templates/components/ui/button.tsx",
  "libs/reference-for-ai/page-component-templates/components/ui/calendar.tsx",
  "libs/reference-for-ai/page-component-templates/components/ui/card.tsx",
  "libs/reference-for-ai/page-component-templates/components/ui/carousel.tsx",
  "libs/reference-for-ai/page-component-templates/components/ui/chart.tsx",
  "libs/reference-for-ai/page-component-templates/components/ui/checkbox.tsx",
  "libs/reference-for-ai/page-component-templates/components/ui/collapsible.tsx",
  "libs/reference-for-ai/page-component-templates/components/ui/command.tsx",
  "libs/reference-for-ai/page-component-templates/components/ui/context-menu.tsx",
  "libs/reference-for-ai/page-component-templates/components/ui/dialog.tsx",
  "libs/reference-for-ai/page-component-templates/components/ui/drawer.tsx",
  "libs/reference-for-ai/page-component-templates/components/ui/dropdown-menu.tsx",
  "libs/reference-for-ai/page-component-templates/components/ui/empty.tsx",
  "libs/reference-for-ai/page-component-templates/components/ui/field.tsx",
  "libs/reference-for-ai/page-component-templates/components/ui/form.tsx",
  "libs/reference-for-ai/page-component-templates/components/ui/hover-card.tsx",
  "libs/reference-for-ai/page-component-templates/components/ui/input-group.tsx",
  "libs/reference-for-ai/page-component-templates/components/ui/input-otp.tsx",
  "libs/reference-for-ai/page-component-templates/components/ui/input.tsx",
  "libs/reference-for-ai/page-component-templates/components/ui/item.tsx",
  "libs/reference-for-ai/page-component-templates/components/ui/kbd.tsx",
  "libs/reference-for-ai/page-component-templates/components/ui/label.tsx",
  "libs/reference-for-ai/page-component-templates/components/ui/menubar.tsx",
  "libs/reference-for-ai/page-component-templates/components/ui/navigation-menu.tsx",
  "libs/reference-for-ai/page-component-templates/components/ui/pagination.tsx",
  "libs/reference-for-ai/page-component-templates/components/ui/popover.tsx",
  "libs/reference-for-ai/page-component-templates/components/ui/progress.tsx",
  "libs/reference-for-ai/page-component-templates/components/ui/radio-group.tsx",
  "libs/reference-for-ai/page-component-templates/components/ui/resizable.tsx",
  "libs/reference-for-ai/page-component-templates/components/ui/scroll-area.tsx",
  "libs/reference-for-ai/page-component-templates/components/ui/select.tsx",
  "libs/reference-for-ai/page-component-templates/components/ui/separator.tsx",
  "libs/reference-for-ai/page-component-templates/components/ui/sheet.tsx",
  "libs/reference-for-ai/page-component-templates/components/ui/sidebar.tsx",
  "libs/reference-for-ai/page-component-templates/components/ui/skeleton.tsx",
  "libs/reference-for-ai/page-component-templates/components/ui/slider.tsx",
  "libs/reference-for-ai/page-component-templates/components/ui/sonner.tsx",
  "libs/reference-for-ai/page-component-templates/components/ui/spinner.tsx",
  "libs/reference-for-ai/page-component-templates/components/ui/switch.tsx",
  "libs/reference-for-ai/page-component-templates/components/ui/table.tsx",
  "libs/reference-for-ai/page-component-templates/components/ui/tabs.tsx",
  "libs/reference-for-ai/page-component-templates/components/ui/textarea.tsx",
  "libs/reference-for-ai/page-component-templates/components/ui/toast.tsx",
  "libs/reference-for-ai/page-component-templates/components/ui/toaster.tsx",
  "libs/reference-for-ai/page-component-templates/components/ui/toggle-group.tsx",
  "libs/reference-for-ai/page-component-templates/components/ui/toggle.tsx",
  "libs/reference-for-ai/page-component-templates/components/ui/tooltip.tsx",
  "libs/reference-for-ai/page-component-templates/components/ui/use-mobile.tsx",
  "libs/reference-for-ai/page-component-templates/components/ui/use-toast.ts",
  "libs/reference-for-ai/page-component-templates/hooks/use-mobile.ts",
  "libs/reference-for-ai/page-component-templates/hooks/use-toast.ts",
  "libs/reference-for-ai/page-component-templates/lib/utils.ts",
  "libs/reference-for-ai/sample_stripe_code/server.js",
  "libs/rendering/index.js",
  "next-env.d.ts",
  "next-sitemap.config.js",
  "scripts/check-asset-saves.js",
  "scripts/dev-with-stripe.js",
  "scripts/generate-placeholder-images.js",
  "scripts/seed-metering-test-data.js",
  "tests/article-refinement/step-1-summarize-insights.test.js",
  "tests/article-refinement/step-2-keyword-strategy.test.js",
  "tests/article-refinement/step-3-qa-targeting.test.js",
  "tests/article-refinement/step-4-competitor-mining.test.js",
  "tests/article-refinement/step-5-placement-suggestions.test.js",
  "tests/article-refinement/step-6-change-checklist.test.js",
  "tests/article-refinement/step-7-implement-changes.test.js",
  "tests/article-refinement/step-8-internal-linking.test.js",
  "tests/article-refinement/step-9-final-review.test.js",
  "tests/article-refinement/test-runner.js",
  "tests/article-refinement/utils.test.js",
  "tests/article-refinement/workflow-e2e.test.js",
  "tests/content-magic/resolveRelativeUrlsInHtml.test.js",
  "tests/import-features-api.test.js",
  "tests/keyword-implementation-verification.test.js",
  "tests/monkey/patch-htmlCheck.test.ts",
  "tests/monkey/placeholder-images.test.ts",
  "tests/production-hardening.test.js",
  "tests/setup.js",
  "vitest.config.js",
  "ARTICLE_REPETITION_FIXES.md",
  "CONTENT_FORMAT_SYSTEM.md",
  "CREDIT_SYSTEM_IMPLEMENTATION.md",
  "IMPLEMENTATION_EVALUATION.md",
  "OUTLINE_V0_IMPLEMENTATION_GUIDE.md",
  "README.md",
  "RESTART_REQUIRED.md",
];

function archiveComment(originalPath, ext) {
  const line = `ARCHIVED: Original path was ${originalPath}`;
  if (ext === ".md") return `<!-- ${line} -->\n\n`;
  return `// ${line}\n\n`;
}

let done = 0;
let skipped = 0;
let excluded = 0;

for (const rel of FILES) {
  if (EXCLUDE.has(rel)) {
    excluded++;
    continue;
  }
  const src = path.join(ROOT, rel);
  if (!fs.existsSync(src)) {
    skipped++;
    continue;
  }
  const ext = path.extname(rel).toLowerCase();
  const content = fs.readFileSync(src, "utf8");
  const comment = archiveComment(rel, ext);
  const newContent = comment + content;
  const dest = path.join(ROOT, "_archive", rel);
  const destDir = path.dirname(dest);
  if (!fs.existsSync(destDir)) {
    fs.mkdirSync(destDir, { recursive: true });
  }
  fs.writeFileSync(dest, newContent, "utf8");
  fs.unlinkSync(src);
  done++;
}

