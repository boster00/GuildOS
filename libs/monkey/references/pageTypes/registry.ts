/**
 * Marketing Page Types and Section Types Registry
 * Defines page types, section types, and their configurations
 */

export enum MarketingPageType {
  QUOTE_CONSULTATION_SERVICE = "QUOTE_CONSULTATION_SERVICE",
  DEMO_TRIAL_SAAS = "DEMO_TRIAL_SAAS",
  LEAD_MAGNET_DOWNLOAD = "LEAD_MAGNET_DOWNLOAD",
  DISCOUNT_PROMOTION = "DISCOUNT_PROMOTION",
  WEBINAR_EVENT_REGISTRATION = "WEBINAR_EVENT_REGISTRATION",
  HOMEPAGE = "HOMEPAGE",
  BASE_UNIVERSAL = "BASE_UNIVERSAL",
  COMPARISON_ALTERNATIVES = "COMPARISON_ALTERNATIVES",
  PROOF_HEAVY_CASE_STUDY = "PROOF_HEAVY_CASE_STUDY",
  USE_CASE_ROLE_BASED = "USE_CASE_ROLE_BASED",
  RESOURCE_LIBRARY = "RESOURCE_LIBRARY",
  PRODUCT_CATEGORY = "PRODUCT_CATEGORY",
  THANK_YOU_CONFIRMATION = "THANK_YOU_CONFIRMATION",
  CAREERS_JOB_LISTING = "CAREERS_JOB_LISTING",
  PARTNERSHIP_AFFILIATE = "PARTNERSHIP_AFFILIATE",
}

export type SectionType =
  | "HERO_VALUE_PROP"
  | "PROCESS_HOW_IT_WORKS"
  | "BENEFITS_FEATURES"
  | "PROOF_SOCIAL"
  | "PRICING"
  | "FAQ"
  | "CTA_BANNER"
  | "USE_CASES"
  | "COMPARISON_TABLE"
  | "TESTIMONIALS"
  | "CASE_STUDIES"
  | "TEAM_ABOUT"
  | "RESOURCES"
  | "CONTACT_FORM"
  // Extended section types used by refineContentOutline / writeArticleLandingPipeline
  | "HERO"
  | "CONVERSION_BLOCK"
  | "BENEFITS"
  | "CAPABILITIES_FIT"
  | "DELIVERABLES"
  | "SCOPE_AND_REQUIREMENTS"
  | "SOCIAL_PROOF"
  | "COMPARISON"
  | "PRICING_OR_QUOTE_LOGIC"
  | "RISK_REVERSAL"
  | "FAQ_OBJECTIONS"
  | "TRUST_CREDENTIALS"
  | "RESOURCES_RELATED"
  | "URGENCY"
  | "EVENT_DETAILS"
  | "LEAD_MAGNET_VALUE"
  | "ROI_CALCULATOR";

export interface PageTypeConfig {
  pageType: MarketingPageType;
  recommended_sections: SectionType[];
  optional_sections: SectionType[];
  primary_goals_supported: string[];
  [key: string]: any;
}

export interface SectionTemplate {
  sectionType: SectionType;
  purpose: string;
  inclusion_rules?: string[];
  boundaries?: string[];
  anti_patterns?: string[];
  recommended_formats?: string[];
  [key: string]: any;
}

