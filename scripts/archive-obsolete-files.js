/**
 * One-off: move listed files into _archive/, prepend original-path comment.
 * Run from repo root: node scripts/archive-obsolete-files.js
 */
const fs = require("fs");
const path = require("path");

const ROOT = path.resolve(__dirname, "..");

const FILES = [
  "app/(private)/dashboard/components/MetricsCard.js",
  "app/(private)/dashboard/components/VisibilityChart.js",
  "app/(private)/icps/components/ICPEdit.js",
  "app/(private)/icps/components/ICPNew.js",
  "app/not-found.js",
  "base44_generated_code/Components/icp/WizardStep1.js",
  "base44_generated_code/Components/icp/WizardStep2.js",
  "base44_generated_code/Components/icp/WizardStep3.js",
  "base44_generated_code/Layout.js",
  "base44_generated_code/Pages/Billing.js",
  "base44_generated_code/Pages/Dashboard.js",
  "base44_generated_code/Pages/IcpList.js",
  "base44_generated_code/Pages/IcpWizard.js",
  "base44_generated_code/Pages/PromptEditor.js",
  "base44_generated_code/Pages/PromptList.js",
  "base44_generated_code/Pages/Settings.js",
  "components/BetterIcon.js",
  "components/ButtonGradient.js",
  "components/ButtonPopover.js",
  "components/CTA.js",
  "components/FAQ.js",
  "components/FeaturesAccordion.js",
  "components/FeaturesGrid.js",
  "components/Modal.js",
  "components/Tabs.js",
  "components/Testimonial1Small.js",
  "components/TestimonialRating.js",
  "components/Testimonials1.js",
  "components/ui/TopBar/TopBar.js",
  "components/WithWithout.js",
  "libs/agent-kit/workflow.js",
  "libs/content-magic/class.js",
  "libs/content-magic/references/tutorialLinks.ts",
  "libs/content-magic/types/competitorExamples.ts",
  "libs/cron/config.js",
  "libs/cron/startCron.js",
  "libs/gpt.js",
  "libs/monkey/pipelines/organizeOutlinePipeline.ts",
  "libs/prompts/class.js",
  "libs/resend.js",
  "libs/settings/class.js",
  "postcss.config.js",
  ".claude-instructions.md",
  "API_CENTRALIZATION_SUMMARY.md",
  "ARTICLE_GENERATION_IMPROVEMENTS.md",
  "ARTICLE_QUALITY_IMPROVEMENTS.md",
  "CLARIFICATION_QUESTIONS_IMPROVEMENTS.md",
  "FRONTEND_INTEGRATION_COMPLETE.md",
  "IMPLEMENT_PROMPTS_COMPLETE.md",
  "KEYWORD_IMPLEMENTATION_REFACTOR_COMPLETE.md",
  "PROMPTS_DATA_INTEGRITY_FIX.md",
  "PROMPTS_REFACTOR_COMPLETE.md",
  "TOPICS_IMPLEMENTATION_COMPLETE.md",
  "TOPICS_REFACTOR_COMPLETE.md",
  "V0_FIX_SUMMARY.md",
  "WEBHOOK_FIX.md",
  "_obsolete-report.md",
];

function archiveComment(originalPath, ext) {
  const line = `ARCHIVED: Original path was ${originalPath}`;
  if (ext === ".md") return `<!-- ${line} -->\n\n`;
  return `// ${line}\n\n`;
}

let done = 0;
let skipped = 0;

for (const rel of FILES) {
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

