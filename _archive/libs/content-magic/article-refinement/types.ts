// ARCHIVED: Original path was libs/content-magic/article-refinement/types.ts

// Article Refinement Workflow Types

export interface AuthorInsights {
  raw: string;
  structured?: {
    mustInclude: string[];
    niceToInclude: string[];
    avoid: string[];
    clarifiedPurpose: string;
  };
}

export interface RefinementBrief {
  mustInclude: string[];
  niceToInclude: string[];
  avoid: string[];
  clarifiedPurpose: string;
}

export interface CandidateKeyword {
  keyword: string;
  volume?: number;
  difficulty?: number;
}

export interface SelectedSecondaryKeyword {
  keyword: string;
  reason: string;
  priority: 'high' | 'medium' | 'low';
}

export interface KeywordStrategy {
  primaryKeyword: string;
  candidateKeywords: CandidateKeyword[];
  selectedSecondaryKeywords: SelectedSecondaryKeyword[];
}

export interface QATarget {
  question: string;
  answerAngle: string;
  sectionTarget: string;
  included?: boolean;
}

export interface CompetitorIdea {
  idea: string;
  whyItMatters: string;
  importance: 'essential' | 'consider' | 'optional';
  included?: boolean;
}

export interface PlacementSuggestion {
  type: 'keyword' | 'qa' | 'idea';
  source: string;
  sectionTarget: string;
  role: 'subheading' | 'paragraph' | 'qa_block' | 'example';
  note: string;
}

export interface ChangeChecklistItem {
  id: string;
  label: string;
  description: string;
  category: 'keyword' | 'qa' | 'new_topic' | 'structure' | 'other';
  accepted: boolean;
}

export interface InternalLinkFrom {
  anchorText: string;
  destinationUrl: string;
  reason: string;
}

export interface InternalLinkTo {
  sourcePage: string;
  suggestedAnchorContext: string;
  reason: string;
}

export interface InternalLinksPlan {
  linksFromThisArticle: InternalLinkFrom[];
  linksToThisArticle: InternalLinkTo[];
}

export interface FinalReviewFeedbackRow {
  type: 'must_fix' | 'strength' | 'suggestion';
  label: string;
  text: string;
}

export interface FinalReview {
  score: number;
  verdict: 'Good' | 'Meh' | 'Bad';
  feedbackRows: FinalReviewFeedbackRow[];
}

export interface ArticleRefinementState {
  authorInsights?: AuthorInsights;
  refinementBrief?: RefinementBrief;
  keywordStrategy?: KeywordStrategy;
  qaTargets?: {
    questions: QATarget[];
  };
  competitorIdeas?: {
    ideas: CompetitorIdea[];
  };
  placementSuggestions?: {
    placements: PlacementSuggestion[];
  };
  changeChecklist?: {
    items: ChangeChecklistItem[];
  };
  internalLinksPlan?: InternalLinksPlan;
  finalReview?: FinalReview;
  implementationResult?: {
    updatedArticle: string;
    changelog: string[];
  };
}