// Page Type Configurations
const PAGE_TYPE_CONFIGS: Record<MarketingPageType, PageTypeConfig> = {
  [MarketingPageType.BASE_UNIVERSAL]: {
    pageType: MarketingPageType.BASE_UNIVERSAL,
    recommended_sections: [
      "HERO_VALUE_PROP",
      "BENEFITS_FEATURES",
      "PROCESS_HOW_IT_WORKS",
      "PROOF_SOCIAL",
      "CTA_BANNER",
    ],
    optional_sections: [
      "FAQ",
      "PRICING",
      "TESTIMONIALS",
      "USE_CASES",
    ],
    primary_goals_supported: ["quote", "contact", "demo"],
  },
  [MarketingPageType.QUOTE_CONSULTATION_SERVICE]: {
    pageType: MarketingPageType.QUOTE_CONSULTATION_SERVICE,
    recommended_sections: [
      "HERO_VALUE_PROP",
      "BENEFITS_FEATURES",
      "PROCESS_HOW_IT_WORKS",
      "PROOF_SOCIAL",
      "CTA_BANNER",
    ],
    optional_sections: ["FAQ", "PRICING", "TESTIMONIALS"],
    primary_goals_supported: ["quote", "contact"],
  },
  [MarketingPageType.DEMO_TRIAL_SAAS]: {
    pageType: MarketingPageType.DEMO_TRIAL_SAAS,
    recommended_sections: [
      "HERO_VALUE_PROP",
      "BENEFITS_FEATURES",
      "USE_CASES",
      "PROOF_SOCIAL",
      "CTA_BANNER",
    ],
    optional_sections: ["FAQ", "PRICING", "TESTIMONIALS"],
    primary_goals_supported: ["demo", "trial"],
  },
  [MarketingPageType.LEAD_MAGNET_DOWNLOAD]: {
    pageType: MarketingPageType.LEAD_MAGNET_DOWNLOAD,
    recommended_sections: [
      "HERO_VALUE_PROP",
      "BENEFITS_FEATURES",
      "RESOURCES",
      "CTA_BANNER",
    ],
    optional_sections: ["FAQ", "TESTIMONIALS"],
    primary_goals_supported: ["download"],
  },
  [MarketingPageType.DISCOUNT_PROMOTION]: {
    pageType: MarketingPageType.DISCOUNT_PROMOTION,
    recommended_sections: [
      "HERO_VALUE_PROP",
      "BENEFITS_FEATURES",
      "PRICING",
      "CTA_BANNER",
    ],
    optional_sections: ["FAQ", "TESTIMONIALS"],
    primary_goals_supported: ["purchase"],
  },
  [MarketingPageType.WEBINAR_EVENT_REGISTRATION]: {
    pageType: MarketingPageType.WEBINAR_EVENT_REGISTRATION,
    recommended_sections: [
      "HERO_VALUE_PROP",
      "BENEFITS_FEATURES",
      "PROCESS_HOW_IT_WORKS",
      "CTA_BANNER",
    ],
    optional_sections: ["FAQ", "TESTIMONIALS"],
    primary_goals_supported: ["register"],
  },
  [MarketingPageType.HOMEPAGE]: {
    pageType: MarketingPageType.HOMEPAGE,
    recommended_sections: [
      "HERO_VALUE_PROP",
      "BENEFITS_FEATURES",
      "USE_CASES",
      "CTA_BANNER",
    ],
    optional_sections: ["FAQ", "TESTIMONIALS", "RESOURCES"],
    primary_goals_supported: ["browse", "demo", "contact"],
  },
  [MarketingPageType.COMPARISON_ALTERNATIVES]: {
    pageType: MarketingPageType.COMPARISON_ALTERNATIVES,
    recommended_sections: [
      "HERO_VALUE_PROP",
      "COMPARISON_TABLE",
      "BENEFITS_FEATURES",
      "CTA_BANNER",
    ],
    optional_sections: ["FAQ", "TESTIMONIALS"],
    primary_goals_supported: ["purchase", "quote"],
  },
  [MarketingPageType.PROOF_HEAVY_CASE_STUDY]: {
    pageType: MarketingPageType.PROOF_HEAVY_CASE_STUDY,
    recommended_sections: [
      "HERO_VALUE_PROP",
      "CASE_STUDIES",
      "PROOF_SOCIAL",
      "CTA_BANNER",
    ],
    optional_sections: ["TESTIMONIALS", "FAQ"],
    primary_goals_supported: ["quote", "contact"],
  },
  [MarketingPageType.USE_CASE_ROLE_BASED]: {
    pageType: MarketingPageType.USE_CASE_ROLE_BASED,
    recommended_sections: [
      "HERO_VALUE_PROP",
      "USE_CASES",
      "BENEFITS_FEATURES",
      "CTA_BANNER",
    ],
    optional_sections: ["FAQ", "TESTIMONIALS"],
    primary_goals_supported: ["demo", "trial"],
  },
  [MarketingPageType.RESOURCE_LIBRARY]: {
    pageType: MarketingPageType.RESOURCE_LIBRARY,
    recommended_sections: [
      "HERO_VALUE_PROP",
      "RESOURCES",
      "CTA_BANNER",
    ],
    optional_sections: ["FAQ", "TESTIMONIALS"],
    primary_goals_supported: ["browse", "download"],
  },
  [MarketingPageType.PRODUCT_CATEGORY]: {
    pageType: MarketingPageType.PRODUCT_CATEGORY,
    recommended_sections: [
      "HERO_VALUE_PROP",
      "BENEFITS_FEATURES",
      "USE_CASES",
      "CTA_BANNER",
    ],
    optional_sections: ["FAQ", "PRICING", "TESTIMONIALS"],
    primary_goals_supported: ["browse", "purchase"],
  },
  [MarketingPageType.THANK_YOU_CONFIRMATION]: {
    pageType: MarketingPageType.THANK_YOU_CONFIRMATION,
    recommended_sections: [
      "HERO_VALUE_PROP",
      "RESOURCES",
      "CTA_BANNER",
    ],
    optional_sections: [],
    primary_goals_supported: ["browse"],
  },
  [MarketingPageType.CAREERS_JOB_LISTING]: {
    pageType: MarketingPageType.CAREERS_JOB_LISTING,
    recommended_sections: [
      "HERO_VALUE_PROP",
      "BENEFITS_FEATURES",
      "TEAM_ABOUT",
      "CTA_BANNER",
    ],
    optional_sections: ["FAQ"],
    primary_goals_supported: ["apply"],
  },
  [MarketingPageType.PARTNERSHIP_AFFILIATE]: {
    pageType: MarketingPageType.PARTNERSHIP_AFFILIATE,
    recommended_sections: [
      "HERO_VALUE_PROP",
      "BENEFITS_FEATURES",
      "PROCESS_HOW_IT_WORKS",
      "CTA_BANNER",
    ],
    optional_sections: ["FAQ", "PRICING"],
    primary_goals_supported: ["register"],
  },
};

