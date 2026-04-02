// Article Refinement Workflow Rules
import determineMainKeyword from "./DetermineMainKeyword";
import benchmarkCompetitors from "./benchmarkCompetitors";
import researchKeywords from "./researchKeywords";
import researchPrompts from "./researchPrompts";
import researchInternalLinks from "./researchInternalLinks";
import createOutline from "./createOutline";
import getSecondOpinions from "./getSecondOpinions";
import implementTopics from "./implementTopics";
import implementPrompts from "./implementPrompts";
import implementKeywords from "./implementKeywords";
import addEeatCredibility from "./addEeatCredibility";
import enrichOptimizeUx from "./enrichOptimizeUx";
import publishAsWebpage from "./publishAsWebpage";
import repurposeForEveryChannel from "./repurposeForEveryChannel";
import addCalendarReminder from "./addCalendarReminder";

// Rule registry - All rules (including hidden for MVP)
const ALL_RULES = {
  [determineMainKeyword.key]: determineMainKeyword,
  [benchmarkCompetitors.key]: benchmarkCompetitors,
  [researchKeywords.key]: researchKeywords,
  [researchPrompts.key]: researchPrompts,
  [researchInternalLinks.key]: researchInternalLinks,
  [createOutline.key]: createOutline, // First step in Write & Optimize
  [implementTopics.key]: implementTopics, // New: Implement Topics
  [implementPrompts.key]: implementPrompts, // New: Implement Prompts
  [implementKeywords.key]: implementKeywords, // New: Implement Keywords
  [getSecondOpinions.key]: getSecondOpinions, // Get second opinions from multiple AI models
  [addEeatCredibility.key]: addEeatCredibility, // MVP: Hidden (writing feature)
  [enrichOptimizeUx.key]: enrichOptimizeUx, // MVP: Hidden (writing feature)
  [publishAsWebpage.key]: publishAsWebpage, // MVP: Hidden (publishing feature)
  [repurposeForEveryChannel.key]: repurposeForEveryChannel, // Launch: Repurpose for distribution
  [addCalendarReminder.key]: addCalendarReminder, // MVP: Hidden (publishing feature)
};

// MVP: Filter out hidden rules
const HIDDEN_RULES = [
  'publish_as_webpage', // Hidden: publishing feature
  'add_eeat_credibility', // Hidden: writing feature
  'enrich_optimize_ux', // Hidden: Apply UEOs
  'add_calendar_reminder', // Hidden: publishing feature
];
const RULES = Object.fromEntries(
  Object.entries(ALL_RULES).filter(([key]) => !HIDDEN_RULES.includes(key))
);

// Categories - all visible
const CATEGORIES = {
  research_plan: "Research and Plan",
  write_optimize: "Write & Optimize",
  launch: "Launch/Ship",
};

export function getAllRules() {
  return Object.values(RULES);
}

export function getRulesByCategory(category) {
  return getAllRules().filter(rule => rule.meta.category === category);
}

// Allow direct access to de-indexed rules if needed (for internal use)
export function getRule(key) {
  return ALL_RULES[key] || RULES[key];
}

export function getCategories() {
  return CATEGORIES;
}