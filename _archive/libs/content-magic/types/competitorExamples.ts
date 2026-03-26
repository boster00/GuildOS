// ARCHIVED: Original path was libs/content-magic/types/competitorExamples.ts

/**
 * Type definitions for competitor benchmarking and example preservation
 * 
 * These types support the enhanced competitor analysis flow that preserves
 * concrete examples with strategic insights throughout the content generation pipeline.
 */

/**
 * A single competitor example with strategic analysis
 */
export interface CompetitorExample {
  /** Exact text from the competitor (100-300 chars that captures the key insight) */
  snippet: string;
  
  /** URL of the competitor page where this example appears */
  source: string;
  
  /** 
   * Strategic analysis of why this example works
   * Should explain psychological/rhetorical techniques, clarity, specificity, etc.
   */
  strategyInsight: string;
  
  /** 
   * Actionable instructions for how to adapt this for content writing
   * What principles to preserve, what to customize for specific ICP/offer
   */
  writingInstruction: string;
  
  /** 
   * Context for when/where this approach fits best
   * Examples: "hero section", "benefits list", "objection handling", "pricing discussion"
   */
  context: string;
  
  /**
   * Key tactics - short, powerful phrases that are ICP-relevant
   * Examples: ["GLP certified", "24-hour turnaround", "ISO 15189 accredited", "Leica automated platform"]
   * These should be 2-5 words and make sense out of context
   */
  keyTactics?: string[];
}

/**
 * A topic with enriched competitor examples
 * Replaces the old simple topic format with strategic competitor insights
 */
export interface EnrichedTopic {
  /** 
   * The topic label/heading - should be specific and actionable
   * Examples: "Establish credibility through CLIA-certified laboratory standards"
   * NOT: "Establish credibility" (too generic)
   */
  label: string;
  
  /** 
   * Strategic commentary on HOW competitors implement this topic and WHY it works
   * Generated during initial topic extraction from competitor analysis
   */
  strategy?: string;
  
  /** Array of 3-5 concrete competitor examples with strategic analysis */
  competitorExamples: CompetitorExample[];
  
  /** 
   * List of competitor URLs where this topic appears
   * For reference and source attribution
   */
  competitors?: Array<{
    url: string;
    title: string;
  }>;
  
  // Backward compatibility fields
  /** @deprecated Use competitorExamples[0].snippet instead */
  exampleText?: string;
  
  /** @deprecated Use competitorExamples[0].source instead */
  sourceUrl?: string;
  
  /** @deprecated Use strategy field for overall approach, competitorExamples for details */
  notes?: string;
}

/**
 * Assets structure that includes enriched topics
 */
export interface ContentAssets {
  /** Enriched topics with competitor examples */
  topics?: EnrichedTopic[];
  
  /** Keywords extracted from competitors or research */
  keywords?: Array<{
    label: string;
    keyword?: string;
    search_volume?: number | null;
  }>;
  
  /** Content prompts with strategic context */
  prompts?: Array<{
    text: string;
    reason?: string;
    target?: string;
  }>;
  
  /** Main keyword for SEO */
  main_keyword?: string;
  
  /** Original vision/customer pain points */
  original_vision?: string;
  
  /** Other assets... */
  [key: string]: any;
}

/**
 * Utility type guards
 */
export function hasCompetitorExamples(topic: any): topic is EnrichedTopic {
  return topic && 
         Array.isArray(topic.competitorExamples) && 
         topic.competitorExamples.length > 0;
}

export function isValidCompetitorExample(example: any): example is CompetitorExample {
  return example &&
         typeof example.snippet === 'string' &&
         typeof example.source === 'string' &&
         typeof example.strategyInsight === 'string' &&
         typeof example.writingInstruction === 'string' &&
         typeof example.context === 'string';
}

/**
 * Helper to convert old topic format to new enriched format
 */
export function migrateTopicToEnriched(oldTopic: any): EnrichedTopic {
  if (hasCompetitorExamples(oldTopic)) {
    return oldTopic;
  }
  
  // Convert old format to new
  const examples: CompetitorExample[] = [];
  
  if (oldTopic.exampleText || oldTopic.sourceUrl) {
    examples.push({
      snippet: oldTopic.exampleText || '',
      source: oldTopic.sourceUrl || '',
      strategyInsight: oldTopic.notes || oldTopic.strategy || '',
      writingInstruction: '',
      context: '',
    });
  }
  
  return {
    label: oldTopic.label || oldTopic.topic || '',
    strategy: oldTopic.strategy || oldTopic.notes || '',
    competitorExamples: examples,
    exampleText: oldTopic.exampleText,
    sourceUrl: oldTopic.sourceUrl,
    notes: oldTopic.notes,
  };
}