// Section Templates (partial: extended section types may have no template yet)
const SECTION_TEMPLATES: Partial<Record<SectionType, SectionTemplate>> = {
  HERO_VALUE_PROP: {
    sectionType: "HERO_VALUE_PROP",
    purpose: "Capture attention immediately with clear value proposition and primary CTA",
    inclusion_rules: [
      "Always include for landing pages",
      "Should clearly state what the offer is and who it's for",
      "Must include primary call-to-action",
    ],
    boundaries: [
      "Do not include detailed features or process steps",
      "Keep it concise and scannable",
    ],
    anti_patterns: [
      "Generic headlines that don't differentiate",
      "Too many CTAs competing for attention",
    ],
    recommended_formats: ["hero", "text_block", "two_column_split"],
  },
  PROCESS_HOW_IT_WORKS: {
    sectionType: "PROCESS_HOW_IT_WORKS",
    purpose: "Explain the process, steps, or methodology in a clear, easy-to-follow format",
    inclusion_rules: [
      "Include when the process is a key differentiator",
      "Use when complexity needs to be simplified",
      "Helpful for service-based offers",
    ],
    boundaries: [
      "Do not include pricing or specific product details",
      "Focus on process, not outcomes",
    ],
    anti_patterns: [
      "Too many steps (keep to 3-7 steps)",
      "Vague or generic process descriptions",
    ],
    recommended_formats: ["steps_timeline", "steps_timeline_icon", "steps_timeline_icon_advanced", "text_block"],
  },
  BENEFITS_FEATURES: {
    sectionType: "BENEFITS_FEATURES",
    purpose: "Highlight key benefits and features that differentiate the offer",
    inclusion_rules: [
      "Include for most landing pages",
      "Focus on benefits over features",
      "Address key pain points",
    ],
    boundaries: [
      "Do not include pricing unless it's a pricing page",
      "Avoid technical jargon without explanation",
    ],
    anti_patterns: [
      "Feature lists without benefit explanation",
      "Too many features (focus on top 3-5)",
    ],
    recommended_formats: ["card_grid", "card_grid_icon", "icon_list", "text_block"],
  },
  PROOF_SOCIAL: {
    sectionType: "PROOF_SOCIAL",
    purpose: "Build trust through social proof, testimonials, and credibility indicators",
    inclusion_rules: [
      "Include when trust is a barrier",
      "Use real testimonials when available",
      "Showcase logos, certifications, or metrics",
    ],
    boundaries: [
      "Do not make false claims",
      "Avoid generic testimonials",
    ],
    anti_patterns: [
      "Fake or overly generic testimonials",
      "Too many logos without context",
    ],
    recommended_formats: ["testimonials", "stats_strip", "quote_block", "card_grid"],
  },
  PRICING: {
    sectionType: "PRICING",
    purpose: "Present pricing information clearly and transparently",
    inclusion_rules: [
      "Include when pricing is a key decision factor",
      "Use for SaaS, products, or service packages",
    ],
    boundaries: [
      "Do not hide fees or additional costs",
      "Avoid confusing pricing structures",
    ],
    anti_patterns: [
      "Hidden pricing or \"contact us\" only",
      "Too many pricing tiers without clear differentiation",
    ],
    recommended_formats: ["pricing_table", "card_grid", "table"],
  },
  FAQ: {
    sectionType: "FAQ",
    purpose: "Address common questions and objections",
    inclusion_rules: [
      "Include when there are common objections",
      "Use for complex offers that need explanation",
    ],
    boundaries: [
      "Do not include questions that should be in other sections",
      "Keep answers concise",
    ],
    anti_patterns: [
      "Too many questions (focus on top 5-7)",
      "Vague or unhelpful answers",
    ],
    recommended_formats: ["faq_accordion", "text_block"],
  },
  CTA_BANNER: {
    sectionType: "CTA_BANNER",
    purpose: "Drive action with clear, compelling call-to-action",
    inclusion_rules: [
      "Include at key decision points",
      "Use throughout the page strategically",
    ],
    boundaries: [
      "Do not overuse (max 2-3 per page)",
      "Avoid generic CTAs",
    ],
    anti_patterns: [
      "Weak or generic CTAs like 'Learn More'",
      "Too many competing CTAs",
    ],
    recommended_formats: ["cta_banner", "text_block"],
  },
  USE_CASES: {
    sectionType: "USE_CASES",
    purpose: "Show specific use cases, scenarios, or applications",
    inclusion_rules: [
      "Include when offer serves multiple use cases",
      "Use for role-based or industry-specific targeting",
    ],
    boundaries: [
      "Do not include pricing or process details",
      "Focus on outcomes, not features",
    ],
    anti_patterns: [
      "Generic use cases that don't resonate",
      "Too many use cases without focus",
    ],
    recommended_formats: ["card_grid", "card_grid_icon", "text_block"],
  },
  COMPARISON_TABLE: {
    sectionType: "COMPARISON_TABLE",
    purpose: "Compare options, features, or alternatives side-by-side",
    inclusion_rules: [
      "Include for comparison pages",
      "Use when differentiation is key",
    ],
    boundaries: [
      "Do not make unfair comparisons",
      "Keep comparisons factual and fair",
    ],
    anti_patterns: [
      "Biased or unfair comparisons",
      "Too many columns (keep to 3-4 max)",
    ],
    recommended_formats: ["comparison_table", "table"],
  },
  TESTIMONIALS: {
    sectionType: "TESTIMONIALS",
    purpose: "Showcase customer testimonials and success stories",
    inclusion_rules: [
      "Include when social proof is important",
      "Use real testimonials when available",
    ],
    boundaries: [
      "Do not use fake testimonials",
      "Avoid generic testimonials",
    ],
    anti_patterns: [
      "Fake or overly generic testimonials",
      "Testimonials without context or attribution",
    ],
    recommended_formats: ["testimonials", "quote_block", "card_grid"],
  },
  CASE_STUDIES: {
    sectionType: "CASE_STUDIES",
    purpose: "Present detailed case studies showing real results",
    inclusion_rules: [
      "Include for proof-heavy pages",
      "Use when results are impressive and verifiable",
    ],
    boundaries: [
      "Do not make false claims",
      "Keep case studies factual and verifiable",
    ],
    anti_patterns: [
      "Fake or exaggerated results",
      "Case studies without specific metrics",
    ],
    recommended_formats: ["card_grid", "text_block", "two_column_split"],
  },
  TEAM_ABOUT: {
    sectionType: "TEAM_ABOUT",
    purpose: "Introduce the team, company, or founders",
    inclusion_rules: [
      "Include for personal brands or small teams",
      "Use when team credibility is important",
    ],
    boundaries: [
      "Do not include irrelevant personal information",
      "Keep it professional and relevant",
    ],
    anti_patterns: [
      "Too much personal information",
      "Generic team descriptions",
    ],
    recommended_formats: ["card_grid", "card_grid_icon", "text_block"],
  },
  RESOURCES: {
    sectionType: "RESOURCES",
    purpose: "Provide additional resources, downloads, or related content",
    inclusion_rules: [
      "Include for resource libraries",
      "Use for lead magnets or content hubs",
    ],
    boundaries: [
      "Do not include unrelated resources",
      "Keep resources relevant to the offer",
    ],
    anti_patterns: [
      "Too many resources without organization",
      "Outdated or irrelevant resources",
    ],
    recommended_formats: ["card_grid", "card_grid_icon", "text_block"],
  },
  CONTACT_FORM: {
    sectionType: "CONTACT_FORM",
    purpose: "Provide a way for visitors to get in touch",
    inclusion_rules: [
      "Include when contact is a primary goal",
      "Use for consultation or quote requests",
    ],
    boundaries: [
      "Do not ask for too much information",
      "Keep forms simple and focused",
    ],
    anti_patterns: [
      "Too many required fields",
      "Unclear form purpose",
    ],
    recommended_formats: ["form_block", "text_block"],
  },
};

/**
 * Get page type configuration
 */
export function getPageTypeConfig(pageType: MarketingPageType): PageTypeConfig | null {
  return PAGE_TYPE_CONFIGS[pageType] || null;
}

/**
 * Get section template
 */
export function getSectionTemplate(sectionType: SectionType): SectionTemplate | null {
  return SECTION_TEMPLATES[sectionType] || null;
}
