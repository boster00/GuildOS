// LLM Prompts for Article Refinement Workflow

export const REFINEMENT_PROMPTS = {
  /**
   * Step 1: Summarize Author Insights into Brief
   */
  summarizeInsights: (
    icpName: string,
    offerName: string,
    articleTitle: string,
    primaryKeyword: string,
    authorInsights: string
  ) => `You are helping prepare an article brief.

Context:
- ICP: ${icpName}
- Offer: ${offerName}
- Article title (working): "${articleTitle}"
- Primary outcome/keyword: ${primaryKeyword}

Author's raw notes about this article:

${authorInsights}

Task:
Summarize these notes into a structured brief that will guide drafting and editing.

Return JSON with:
{
  "mustInclude": [
    "Bullet point: a specific idea, story, data point, or angle that must be included."
  ],
  "niceToInclude": [
    "Optional ideas that are good to include if space allows."
  ],
  "avoid": [
    "Things to avoid (claims, phrases, angles, mistakes)."
  ],
  "clarifiedPurpose": "One sentence explaining the main job of this article for this ICP."
}

Do not rewrite the article; only summarize the author's intent.`,

  /**
   * Step 2: Secondary Keyword Strategy
   */
  keywordStrategy: (
    icpName: string,
    offerName: string,
    articleTitle: string,
    primaryKeyword: string,
    targetWordCount: number,
    candidateKeywords: Array<{ keyword: string; volume?: number }>
  ) => `You are a content strategist choosing secondary keywords for one article.

Context:
- ICP: ${icpName}
- Offer: ${offerName}
- Article title: "${articleTitle}"
- Primary keyword: ${primaryKeyword}
- Article length target: ${targetWordCount} words (approx).

Candidate keywords with search volumes:
${candidateKeywords.map(k => `- ${k.keyword}${k.volume ? ` (${k.volume} searches/month)` : ''}`).join('\n')}

Task:
1) Recommend a sensible number of secondary keywords for this article, given its topic and length.
2) From the candidate list, select 5–10 good secondary keywords:
   - Strong relevance to the primary keyword and ICP.
   - Mix of "must-have" and "nice-to-have" terms.
3) Briefly explain why each chosen keyword is useful.

Return JSON:
{
  "recommendedSecondaryCount": <number>,
  "selectedKeywords": [
    {
      "keyword": "keyword phrase",
      "reason": "Short reason this is a good fit.",
      "priority": "high|medium|low"
    }
  ]
}

Do not rewrite the article. Focus only on keyword selection strategy.`,

  /**
   * Step 3: Q&A Targeting
   */
  qaTargeting: (
    icpName: string,
    offerName: string,
    articleTitle: string,
    primaryKeyword: string,
    selectedKeywords: Array<{ keyword: string; priority: string }>,
    outlineJson: string
  ) => `You are designing Q&A-style blocks to align with how users ask AI or search engines.

Context:
- ICP: ${icpName}
- Offer: ${offerName}
- Article title: "${articleTitle}"
- Primary keyword: ${primaryKeyword}
- Selected secondary keywords:
${selectedKeywords.map(k => `- ${k.keyword} (${k.priority} priority)`).join('\n')}

Current outline:
${outlineJson}

Task:
1) Propose 5–10 realistic questions that this ICP would ask an AI assistant or search engine,
   based on the primary + secondary keywords and the article's purpose.
2) For each question, suggest:
   - A short answer angle (1 sentence summary of what the answer should do).
   - The best section in the outline to insert it, by section_id or title.

Return JSON:
[
  {
    "question": "Natural language question the ICP would ask.",
    "answerAngle": "One-sentence description of the answer angle.",
    "sectionTarget": "section_id or section title where this Q&A fits best."
  }
]

Do not write full Q&A answers. Only design questions and placements.`,

  /**
   * Step 4: Competitor Content Mining
   */
  competitorMining: (
    icpName: string,
    offerName: string,
    articleTitle: string,
    primaryKeyword: string,
    ourOutlineOrArticle: string,
    competitorSummaries: string
  ) => `You are analyzing competitor content to find ideas this article might be missing.

Context:
- ICP: ${icpName}
- Offer: ${offerName}
- Article title: "${articleTitle}"
- Primary keyword: ${primaryKeyword}

Our current outline (and/or article):
${ourOutlineOrArticle}

Top competitor content summaries (for the same primary keyword):
${competitorSummaries}

Task:
1) Identify 5–15 specific topic ideas, sections, or angles that competitors cover which we either:
   - Do NOT cover at all, or
   - Cover weakly or only in passing.
2) For each idea, explain:
   - Why it might matter to this ICP.
   - Whether you consider it "essential", "worth considering", or "optional" for our article.

Return JSON:
[
  {
    "idea": "Short description of the missing/weak topic.",
    "whyItMatters": "1–2 sentences about why this might matter.",
    "importance": "essential|consider|optional"
  }
]

Do not rewrite our article. Only propose missing or underdeveloped ideas.`,

  /**
   * Step 5: Placement Suggestions
   */
  placementSuggestions: (
    articleTitle: string,
    outlineJson: string,
    selectedKeywords: Array<{ keyword: string; priority: string }>,
    approvedQa: Array<{ question: string; answerAngle: string; sectionTarget: string }>,
    approvedCompetitorIdeas: Array<{ idea: string; whyItMatters: string; importance: string }>
  ) => `You are assigning where new ideas should live inside the article outline.

Context:
- Article title: "${articleTitle}"

Outline:
${outlineJson}

Secondary keywords to feature:
${selectedKeywords.map(k => `- ${k.keyword} (${k.priority} priority)`).join('\n')}

Approved Q&A items:
${approvedQa.map(q => `- Q: ${q.question}\n  A: ${q.answerAngle}\n  Target: ${q.sectionTarget}`).join('\n\n')}

Approved competitor-inspired ideas:
${approvedCompetitorIdeas.map(i => `- ${i.idea}\n  Why: ${i.whyItMatters}\n  Importance: ${i.importance}`).join('\n\n')}

Task:
For EACH of the above items (keywords, Q&A, ideas), suggest:
- Which section it belongs in (section_id or title).
- How it should appear:
  - "subheading"
  - "paragraph"
  - "Q&A block"
  - "example / mini-case"
- A short note on how to weave it in without breaking flow.

Return JSON:
{
  "placements": [
    {
      "type": "keyword|qa|idea",
      "source": "the keyword/question/idea text itself",
      "sectionTarget": "section_id or section title",
      "role": "subheading|paragraph|qa_block|example",
      "note": "Short guidance for how to integrate it."
    }
  ]
}

Do not write article text. Only suggest placements and roles.`,

  /**
   * Step 6: Change Checklist
   */
  changeChecklist: (
    articleTitle: string,
    outlineJson: string,
    placementsJson: string,
    approvedCompetitorIdeasJson: string
  ) => `You are summarizing proposed changes so a human editor can review them.

Context:
- Article title: "${articleTitle}"

Inputs:
- Outline:
${outlineJson}

- Keyword placements:
${placementsJson}

- Competitor ideas:
${approvedCompetitorIdeasJson}

Task:
Summarize the proposed changes as a review checklist.

Return JSON:
[
  {
    "id": "change_1",
    "label": "Short label, e.g. 'Add Q&A on X to section Y'",
    "description": "1–2 sentence description of what would change.",
    "category": "keyword|qa|new_topic|structure|other"
  }
]

Do not rewrite the article. Only summarize the changes so a human can accept/deny them.`,

  /**
   * Step 7: AI-Assisted Implementation
   */
  implementChanges: (
    icpName: string,
    offerName: string,
    articleTitle: string,
    primaryKeyword: string,
    selectedKeywords: string[],
    articleContent: string,
    approvedChangesJson: string
  ) => `You are an editor applying a set of approved changes to an article.

Context:
- ICP: ${icpName}
- Offer: ${offerName}
- Article title: "${articleTitle}"
- Primary keyword: ${primaryKeyword}
- Secondary keywords: ${selectedKeywords.join(', ')}

Current article:
${articleContent}

Approved changes:
${approvedChangesJson}

Task:
Update the article content to implement these changes while:
- Preserving the author's voice and key ideas.
- Keeping the structure and headings as similar as possible unless a change explicitly alters them.
- Integrating Q&A blocks and new topics where indicated.
- Making keyword use feel natural, not stuffed.

Return JSON:
{
  "updatedArticle": "Full updated article text.",
  "changelog": [
    "Short bullet describing each major change applied."
  ]
}

Do not add new changes beyond those approved. Focus on clean implementation.`,

  /**
   * Step 8: Internal Linking
   */
  internalLinking: (
    domain: string,
    articleTitle: string,
    articleUrl: string,
    supportingPageTitle: string,
    supportingPageUrl: string,
    internalCandidatesJson: string,
    articleContent: string
  ) => `You are designing internal links for this article.

Context:
- Site domain: ${domain}
- Article title: "${articleTitle}"
- Article URL (planned or existing): ${articleUrl}
- Main supporting page to link TO: "${supportingPageTitle}" (${supportingPageUrl})
- Other candidate internal pages:
${internalCandidatesJson}

Article content:
${articleContent}

Task:
1) Suggest 2–5 places INSIDE this article where we should add internal links:
   - For each, specify:
     - anchorText: the exact phrase to hyperlink
     - destinationUrl: which page to link to
     - reason: why this link helps the reader.
2) Suggest 1–3 instructions for links FROM other pages TO this article, especially from the main supporting page.

Return JSON:
{
  "linksFromThisArticle": [
    {
      "anchorText": "exact phrase in the article",
      "destinationUrl": "https://...",
      "reason": "Why this link helps."
    }
  ],
  "linksToThisArticle": [
    {
      "sourcePage": "supporting page title or URL",
      "suggestedAnchorContext": "Short description of where and how to link.",
      "reason": "Why pointing to this article is useful."
    }
  ]
}

Do not rewrite the article; only suggest internal linking opportunities.`,

  /**
   * Step 9: Final Editorial Review
   */
  finalReview: (
    icpName: string,
    offerName: string,
    articleTitle: string,
    primaryKeyword: string,
    selectedKeywords: string[],
    articleContent: string
  ) => `You are reviewing a draft article for SEO, GEO (AI search), and UX.

Context:
- ICP: ${icpName}
- Offer: ${offerName}
- Article title: "${articleTitle}"
- Primary keyword: ${primaryKeyword}
- Secondary keywords: ${selectedKeywords.join(', ')}

Article content:
${articleContent}

Task:
Evaluate this article on:
1) SEO basics: H1, headings, natural keyword usage, meta-description-level summary.
2) GEO readiness: does it clearly answer a few likely AI-style questions, reference the ICP identity, and give a concrete next step?
3) UX: scannability (headings, bullets), paragraph length, clarity of CTA.

OUTPUT FORMAT (STRICT):

First line:
Score: <number>/100

Second line:
Verdict: <Good|Meh|Bad>

Then 3–10 feedback rows, ordered from most important to least important:

For must-fix issues:
! <Short label>: <Short, actionable suggestion with section reference if possible>

For strengths:
✅ <Short label>: <Short line about what works well>

For nice-to-have suggestions:
→ <Short label>: <Short, specific improvement>

Guidelines:
- Focus on a few high-impact issues, not nitpicking.
- When you say something needs improvement, be concrete (e.g., "Add primary keyword to H1" or "Split section 3 into 2 subheadings").
- Do NOT rewrite the article here; only give feedback.`
};

