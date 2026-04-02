/**
 * Tutorial registry: single source of truth for tutorial videos.
 * Rule-linked tutorials come from rule meta (tutorialTitle, tutorialURL).
 * Standalone tutorials (no matching rule) are defined here.
 */

import { getRule } from "../rules/index";

// Step keys used by RefinementStepper may differ from rule keys (e.g. add_offer_and_icp -> determine_main_keyword)
const STEP_KEY_TO_RULE_KEY = {
  add_offer_and_icp: "determine_main_keyword",
};

// Display order for the Tutorials page: rule keys and standalone entries in sequence.
// Order: 1, 2, 3, 4, 5, 6, 7.1, 7.2, 8, 9, bonus. 7.1 is the default featured video (index 6).
const TUTORIAL_PAGE_ORDER = [
  { type: "standalone", title: "CJGEO Tutorial 1: create an article", shareUrl: "https://www.loom.com/share/eb5707c1bfc047f3964c99e0570accfe" },
  { type: "rule", ruleKey: "determine_main_keyword" },
  { type: "rule", ruleKey: "benchmark_competitors" },
  { type: "rule", ruleKey: "research_keywords" },
  { type: "rule", ruleKey: "research_prompts" },
  { type: "rule", ruleKey: "research_internal_links" },
  { type: "rule", ruleKey: "create_outline" }, // 7.1 - default featured
  { type: "standalone", title: "CJGEO Tutorial 7.2: Importing and Improving Existing Web Pages Made Easy! 🌐", shareUrl: "https://www.loom.com/share/d27a8e327e874eb296f42082a0c46516" },
  { type: "rule", ruleKey: "implement_keywords" },
  { type: "rule", ruleKey: "repurpose_for_every_channel" },
  { type: "standalone", title: "CJGEO Tutorial bonus 1: set up custom styling and custom templates", shareUrl: "https://www.loom.com/share/a0b96cb428d74d9b9c4533e07d956a0a" },
];

/**
 * Returns ordered list of tutorial videos for the Tutorials page.
 * Each item: { title, shareUrl }.
 * Uses rule meta for rule-linked tutorials and inline definitions for standalone tutorials.
 */
export function getTutorialVideos() {
  return TUTORIAL_PAGE_ORDER.map((entry) => {
    if (entry.type === "standalone") {
      return { title: entry.title, shareUrl: entry.shareUrl };
    }
    const rule = getRule(entry.ruleKey);
    const url = rule?.meta?.tutorialURL;
    const title = rule?.meta?.tutorialTitle;
    if (!url || !title) return null;
    return { title, shareUrl: url };
  }).filter(Boolean);
}

/**
 * Default index for the Tutorials page hero (7.1 = create a new draft).
 */
export const DEFAULT_TUTORIAL_INDEX = 6;

/**
 * Get tutorial URL for a rule key or RefinementStepper step key.
 * @param {string} stepOrRuleKey - Step key (e.g. add_offer_and_icp) or rule key (e.g. research_keywords)
 * @returns {string|null} Tutorial URL or null
 */
export function getTutorialLink(stepOrRuleKey) {
  const ruleKey = STEP_KEY_TO_RULE_KEY[stepOrRuleKey] ?? stepOrRuleKey;
  const rule = getRule(ruleKey);
  return rule?.meta?.tutorialURL ?? null;
}

/**
 * Check if a tutorial exists for a step or rule key.
 * @param {string} stepOrRuleKey
 * @returns {boolean}
 */
export function hasTutorial(stepOrRuleKey) {
  return getTutorialLink(stepOrRuleKey) != null;
}
