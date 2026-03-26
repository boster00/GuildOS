"use client";

import React, { useState, useEffect, useRef } from "react";
import { useRouter } from "next/navigation";
import { ArrowLeft, Save, Info, Sparkles, X, Search, ExternalLink, Loader, Download, Lightbulb, Copy, Check } from "lucide-react";
import { createClient } from "@/libs/supabase/client";
import { getPageOutlineHtml } from "@/libs/content-magic/pageTypes";
import ContentMagicEditor from "@/app/(private)/content-magic/components/ContentMagicEditor";
import { WritingGuideProvider } from "@/libs/content-magic/context/WritingGuideContext";
import AI_MODELS from "@/config/ai-models";
import { initMonkey } from "@/libs/monkey";
import CreditCostBadge from "@/components/CreditCostBadge";

// ============================================
// 🎨 AI PROMPT TEMPLATES
// ============================================
// These prompts power the AI suggestions for article creation.
// Edit these to improve AI output quality and alignment with your needs.
// ============================================

const PROMPT_TEMPLATES = {
  
  /**
   * Article Title Generation - Phase 1 & 3
   * Generates 5 HIGH-CONVERSION title options that sound like real landing page titles
   * Output: JSON array of 5 strings
   */
  articleTitle: (icpName, icpDescription, offerName, offerDescription, outcome, peaceOfMind, phaseName, phasePurpose, currentUserInput) => `Generate exactly 5 HIGH-CONVERSION article title options for this ${phaseName}.

Context:
ICP: ${icpName} - ${icpDescription || ''}
Offer: ${offerName}
Offer Description: ${offerDescription || ''}
Desired Outcome: ${outcome || 'improved results'}
${currentUserInput ? `User's Current Title Input: "${currentUserInput}"` : ''}

${phasePurpose}

STRICT Requirements:
- Titles must sound like REAL high-performing landing page / SaaS / e-commerce titles.
- Use concrete, specific phrasing (e.g., numbers, timeframes, quantities).
- Use the ICP's language and mental model—not generic marketing language.
- Avoid inspiration fluff words such as: elevate, transform, empower, unlock, innovate.
- Avoid adjectives that don't add clarity (e.g., exceptional, amazing, powerful).
- If speed is a USP, show it concretely (e.g., "7-day", "48-hour prototype").
- No CTA phrases ("order now", "click here").
- No exclamation marks.
- Keep titles short, clear, and direct.

FOR PHASE 1 (TRANSACTIONAL/LANDING PAGE):
- START with the outcome/main keyword in the FIRST 2-4 WORDS. This is non-negotiable.
- The core message is: what you're looking for is available here.
- USPs, pain points, and identity callouts are OPTIONAL—only include them if they add meaningful differentiation without diluting the main message.
- Evaluate: Does adding details make it clearer or more cluttered? When in doubt, keep it simple.
- The title should pass the "billboard test"—someone driving by should instantly know what's being offered.

FOR PHASE 3 (OUTCOME GUIDE):
- Center the title on the outcome the reader wants to achieve.
- Lead with the outcome, follow with how or for whom if needed.

${currentUserInput ? `- Improve/refine the user's input while keeping the intent.` : '- Generate fresh, high-signal titles based only on the above context.'}

Return ONLY a JSON array of 5 title strings.
Format: ["Title 1", "Title 2", "Title 3", "Title 4", "Title 5"]`,

  /**
   * Article Title Generation - Phase 2 (Comparison Guide)
   * Generates 5 HIGH-CONVERSION title options for comparison-style decision guides
   * Output: JSON array of 5 strings
   */
  articleTitleComparisonGuide: (icpName, icpDescription, offerName, offerDescription, outcome, peaceOfMind, phaseName, phasePurpose, currentUserInput) => `Generate exactly 5 HIGH-CONVERSION title options for a COMPARISON Decision Guide (Phase 2).

This page is for mid-funnel readers who:
- Already know they need help with "${outcome || 'this problem'}"
- Are actively comparing different OPTIONS or STRATEGIES
- Want help deciding which path is right for them

Context (use this for specificity, not for stuffing):
- ICP: ${icpName} - ${icpDescription || 'No description'}
- Offer: ${offerName} - ${offerDescription || 'No description'}
- Promise: ${peaceOfMind || 'No promise specified'}

${phasePurpose}

### STRUCTURE & LENGTH RULES
- Each title must be:
  - MAX 60 characters
  - AND ideally 6–10 words
- NO subtitles or second clauses after a colon or dash.
  - Avoid patterns like "..., in One Plan" or "..., Side-by-Side Strategy Guide".
- One clear idea per title. No "everything and the kitchen sink" phrasing.

### DECISION/KEYWORD RULES
- All titles must clearly signal a COMPARISON or DECISION:
  - e.g., "X vs Y", "Which [option]...", "Best [strategy] for [ICP]"
- Across the 5 titles, vary the angle:
  1) One explicit "X vs Y" or "X vs Y vs Z" option comparison.
  2) One "Which [option/strategy] is right for [ICP]?" style.
  3) One outcome/benefit-focused decision title
     (e.g., "Life Insurance for Business Exit and Retirement").
  4) One that emphasizes a key decision criterion or pain point.
  5) One that focuses on the specific context or situation of the ICP.
- At least ONE title must explicitly reference the ICP
  (e.g., "business owners", "practice owners", or a clear equivalent).
- At least ONE title must reference a concrete solution type or strategy
  (e.g., "key person", "buy-sell", "cash value", "tax-free retirement income"),
  but do NOT list more than TWO concepts in any single title.

### TONE & CLARITY RULES
- Use the ICP's language and mental model, not generic marketing fluff.
- Avoid inspiration fluff verbs: elevate, transform, empower, unlock, innovate.
- Avoid empty adjectives: exceptional, amazing, powerful, world-class.
- Do NOT lead with meta words like "guide", "comparison guide", "strategy guide".
  - If you use "guide" or "comparison", it should be near the END,
    and the title must still fit the length limits.
- No CTA phrases ("order now", "click here").
- No exclamation marks.

User input rule:
${currentUserInput
  ? `- Improve/refine the user's input while keeping the core decision and angle.`
  : '- Generate fresh, high-signal titles based only on the above context.'}

OUTPUT FORMAT:
Return ONLY a JSON array of 5 title strings.
Format: ["Title 1", "Title 2", "Title 3", "Title 4", "Title 5"]`,

  /**
   * Article Title Generation - Phase 2 (Scenario Listicle)
   * Generates 5 HIGH-CONVERSION title options for scenario-based decision guides
   * Output: JSON array of 5 strings
   */
  articleTitleListicle: (icpName, icpDescription, offerName, offerDescription, outcome, peaceOfMind, phaseName, phasePurpose, currentUserInput) => `Generate exactly 5 HIGH-CONVERSION title options for a SCENARIO-BASED Decision Guide (Phase 2).

This page is for mid-funnel readers who:
- Already know they need help with "${outcome || 'this problem'}"
- Are actively looking for solutions that match THEIR specific situation or scenario
- Want help understanding which approach fits their unique context

Context (use this for specificity, not for stuffing):
- ICP: ${icpName} - ${icpDescription || 'No description'}
- Offer: ${offerName} - ${offerDescription || 'No description'}
- Promise: ${peaceOfMind || 'No promise specified'}

${phasePurpose}

### STRUCTURE & LENGTH RULES
- Each title must be:
  - MAX 60 characters
  - AND ideally 6–10 words
- NO subtitles or second clauses after a colon or dash.
  - Avoid patterns like "..., in One Guide" or "..., Complete Scenario Breakdown".
- One clear idea per title. No "everything and the kitchen sink" phrasing.

### SCENARIO / OFFER / ICP RULES
- All titles must clearly signal SCENARIOS or SITUATIONS:
  - e.g., "If You're [Situation A], Do X"
  - e.g., "Which [Solution Type] Is Right for Your [Scenario]?"
  - e.g., "The Right [Solution] for Every [Scenario Type]"
- Across the 5 titles, vary the angle:
  1) One explicit scenario-based conditional
     (e.g., "If you're [scenario A]… If you're [scenario B]…").
  2) One "Which [option/strategy] is right for [specific scenario]?" style.
  3) One **numeric listicle** in the pattern
     "[number] [paths/options/strategies] for [scenario/outcome]".
  4) One that emphasizes situational context or use cases.
  5) One that highlights common mistakes or key considerations.
- At least ONE title must explicitly reference the ICP
  (e.g., "business owners", "practice owners", "lab managers", etc.).
- EVERY title must reference either:
  - a clear solution category related to the offer
    (e.g., "life insurance strategy", "policy structure",
     "ELN", "SEO agency", "CRM setup"),
  OR
  - a close paraphrase of ${offerName}.
- At least ONE title must reference a concrete scenario type or situation
  (e.g., "exit planning", "retirement", "key person", "buy-sell",
   "selling soon", "5–10 years from retirement"),
  but do NOT list more than TWO concepts in any single title.
- Focus on SCENARIOS/SITUATIONS, not just comparisons.
- Use concrete, specific phrasing when possible (e.g., numbers, timeframes, quantities).

### TONE & CLARITY RULES
- Use the ICP's language and mental model, not generic marketing fluff.
- Avoid inspiration fluff verbs: elevate, transform, empower, unlock, innovate.
- Avoid empty adjectives: exceptional, amazing, powerful, world-class.
- Do NOT lead with meta words like "guide", "scenario guide", "complete guide".
  - If you use "guide" or "scenarios", it should be near the END,
    and the title must still fit the length limits.
- No CTA phrases ("order now", "click here").
- No exclamation marks.

User input rule:
${currentUserInput
  ? `- Improve/refine the user's input while keeping the core scenario and angle.`
  : '- Generate fresh, high-signal titles based only on the above context.'}

OUTPUT FORMAT:
Return ONLY a JSON array of 5 title strings.
Format: ["Title 1", "Title 2", "Title 3", "Title 4", "Title 5"]
`,

  /**
   * Article Title Generation - Phase 3 (Outcome Pillar)
   * Generates 5 HIGH-CONVERSION title options for "How to achieve [outcome]" guides
   * Output: JSON array of 5 strings
   * Focuses on BLUF, owner-style reality, double goals, and solution-to-outcome angles
   */
  articleTitleOutcomePillar: (icpName, icpDescription, offerName, offerDescription, outcome, peaceOfMind, phaseName, phasePurpose, currentUserInput) => `Generate exactly 5 HIGH-CONVERSION title options for an OUTCOME PILLAR PAGE (Phase 3).

This page is a "How to achieve [outcome]" roadmap for readers who:
- Clearly want "${outcome || 'a better result'}"
- Feel stuck or uncertain about the path to get there
- Want a realistic, step-by-step way forward

Context (use this for specificity, not for stuffing):
- ICP: ${icpName} - ${icpDescription || 'No description'}
- Offer: ${offerName} - ${offerDescription || 'No description'}
- Promise: ${peaceOfMind || 'No promise specified'}

${phasePurpose}

Your goal:

Write 5 distinct title options that would make THIS ICP feel:
- "This is clearly about the outcome I want"
- "This is written for someone in my situation"
- "This looks like a practical roadmap, not generic advice"

### BASIC RULES
- Each title must be:
  - MAX 60 characters
  - Ideally 6–10 words
- One clear idea per title. No stacked clauses.
- Do NOT use colons or dashes with subtitles.
- No CTA phrases ("order now", "click here").
- No exclamation marks.

### CONTENT & TONE GUIDELINES
- Make it obvious this is about achieving "${outcome}"
  for THIS kind of ICP, not for "everyone".
- Naturally reflect their real situation using the context:
  - e.g. wealth tied up in a business or practice,
    exit/succession planning, family + staff to protect, etc.
- If it feels natural, you MAY mention the solution category
  (e.g. "life insurance strategy", "policy structure", or "${offerName}"),
  but only when it helps clarity.
- Use the ICP's language and mental model.
- Avoid inspiration fluff verbs: elevate, transform, empower, unlock, innovate.
- Avoid empty adjectives: exceptional, amazing, powerful, world-class.

### VARIETY (LIGHT GUIDANCE)
Across the 5 titles, try to vary the angle. For example:
1) One simple, direct "How to [outcome]" title.
2) One that specifies the ICP (e.g., "How [ICP] Can...").
3) One that hints at a benefit, timeframe, or unique approach.
4) One that addresses a common challenge or barrier.
5) One that emphasizes a specific methodology or framework.

Do NOT mechanically follow templates. Choose what feels natural and
high-signal for THIS ICP and offer.

User input rule:
${currentUserInput
  ? `- Improve/refine the user's input while keeping the core outcome and angle.`
  : '- Generate fresh, high-signal titles based only on the above context.'}

OUTPUT FORMAT:
Return ONLY a JSON array of 5 title strings.
Format: ["Title 1", "Title 2", "Title 3", "Title 4", "Title 5"]
`,

  articleTitleSatellite: (icpName, icpDescription, offerName, offerDescription, outcome, peaceOfMind, phaseName, phasePurpose, currentUserInput) => `Generate exactly 5 HIGH-CONVERSION title options for a SATELLITE ARTICLE (Content Cluster - Expand Phase).

This article is part of a content cluster supporting your main pages (Phase 1, 2, 3). It should:
- Draw in traffic for target keywords related to your main content
- Support main pages in SEO and GEO (Generative Engine Optimization)
- Keep fresh content coming to the site (favored by search engines and AIs)

Context (use this for specificity):
- ICP: ${icpName} - ${icpDescription || 'No description'}
- Offer: ${offerName} - ${offerDescription || 'No description'}
- Main Outcome: ${outcome || 'Not specified'}
- Promise: ${peaceOfMind || 'No promise specified'}

${phasePurpose}

STRICT Requirements:
- Titles must be keyword-focused and specific to search queries
- Address long-tail and related search queries your ICP uses
- Use concrete, specific phrasing (e.g., numbers, timeframes, quantities)
- Use the ICP's language and mental model—not generic marketing language
- Avoid inspiration fluff words such as: elevate, transform, empower, unlock, innovate
- Avoid adjectives that don't add clarity (e.g., exceptional, amazing, powerful)
- No CTA phrases ("order now", "click here")
- No exclamation marks
- Keep titles short, clear, and direct (ideally 6-12 words)
- Should feel like a helpful resource, not a sales pitch

${currentUserInput ? `- Improve/refine the user's input while keeping the keyword focus.` : '- Generate fresh, keyword-focused titles based only on the above context.'}

Return ONLY a JSON array of 5 title strings.
Format: ["Title Option 1", "Title Option 2", "Title Option 3", "Title Option 4", "Title Option 5"]
`,

  /**
   * Article Outline Generation
   * Creates modular landing-page content draft (80% complete) with short strategic reasoning
   * Enforces strict word limits (45-90 words per section, hero 40-60 words), exact HTML structure, and scannable format
   * Prevents verbose output, extra sections, and corporate tone drift
   * Output: Structured JSON with HTML content blocks + reasoning field (max 18 words) for each section
   */
  /**
   * Article Outline Generator - Phase 1 (Landing Page)
   */
  articleOutline: (
    icpName,
    icpDescription,
    offerName,
    offerDescription,
    transactionalFacts,
    outcome,
    peaceOfMind,
    articleTitle,
    phaseName,
    phaseDescription,
    phaseInstructions
  ) => `Generate a modular Phase ${phaseInstructions?.phase || ""} "${phaseName}" landing-page draft (page-builder friendly blocks). This is NOT a blog post.
Include short strategic reasoning for each section.

CAMPAIGN CONTEXT
- ICP: ${icpName || "Target customer"}
  ${icpDescription ? `Description: ${icpDescription}` : ""}
- Offer: ${offerName || "Product/Service"}
  ${offerDescription ? `What it does: ${offerDescription}` : ""}
  ${transactionalFacts ? `Transactional facts (only use if present): ${transactionalFacts}` : ""}
- Desired outcome (in their words): ${outcome || "Improved results"}
- Peace of mind / risk reversal: ${peaceOfMind || "Satisfaction guaranteed"}

PAGE META
- Title: "${articleTitle}"
- Purpose: ${phaseDescription}

${phaseInstructions?.instructions || ""}

========================
NON-NEGOTIABLE GUARDRAILS
========================
1) Offer boundary (no scope drift)
- Do NOT introduce additional major offers or capabilities unless explicitly stated in offerName/offerDescription/transactionalFacts.
- If optional add-ons are explicitly present in the inputs, you may mention them once as "optional" (not as the main headline).

2) Evidence-gated trust (no invented proof)
- Do NOT invent: client counts, "leading pharma" claims, awards, satisfaction rates, regulatory recognition, endorsements, case results.
- Use only proof explicitly provided in the inputs.
- If proof is not provided, use conservative credibility language OR placeholders like: [Insert testimonial] / [Insert client logo].

3) Anti-repetition (reduce template feel)
- Each section must add NEW information.
- The same claim (e.g., speed/support/menu) may appear at most twice across the whole page (Hero + one other).
- A step-by-step process may appear only once (either as a process section OR as a brief ease line, not both).

4) CTA realism
- If this is a COMPLEX B2B service, CTA must be one of:
  "Request a quote" / "Talk to a scientist" / "Send requirements" / "Start a project"
- Avoid "order now / click to order" for COMPLEX offers.

========================
STRUCTURE (5–7 SECTIONS)
========================
You may combine adjacent topics to stay within 5–7 sections, but keep the flow in this order:

1) HERO
2) BENEFITS (must start with 1 sentence: ICP identity + painpoint)
3) HOW IT WORKS (ONLY if offer is COMPLEX; otherwise skip)
4) TRUST (evidence-gated; bullets; or merge into Benefits if no proof)
5) KEY DETAILS (ONLY if transactionalFacts provided; table or bullets)
6) FAQ (ONLY if you can infer specific decision-stopping objections)
7) FINAL CTA (single action; include peace-of-mind; no process repetition)

========================
HERO HTML (exact skeleton)
========================
<h1>[benefit-driven headline]</h1>
<p>[What you offer + main outcome. Max 2 sentences.]</p>
<ul>
  <li>[Benefit/fact 1]</li>
  <li>[Benefit/fact 2]</li>
  <li>[Benefit/fact 3]</li>
</ul>
<p><a href="#" class="cta-button">[Primary CTA]</a></p>
<p><em>[Peace-of-mind line]</em></p>
<p><strong>[One trust line OR placeholder]</strong></p>

- If proof is not provided, the trust line must be conservative or a placeholder (no grand claims).

========================
STYLE (light-touch)
========================
- Second person ("you/your"). Keep it scannable.
- Avoid hype/buzzwords and vague superlatives.
- Use natural headings (never internal labels).
- Page-builder HTML: use h1/h2/h3, p, ul/li, and optional table.

========================
OUTPUT FORMAT (JSON only)
========================
Return exactly:
{
  "sections": [
    {
      "heading": "Section Title",
      "reasoning": "Max 18 words.",
      "html": "HTML for the block"
    }
  ]
}
No text outside the JSON.
`,

  /**
   * Article Outline Generator - Phase 2 (Comparison Guide)
   * For decision guides that compare different solution options
   * Generates actual draft content with dynamic, ICP-specific titles
   */
  articleOutlineComparisonGuide: (icpName, icpDescription, offerName, offerDescription, transactionalFacts, outcome, peaceOfMind, articleTitle, phaseName, phaseDescription) => `You are writing a Phase 2 COMPARISON Decision Guide as a DRAFT WEBPAGE.

The reader:
- Already knows they have a problem related to "${outcome || 'their work'}".
- Is actively looking for a solution.
- Is unsure which OPTION / APPROACH to choose.

Campaign context (use it for realism and specificity):
- Offer name: ${offerName || 'Not specified'}
- Offer description: ${offerDescription || 'No description'}
- ICP name: ${icpName || 'Not specified'}
- ICP description: ${icpDescription || 'No description'}
- Promise / guarantee: ${peaceOfMind || 'Not specified'}
- Article title: ${articleTitle || 'Not specified'}
- Transactional facts (MUST NOT be contradicted or invented around):
  ${transactionalFacts || 'None provided'}

FIRST, silently identify 1–3 UNIQUE traits from the ICP and offer
(e.g. local focus, type of business, high-stakes context, holistic approach).
Use those traits throughout the article so it is clearly written FOR this ICP
ABOUT this offer, not a generic template.

Your task:
Write the ACTUAL DRAFT CONTENT for a COMPARISON-style Decision Guide that helps THIS ICP
choose between realistic options in THIS space (e.g. DIY, generic vendors, specialists, ${offerName}).

This should be something a user can lightly edit and publish, NOT instructions
to the user about what to write.

Fixed sections (use these IDs and this order EXACTLY):
1. hero
2. who_its_for
3. fast_recommendation
4. decision_factors
5. comparison_table_intro
6. comparison_table_commentary
7. our_offer_fit
8. next_steps

For each section, output:
- section_id: one of the IDs above
- title: the section heading as it should appear on the page
- body: the actual copy for that section (paragraphs and/or bullet lists), ready for the webpage

TITLE RULES (to avoid templaty feeling):
- Each title must be 3–7 words.
- Each title must include at least ONE domain- or ICP-specific word
  (for example: "business owners", "practice", "buy-sell", "key-person",
   "retirement", "lab", "ELN", "biotech", depending on the context).
- Titles MUST NOT be exactly:
  "Who This Is For", "Who This Guide Is For",
  "Key Factors to Consider", "Next Steps", "Conclusion",
  or other generic headings.
- Titles should hint at the decision, ICP, or options being discussed
  (e.g. "Which Owners This Guide Helps Most"
   instead of "Who This Guide Is For").

LENGTH & READABILITY RULES (IMPORTANT):
- Avoid text walls. No paragraph should be longer than 3 short sentences.
- Use line breaks and bullet lists where helpful.
- Aim for:
  - hero: 1–2 short sentences total
  - other sections: 1–2 short paragraphs and/or 3–6 bullets
- If you use bullets, keep each bullet to one short, clear sentence.

SECTION RULES:

- "hero":
  - Use the provided articleTitle if it is sensible; otherwise refine it.
  - Body: 1–2 short sentences that frame the decision and why it matters for ${icpName}.
  - Make the comparison/decision explicit (e.g. which approach/strategy is right).

- "who_its_for":
  - 1 short paragraph + 3–5 bullets describing who this guide IS and IS NOT for.
  - Clearly call out this ICP (e.g. ${icpName}) and their unique situation.

- "fast_recommendation":
  - 1–2 short paragraphs that give a default recommendation
    ("Most ${icpName} in situation X should consider Y…") and when that default is wrong.
  - Focus on helping them decide quickly, not storytelling.

- "decision_factors":
  - 1 intro sentence + 4–6 bullets, each naming a factor (e.g. risk, tax, control, cost)
    and how it applies specifically to ${icpName}.
  - Each bullet should clearly help compare options, not define basic terms.

- "comparison_table_intro":
  - 1 short paragraph that introduces the concrete options being compared
    (e.g. DIY, generic advisors, product-only agents, specialist/${offerName}).
  - Make it clear this page is about sorting through these options.

- "comparison_table_commentary":
  - 1–3 short paragraphs and/or a bulleted list explaining the practical pros and cons
    of each option for this ICP.
  - Write like a real advisor: "Choose X if…", "Avoid Y when…".
  - Keep it focused on tradeoffs and fit, not generic education.

- "our_offer_fit":
  - 1–3 short paragraphs that calmly position ${offerName} among the options:
    when it is a strong fit, when it might not be, and how ${peaceOfMind} matters.
  - Mention at least one UNIQUE aspect of the offer or approach (from the context),
    not just generic "we care about you" language.

- "next_steps":
  - 1 short paragraph + 3–5 bullets giving clear, low-risk next steps
    (e.g. what to list, what to ask, when to schedule a call).
  - These steps should help the reader move from confusion to a decision,
    not just "contact us" spam.

Specificity rules (VERY important):
- Do NOT output meta-instructions like "Frame the decision…" or "Help the reader…".
  Write the content AS the page, speaking directly to the reader ("you").
- In EVERY section body, mention either:
  - the ICP (e.g. ${icpName}, their type of business, local context), or
  - the offer/approach (e.g. ${offerName}, holistic planning, tax-free cash value, etc.),
  using details inferred from the descriptions.
- Do NOT invent new transactional facts (prices, guarantees, carriers, product names)
  that are not present in transactionalFacts. If something is unknown, keep it high-level.
- Include at least THREE concrete OPTIONS somewhere in the comparison narrative
  (for example: DIY, generic/cheap, product-only agents, specialist/holistic planner).

INTENT (PHASE 2 – MID FUNNEL):
- This is MID-FUNNEL decision support, not top-of-funnel education.
- Assume the reader already knows the basics of the problem and the solution category.
  Do NOT explain "what life insurance is" or similar basics.
- Every section should help them:
  - compare options,
  - understand tradeoffs,
  - and move closer to a confident decision.
- Minimize fluff, inspirational language, and long stories.
  Prioritize clarity, specificity, and decision-making help.

Keep strictly away from:
- Page layout or design talk (columns, tables, CSS).
- Instructions to the user about how to use this content.

OUTPUT FORMAT (IMPORTANT):
Return ONLY a JSON array with 8 objects, one per section, in order.

Each object must look like:
{
  "section_id": "hero",
  "title": "Which Retirement Path Protects Your Family and Your Business?",
  "body": "Full text of this section in paragraphs and/or bullet lists..."
}

- "body" may include line breaks and bullet lists, but NO meta commentary.
- Do NOT add extra keys, sections, or any text outside the JSON array.
`,

  /**
   * Article Outline Generator - Phase 2 (Scenario Listicle)
   * For scenario-based decision guides that help readers find the right solution for their situation
   * Generates actual draft content with dynamic, ICP-specific titles
   */
  articleOutlineListicle: (icpName, icpDescription, offerName, offerDescription, transactionalFacts, outcome, peaceOfMind, articleTitle, phaseName, phaseDescription) => `You are writing a Phase 2 SCENARIO-BASED Decision Guide as a DRAFT WEBPAGE.

The reader:
- Already knows they have a problem related to "${outcome || 'their work'}".
- Is actively looking for a solution.
- Is unsure which OPTION / APPROACH fits THEIR specific situation or scenario.

Campaign context (use it for realism and specificity):
- Offer name: ${offerName || 'Not specified'}
- Offer description: ${offerDescription || 'No description'}
- ICP name: ${icpName || 'Not specified'}
- ICP description: ${icpDescription || 'No description'}
- Promise / guarantee: ${peaceOfMind || 'Not specified'}
- Article title: ${articleTitle || 'Not specified'}
- Transactional facts (MUST NOT be contradicted or invented around):
  ${transactionalFacts || 'None provided'}

FIRST, silently identify 1–3 UNIQUE traits from the ICP and offer
(e.g. local focus, type of business, high-stakes context, holistic approach).
Use those traits throughout the article so it is clearly written FOR this ICP
ABOUT this offer, not a generic template.

Your task:
Write the ACTUAL DRAFT CONTENT for a SCENARIO-BASED Decision Guide that helps THIS ICP
identify which solution fits their specific situation (e.g. different scenarios, use cases, contexts).

This should be something a user can lightly edit and publish, NOT instructions
to the user about what to write.

Fixed sections (use these IDs and this order EXACTLY):
1. hero
2. who_its_for
3. scenario_intro
4. scenario_1
5. scenario_2
6. scenario_3
7. our_offer_fit
8. next_steps

For each section, output:
- section_id: one of the IDs above
- title: the section heading as it should appear on the page
- body: the actual copy for that section (paragraphs and/or bullet lists), ready for the webpage

TITLE RULES (to avoid templaty feeling):
- Each title must be 3–7 words.
- Each title must include at least ONE domain- or ICP-specific word
  (for example: "business owners", "practice", "buy-sell", "key-person",
   "retirement", "lab", "ELN", "biotech", depending on the context).
- Titles MUST NOT be exactly:
  "Who This Is For", "Who This Guide Is For",
  "Key Factors to Consider", "Next Steps", "Conclusion",
  "Scenario 1", "Scenario 2", "Scenario 3",
  or other generic headings.
- Titles should hint at the scenario, ICP, or situation being discussed
  (e.g. "Which Owners This Guide Helps Most"
   instead of "Who This Guide Is For").
- Scenario section titles should be specific and descriptive
  (e.g. "If You're Planning a Business Exit" instead of "Scenario 1").

LENGTH & READABILITY RULES (IMPORTANT):
- Avoid text walls. No paragraph should be longer than 3 short sentences.
- Use line breaks and bullet lists where helpful.
- Aim for:
  - hero: 1–2 short sentences total
  - other sections: 1–2 short paragraphs and/or 3–6 bullets
- If you use bullets, keep each bullet to one short, clear sentence.

SECTION RULES:

- "hero":
  - Use the provided articleTitle if it is sensible; otherwise refine it.
  - Body: 1–2 short sentences that frame the scenario-based decision and why it matters for ${icpName}.
  - Make the scenario/decision explicit (e.g. which situation calls for which approach).

- "who_its_for":
  - 1 short paragraph + 3–5 bullets describing who this guide IS and IS NOT for.
  - Clearly call out this ICP (e.g. ${icpName}) and their unique situation.
  - Mention that this guide helps them match solutions to their specific scenario.

- "scenario_intro":
  - 1–2 short paragraphs that introduce the concept of scenario-based decision making.
  - Explain that different situations call for different approaches.
  - Set up the scenarios that will follow.

- "scenario_1", "scenario_2", "scenario_3":
  - Each scenario section should:
    - Have a specific, descriptive title (not "Scenario 1").
    - Start with 1 short paragraph describing the situation/scenario.
    - Include 3–5 bullets explaining:
      - When this scenario applies
      - What approach/solution fits this scenario
      - Why this approach works for this scenario
      - What to consider or avoid
  - Make scenarios concrete and specific to ${icpName} and their context.
  - Vary the scenarios to cover different situations (e.g. different business stages, different goals, different constraints).

- "our_offer_fit":
  - 1–3 short paragraphs that calmly position ${offerName} among the scenarios:
    when it is a strong fit, when it might not be, and how ${peaceOfMind} matters.
  - Mention at least one UNIQUE aspect of the offer or approach (from the context),
    not just generic "we care about you" language.
  - Reference which scenarios ${offerName} fits best.

- "next_steps":
  - 1 short paragraph + 3–5 bullets giving clear, low-risk next steps
    (e.g. how to identify their scenario, what to list, what to ask, when to schedule a call).
  - These steps should help the reader move from confusion to identifying their scenario and making a decision,
    not just "contact us" spam.

Specificity rules (VERY important):
- Do NOT output meta-instructions like "Frame the decision…" or "Help the reader…".
  Write the content AS the page, speaking directly to the reader ("you").
- In EVERY section body, mention either:
  - the ICP (e.g. ${icpName}, their type of business, local context), or
  - the offer/approach (e.g. ${offerName}, holistic planning, tax-free cash value, etc.),
  using details inferred from the descriptions.
- Do NOT invent new transactional facts (prices, guarantees, carriers, product names)
  that are not present in transactionalFacts. If something is unknown, keep it high-level.
- Include at least THREE distinct SCENARIOS that are relevant to ${icpName}
  (for example: different business stages, different goals, different constraints, different timelines).

INTENT (PHASE 2 – MID FUNNEL):
- This is MID-FUNNEL decision support, not top-of-funnel education.
- Assume the reader already knows the basics of the problem and the solution category.
  Do NOT explain "what life insurance is" or similar basics.
- Every section should help them:
  - identify their scenario,
  - understand which approach fits their situation,
  - and move closer to a confident decision.
- Minimize fluff, inspirational language, and long stories.
  Prioritize clarity, specificity, and scenario-based decision-making help.

Keep strictly away from:
- Page layout or design talk (columns, tables, CSS).
- Instructions to the user about how to use this content.

OUTPUT FORMAT (IMPORTANT):
Return ONLY a JSON array with 8 objects, one per section, in order.

Each object must look like:
{
  "section_id": "hero",
  "title": "Which Life Insurance Scenario Matches Your Business Exit Plan?",
  "body": "Full text of this section in paragraphs and/or bullet lists..."
}

- "body" may include line breaks and bullet lists, but NO meta commentary.
- Do NOT add extra keys, sections, or any text outside the JSON array.
`,

  /**
   * Article Outline Generator - Phase 3 (Outcome Pillar)
   * For "How to achieve [outcome]" guides with hyper-scannable structure, BLUF, pattern interrupts, and micro-CTAs
   * Generates actual draft content ready for publishing
   */
  articleOutlineSatellite: (icpName, icpDescription, offerName, offerDescription, transactionalFacts, outcome, peaceOfMind, articleTitle, phaseName, phaseDescription) => `You are writing a SATELLITE ARTICLE (Content Cluster - Expand Phase) as a DRAFT WEBPAGE.

This article is part of a content cluster supporting your main pages (Phase 1, 2, 3). It should:
- Draw in traffic for target keywords related to your main content
- Support main pages in SEO (Search Engine Optimization) and GEO (Generative Engine Optimization)
- Keep fresh content coming to the site (favored by search engines and AIs)
- Create supporting articles that link back to and reinforce your pillar pages
- Target long-tail and related search queries your ICP uses

The reader:
- Is searching for specific information related to your main content topics
- May be at different stages of awareness (top to mid funnel)
- Wants practical, actionable information
- Values depth and specificity over broad overviews

Campaign context (use it for realism and specificity):
- Offer name: ${offerName || 'Not specified'}
- Offer description: ${offerDescription || 'No description'}
- ICP name: ${icpName || 'Not specified'}
- ICP description: ${icpDescription || 'No description'}
- Main Outcome: ${outcome || 'Not specified'}
- Promise / guarantee: ${peaceOfMind || 'Not specified'}
- Article title: ${articleTitle || 'Not specified'}

Your task:
Write the ACTUAL DRAFT CONTENT for a satellite article that:
- Provides deep, valuable information on a specific topic related to your main content
- Naturally links back to your pillar pages and main offers where relevant
- Is highly scannable (short sections, bullets, clear headings)
- Uses keyword-focused language that matches search queries
- Feels like a helpful resource, not a sales pitch
- Builds topical authority around your core offering

CONTENT STRUCTURE (flexible, but should include):
- <h1>${articleTitle}</h1>
- Introduction that establishes context and value
- Main content sections (3-7 sections depending on topic depth)
- Practical examples, case studies, or step-by-step guidance
- Natural links/references to related main content
- Conclusion with key takeaways

Keep everything focused, scannable, and valuable. This is DRAFT CONTENT, not an outline.

OUTPUT FORMAT:
Return ONLY a JSON array with section objects, in order.

Each object must look like:
{
  "section_id": "hero",
  "title": "Section Heading",
  "body": "Full text of this section in paragraphs and/or bullet lists..."
}

- "body" may include line breaks and bullet lists, but NO meta commentary.
- Do NOT add extra keys, sections, or any text outside the JSON array.
`,

  articleOutlineOutcomePillar: (icpName, icpDescription, offerName, offerDescription, transactionalFacts, outcome, peaceOfMind, articleTitle, phaseName, phaseDescription) => `You are writing a Phase 3 OUTCOME PILLAR PAGE ("How to achieve [outcome]") as a DRAFT WEBPAGE.

The reader:
- Clearly wants to achieve "${outcome || 'a better result'}".
- May not fully understand all solution types yet.
- Needs a realistic, organized roadmap: stages, pitfalls, and what to focus on first.

Campaign context (use it for realism and specificity):
- Offer name: ${offerName || 'Not specified'}
- Offer description: ${offerDescription || 'No description'}
- ICP name: ${icpName || 'Not specified'}
- ICP description: ${icpDescription || 'No description'}
- Promise / guarantee: ${peaceOfMind || 'Not specified'}
- Article title: ${articleTitle || 'Not specified'}
- Transactional facts (MUST NOT be contradicted or invented around):
  ${transactionalFacts || 'None provided'}

FIRST, silently identify 1–3 UNIQUE traits from the ICP and offer
(e.g. local focus, type of business, high-stakes context, holistic approach).
Use those traits throughout the article so it is clearly written FOR this ICP
ABOUT this outcome, not a generic template.

Your task:
Write the ACTUAL DRAFT CONTENT for a "How to achieve [outcome]" pillar page that:
- Affirms the reader's goal immediately (BLUF).
- Is highly scannable (short sections, bullets).
- Organizes the journey into clear stages.
- Naturally weaves in pattern interrupts, "why this matters" notes, micro-CTAs,
  and light objection-handling microcopy within the content itself.

This should be something a user can lightly edit and publish, NOT instructions
to the user about what to write.

Fixed sections (use these IDs and this order EXACTLY):
1. hero
2. who_its_for
3. why_this_is_hard
4. roadmap_overview
5. stage_walkthrough
6. common_mistakes
7. where_our_approach_fits
8. next_steps

For EACH section, output:
- section_id: one of the IDs above
- title: the section heading as it should appear on the page
  - 3–7 words
  - Must include at least ONE domain- or ICP-specific word or phrase
    (e.g. "practice owners", "business exit", "lab records", "retirement income").
  - MUST NOT be exactly: "Who This Is For", "Why This Is Hard",
    "Key Steps", "Next Steps", "Conclusion".
- body: the actual copy for that section (paragraphs and/or bullet lists), ready for the webpage
  - Integrate pattern interrupts naturally (e.g. "Here's the part most owners skip.")
  - Include micro-CTAs within the flow (e.g. "Jot down which stage you're in.")
  - Weave in "why this matters" notes naturally
  - Address common objections or concerns within the content
  - Write directly to the reader ("you"), not about what to write

Keep everything short and scannable. This is DRAFT CONTENT, not an outline.

SECTION GUIDANCE:

- "hero":
  - Start with BLUF: "You want [outcome] for your [lab/practice/business/family]."
  - Body: 1–2 short paragraphs that:
    - Affirm the outcome they want.
    - Name the big fear or cost they want to avoid.
    - Briefly state that this is a short, structured guide (e.g. "5 stages").
    - Reassure this is written specifically for ${icpName}, not generic advice.

- "who_its_for":
  - Body: 1 short paragraph + 3–5 bullets describing concrete life situations
    where this guide is obviously relevant (e.g. "Most of your net worth is in the business…").
  - Show, don't tell: focus on scenarios and traits, not "This guide is for…".

- "why_this_is_hard":
  - Body: 1 short paragraph + 4–6 bullets covering real obstacles for this ICP
    (e.g. time, complexity, conflicting advice, fear of big irreversible decisions).
  - Include at least one emotional or practical tension
    ("You're busy running the business, not designing retirement models.").
  - Naturally address the concern: "Am I just indecisive, or is this actually hard?"

- "roadmap_overview":
  - Body: 1 short paragraph introducing the roadmap + 3–6 bullets naming stages
    of the journey from today → outcome.
  - Each stage label should be understandable at a glance to this ICP
    (e.g. "Clarify your target lifestyle", "Decide what the business will fund", etc.).
  - Include a pattern interrupt: "Retirement isn't a date—it's a sequence of business decisions."

- "stage_walkthrough":
  - Body: Expand each stage with 1–2 sentences per stage covering:
    - key actions,
    - what to focus on,
    - a mini "why this matters" for each stage.
  - Include at least one pattern interrupt that calls out
    where people usually get stuck ("This is where most labs lose a year.").
  - Add a micro-CTA: "Mark which stage you instinctively feel you're in right now."

- "common_mistakes":
  - Body: 1 short intro paragraph + 4–7 bullets, each covering:
    - what the mistake is,
    - why it hurts this ICP,
    - what a better approach looks like.
  - Avoid vague "not planning ahead"; be as specific as possible.
  - Include a micro-CTA: "Put a checkmark by any mistake you've already made."

- "where_our_approach_fits":
  - Body: 1–3 short paragraphs that:
    - Indicate where in the journey ${offerName} typically comes in.
    - Note what your approach does and does NOT do.
    - Mention how ${peaceOfMind} supports the outcome (e.g. tax-free cash value, etc.).
  - This section should feel calm and honest, not salesy.
  - Address the concern: "Is this just a way to sell me more [product/service]?"

- "next_steps":
  - Body: 1 short paragraph + 3–5 bullets covering:
    - 1–2 DIY steps they can take alone (self-assessment, listing, rough plan).
    - 1–2 "when to talk to a specialist like us" triggers.
    - A suggestion to use this guide as a checklist or reference.
  - Include a light micro-CTA: "Circle the stage you're in and note one question you'd ask."

VOICE & SPECIFICITY RULES:
- Do NOT use inspiration fluff verbs: elevate, transform, empower, unlock, innovate.
- Do NOT use empty adjectives: exceptional, amazing, powerful, world-class.
- Aim for concrete language (e.g. "review last year's P&L", "check your current coverage",
  "estimate your monthly retirement budget").
- Make bullets feel like things a real ${icpName || 'buyer'} would think, ask, or do.

INTENT (PHASE 3 – OUTCOME "HOW TO"):
- This outline is for a "How to achieve [outcome]" guide,
  NOT a comparison page and NOT a pure sales page.
- Focus on:
  - clarifying the journey,
  - reducing anxiety,
  - making action feel doable,
  - and using pattern interrupts, micro-CTAs, and "why this matters" notes
    to keep the reader engaged.

LENGTH & READABILITY RULES (IMPORTANT):
- Avoid text walls. No paragraph should be longer than 3 short sentences.
- Use line breaks and bullet lists where helpful.
- Aim for:
  - hero: 1–2 short paragraphs total
  - other sections: 1–2 short paragraphs and/or 3–6 bullets
- If you use bullets, keep each bullet to one short, clear sentence.
- Pattern interrupts, micro-CTAs, and "why this matters" notes should be woven
  naturally into the body text, not called out as separate elements.

SPECIFICITY RULES (VERY important):
- Do NOT output meta-instructions like "Frame the decision…" or "Help the reader…".
  Write the content AS the page, speaking directly to the reader ("you").
- In EVERY section body, mention either:
  - the ICP (e.g. ${icpName}, their type of business, local context), or
  - the offer/approach (e.g. ${offerName}, holistic planning, tax-free cash value, etc.),
  using details inferred from the descriptions.
- Do NOT invent new transactional facts (prices, guarantees, carriers, product names)
  that are not present in transactionalFacts. If something is unknown, keep it high-level.

OUTPUT FORMAT (IMPORTANT):
Return ONLY a JSON array with 8 objects, one per section, in order.

Each object must look like:
{
  "section_id": "hero",
  "title": "How Practice Owners Build Reliable Retirement Income",
  "body": "You want retirement planning for your business and your family. Most Danville owners have built valuable practices but aren't sure how to turn that value into steady retirement income. This guide walks you through 5 stages from 'still running it' to 'comfortably retired'—specifically written for small business and practice owners, not generic retirees.\n\n💡 Pattern Interrupt: Selling your business is not your retirement plan.\n\n→ Action: Note in one sentence what 'retired and done with the business' looks like for you."
}

- "body" may include line breaks, bullet lists, pattern interrupts, and micro-CTAs
  naturally woven into the content, but NO meta commentary or instructions.
- Do NOT add extra keys, sections, or any text outside the JSON array.
`,

  /**
   * Outline Evaluation - Phase 1 (Landing Page)
   * Evaluates landing page outlines against conversion-focused criteria
   */
  evaluateOutlinePhase1: (articleTitle, articleContent, icpName, offerName, outcome, peaceOfMind) => `Evaluate this landing page outline for conversion effectiveness.

ARTICLE:
Title: "${articleTitle}"

Content:
${articleContent}

CONTEXT:
- ICP: ${icpName || 'Target audience'}
- Offer: ${offerName || 'Product/Service'}
- Desired Outcome: ${outcome || 'Improved results'}
- Promise: ${peaceOfMind || 'Satisfaction guaranteed'}

EVALUATION CRITERIA:
1. RECOMMENDED STRUCTURE: Can the customer find out how to start the transaction within 3 seconds? Does the Hero section have: h1, p, ul, CTA language, guarantee, trust metric?
2. LENGTH: Are any sections longer than 120 words (hero 60 words)? Scannable format?
3. CONTENT QUALITY: Uses ICP language, concrete nouns, avoids fluff words? Second person voice?
4. REQUIRED SECTIONS: Benefits (with identity/painpoint callout at start), How It Works, Trust & Credibility, FAQ, Final CTA?
5. CONVERSION FOCUS: Clear CTAs? Peace-of-mind guarantee integrated? Transactional details included?
6. THROUGHOUT: does the whole page have a call out to the ICP (mention their identity)? Are all the transactional facts of the offer mentioned? 
For each feedback, try give examples and clear criteria for what's the right thing to do.

OUTPUT FORMAT (STRICT):
You MUST output in this exact format:

Score: <number>/100 (do not give score lower than 70. Meh is 70 - 80, Good is 80 - 90, Excellent is 90 - 100)
Verdict: <Excellent|Good|Meh>

Then provide 3-5 feedback rows, ordered from most important to least important. Use this format:

For high-impact issues (must fix):
! <Short label>: <Short sentence with concrete, actionable fix>

For suggestions (nice to have):
→ <Short label>: <Short sentence with specific improvement>

IMPORTANT:
- Score must be first line, verdict second line
- Use row format (one issue/strength per line), NOT paragraphs
- Mark critical issues with ! at the start
- Order by impact: most critical issues first, then strengths, then suggestions
- Be specific and actionable (e.g., "Add 1 CTA in hero" not "needs more CTAs")
- Base score on: structure completeness (30%), conversion elements (30%), content quality (25%), length/scannability (15%)`,

  /**
   * Outline Evaluation - Phase 2 (Comparison Guide)
   * Evaluates comparison guide outlines against decision-support criteria
   */
  evaluateOutlinePhase2Comparison: (articleTitle, articleContent, icpName, offerName, outcome) => `Evaluate this comparison decision guide outline.

ARTICLE:
Title: "${articleTitle}"

Content:
${articleContent}

CONTEXT:
- ICP: ${icpName || 'Target audience'}
- Offer: ${offerName || 'Product/Service'}
- Desired Outcome: ${outcome || 'Improved results'}

EVALUATION CRITERIA:
1. STRUCTURE: Does it have 8 fixed sections (hero, who_its_for, fast_recommendation, decision_factors, comparison_table_intro, comparison_table_commentary, our_offer_fit, next_steps)?
2. SPECIFICITY: Does each section reference ICP or offer context? At least 3 concrete options to compare?
3. DECISION FOCUS: Mid-funnel decision support (not top-of-funnel education)? Helps readers choose between options?
4. CONTENT QUALITY: Addresses real buyer concerns (timelines, approval, budget, risk, compliance)? Uses ICP's mental model?

OUTPUT FORMAT (STRICT):
You MUST output in this exact format:

Score: <number>/100 (do not give score lower than 70. Meh is 70 - 80, Good is 80 - 90, Excellent is 90 - 100)
Verdict: <Excellent|Good|Meh>

Then provide 3-8 feedback rows, ordered from most important to least important. Use this format:

For high-impact issues (must fix):
! <Short label>: <Short sentence with concrete, actionable fix>

For suggestions (nice to have):
→ <Short label>: <Short sentence with specific improvement>

IMPORTANT:
- Score must be first line, verdict second line
- Use row format (one issue/strength per line), NOT paragraphs
- Mark critical issues with ! at the start
- Order by impact: most critical issues first, then strengths, then suggestions
- Be specific and actionable (e.g., "Add 3 concrete options: DIY, generic SaaS, specialist" not "needs more options")
- Base score on: structure completeness (30%), option clarity (25%), decision focus (25%), ICP specificity (20%)
- Check that outline assumes mid-funnel knowledge (they know the problem, choosing solution), not top-funnel education`,

  /**
   * Outline Evaluation - Phase 2 (Scenario Listicle)
   * Evaluates scenario-based decision guide outlines
   */
  evaluateOutlinePhase2Listicle: (articleTitle, articleContent, icpName, offerName, outcome) => `Evaluate this scenario-based decision guide outline.

ARTICLE:
Title: "${articleTitle}"

Content:
${articleContent}

CONTEXT:
- ICP: ${icpName || 'Target audience'}
- Offer: ${offerName || 'Product/Service'}
- Desired Outcome: ${outcome || 'Improved results'}

EVALUATION CRITERIA:
1. STRUCTURE: Does it have 8 fixed sections (hero, who_its_for, scenario_intro, scenario_1, scenario_2, scenario_3, our_offer_fit, next_steps)?
2. SCENARIO FOCUS: Does it help readers identify which scenario/situation applies to them? At least 3 distinct, concrete scenarios?
3. SITUATION MATCHING: Each scenario clearly describes when it applies, what approach fits, and why? Helps readers match their situation?
4. SPECIFICITY: Does each section reference ICP or offer context? Scenarios are specific to ${icpName || 'the target audience'}?
5. CONTENT QUALITY: Scenarios address real situations this ICP faces? Uses ICP's mental model and language?

OUTPUT FORMAT (STRICT):
You MUST output in this exact format:

Score: <number>/100 (do not give score lower than 70. Meh is 70 - 80, Good is 80 - 90, Excellent is 90 - 100)
Verdict: <Excellent|Good|Meh>

Then provide 3-8 feedback rows, ordered from most important to least important. Use this format:

For high-impact issues (must fix):
! <Short label>: <Short sentence with concrete, actionable fix>

For strengths (what works well):
✅ <Short label>: <Short sentence describing what works>

For suggestions (nice to have):
→ <Short label>: <Short sentence with specific improvement>

Examples:
! Scenarios too generic: Make scenarios more specific to ${icpName || 'the target audience'} (e.g., "If you're planning a business exit in 5-10 years" not "If you're planning to retire").
! Missing scenario identification: Add clear signals in each scenario section that help readers recognize "this is me" (e.g., specific business situations, timelines, constraints).
! Scenario structure weak: Each scenario should clearly state when it applies, what approach/solution fits, why it works, and what to consider or avoid.
✅ Structure complete: All 8 required sections (hero, who_its_for, scenario_intro, scenario_1, scenario_2, scenario_3, our_offer_fit, next_steps) are present.
→ Scenario variety: Ensure scenarios cover different situations (e.g., different business stages, goals, constraints, timelines) not just variations of the same scenario.

IMPORTANT:
- Score must be first line, verdict second line
- Use row format (one issue/strength per line), NOT paragraphs
- Mark critical issues with ! at the start
- Order by impact: most critical issues first, then strengths, then suggestions
- Be specific and actionable (e.g., "Add 3 distinct scenarios: exit in 5 years, exit in 10+ years, family succession" not "needs more scenarios")
- Base score on: structure completeness (30%), scenario clarity (25%), situation matching (25%), ICP specificity (20%)
- Check that outline helps readers identify their scenario and understand which approach fits, not just compare options`,

  /**
   * Outline Evaluation - Phase 3 (Pillar Page)
   * Evaluates outcome-focused pillar page outlines
   */
  evaluateOutlinePhase3: (articleTitle, articleContent, icpName, offerName, outcome) => `Evaluate this outcome-focused pillar page outline.

ARTICLE:
Title: "${articleTitle}"

Content:
${articleContent}

CONTEXT:
- ICP: ${icpName || 'Target audience'}
- Offer: ${offerName || 'Product/Service'}
- Desired Outcome: ${outcome || 'Improved results'}

EVALUATION CRITERIA:
1. OUTCOME FOCUS: Centers on achieving the outcome, not just the solution? Educational, step-by-step guidance?
2. AUDIENCE: Speaks to latent customers (know outcome, not solutions yet)? Identity-based and pain-point language?
3. STRUCTURE: Clear progression from challenge → steps → mistakes → tools → conclusion?
4. CONTENT QUALITY: Naturally introduces solution as tool (not focus)? Builds authority through valuable information?

OUTPUT FORMAT (STRICT):
You MUST output in this exact format:

Score: <number>/100 (do not give score lower than 70. Meh is 70 - 80, Good is 80 - 90, Excellent is 90 - 100)
Verdict: <Excellent|Good|Meh>

Then provide 3-8 feedback rows, ordered from most important to least important. Use this format:

For high-impact issues (must fix):
! <Short label>: <Short sentence with concrete, actionable fix>

For strengths (what works well):
✅ <Short label>: <Short sentence describing what works>

For suggestions (nice to have):
→ <Short label>: <Short sentence with specific improvement>

Examples:
! Solution-focused not outcome-focused: Reframe sections to center on achieving "${outcome || 'the desired outcome'}" rather than explaining ${offerName || 'the solution'} features.
! Missing step-by-step guide: Add clear numbered steps (3-5 steps) showing how to achieve the outcome, with specific actions per step.
! Identity language weak: Use more identity-based callouts (e.g., "If you're a ${icpName || 'business owner'} who...") and pain-point language in opening sections.
✅ Structure logical: Clear progression from understanding challenge → actionable steps → common mistakes → tools → conclusion.
→ Authority signals missing: Add expert quotes, citations, or case snippets to build credibility without being promotional.

IMPORTANT:
- Score must be first line, verdict second line
- Use row format (one issue/strength per line), NOT paragraphs
- Mark critical issues with ! at the start
- Order by impact: most critical issues first, then strengths, then suggestions
- Be specific and actionable (e.g., "Add 4-5 numbered steps with 2-3 sentences each" not "needs more steps")
- Base score on: outcome focus (35%), audience alignment (25%), structure/logic (25%), content quality (15%)
- Check that content speaks to latent customers (they want the outcome, don't know solutions yet), not active buyers`

};

// ============================================
// 🎯 END PROMPT TEMPLATES  
// ============================================

// ============================================
// 🤖 AI MODEL CONFIGURATION
// ============================================
// Configure which AI model to use for each article generation type.
// Models: 'gpt-5.1' (most advanced), 'gpt-4o' (fast & cost-effective)
// ============================================

const AI_CONFIG = {
  articleTitle: {
    // Use advanced model for Phase 2 titles (requires strategic insight to choose comparison type)
    // Use standard model for Phase 1 & 3 (more straightforward)
    getModel: (phase) => phase === 2 ? AI_MODELS.ADVANCED : AI_MODELS.STANDARD,
    // Get the appropriate template based on phase and roadmap mode
    getTemplate: (phase, roadmapMode) => {
      if (phase === 2) {
        if (roadmapMode === 'scenario_listicle') {
          return PROMPT_TEMPLATES.articleTitleListicle;
        } else if (roadmapMode === 'comparison_guide') {
          return PROMPT_TEMPLATES.articleTitleComparisonGuide;
        } else {
          // Default to comparison guide for Phase 2 if no specific mode
          return PROMPT_TEMPLATES.articleTitleComparisonGuide;
        }
      } else if (phase === 3) {
        return PROMPT_TEMPLATES.articleTitleOutcomePillar;
      } else if (phase === "Expand") {
        return PROMPT_TEMPLATES.articleTitleSatellite;
      }
      // Phase 1 uses the default template
      return PROMPT_TEMPLATES.articleTitle;
    },
    template: PROMPT_TEMPLATES.articleTitle,
    description: 'Article title generation (3 options)'
  },
  articleOutline: {
    model: AI_MODELS.ADVANCED, // Advanced model for comprehensive content creation
    template: PROMPT_TEMPLATES.articleOutline,
    description: 'Full article outline with actual content'
  }
};

// ============================================
// 🎯 END AI MODEL CONFIGURATION
// ============================================

function Button({ children, className = "", variant = "default", onClick, disabled = false, type = "button" }) {
  console.log("[app/(private)/campaigns/components/CampaignArticleOutline.js] Button");
  const baseClasses = "inline-flex items-center justify-center rounded-md font-medium transition-colors focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-offset-2 disabled:pointer-events-none disabled:opacity-50";
  
  const variants = {
    default: "bg-blue-600 text-white hover:bg-blue-700 focus-visible:ring-blue-600",
    outline: "border border-gray-300 bg-white text-gray-700 hover:bg-gray-50 focus-visible:ring-blue-600",
  };

  return (
    <button
      type={type}
      className={`${baseClasses} ${variants[variant]} px-4 py-2 gap-2 ${className}`}
      onClick={onClick}
      disabled={disabled}
    >
      {children}
    </button>
  );
}

function Input({ label, ...props }) {
  console.log("[app/(private)/campaigns/components/CampaignArticleOutline.js] Input");
  return (
    <div className="mb-4">
      {label && <label className="block text-sm font-medium text-gray-700 mb-2">{label}</label>}
      <input
        className="w-full px-3 py-2 border border-gray-300 rounded-md focus:outline-none focus:ring-2 focus:ring-blue-600"
        {...props}
      />
    </div>
  );
}

function Card({ children, className = "" }) {
  console.log("[app/(private)/campaigns/components/CampaignArticleOutline.js] Card");
  return <div className={`bg-white rounded-lg shadow-sm border border-gray-200 p-6 ${className}`}>{children}</div>;
}

// Research Suggestions List Component
function ResearchSuggestionsList({ research }) {
  console.log("[app/(private)/campaigns/components/CampaignArticleOutline.js] ResearchSuggestionsList");
  const { competitorUrls = [], commonSections = [], contentSections = {}, contentPatterns = {}, insights = [], uniqueValueProps = [], qualitySignals = [] } = research || {};
  
  const allIdeas = [];
  
  // Add common sections
  commonSections.forEach(section => {
    allIdeas.push({
      text: section,
      rationale: "Common section found across competitor pages",
      competitorCount: competitorUrls.length,
      type: "section"
    });
  });
  
  // Add content sections
  Object.entries(contentSections).forEach(([sectionName, sectionData]) => {
    if (sectionData?.examples && sectionData.examples.length > 0) {
      allIdeas.push({
        text: sectionName,
        rationale: `Found in ${sectionData.examples.length} competitor(s). ${sectionData.commonApproach || ''}`,
        competitorCount: sectionData.examples.length,
        type: "content_section"
      });
    }
  });
  
  // Add content patterns (backward compatibility)
  Object.entries(contentPatterns).forEach(([category, patterns]) => {
    if (!contentSections[category] && Array.isArray(patterns)) {
      patterns.forEach(pattern => {
        allIdeas.push({
          text: pattern,
          rationale: `Content approach used in "${category}" sections`,
          competitorCount: competitorUrls.length,
          type: "pattern"
        });
      });
    }
  });
  
  // Add insights
  insights.forEach(insight => {
    const percentMatch = insight.match(/(\d+)%/);
    const count = percentMatch ? Math.round((parseInt(percentMatch[1]) / 100) * competitorUrls.length) : competitorUrls.length;
    allIdeas.push({
      text: insight,
      rationale: "Key insight from competitive analysis",
      competitorCount: count,
      type: "insight"
    });
  });
  
  // Add unique value props
  uniqueValueProps.forEach(prop => {
    allIdeas.push({
      text: prop,
      rationale: "Unique value proposition to differentiate your offer",
      competitorCount: competitorUrls.length,
      type: "value_prop"
    });
  });
  
  // Add quality signals
  qualitySignals.forEach(signal => {
    allIdeas.push({
      text: signal,
      rationale: "Quality signal that builds trust",
      competitorCount: competitorUrls.length,
      type: "quality"
    });
  });
  
  if (allIdeas.length === 0) {
    return (
      <p className="text-sm text-gray-500 italic">No suggestions available</p>
    );
  }
  
  return (
    <div className="space-y-2 max-h-64 overflow-y-auto">
      {allIdeas.slice(0, 10).map((idea, idx) => (
        <div key={idx} className="p-2 bg-gray-50 rounded border border-gray-200">
          <p className="text-sm font-medium text-gray-900 mb-1">{idea.text}</p>
          <p className="text-xs text-gray-600">{idea.rationale}</p>
          <div className="mt-1 text-xs text-gray-500">
            Found in {idea.competitorCount} of {competitorUrls.length} competitors
          </div>
        </div>
      ))}
      {allIdeas.length > 10 && (
        <p className="text-xs text-gray-500 italic">... and {allIdeas.length - 10} more suggestions</p>
      )}
    </div>
  );
}

function CampaignArticleOutlineContent({ campaign, phase, onBack, onSaved, articleId: propArticleId = null }) {
  console.log("[app/(private)/campaigns/components/CampaignArticleOutline.js] CampaignArticleOutlineContent");
  const router = useRouter();
  const supabase = createClient();
  const editorRef = useRef(null);
  
  // Helper function to convert phase to database value
  // "Expand" -> 4, numeric phases stay as-is
  const getPhaseDbValue = (phaseValue) => {
  console.log("[app/(private)/campaigns/components/CampaignArticleOutline.js] getPhaseDbValue");
    return phaseValue === "Expand" ? 4 : phaseValue;
  };
  
  // Debug: Log campaign roadmap
  useEffect(() => {

    
  }, [campaign]);
  
  const [articleTitle, setArticleTitle] = useState("");
  const [articleId, setArticleId] = useState(null);
  const [articleContent, setArticleContent] = useState("");
  const [isLoading, setIsLoading] = useState(true);
  const [isSaving, setIsSaving] = useState(false);
  const [isGenerating, setIsGenerating] = useState(false);
  const [aiSuggestions, setAiSuggestions] = useState([]);
  const [showSuggestions, setShowSuggestions] = useState(false);
  const [isEditingInline, setIsEditingInline] = useState(false);
  const [isGeneratingOutline, setIsGeneratingOutline] = useState(false);
  const [isGeneratingFullArticle, setIsGeneratingFullArticle] = useState(false);
  const [hasEditorContent, setHasEditorContent] = useState(false);
  const [outlineFeedback, setOutlineFeedback] = useState('');
  
  // Feedback state - for AI suggestions
  const [feedbackText, setFeedbackText] = useState({}); // { 'title': "feedback text", 'outline': "feedback text" }
  const [showFeedbackInput, setShowFeedbackInput] = useState({}); // { 'title': true/false, 'outline': true/false }
  const [originalPrompts, setOriginalPrompts] = useState({}); // { 'title': "original prompt", 'outline': "original prompt" }
  const [previousSuggestions, setPreviousSuggestions] = useState({}); // { 'title': [...], 'outline': [...] }
  
  // User instructions state - for outline generation
  const [showOutlineInstructions, setShowOutlineInstructions] = useState(false);
  const [outlineInstructions, setOutlineInstructions] = useState('');
  const [showAgenticInstructions, setShowAgenticInstructions] = useState(false);
  const [agenticInstructions, setAgenticInstructions] = useState('');
  const [competitorResults, setCompetitorResults] = useState([]);
  const [showCompetitors, setShowCompetitors] = useState(false);
  const [isSearchingCompetitors, setIsSearchingCompetitors] = useState(false);
  
  // URL import state
  const [importUrl, setImportUrl] = useState("");
  const [isCrawling, setIsCrawling] = useState(false);
  const [crawlError, setCrawlError] = useState(null);
  
  // Disassociate state
  const [showDisassociateConfirm, setShowDisassociateConfirm] = useState(false);
  const [isDisassociating, setIsDisassociating] = useState(false);
  
  // Link existing article state
  const [showLinkExisting, setShowLinkExisting] = useState(false);
  const [existingArticles, setExistingArticles] = useState([]);
  const [isLoadingArticles, setIsLoadingArticles] = useState(false);
  const [selectedExistingArticle, setSelectedExistingArticle] = useState(null);
  
  // Deep research mode state
  const [generatedArticle, setGeneratedArticle] = useState(null);
  const [researchData, setResearchData] = useState(null);
  const [filteredResearch, setFilteredResearch] = useState(null);
  const [reviewSummary, setReviewSummary] = useState(null);
  const [copiedSection, setCopiedSection] = useState(null);

  const phaseInfo = {
    1: { name: "Help them buy", type: "service-page", icon: "🏘️", description: "Bottom funnel: Enable instant conversion + convince the undecided" },
    2: { name: "Help them decide", type: "guide", icon: "🏛️", description: "Mid funnel: Guide evaluation (vendor or strategy comparison)" },
    3: { name: "Help them discover", type: "pillar-page", icon: "🏔️", description: "Top funnel: Educate latent customers on achieving the outcome" },
    "Expand": { name: "Expand", type: "satellite", icon: "🛰️", description: "Satellite articles: Supporting content around your pillar page to grow search visibility" }
  };

  const currentPhase = phaseInfo[phase] || phaseInfo[1];

  useEffect(() => {
    loadExistingArticle();
  }, [campaign?.id, phase, propArticleId]);

  const loadExistingArticle = async () => {
    try {
      setIsLoading(true);

      // Reset state first
      setArticleId(null);
      setArticleTitle("");
      setArticleContent("");
      setIsEditingInline(false);

      if (!campaign?.id) {

        return;
      }

      // If articleId prop is provided, load that specific article
      if (propArticleId) {

        const { data: article, error } = await supabase
          .from('content_magic_articles')
          .select('*')
          .eq('id', propArticleId)
          .eq('campaign_id', campaign.id)
          .single();
        
        if (error) {

          throw error;
        }
        
        if (article) {

          setArticleId(article.id);
          setArticleTitle(article.title || "");
          const content = article.content_html || "";
          setArticleContent(content);
          const textContent = content ? content.replace(/<[^>]*>/g, '').trim() : '';
          setHasEditorContent(textContent.length >= 50);
          // Don't set isEditingInline - show article info UI instead
          setIsEditingInline(false);
        }
        return;
      }

      // If articleId is null and phase is "Expand", don't load any article (start fresh)
      if (propArticleId === null && phase === "Expand") {

        setHasEditorContent(false);
        return;
      }

      // For other phases, load the latest article (existing behavior)

      // For "Expand" phase, query by campaign_phase = 4
      // For numeric phases (1, 2, 3), query by campaign_phase
      let query = supabase
        .from('content_magic_articles')
        .select('*')
        .eq('campaign_id', campaign.id);
      
      if (phase === "Expand") {
        // For Expand phase, use campaign_phase = 4
        query = query.eq('campaign_phase', 4);
      } else {
        // For numeric phases, query by campaign_phase as number
        query = query.eq('campaign_phase', phase);
      }
      
      const { data: articles, error } = await query
        .order('created_at', { ascending: false })
        .limit(1);
      
      if (error) {

        throw error;
      }
      
      const existingArticle = articles?.[0];
      
      if (existingArticle) {

        setArticleId(existingArticle.id);
        setArticleTitle(existingArticle.title || "");
        const content = existingArticle.content_html || "";
        setArticleContent(content);
        // Check if there's meaningful content
        const textContent = content ? content.replace(/<[^>]*>/g, '').trim() : '';
        setHasEditorContent(textContent.length >= 50);
        // Don't set isEditingInline - show article info UI instead
        setIsEditingInline(false);
      } else {

        setHasEditorContent(false);
      }
    } catch (error) {

    } finally {
      setIsLoading(false);
    }
  };

  const handleAIGenerate = async () => {
    try {
      setIsGenerating(true);
      setShowSuggestions(false);

      // Define phase-specific purposes and requirements
      const phasePurposes = {
        1: `Phase 1 Purpose (Landing Page - Bottom of Funnel):
AUDIENCE: Visitors seeking vendors + those with conversion intent
GOAL: Convert seekers into buyers, and enable instant action for ready buyers

PRIMARY OBJECTIVE (3-second test):
• Determine the most appropriate call-to-action for this offer (order, book meeting, contact, etc.)
• Make that action completable within seconds for ready buyers

SECONDARY OBJECTIVE (convince "on the fence"):
• Present general decision factors involved in choosing this type of offer/solution
• Highlight the specific USPs that differentiate this offer
• Help them confirm: "This is the right solution for me"

CONTENT APPROACH:
• Lead with clear value proposition aligned with the outcome they want
• Address both emotional (identity, pain points) and rational (decision factors) needs
• Include concrete transactional details (don't make them ask)
• Strong, friction-free call-to-action

Title strategy: Lead with the outcome/main keyword in the first few words. This is a transactional page—the core message is "what you're looking for is here." Keep it simple and direct. USPs, pain points, and identity callouts are optional—only add them if they meaningfully differentiate without cluttering the main message.`,

        2: `Phase 2 Purpose (Decision Guide - Mid Funnel):
AUDIENCE: Actively seeking solutions, trying to figure out the right strategy and vendor
CRITICAL: This phase varies significantly based on customer familiarity with the solution space

YOUR TASK: Analyze the offer and determine which comparison approach fits:
• If customers are FAMILIAR with this type of solution → Focus on vendor comparison (who to choose)
• If customers are UNFAMILIAR with solutions → Focus on strategy/approach comparison (what to choose)

GOAL: Guide them through their evaluation process toward the landing page (Phase 1)

CONTENT APPROACH:
• Help them understand their options clearly
• Address key decision criteria they're evaluating
• Position this offer naturally without being overly promotional
• Show why this solution/vendor fits their specific needs

Title strategy: Should reflect the comparison type - adapt to whether this is a vendor selection or strategy selection decision`,

        3: `Phase 3 Purpose (Outcome Guide - Top of Funnel):
AUDIENCE: Latent customers transitioning to active seekers
MINDSET: They resonate with the OUTCOME, not solution details yet

WHO ARE LATENT CUSTOMERS:
• Know they want the outcome/transformation
• Don't yet know the solution approaches or vendors
• Respond to identity-based callouts (who they are) and pain-point language
• Not ready for technical details or vendor comparisons

GOAL: Educate on HOW to achieve the outcome they desire (step-by-step guide)

CONTENT APPROACH:
• Focus on the outcome/transformation throughout
• Provide detailed step-by-step guidance for achieving it
• Use language that speaks to their identity and pain points
• Naturally introduce the solution as a tool for achieving the outcome (not the focus)
• Build authority through valuable, actionable information

Title strategy: Outcome-focused, educational, promises clear path to achieving what they want`,

        "Expand": `Expand Purpose (Content Cluster - Satellite Articles):
AUDIENCE: Search engine users and AI systems seeking related information
GOAL: Create content cluster to support the main pages (Phase 1, 2, 3)

PRIMARY OBJECTIVES:
• Draw in traffic for target keywords that bring visitors searching for related topics
• Support main pages in SEO (Search Engine Optimization) and GEO (Generative Engine Optimization)
• Keep new content coming to the site, which is favored by search engines and AIs

CONTENT CLUSTER STRATEGY:
• Create supporting articles that link back to and reinforce your pillar pages (Phase 3)
• Target long-tail and related search queries your ICP uses
• Cover topics that complement and expand on your main content
• Build topical authority around your core offering

CONTENT APPROACH:
• Deep dives on key concepts from your pillar page
• Usage scenarios and case studies showing real-world applications
• Troubleshooting guides and common mistakes
• Micro-decision content (A vs B comparisons)
• Checklists, templates, and practical tools

Title strategy: Keyword-focused, specific, addresses search queries related to your main content`
      };

      // Get AI configuration for title generation
      const aiConfig = AI_CONFIG.articleTitle;
      const modelToUse = aiConfig.getModel(phase);
      
      // Get roadmap mode for Phase 2 to determine which template to use
      const roadmapMode = phase === 2 ? campaign.campaign_roadmap?.phase2_choice : null;
      const titleTemplate = aiConfig.getTemplate(phase, roadmapMode);
      
      // Determine which template name is being used for logging
      let templateName = 'articleTitle (default)';
      if (phase === 2) {
        if (roadmapMode === 'scenario_listicle') {
          templateName = 'articleTitleListicle';
        } else if (roadmapMode === 'comparison_guide') {
          templateName = 'articleTitleComparisonGuide';
        } else {
          templateName = 'articleTitleComparisonGuide (default for Phase 2)';
        }
      } else if (phase === 1) {
        templateName = 'articleTitle';
      } else if (phase === 3) {
        templateName = 'articleTitleOutcomePillar';
      } else if (phase === "Expand") {
        templateName = 'articleTitleSatellite';
      }

      

      const userInput = articleTitle.trim();
      if (userInput) {

      } else {

      }
      
      const prompt = titleTemplate(
        campaign.icp?.name,
        campaign.icp?.description,
        campaign.offer?.name,
        campaign.offer?.description,
        campaign.outcome,
        campaign.peace_of_mind,
        currentPhase.name,
        phasePurposes[phase],
        userInput // Pass user's current input as context
      );

      const monkey = await initMonkey();
      const text = await monkey.apiCall("/api/ai", {
        query: prompt,
        vendor: "ChatGPT",
        model: modelToUse
      });
      const data = JSON.parse(text);
      if (data.error) throw new Error(data.error || "AI generation failed");
      let suggestions = data.response || data.result;

      if (typeof suggestions === 'string') {
        suggestions = suggestions.replace(/```json\n?/g, '').replace(/```\n?/g, '').trim();
        suggestions = JSON.parse(suggestions);
      }

      const filteredSuggestions = suggestions.filter(s => s && s.trim());
      setAiSuggestions(filteredSuggestions);
      
      // Store original prompt and suggestions for feedback functionality
      setOriginalPrompts(prev => ({ ...prev, title: prompt }));
      setPreviousSuggestions(prev => ({ ...prev, title: filteredSuggestions }));
      
      setShowSuggestions(true);

    } catch (error) {

      alert("Failed to generate suggestions. Please try again.");
    } finally {
      setIsGenerating(false);
    }
  };

  /**
   * Reusable function to generate AI title suggestions with user feedback
   * @param {string} userFeedback - The user's feedback text
   */
  const handleAIGenerateWithFeedback = async (userFeedback) => {
    // Feedback is optional - only exists after first iteration
    // If no feedback provided, just use empty string
    // Ensure userFeedback is a string before calling trim
    const feedback = (typeof userFeedback === 'string' ? userFeedback.trim() : '') || '';

    const originalPrompt = originalPrompts['title'];
    const prevSuggestions = previousSuggestions['title'] || [];

    if (!originalPrompt) {

      alert("Unable to generate feedback suggestions. Please generate initial suggestions first.");
      return;
    }

    try {

      setIsGenerating(true);
      setShowSuggestions(false);

      // Get AI configuration for title generation
      const aiConfig = AI_CONFIG.articleTitle;
      const modelToUse = aiConfig.getModel(phase);
      
      // Get roadmap mode for Phase 2 to determine which template to use
      const roadmapMode = phase === 2 ? campaign.campaign_roadmap?.phase2_choice : null;
      const titleTemplate = aiConfig.getTemplate(phase, roadmapMode);
      
      // Determine which template name is being used for logging
      let templateName = 'articleTitle (default)';
      if (phase === 2) {
        if (roadmapMode === 'scenario_listicle') {
          templateName = 'articleTitleListicle';
        } else if (roadmapMode === 'comparison_guide') {
          templateName = 'articleTitleComparisonGuide';
        } else {
          templateName = 'articleTitleComparisonGuide (default for Phase 2)';
        }
      } else if (phase === 1 || phase === 3) {
        templateName = 'articleTitle';
      }

      // Build feedback prompt
      const previousSuggestionsText = Array.isArray(prevSuggestions)
        ? prevSuggestions.map((s, i) => `${i + 1}. ${s}`).join('\n')
        : String(prevSuggestions);

      const feedbackPrompt = feedback 
        ? `Previous AI suggestions for this request:
${previousSuggestionsText}

User's feedback for previous results: ${feedback}

Original request:
${originalPrompt}

Based on the user's feedback above, please generate new suggestions that address their concerns. Retain the same response format as the original request.`
        : `Previous AI suggestions for this request:
${previousSuggestionsText}

Original request:
${originalPrompt}

Please generate new suggestions. Retain the same response format as the original request.`;

      

      const monkey = await initMonkey();
      const text = await monkey.apiCall("/api/ai", {
        query: feedbackPrompt,
        vendor: "ChatGPT",
        model: modelToUse
      });
      const data = JSON.parse(text);
      if (data.error) throw new Error(data.error || "AI generation failed");
      let suggestions = data.response || data.result;

      if (typeof suggestions === 'string') {
        suggestions = suggestions.replace(/```json\n?/g, '').replace(/```\n?/g, '').trim();
        suggestions = JSON.parse(suggestions);
      }

      const filteredSuggestions = suggestions.filter(s => s && s.trim());
      setAiSuggestions(filteredSuggestions);
      setPreviousSuggestions(prev => ({ ...prev, title: filteredSuggestions }));
      setShowSuggestions(true);
      setShowFeedbackInput(prev => ({ ...prev, title: false }));
      setFeedbackText(prev => ({ ...prev, title: "" }));

    } catch (error) {

      alert(`Failed to generate AI suggestion: ${error.message}`);
    } finally {
      setIsGenerating(false);
    }
  };

  /**
   * Reusable Feedback UI Component for title suggestions
   */
  const renderFeedbackSection = (field) => {
  console.log("[app/(private)/campaigns/components/CampaignArticleOutline.js] renderFeedbackSection");
    return (
      <div className="pt-2 mt-2 border-t border-blue-300">
        <p className="text-xs text-gray-600 mb-2">Or provide feedback to generate new options</p>
        
        {!showFeedbackInput[field] ? (
          <button
            onClick={() => setShowFeedbackInput(prev => ({ ...prev, [field]: true }))}
            className="w-full text-center p-2 text-sm text-blue-600 hover:text-blue-800 hover:bg-blue-100 rounded border border-blue-200 transition-colors"
          >
            Provide Feedback
          </button>
        ) : (
          <div className="space-y-2">
            <textarea
              value={feedbackText[field] || ''}
              onChange={(e) => setFeedbackText(prev => ({ ...prev, [field]: e.target.value }))}
              placeholder="What would you like to change or improve?"
              className="w-full px-2 py-1 text-sm border border-gray-300 rounded min-h-[60px]"
              rows={3}
            />
            <div className="flex gap-2">
              <button
                onClick={() => handleAIGenerateWithFeedback(feedbackText[field] || '')}
                disabled={isGenerating || !feedbackText[field]?.trim()}
                className="flex-1 px-3 py-1 bg-blue-600 text-white text-sm rounded hover:bg-blue-700 disabled:opacity-50 disabled:cursor-not-allowed inline-flex items-center justify-center gap-2"
              >
                {isGenerating ? "Generating..." : "Refresh Suggestions"}
                <CreditCostBadge path="/api/ai" size="sm" />
              </button>
              <button
                onClick={() => {
                  setShowFeedbackInput(prev => ({ ...prev, [field]: false }));
                  setFeedbackText(prev => ({ ...prev, [field]: "" }));
                }}
                className="px-3 py-1 bg-gray-200 text-gray-700 text-sm rounded hover:bg-gray-300"
              >
                Cancel
              </button>
            </div>
          </div>
        )}
      </div>
    );
  };

  const handleSelectSuggestion = (suggestion) => {
  console.log("[app/(private)/campaigns/components/CampaignArticleOutline.js] handleSelectSuggestion");
    setArticleTitle(suggestion);
    setShowSuggestions(false);
    // Clear feedback state when suggestion is selected
    setShowFeedbackInput(prev => ({ ...prev, title: false }));
    setFeedbackText(prev => ({ ...prev, title: "" }));
  };

  const handleCheckCompetitors = async () => {
    if (!campaign.offer?.name && !articleTitle.trim()) {
      alert("Please enter a title or select an offer first");
      return;
    }

    try {
      setIsSearchingCompetitors(true);
      setShowCompetitors(false);

      // Use article title if available (more specific), otherwise fallback to offer name
      const searchQuery = articleTitle.trim() 
        ? articleTitle  
        : `${campaign.offer.name} ${currentPhase.name}`;

      const monkey = await initMonkey();
      const text = await monkey.apiCall("/api/monkey", {
        action: "webSearch",
        table: searchQuery,
        payload: { maxResults: 5 }
      });
      const data = JSON.parse(text);
      if (data.error) throw new Error(data.error || "Competitor search failed");
      const results = data.result || [];

      setCompetitorResults(results.slice(0, 5));
      setShowCompetitors(true);

    } catch (error) {

      alert("Failed to search competitors. Please enter a starting title and try again.");
    } finally {
      setIsSearchingCompetitors(false);
    }
  };

  const handleSelectCompetitor = (competitorTitle) => {
  console.log("[app/(private)/campaigns/components/CampaignArticleOutline.js] handleSelectCompetitor");
    setArticleTitle(competitorTitle);
    setShowCompetitors(false);
  };

  const isValidUrl = (string) => {
  console.log("[app/(private)/campaigns/components/CampaignArticleOutline.js] isValidUrl");
    try {
      new URL(string);
      return true;
    } catch {
      return false;
    }
  };

  const handleCrawlUrl = async () => {
    if (!importUrl || !isValidUrl(importUrl)) {
      setCrawlError("Please enter a valid URL (e.g., https://example.com)");
      return;
    }

    setIsCrawling(true);
    setCrawlError(null);

    try {

      const monkey = await initMonkey();
      const text = await monkey.apiCall("/api/content-magic/crawl", {
        url: importUrl,
        crawlDepth: 0,
      });
      const data = JSON.parse(text);
      if (data.error) throw new Error(data.error || "Failed to crawl URL");

      if (data.content && data.content.length > 0) {
        const content = data.content[0]?.html || "";
        const extractedTitle = data.title || "Untitled Article";
        
        if (content) {

          // Create article with crawled content and extracted title
          await handleCreateArticleFromUrl(content, importUrl, extractedTitle);
        } else {
          throw new Error("No content extracted from URL");
        }
      } else {
        throw new Error("No content found at URL");
      }
    } catch (err) {

      setCrawlError(err.message || "Failed to load URL. Please check the URL and try again.");
    } finally {
      setIsCrawling(false);
    }
  };

  const handleCreateArticleFromUrl = async (content, sourceUrl, extractedTitle) => {
    try {
      setIsSaving(true);

      const { data: { user } } = await supabase.auth.getUser();
      if (!user) {
        alert("Not authenticated");
        return;
      }

      const articleContext = {
        type: currentPhase.type,
        icpId: campaign.icp_id,
        campaignId: campaign.id,
        campaignPhase: phase,
        sourceUrl: sourceUrl,
        campaignSettings: {
          name: campaign.name,
          outcome: campaign.outcome,
          peace_of_mind: campaign.peace_of_mind,
          icp: {
            id: campaign.icp?.id,
            name: campaign.icp?.name,
            description: campaign.icp?.description
          },
          offer: {
            id: campaign.offer?.id,
            name: campaign.offer?.name,
            description: campaign.offer?.description,
            transactional_facts: campaign.offer?.transactional_facts
          }
        },
        createdAt: new Date().toISOString()
      };

      const articleData = {
        user_id: user.id,
        icp_id: campaign.icp_id,
        campaign_id: campaign.id,
        campaign_phase: getPhaseDbValue(phase),
        title: extractedTitle, // Use extracted title from page
        content_html: content,
        type: currentPhase.type,
        status: "draft",
        source_url: sourceUrl, // Save the source URL
        context: articleContext
      };

      const { data, error } = await supabase
        .from("content_magic_articles")
        .insert(articleData)
        .select("id, content_html, title")
        .single();

      if (error) throw error;

      // Reload from database to ensure fresh content
      await loadExistingArticle();
      
      setImportUrl(""); // Clear URL field
      setCrawlError(null); // Clear any errors
      alert("Article created successfully from URL! You can now edit it below.");
    } catch (error) {

      alert("Failed to create article from URL. Please try again.");
    } finally {
      setIsSaving(false);
    }
  };

  const handleCreateOrOpenArticle = async () => {
    if (!articleTitle.trim()) {
      alert("Please enter an article title");
      return;
    }

    try {
      setIsSaving(true);

      const { data: { user } } = await supabase.auth.getUser();
      if (!user) {
        alert("Not authenticated");
        return;
      }

      if (articleId) {
        // Article already exists, just open it in full editor
        handleOpenFullEditor();
        setIsSaving(false);
        return;
      }

      const articleContext = {
        type: currentPhase.type,
        icpId: campaign.icp_id,
        campaignId: campaign.id,
        campaignPhase: phase,
        campaignSettings: {
          name: campaign.name,
          outcome: campaign.outcome,
          peace_of_mind: campaign.peace_of_mind,
          icp: {
            id: campaign.icp?.id,
            name: campaign.icp?.name,
            description: campaign.icp?.description
          },
          offer: {
            id: campaign.offer?.id,
            name: campaign.offer?.name,
            description: campaign.offer?.description,
            transactional_facts: campaign.offer?.transactional_facts
          }
        },
        createdAt: new Date().toISOString()
      };

      // Create article with empty content
      const articleData = {
          user_id: user.id,
          icp_id: campaign.icp_id,
          campaign_id: campaign.id,
          campaign_phase: getPhaseDbValue(phase),
          title: articleTitle,
          content_html: "", // Empty content - user will add content in full editor
          type: currentPhase.type,
          status: "draft",
        context: articleContext
      };

      const { data, error } = await supabase
        .from("content_magic_articles")
        .insert(articleData)
        .select("id, content_html, title")
        .single();

      if (error) throw error;

      // Reload the article to show it in the UI
      await loadExistingArticle();
      
      alert("Article created successfully! You can now open it to edit.");
    } catch (error) {

      alert("Failed to save article. Please try again.");
    } finally {
      setIsSaving(false);
    }
  };

  const handleSaveContent = async () => {
    if (!articleId) return;

    try {
      setIsSaving(true);

      const contentToSave = editorRef.current ? editorRef.current.getHtml() : articleContent;

      const { error } = await supabase
        .from("content_magic_articles")
        .update({
          title: articleTitle,
          content_html: contentToSave
        })
        .eq("id", articleId);

      if (error) throw error;

      // Update local state to reflect saved changes
      setArticleContent(contentToSave);

      alert("Article saved successfully!");
      // Don't call onSaved() - let user continue editing
      // They can use the Back button when completely done
    } catch (error) {

      alert("Failed to save content. Please try again.");
    } finally {
      setIsSaving(false);
    }
  };

  const handleOpenFullEditor = () => {
  console.log("[app/(private)/campaigns/components/CampaignArticleOutline.js] handleOpenFullEditor");
    if (articleId) {
      // Open full editor in new tab
      window.open(`/content-magic/${articleId}`, '_blank');
      // Navigate current tab back to campaign overview to avoid version conflicts
      onBack();
    }
  };

  const handleDisassociateArticle = async () => {
    if (!articleId) return;

    setIsDisassociating(true);
    try {
      const { error } = await supabase
        .from("content_magic_articles")
        .update({
          campaign_id: null,
          campaign_phase: null
        })
        .eq("id", articleId);

      if (error) throw error;

      setShowDisassociateConfirm(false);
      alert(
        "Article has been disassociated from this campaign.\n\n" +
        "The article still exists and can be found in the Content Magic module.\n\n" +
        "You can delete it from there if needed."
      );
      
      // Navigate back to campaign overview
      onBack();
    } catch (error) {

      alert("Failed to disassociate article. Please try again.");
    } finally {
      setIsDisassociating(false);
    }
  };

  const handleLoadExistingArticles = async () => {
    setIsLoadingArticles(true);
    try {
      const { data: { user } } = await supabase.auth.getUser();
      if (!user) return;

      const { data, error } = await supabase
        .from("content_magic_articles")
        .select("id, title, type, created_at")
        .eq("user_id", user.id)
        .is("campaign_id", null) // Only articles not linked to any campaign
        .order("created_at", { ascending: false });

      if (error) throw error;

      setExistingArticles(data || []);
      setShowLinkExisting(true);
    } catch (error) {

      alert("Failed to load existing articles. Please try again.");
    } finally {
      setIsLoadingArticles(false);
    }
  };

  const handleLinkExistingArticle = async (articleToLink) => {
    try {
      setIsSaving(true);

      const { error } = await supabase
        .from("content_magic_articles")
        .update({
          campaign_id: campaign.id,
          campaign_phase: getPhaseDbValue(phase)
        })
        .eq("id", articleToLink.id);

      if (error) throw error;

      // Reload to show the linked article
      await loadExistingArticle();
      
      setShowLinkExisting(false);
      setSelectedExistingArticle(null);
      alert("Article has been linked to this campaign!");
    } catch (error) {

      alert("Failed to link article. Please try again.");
    } finally {
      setIsSaving(false);
    }
  };

  const handleGenerateOutline = async (userFeedback = '') => {
    if (!articleTitle.trim()) {
      alert("Please enter an article title first");
      return;
    }

    try {
      setIsGeneratingOutline(true);

      let phaseInstructions = "";
      const transactionalFacts = campaign.offer?.transactional_facts || 'pricing and availability details';
      
      // Determine which prompt template to use based on phase and roadmap
      let promptTemplate = PROMPT_TEMPLATES.articleOutline;
      
      if (phase === 1) {
        // Phase 1 uses the generic articleOutline template with minimal phase-specific guidance
        // The template handles structure, section topics, SIMPLE vs COMPLEX, etc.
        // No HTML structure or internal notes - let the template drive the structure
        phaseInstructions = "This is a bottom-funnel landing page for a service or offer, designed to convert visitors into customers. The reader already understands the problem. Focus on decision-grade outcomes, timelines, risk reduction, and clear next steps.";
      } else if (phase === 2) {
        // Check roadmap to determine Phase 2 format (new format)
        const roadmapMode = campaign.campaign_roadmap?.phase2_choice;
        const isListicle = roadmapMode === 'scenario_listicle';
        
        // Select the appropriate prompt template based on roadmap
        if (isListicle) {
          promptTemplate = PROMPT_TEMPLATES.articleOutlineListicle;
        } else {
          // Default to comparison guide (also used when roadmap is 'comparison_guide' or 'none')
          promptTemplate = PROMPT_TEMPLATES.articleOutlineComparisonGuide;
        }
        
        // Phase 2 doesn't use phaseInstructions - the prompt template handles it
        phaseInstructions = "";
      } else if (phase === 3) {
        // Phase 3 uses the dedicated outcome pillar template
        promptTemplate = PROMPT_TEMPLATES.articleOutlineOutcomePillar;
        phaseInstructions = "";
      } else if (phase === "Expand") {
        // Expand phase uses the satellite article template
        promptTemplate = PROMPT_TEMPLATES.articleOutlineSatellite;
        phaseInstructions = "";
      } else {
        phaseInstructions = `This is OUTCOME/HOW-TO CONTENT (pillar page) to educate ${campaign.icp?.name || 'readers'} about achieving: "${campaign.outcome || 'their desired outcome'}".

CONTENT STRUCTURE:
- <h1>${articleTitle}</h1>
- <p>Introduction about the importance of achieving this outcome</p>

- <h2>Understanding the Challenge</h2>
  <p>[Why this outcome is difficult to achieve]</p>
  <p>[Common obstacles faced by ${campaign.icp?.name || 'people'}]</p>

- <h2>Step-by-Step Guide to ${campaign.outcome || 'Success'}</h2>
  <h3>Step 1: [First Action]</h3>
  <p>[Detailed instructions]</p>
  
  <h3>Step 2: [Second Action]</h3>
  <p>[Detailed instructions]</p>
  
  <h3>Step 3: [Third Action]</h3>
  <p>[Detailed instructions]</p>

- <h2>Common Mistakes to Avoid</h2>
  <ul>
    <li><strong>[Mistake 1]</strong> - [Why it's problematic and how to avoid it]</li>
    <li><strong>[Mistake 2]</strong> - [Why it's problematic and how to avoid it]</li>
  </ul>

- <h2>Tools & Resources That Help</h2>
  <p>[Naturally mention how ${campaign.offer?.name || 'the right tools'} can make this process easier]</p>
  <p>[Reference: ${campaign.offer?.description || ''}]</p>

- <h2>Conclusion</h2>
  <p>[Recap the key points]</p>
  <p>[Encourage action toward achieving the outcome]</p>`;
      }

      // Get AI configuration for outline generation
      const aiConfig = AI_CONFIG.articleOutline;

      // Use the selected prompt template
      // Phase 1 uses articleOutline template which accepts phaseInstructions as the last parameter
      // Other phases use dedicated templates that don't accept phaseInstructions
      let prompt = phase === 1
        ? promptTemplate(
            campaign.icp?.name,
            campaign.icp?.description,
            campaign.offer?.name,
            campaign.offer?.description,
            campaign.offer?.transactional_facts,
            campaign.outcome,
            campaign.peace_of_mind,
            articleTitle,
            currentPhase.name,
            currentPhase.description,
            { phase, instructions: phaseInstructions }
          )
        : promptTemplate(
            campaign.icp?.name,
            campaign.icp?.description,
            campaign.offer?.name,
            campaign.offer?.description,
            campaign.offer?.transactional_facts,
            campaign.outcome,
            campaign.peace_of_mind,
            articleTitle,
            currentPhase.name,
            currentPhase.description
          );

      // Append user feedback to the prompt if provided
      // Ensure userFeedback is a string before calling trim
      const feedbackText = typeof userFeedback === 'string' ? userFeedback.trim() : '';
      if (feedbackText) {
        prompt += `\n\nUSER FEEDBACK (use this to refine the outline):\n${feedbackText}`;

      }

      // Append user instructions to the prompt if provided
      const instructionsText = outlineInstructions.trim();
      if (instructionsText) {
        prompt += `\n\nUSER INSTRUCTIONS (follow these instructions when generating the outline):\n${instructionsText}`;

      }

      // Log action trigger (client-side, will only log in dev mode via server-side logger in API route)
      // Server-side logger will handle the actual strategic logging

      const monkey = await initMonkey();
      const text = await monkey.apiCall("/api/ai", {
        query: prompt,
        vendor: "ChatGPT",
        model: aiConfig.model
      });
      const data = JSON.parse(text);
      if (data.error) throw new Error(data.error || "AI generation failed");

      let rawResponse = data.response || data.result;

      

      // Clean up markdown code blocks if present
      rawResponse = rawResponse.replace(/```json\n?/g, '').replace(/```\n?/g, '').trim();
      
      // Try to parse as JSON
      let outlineHtml = '';
      try {
        const parsed = JSON.parse(rawResponse);

        // Check if this is the new Phase 2 or Phase 3 format (array of outline objects with section_id)
        if (Array.isArray(parsed) && parsed.length > 0 && parsed[0].section_id) {
          // Check if it's Phase 3 format by looking for Phase 3-specific section IDs
          const hasPhase3Section = parsed.some(s => 
            s.section_id === 'why_this_is_hard' || 
            s.section_id === 'roadmap_overview' || 
            s.section_id === 'stage_walkthrough'
          );
          
          if (hasPhase3Section) {
            // Phase 3 Outcome Pillar format: array of { section_id, title, body } (new) or { section_id, title, goal, bullets, ... } (old)
            
            outlineHtml = convertOutcomePillarOutlineToHtml(parsed);
          } else {
            // Phase 2 format: array of { section_id, title, body } (or old: { section_id, title, purpose, bullets })
            
            outlineHtml = convertComparisonGuideOutlineToHtml(parsed);
          }
        } else if (parsed.sections && Array.isArray(parsed.sections)) {
          // Old format: { sections: [...] } with html or tag fields
          
          
          if (parsed.sections.length === 0) {
            throw new Error("Invalid JSON structure: sections array is empty");
          }
          
          // Check if sections have 'html' field (new format) or 'tag' field (old format)
          if (parsed.sections[0].html) {
            // Format: { heading, html }

            outlineHtml = parsed.sections.map(s => s.html).filter(Boolean).join('\n\n');
          } else if (parsed.sections[0].tag) {
            // Format: { tag, content, items, etc }

            outlineHtml = convertSectionsToHtml(parsed.sections);
          } else {
            throw new Error("Unknown section format");
          }
        } else {
          throw new Error("Invalid JSON structure: expected array or object with sections");
        }

      } catch (parseError) {
        // Fallback: treat as raw HTML (backward compatibility)

        outlineHtml = rawResponse.replace(/```html\n?/g, '').replace(/```\n?/g, '').trim();
      }

      if (!outlineHtml || outlineHtml.length < 20) {
        throw new Error("Generated outline is too short or empty");
      }

      if (editorRef.current) {
        editorRef.current.setHtml(outlineHtml);
        setArticleContent(outlineHtml);
        setHasEditorContent(true); // Enable evaluation button

        // Trigger save after AI suggested outline comes back
        if (articleId) {
          // Small delay to ensure editor state is updated
          setTimeout(async () => {
            try {
              setIsSaving(true);
              const contentToSave = editorRef.current ? editorRef.current.getHtml() : outlineHtml;

              const { error } = await supabase
                .from("content_magic_articles")
                .update({
                  title: articleTitle,
                  content_html: contentToSave
                })
                .eq("id", articleId);
              
              if (error) throw error;
              
              setArticleContent(contentToSave);

            } catch (error) {

              // Don't show alert for auto-save failures - user can manually save if needed
            } finally {
              setIsSaving(false);
            }
          }, 500);
        }
      }

      alert("Outline generated! You can now edit it.");
      
      // Hide instructions input after successful generation
      setShowOutlineInstructions(false);
      setOutlineInstructions('');

    } catch (error) {

      alert(`Failed to generate outline: ${error.message}\n\nPlease try again.`);
    } finally {

      setIsGeneratingOutline(false);
    }
  };

  const handleGenerateFullArticle = async () => {
    if (!editorRef.current) {
      alert("Editor not ready");
      return;
    }

    if (!articleTitle.trim()) {
      alert("Please enter an article title first");
      return;
    }

    try {
      setIsGeneratingFullArticle(true);
      setGeneratedArticle(null);
      setResearchData(null);
      setFilteredResearch(null);

      // Build step1Output format (matching agent-playground structure)
      const step1Output = {
        icp: {
          name: campaign.icp?.name || "Unknown ICP",
          description: campaign.icp?.description || "",
        },
        offer: {
          name: campaign.offer?.name || "",
          description: campaign.offer?.description || "",
          transactional_facts: campaign.offer?.transactional_facts || "",
        },
        outcome: campaign.outcome || "",
        peace_of_mind: campaign.peace_of_mind || "",
      };

      // Build user prompt
      const userPrompt = agenticInstructions.trim() 
        ? `${articleTitle}\n\n${agenticInstructions}`
        : articleTitle;

      // Call the deep research mode API
      const monkey = await initMonkey();
      const text = await monkey.apiCall("/api/monkey/landing-page/write-article", {
        model: "high",
        step1Output,
        clarificationAnswers: {
          userPrompt: userPrompt
        },
        pageType: "BASE_UNIVERSAL",
        useAgentMode: true,
        theme: "minimalist",
        agentMode: "deep_research", // Use deep research mode
      });
      const data = JSON.parse(text);

      if (!data.success) {
        throw new Error(data.error || "Failed to generate article");
      }

      // Store generated article and research data
      setGeneratedArticle(data.article);
      setResearchData(data.research);

      // Review research data if available
      if (data.research && data.article?.html) {
        await reviewResearchData(data.research, data.article.html);
      }

    } catch (error) {

      alert(`Failed to generate full article: ${error.message}\n\nPlease try again.`);
    } finally {
      setIsGeneratingFullArticle(false);
    }
  };

  const reviewResearchData = async (researchData, currentArticleHtml) => {
    try {
      const step1Output = {
        icp: {
          name: campaign.icp?.name || "Unknown ICP",
          description: campaign.icp?.description || "",
        },
        offer: {
          name: campaign.offer?.name || "",
          description: campaign.offer?.description || "",
        },
      };
      
      const monkey = await initMonkey();
      const text = await monkey.apiCall("/api/monkey/landing-page/review-research", {
        researchData,
        articleHtml: currentArticleHtml,
        icp: step1Output.icp,
        offer: step1Output.offer,
      });
      const data = JSON.parse(text);
      
      if (data.success) {
        setFilteredResearch(data.filteredResearch);
        setReviewSummary(data.reviewSummary);

      } else {
        setFilteredResearch(researchData);
      }
    } catch (error) {

      setFilteredResearch(researchData);
    }
  };

  const handleCopyToClipboard = async (htmlContent) => {
    try {
      // Extract just the body content if it's a full HTML document
      let contentToCopy = htmlContent;
      if (htmlContent.includes('<body>')) {
        const parser = new DOMParser();
        const doc = parser.parseFromString(htmlContent, "text/html");
        contentToCopy = doc.body.innerHTML;
      }
      
      await navigator.clipboard.writeText(contentToCopy);
      setCopiedSection(true);
      setTimeout(() => setCopiedSection(null), 2000);
    } catch (error) {

      alert("Failed to copy to clipboard. Please try again.");
    }
  };

  const handleInsertToEnd = () => {
  console.log("[app/(private)/campaigns/components/CampaignArticleOutline.js] handleInsertToEnd");
    if (!generatedArticle?.html || !editorRef.current) return;
    
    try {
      // Extract body content from generated article
      let contentToInsert = generatedArticle.html;
      if (contentToInsert.includes('<body>')) {
        const parser = new DOMParser();
        const doc = parser.parseFromString(contentToInsert, "text/html");
        contentToInsert = doc.body.innerHTML;
      }
      
      // Get current editor content
      const currentContent = editorRef.current.getHtml();
      
      // Append new content
      const updatedContent = currentContent + contentToInsert;
      
      // Set in editor
      editorRef.current.setHtml(updatedContent);
      setArticleContent(updatedContent);
      
      // Clear generated article state
      setGeneratedArticle(null);
      setResearchData(null);
      setFilteredResearch(null);
      
      alert("Article content inserted at the end of the editor!");
    } catch (error) {

      alert("Failed to insert content. Please try copying manually.");
    }
  };

  // Legacy code for step-by-step generation (keeping for backward compatibility)
  const handleGenerateFullArticleLegacy = async () => {
    if (!editorRef.current) {
      alert("Editor not ready");
      return;
    }

    const outlineContent = editorRef.current.getHtml();
    const hasOutlineContent = outlineContent && outlineContent.trim().length >= 50;
    
    if (!hasOutlineContent) {

    } else {
      
    }

    if (!articleTitle.trim()) {
      alert("Please enter an article title first");
      return;
    }

    try {
      setIsGeneratingFullArticle(true);

      // Initialize monkey.agentic_state if it doesn't exist
      if (!window.monkey) {
        window.monkey = {};
      }
      if (!window.monkey.agentic_state) {
        window.monkey.agentic_state = {
          runId: null,
          currentStep: null,
          steps: [],
          artifacts: {},
        };
      }

      // Build campaign context
      const campaignContext = {
        icp: {
          name: campaign.icp?.name || "Unknown ICP",
          description: campaign.icp?.description || "",
        },
        campaign: {
          name: campaign.name || "Untitled Campaign",
          goal: campaign.goal || "",
        },
        offer: {
          name: campaign.offer?.name || "",
          description: campaign.offer?.description || "",
          transactional_facts: campaign.offer?.transactional_facts || "",
        },
        outcome: campaign.outcome || "",
        peace_of_mind: campaign.peace_of_mind || "",
      };

      // Build base query
      let baseQuery = hasOutlineContent 
        ? `Generate a full article with title: "${articleTitle}". Use this outline as reference:\n\n${outlineContent}`
        : `Generate a full article with title: "${articleTitle}"`;
      
      // Append user instructions if provided
      const instructionsText = agenticInstructions.trim();
      if (instructionsText) {
        baseQuery += `\n\nUSER INSTRUCTIONS (follow these instructions when generating the article):\n${instructionsText}`;

      }

      // Step-by-step loop
      let runId = window.monkey.agentic_state.runId;
      let nextStep = window.monkey.agentic_state.currentStep || 1;
      let finalHtml = null;

      while (nextStep) {

        // Build request
        const request = {
          model: "high",
          taskType: "WRITE_ARTICLE_LANDING",
          campaignContext: campaignContext,
          userInput: {
            query: baseQuery,
            ...(runId && nextStep > 1 ? { runId, stepIndex: nextStep } : {}),
          },
          constraints: {
            tone: "Professional and approachable",
            audience: campaign.icp?.name || "Target audience",
          },
        };

        // Call API
        const monkey = await initMonkey();
        const text = await monkey.apiCall("/api/monkey/run-task", request);
        const data = typeof text === "string" ? JSON.parse(text) : text;

        if (data.error) {
          throw new Error(data.error || `Step ${nextStep} failed`);
        }

        // Always log the full response in browser console
        // Try to extract and parse JSON if it's a string, otherwise log the object directly
        let responseToLog = data;
        if (typeof data === 'string') {
          try {
            // Try to extract JSON from markdown code blocks or plain text
            const jsonMatch = data.match(/```(?:json)?\s*([\s\S]*?)```/) || data.match(/(\{[\s\S]*\}|\[[\s\S]*\])/);
            if (jsonMatch) {
              responseToLog = JSON.parse(jsonMatch[1] || jsonMatch[0]);
            } else {
              // Try parsing the whole string
              responseToLog = JSON.parse(data);
            }
          } catch (e) {
            // If parsing fails, log as string
            responseToLog = data;
          }
        }

        if (!data.ok) {
          const errorDetails = data.errors?.[0];
          const errorMessage = errorDetails?.message || `Step ${nextStep} failed`;

          // Try to parse and display error response as object if it's a string
          let errorResponseToLog = data;
          if (typeof data === 'string') {
            try {
              const jsonMatch = data.match(/```(?:json)?\s*([\s\S]*?)```/) || data.match(/(\{[\s\S]*\}|\[[\s\S]*\])/);
              if (jsonMatch) {
                errorResponseToLog = JSON.parse(jsonMatch[1] || jsonMatch[0]);
              } else {
                errorResponseToLog = JSON.parse(data);
              }
            } catch (e) {
              errorResponseToLog = data;
            }
          }

          throw new Error(errorMessage);
        }

        // Update state
        runId = data.runId || runId;
        window.monkey.agentic_state.runId = runId;
        window.monkey.agentic_state.currentStep = data.meta?.nextStep || null;
        window.monkey.agentic_state.steps.push({
          step: data.step,
          stepName: data.stepName,
          message: data.message,
          artifacts: data.artifacts,
          timestamp: new Date().toISOString(),
        });
        if (data.artifacts) {
          window.monkey.agentic_state.artifacts = {
            ...window.monkey.agentic_state.artifacts,
            ...data.artifacts,
          };
        }

        // Display message in editor (or full JSON if message doesn't exist)
        const displayContent = data.message || JSON.stringify(data, null, 2);
        if (editorRef.current && editorRef.current.setHtml) {
          // Append to editor content (don't replace, so user can see progress)
          const currentContent = editorRef.current.getHtml();
          
          // TEMPORARY: Add proceed button for manual step triggering (for debugging)
          // This will be removed later - it's only for troubleshooting
          const proceedButtonId = `proceed-btn-${data.step || nextStep}-${Date.now()}`;
          
          // Build failed attempts display if any
          let failedAttemptsHtml = '';
          if (data.meta?.failedAttempts && data.meta.failedAttempts.length > 0) {
            failedAttemptsHtml = `<div style="margin-top: 10px; padding: 10px; background: #fff3cd; border-left: 4px solid #ffc107; border-radius: 4px;">
              <strong>⚠️ Failed Attempts (${data.meta.failedAttempts.length}):</strong>
              ${data.meta.failedAttempts.map((attempt, idx) => `
                <div style="margin-top: 8px; padding: 8px; background: white; border-radius: 3px;">
                  <strong>Attempt ${attempt.attempt}:</strong> ${attempt.reason}
                  ${attempt.error ? `<pre style="margin-top: 4px; font-size: 11px; color: #666; white-space: pre-wrap;">${typeof attempt.error === 'object' ? JSON.stringify(attempt.error, null, 2) : attempt.error}</pre>` : ''}
                </div>
              `).join('')}
              ${data.meta.finalAttempt ? `<div style="margin-top: 8px; font-size: 12px; color: #28a745;"><strong>✓ Succeeded on attempt ${data.meta.finalAttempt}</strong></div>` : ''}
            </div>`;
          }
          
          const stepDiv = `<div style="margin: 20px 0; padding: 15px; background: #f0f0f0; border-left: 4px solid #007bff; border-radius: 4px;">
            <h3>Step ${data.step || nextStep}: ${data.stepName || 'Processing'}</h3>
            <pre style="white-space: pre-wrap; font-family: monospace; font-size: 12px;">${displayContent}</pre>
            ${failedAttemptsHtml}
            ${data.meta?.nextStep ? `<button class="monkey-proceed-btn" data-proceed-id="${proceedButtonId}" style="margin-top: 10px; padding: 8px 16px; background: #007bff; color: white; border: none; border-radius: 4px; cursor: pointer; font-size: 14px; font-weight: 500;">▶ Proceed to Step ${data.meta.nextStep}</button>` : ''}
          </div>`;
          editorRef.current.setHtml(currentContent + stepDiv);
          
          // TEMPORARY: Wait for user to click proceed button before continuing
          if (data.meta?.nextStep) {

            // Create a promise that resolves when the button is clicked
            const proceedPromise = new Promise((resolve) => {
              // Use event delegation - attach listener to the editor element
              const editorElement = editorRef.current?.getEditorNode();
              if (!editorElement) {

                resolve(); // Resolve immediately if editor not found
                return;
              }
              
              const clickHandler = (e) => {
  console.log("[app/(private)/campaigns/components/CampaignArticleOutline.js] clickHandler");
                const button = e.target.closest('.monkey-proceed-btn[data-proceed-id="' + proceedButtonId + '"]');
                if (button) {

                  editorElement.removeEventListener('click', clickHandler);
                  resolve();
                }
              };
              
              // Attach event listener to editor
              editorElement.addEventListener('click', clickHandler);
              
              // Store handler for cleanup (in case component unmounts)
              if (!window.monkeyProceedHandlers) {
                window.monkeyProceedHandlers = new Map();
              }
              window.monkeyProceedHandlers.set(proceedButtonId, clickHandler);
            });
            
            // Wait for the button click
            await proceedPromise;
          }
        }

        // Check if this is the final step
        if (data.output?.html) {
          finalHtml = data.output.html;

        }

        // Continue to next step if available
        nextStep = data.meta?.nextStep;
        if (nextStep) {

        } else {

        }
      }

      // Set final HTML in editor if available
      if (finalHtml) {
        if (editorRef.current && editorRef.current.setHtml) {
          editorRef.current.setHtml(finalHtml);
          setArticleContent(finalHtml);

        }

        // Auto-save article
        if (articleId) {
          try {
            const supabase = createClient();
            const { error: saveError } = await supabase
              .from("content_magic_articles")
              .update({
                content_html: finalHtml,
                updated_at: new Date().toISOString(),
              })
              .eq("id", articleId);

            if (saveError) {

            } else {

            }
          } catch (saveError) {

          }
        }
      }

      // Hide instructions input after successful generation
      setShowAgenticInstructions(false);
      setAgenticInstructions('');

    } catch (error) {

      alert(`Failed to generate full article: ${error.message}\n\nPlease try again.`);
    } finally {
      setIsGeneratingFullArticle(false);
    }
  };

  // Helper function to convert Phase 3 outcome pillar outline format to HTML
  // Supports both old format (goal + bullets + meta fields) and new format (body)
  const convertOutcomePillarOutlineToHtml = (outlineSections) => {
  console.log("[app/(private)/campaigns/components/CampaignArticleOutline.js] convertOutcomePillarOutlineToHtml");
    return outlineSections.map(section => {
      const { section_id, title, body, goal, bullets, pattern_interrupt_idea, micro_cta_idea, why_this_matters_note, objection_hook } = section;
      
      // Determine heading level based on section
      const headingTag = section_id === 'hero' ? 'h1' : 'h2';
      
      // Build HTML for this section
      let html = `<${headingTag}>${title || section_id}</${headingTag}>`;
      
      // New format: use body directly (contains ready-to-use HTML/text with pattern interrupts and CTAs woven in)
      if (body) {
        // Body may already contain HTML tags, so we preserve it
        // If it's plain text, we'll wrap paragraphs appropriately
        const bodyText = body.trim();
        if (bodyText) {
          // Check if body already contains HTML tags
          if (bodyText.includes('<p>') || bodyText.includes('<ul>') || bodyText.includes('<li>')) {
            // Already formatted HTML, use as-is
            html += `\n${bodyText}`;
          } else {
            // Plain text - convert line breaks to paragraphs and bullets to lists
            const lines = bodyText.split('\n').filter(line => line.trim());
            let currentList = null;
            
            lines.forEach(line => {
              const trimmed = line.trim();
              // Check if line looks like a bullet point
              if (trimmed.startsWith('- ') || trimmed.startsWith('* ') || trimmed.startsWith('💡') || trimmed.startsWith('→') || trimmed.match(/^\d+\.\s/)) {
                const listItem = trimmed.replace(/^[-*]\s+/, '').replace(/^\d+\.\s+/, '');
                if (!currentList) {
                  currentList = [];
                  html += '\n<ul>';
                }
                currentList.push(listItem);
              } else {
                // Close any open list
                if (currentList) {
                  currentList.forEach(item => {
                    html += `\n  <li>${item}</li>`;
                  });
                  html += '\n</ul>';
                  currentList = null;
                }
                // Add as paragraph
                if (trimmed) {
                  html += `\n<p>${trimmed}</p>`;
                }
              }
            });
            
            // Close any remaining open list
            if (currentList) {
              currentList.forEach(item => {
                html += `\n  <li>${item}</li>`;
              });
              html += '\n</ul>';
            }
          }
        }
      } else {
        // Old format: use goal + bullets + meta fields (backward compatibility)
        if (goal) {
          html += `\n<p><em>${goal}</em></p>`;
        }
        
        if (bullets && Array.isArray(bullets) && bullets.length > 0) {
          const bulletItems = bullets.map(bullet => `  <li>${bullet}</li>`).join('\n');
          html += `\n<ul>\n${bulletItems}\n</ul>`;
        }
        
        // Add pattern interrupt idea if present
        if (pattern_interrupt_idea) {
          html += `\n<p><strong>💡 Pattern Interrupt:</strong> ${pattern_interrupt_idea}</p>`;
        }
        
        // Add micro CTA idea if present
        if (micro_cta_idea) {
          html += `\n<p><strong>→ Action:</strong> ${micro_cta_idea}</p>`;
        }
        
        // Add why this matters note if present
        if (why_this_matters_note) {
          html += `\n<p><em>Why this matters:</em> ${why_this_matters_note}</p>`;
        }
        
        // Add objection hook if present
        if (objection_hook) {
          html += `\n<p><em>Common concern:</em> ${objection_hook}</p>`;
        }
      }
      
      return html;
    }).filter(Boolean).join('\n\n');
  };

  // Helper function to convert Phase 2 outline format to HTML
  // Works for both comparison guide and listicle formats
  // Supports both old format (purpose + bullets) and new format (body)
  const convertComparisonGuideOutlineToHtml = (outlineSections) => {
  console.log("[app/(private)/campaigns/components/CampaignArticleOutline.js] convertComparisonGuideOutlineToHtml");
    return outlineSections.map(section => {
      const { section_id, title, body, purpose, bullets } = section;
      
      // Determine heading level based on section
      const headingTag = section_id === 'hero' ? 'h1' : 'h2';
      
      // Build HTML for this section
      let html = `<${headingTag}>${title || section_id}</${headingTag}>`;
      
      // New format: use body directly (contains ready-to-use HTML/text)
      if (body) {
        // Body may already contain HTML tags, so we preserve it
        // If it's plain text, we'll wrap paragraphs appropriately
        const bodyText = body.trim();
        if (bodyText) {
          // Check if body already contains HTML tags
          if (bodyText.includes('<p>') || bodyText.includes('<ul>') || bodyText.includes('<li>')) {
            // Already formatted HTML, use as-is
            html += `\n${bodyText}`;
          } else {
            // Plain text - convert line breaks to paragraphs and bullets to lists
            const lines = bodyText.split('\n').filter(line => line.trim());
            let currentList = null;
            
            lines.forEach(line => {
              const trimmed = line.trim();
              // Check if line looks like a bullet point
              if (trimmed.startsWith('- ') || trimmed.startsWith('* ') || trimmed.match(/^\d+\.\s/)) {
                const listItem = trimmed.replace(/^[-*]\s+/, '').replace(/^\d+\.\s+/, '');
                if (!currentList) {
                  currentList = [];
                  html += '\n<ul>';
                }
                currentList.push(listItem);
              } else {
                // Close any open list
                if (currentList) {
                  currentList.forEach(item => {
                    html += `\n  <li>${item}</li>`;
                  });
                  html += '\n</ul>';
                  currentList = null;
                }
                // Add as paragraph
                if (trimmed) {
                  html += `\n<p>${trimmed}</p>`;
                }
              }
            });
            
            // Close any remaining open list
            if (currentList) {
              currentList.forEach(item => {
                html += `\n  <li>${item}</li>`;
              });
              html += '\n</ul>';
            }
          }
        }
      } else {
        // Old format: use purpose + bullets (backward compatibility)
        if (purpose) {
          html += `\n<p><em>${purpose}</em></p>`;
        }
        
        if (bullets && Array.isArray(bullets) && bullets.length > 0) {
          const bulletItems = bullets.map(bullet => `  <li>${bullet}</li>`).join('\n');
          html += `\n<ul>\n${bulletItems}\n</ul>`;
        }
      }
      
      return html;
    }).filter(Boolean).join('\n\n');
  };

  // Helper function to convert JSON sections to HTML (old format)
  const convertSectionsToHtml = (sections) => {
  console.log("[app/(private)/campaigns/components/CampaignArticleOutline.js] convertSectionsToHtml");
    return sections.map(section => {
      switch (section.tag) {
        case 'h1':
        case 'h2':
        case 'h3':
        case 'p':
          return `<${section.tag}>${section.content || ''}</${section.tag}>`;
        
        case 'ul':
        case 'ol':
          const items = (section.items || []).map(item => `  <li>${item}</li>`).join('\n');
          return `<${section.tag}>\n${items}\n</${section.tag}>`;
        
        case 'table':
          const headers = (section.headers || []).map(h => `    <th>${h}</th>`).join('\n');
          const rows = (section.rows || []).map(row => {
            const cells = row.map(cell => `      <td>${cell}</td>`).join('\n');
            return `    <tr>\n${cells}\n    </tr>`;
          }).join('\n');
          return `<table>\n  <thead>\n    <tr>\n${headers}\n    </tr>\n  </thead>\n  <tbody>\n${rows}\n  </tbody>\n</table>`;
        
        default:

          return '';
      }
    }).filter(Boolean).join('\n\n');
  };

  if (isLoading) {
    return (
      <div className="max-w-7xl mx-auto p-8">
        <div className="flex items-center justify-center py-12">
          <div className="text-center">
            <div className="animate-spin rounded-full h-12 w-12 border-b-2 border-blue-600 mx-auto"></div>
            <p className="mt-4 text-gray-600">Loading...</p>
          </div>
        </div>
      </div>
    );
  }

  // Create article object for WritingGuideProvider with loaded content
  const articleForProvider = {
    id: articleId,
    title: articleTitle,
    content_html: articleContent, // Now populated from database
    type: currentPhase.type,
    icp_id: campaign.icp_id,
    campaign_id: campaign.id,
    campaign_phase: getPhaseDbValue(phase),
    context: {
      campaignSettings: {
        name: campaign.name,
        outcome: campaign.outcome,
        peace_of_mind: campaign.peace_of_mind,
        icp: campaign.icp,
        offer: campaign.offer
      }
    }
  };

  return (
    <WritingGuideProvider article={articleForProvider}>
    <div className="max-w-7xl mx-auto p-8">
      <div className="mb-6 flex items-center gap-4">
        <Button variant="outline" className="px-3 py-2" onClick={onBack}>
          <ArrowLeft className="w-4 h-4" />
        </Button>
        <div className="flex-1">
          <h1 className="text-3xl font-bold text-gray-900">
            {currentPhase.icon} {typeof phase === 'number' ? `Phase ${phase}: ` : ''}{currentPhase.name}
          </h1>
          <p className="text-gray-600 mt-1">{campaign.name}</p>
        </div>
      </div>

      <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
        {/* LEFT: Article Creation/Editing Form */}
        <div className="lg:col-span-2">
          <Card>
            {!isEditingInline && (
              <>
                <div className="mb-6 p-4 bg-blue-50 border border-blue-200 rounded-lg">
                  <h4 className="font-semibold text-blue-900 mb-2">{typeof phase === 'number' ? `Phase ${phase}` : phase} Purpose:</h4>
                  {phase === 1 && (
                    <div className="text-sm text-blue-800 space-y-2">
                      <p><strong>Bottom of Funnel - Landing Page</strong></p>
                      <p><strong>Goal:</strong> Enable instant conversion (3-second test) + convince those "on the fence"</p>
                      <ul className="space-y-1 mt-2">
                        <li>• Make the appropriate CTA (order/book/contact) completable in seconds</li>
                        <li>• Present general decision factors for this type of solution</li>
                        <li>• Highlight USPs that differentiate your offer</li>
                        <li>• Include concrete transactional details (don't make them ask)</li>
                        <li>• Display: {campaign.peace_of_mind || 'your guarantee'}</li>
                      </ul>
                    </div>
                  )}
                  {phase === 2 && (
                    <div className="text-sm text-blue-800 space-y-2">
                      <p><strong>Mid Funnel - Decision Guide</strong></p>
                      <p><strong>Goal:</strong> Guide them through evaluation toward Phase 1</p>
                      <ul className="space-y-1 mt-2">
                        <li>• Determine if customers are familiar or unfamiliar with this solution type</li>
                        <li>• Familiar → Compare vendors (who to choose)</li>
                        <li>• Unfamiliar → Compare strategies/approaches (what to choose)</li>
                        <li>• Address their key evaluation criteria</li>
                        <li>• Position this offer naturally without being overly promotional</li>
                      </ul>
                    </div>
                  )}
                  {phase === 3 && (
                    <div className="text-sm text-blue-800 space-y-2">
                      <p><strong>Top of Funnel - Outcome Guide</strong></p>
                      <p><strong>Goal:</strong> Educate latent customers on achieving: {campaign.outcome || 'the outcome'}</p>
                      <ul className="space-y-1 mt-2">
                        <li>• <strong>Latent customers:</strong> Know the outcome they want, not the solutions yet</li>
                        <li>• Provide step-by-step guidance for achieving the outcome</li>
                        <li>• Use identity-based callouts and pain-point language</li>
                        <li>• Focus on outcome/transformation throughout</li>
                        <li>• Naturally introduce your solution as a tool (not the focus)</li>
                      </ul>
                    </div>
                  )}
                  {phase === "Expand" && (
                    <div className="text-sm text-blue-800 space-y-2">
                      <p><strong>Content Cluster - Satellite Articles</strong></p>
                      <p><strong>Goal:</strong> Create content cluster to support the main pages</p>
                      <ul className="space-y-1 mt-2">
                        <li>• <strong>Draw in traffic:</strong> Target keywords that bring visitors searching for related topics</li>
                        <li>• <strong>Support main pages:</strong> Strengthen SEO and GEO (Generative Engine Optimization) for Phase 1, 2, and 3 articles</li>
                        <li>• <strong>Fresh content:</strong> Keep new content coming to the site, which is favored by search engines and AIs</li>
                        <li>• <strong>Cluster strategy:</strong> Create supporting articles that link back to and reinforce your pillar pages</li>
                        <li>• <strong>Keyword coverage:</strong> Capture long-tail and related search queries your ICP uses</li>
                      </ul>
                    </div>
                  )}
                </div>

                {/* Show existing article if one is associated */}
                {articleId && (
                  <div className="mb-6 p-5 border-2 border-blue-300 rounded-lg bg-blue-50">
                    <h3 className="text-lg font-bold text-blue-900 mb-4">Associated Article</h3>
                    
                    <div className="space-y-4">
                      <div>
                        <h4 className="font-semibold text-gray-900 mb-1">Title</h4>
                        <p className="text-gray-700">{articleTitle || "Untitled"}</p>
                      </div>
                      
                      <div>
                        <h4 className="font-semibold text-gray-900 mb-1">Content Overview</h4>
                        {articleContent && articleContent.trim() ? (
                          <div className="text-sm text-gray-600 bg-white p-3 rounded border border-gray-200 max-h-32 overflow-y-auto">
                            <div dangerouslySetInnerHTML={{ __html: articleContent.substring(0, 500) + (articleContent.length > 500 ? '...' : '') }} />
                          </div>
                        ) : (
                          <p className="text-sm text-gray-500 italic">No content yet. Open the article to start writing.</p>
                        )}
                      </div>
                      
                      <div className="flex gap-3">
                        <Button
                          onClick={handleOpenFullEditor}
                          className="flex-1"
                        >
                          <ExternalLink className="w-4 h-4 mr-2" />
                          Open/Edit Article
                        </Button>
                        <Button
                          variant="outline"
                          onClick={() => setShowDisassociateConfirm(true)}
                          disabled={isDisassociating}
                        >
                          {isDisassociating ? (
                            <>
                              <Loader className="w-4 h-4 animate-spin" />
                              Disassociating...
                            </>
                          ) : (
                            <>
                              <X className="w-4 h-4" />
                              Disassociate
                            </>
                          )}
                        </Button>
                      </div>
                    </div>
                  </div>
                )}

                {/* OPTION 1: Create New Article - Only show if no article is associated */}
                {!articleId && (
                <div className="mb-6 p-5 border-2 border-blue-300 rounded-lg bg-blue-50">
                  <h3 className="text-lg font-bold text-blue-900 mb-4">Option 1: Create a New Article</h3>
                  
                  <Input
                    label="Article Title"
                    value={articleTitle}
                    onChange={(e) => setArticleTitle(e.target.value)}
                    placeholder={`e.g., ${campaign.offer?.name || 'Your Offer'} - ${currentPhase.name}`}
                    autoFocus
                  />

                  <div className="mt-4">
                    <Button
                      type="button"
                      variant="outline"
                      onClick={handleAIGenerate}
                      disabled={isGenerating}
                      className="w-full"
                    >
                      {isGenerating ? (
                        <>
                          <Sparkles className="w-4 h-4 animate-spin" />
                          Generating...
                        </>
                      ) : (
                        <>
                          <Sparkles className="w-4 h-4" />
                          AI Suggest Title
                          <CreditCostBadge path="/api/ai" size="sm" />
                        </>
                      )}
                    </Button>
                  </div>
                  
                  {/* Create Article Button */}
                  <div className="mt-4">
                    <Button 
                      onClick={handleCreateOrOpenArticle} 
                      disabled={isSaving || !articleTitle.trim()}
                      className="w-full"
                    >
                      <Save className="w-4 h-4" />
                      {isSaving ? "Saving..." : articleId ? "Edit Content" : "Create Article"}
                    </Button>
                  </div>
                  </div>
                )}

                {showSuggestions && aiSuggestions.length > 0 && (
                  <div className="mb-6 p-4 border border-blue-200 rounded-lg bg-blue-50">
                    <div className="flex items-center justify-between mb-3">
                      <h4 className="font-semibold text-blue-900">AI Suggestions</h4>
                      <button
                        onClick={() => {
                          setShowSuggestions(false);
                          setShowFeedbackInput(prev => ({ ...prev, title: false }));
                          setFeedbackText(prev => ({ ...prev, title: "" }));
                        }}
                        className="text-blue-600 hover:text-blue-800"
                      >
                        <X className="w-4 h-4" />
                      </button>
                    </div>
                    <div className="space-y-2">
                      {aiSuggestions.map((suggestion, index) => (
                        <button
                          key={index}
                          onClick={() => handleSelectSuggestion(suggestion)}
                          className="w-full text-left p-3 bg-white border border-blue-200 rounded hover:border-blue-400 hover:bg-blue-50 transition-colors"
                        >
                          <span className="text-sm text-gray-900">{suggestion}</span>
                        </button>
                      ))}
                      
                      {/* Feedback Section - Reusable */}
                      {renderFeedbackSection('title')}
                    </div>
                  </div>
                )}

                {showCompetitors && competitorResults.length > 0 && (
                  <div className="mb-6 p-4 border border-green-200 rounded-lg bg-green-50">
                    <div className="flex items-center justify-between mb-3">
                      <h4 className="font-semibold text-green-900">Competitor Inspiration</h4>
                      <button
                        onClick={() => setShowCompetitors(false)}
                        className="text-green-600 hover:text-green-800"
                      >
                        <X className="w-4 h-4" />
                      </button>
                    </div>
                    <div className="space-y-2">
                      {competitorResults.map((result, index) => (
                        <button
                          key={index}
                          onClick={() => handleSelectCompetitor(result.title)}
                          className="w-full text-left p-3 bg-white border border-green-200 rounded hover:border-green-400 hover:bg-green-50 transition-colors"
                        >
                          <div className="flex items-start gap-2">
                            <ExternalLink className="w-4 h-4 text-green-600 mt-0.5 flex-shrink-0" />
                            <div className="flex-1 min-w-0">
                              <div className="font-semibold text-gray-900 text-sm mb-1 truncate">
                                {result.title}
                              </div>
                              {result.content && (
                                <p className="text-xs text-gray-600 line-clamp-2">
                                  {result.content}
                                </p>
                              )}
                              {result.url && (
                                <p className="text-xs text-green-700 mt-1 truncate">
                                  {result.url}
                                </p>
                              )}
                            </div>
                          </div>
                        </button>
                      ))}
                      <button
                        onClick={() => setShowCompetitors(false)}
                        className="w-full text-center p-2 text-sm text-gray-600 hover:text-gray-800"
                      >
                        Cancel
                      </button>
                    </div>
                  </div>
                )}

                {/* OPTION 2: Import from URL - Only show if no article is associated */}
                {!articleId && (
                  <div className="mb-6 p-5 border-2 border-green-300 rounded-lg bg-green-50">
                    <h3 className="text-lg font-bold text-green-900 mb-2">Option 2: Import and Improve an Existing Webpage</h3>
                  <p className="text-sm text-green-800 mb-4">Paste a competitor's URL or your existing page. We'll extract the content and title automatically.</p>
                  
                  <div className="flex items-start gap-3">
                    <div className="flex-1">
                      <input
                        type="url"
                        value={importUrl}
                        onChange={(e) => setImportUrl(e.target.value)}
                        placeholder="https://example.com/article"
                        className="w-full px-3 py-2 border border-green-300 rounded-md focus:outline-none focus:ring-2 focus:ring-green-500 bg-white"
                        disabled={isCrawling}
                      />
                      {crawlError && (
                        <p className="mt-2 text-sm text-red-600">{crawlError}</p>
                      )}
                    </div>
                    <Button
                      onClick={handleCrawlUrl}
                      disabled={isCrawling || !importUrl.trim()}
                      className="whitespace-nowrap"
                    >
                      {isCrawling ? (
                        <>
                          <Loader className="w-4 h-4 animate-spin" />
                          Importing...
                        </>
                      ) : (
                        <>
                          <Download className="w-4 h-4" />
                          Import & Create
                        </>
                      )}
                    </Button>
                  </div>
                  </div>
                )}

                {/* OPTION 3: Link Existing Article - Only show if no article is associated */}
                {!articleId && (
                  <div className="mb-6 p-5 border-2 border-purple-300 rounded-lg bg-purple-50">
                    <h3 className="text-lg font-bold text-purple-900 mb-2">Option 3: Link an Existing Article</h3>
                  <p className="text-sm text-purple-800 mb-4">Select an existing article from your Content Magic library to associate with this campaign.</p>
                  
                  {!showLinkExisting ? (
                    <Button
                      variant="outline"
                      onClick={handleLoadExistingArticles}
                      disabled={isLoadingArticles}
                      className="w-full"
                    >
                      {isLoadingArticles ? (
                        <>
                          <Loader className="w-4 h-4 animate-spin" />
                          Loading Articles...
                        </>
                      ) : (
                        <>
                          <ExternalLink className="w-4 h-4" />
                          Browse Existing Articles
                        </>
                      )}
                    </Button>
                  ) : (
                    <div className="space-y-3">
                      {existingArticles.length === 0 ? (
                        <p className="text-sm text-purple-700 text-center py-4">
                          No unlinked articles found. All your articles are either linked to campaigns or you haven't created any yet.
                        </p>
                      ) : (
                        <>
                          <div className="max-h-60 overflow-y-auto space-y-2">
                            {existingArticles.map((article) => (
                              <button
                                key={article.id}
                                onClick={() => setSelectedExistingArticle(article)}
                                className={`w-full text-left p-3 rounded border-2 transition-all ${
                                  selectedExistingArticle?.id === article.id
                                    ? 'border-purple-500 bg-purple-100'
                                    : 'border-purple-200 bg-white hover:border-purple-400'
                                }`}
                              >
                                <div className="font-semibold text-gray-900 text-sm">
                                  {article.title}
                                </div>
                                <div className="text-xs text-gray-600 mt-1">
                                  Type: {article.type} • Created: {new Date(article.created_at).toLocaleDateString()}
                                </div>
                              </button>
                            ))}
                          </div>
                          <div className="flex gap-2">
                            <Button
                              onClick={() => handleLinkExistingArticle(selectedExistingArticle)}
                              disabled={!selectedExistingArticle || isSaving}
                              className="flex-1"
                            >
                              {isSaving ? (
                                <>
                                  <Loader className="w-4 h-4 animate-spin" />
                                  Linking...
                                </>
                              ) : (
                                <>
                                  <ExternalLink className="w-4 h-4" />
                                  Link Selected Article
                                </>
                              )}
                            </Button>
                            <Button
                              variant="outline"
                              onClick={() => {
                                setShowLinkExisting(false);
                                setSelectedExistingArticle(null);
                              }}
                            >
                              Cancel
                            </Button>
                          </div>
                        </>
                      )}
                    </div>
                  )}
                  </div>
                )}

                <div className="flex gap-3 justify-end mt-6">
                  <Button variant="outline" onClick={onBack}>
                    Back
                  </Button>
                </div>
              </>
            )}

            {isEditingInline && (
              <>
                <div className="mb-4">
                  <Input
                    label="Article Title"
                    value={articleTitle}
                    onChange={(e) => setArticleTitle(e.target.value)}
                    placeholder="Article title"
                  />
                </div>

                <div className="mb-4">
                  <label className="block text-sm font-medium text-gray-700 mb-2">Content Outline</label>
                  
                  <div className="mb-3 flex flex-col gap-2">
                    {/* Regular Outline Suggestion */}
                    <div className="flex flex-col gap-2">
                      <Button
                        type="button"
                        variant="outline"
                        onClick={() => {
                          if (showOutlineInstructions) {
                            // If input is shown, submit
                            handleGenerateOutline();
                          } else {
                            // Show input field
                            setShowOutlineInstructions(true);
                          }
                        }}
                        disabled={isGeneratingOutline || !articleTitle.trim()}
                        className="flex-1"
                      >
                        {isGeneratingOutline ? (
                          <>
                            <Sparkles className="w-4 h-4 animate-spin" />
                            Generating Outline... (this may take a minute)
                          </>
                        ) : (
                          <>
                            <Sparkles className="w-4 h-4" />
                            AI Suggest Outline
                            <CreditCostBadge path="/api/ai" size="sm" />
                          </>
                        )}
                      </Button>
                      {showOutlineInstructions && (
                        <div className="flex gap-2 items-end">
                          <div className="flex-1">
                            <label className="block text-sm font-medium text-gray-700 mb-2">
                              Do you have any instructions for the outline generation?
                            </label>
                            <textarea
                              value={outlineInstructions}
                              onChange={(e) => setOutlineInstructions(e.target.value)}
                              placeholder="e.g., Focus on X, include Y section, emphasize Z..."
                              className="w-full px-3 py-2 border border-gray-300 rounded-md focus:outline-none focus:ring-2 focus:ring-blue-600"
                              rows={3}
                            />
                          </div>
                          <Button
                            type="button"
                            onClick={handleGenerateOutline}
                            disabled={isGeneratingOutline || !articleTitle.trim()}
                            className="mb-0"
                          >
                            Submit
                          </Button>
                          <Button
                            type="button"
                            variant="outline"
                            onClick={() => {
                              setShowOutlineInstructions(false);
                              setOutlineInstructions('');
                            }}
                            className="mb-0"
                          >
                            Cancel
                          </Button>
                        </div>
                      )}
                    </div>
                    
                    {/* Agentic Mode Outline Suggestion */}
                    <div className="flex flex-col gap-2">
                      <Button
                        type="button"
                        variant="outline"
                        onClick={() => {
                          if (showAgenticInstructions) {
                            // If input is shown, submit
                            handleGenerateFullArticle();
                          } else {
                            // Show input field
                            setShowAgenticInstructions(true);
                          }
                        }}
                        disabled={isGeneratingFullArticle || !articleTitle.trim()}
                        className="flex-1"
                      >
                        {isGeneratingFullArticle ? (
                          <>
                            <Loader className="w-4 h-4 animate-spin" />
                            Generating Full Article... (this may take a few minutes)
                          </>
                        ) : (
                          <>
                            <Sparkles className="w-4 h-4" />
                            Generate Full Article Via Agentic Mode
                          </>
                        )}
                      </Button>
                      {showAgenticInstructions && (
                        <div className="space-y-4">
                          <div className="flex gap-2 items-end">
                            <div className="flex-1">
                              <label className="block text-sm font-medium text-gray-700 mb-2">
                                Do you have any instructions for the article generation?
                              </label>
                              <textarea
                                value={agenticInstructions}
                                onChange={(e) => setAgenticInstructions(e.target.value)}
                                placeholder="e.g., Focus on X, include Y section, emphasize Z..."
                                className="w-full px-3 py-2 border border-gray-300 rounded-md focus:outline-none focus:ring-2 focus:ring-blue-600"
                                rows={3}
                              />
                            </div>
                          </div>
                          <div className="flex gap-2">
                            <Button
                              type="button"
                              onClick={handleGenerateFullArticle}
                              disabled={isGeneratingFullArticle || !articleTitle.trim()}
                              className="mb-0"
                            >
                              Submit
                            </Button>
                            <Button
                              type="button"
                              variant="outline"
                              onClick={() => {
                                setShowAgenticInstructions(false);
                                setAgenticInstructions('');
                              }}
                              className="mb-0"
                            >
                              Cancel
                            </Button>
                          </div>
                        </div>
                      )}
                    </div>
                  </div>

                  <ContentMagicEditor 
                    key={articleId || 'new-article'} // Force remount when article changes
                    ref={editorRef}
                    onChange={() => {
                      if (editorRef.current) {
                        const html = editorRef.current.getHtml();
                        setArticleContent(html);
                        // Check if there's meaningful content (at least 50 characters of text)
                        const textContent = html ? html.replace(/<[^>]*>/g, '').trim() : '';
                        setHasEditorContent(textContent.length >= 50);
                      }
                    }}
                  />
                  
                  <p className="text-xs text-gray-500 mt-2">
                    Rich text editor with formatting. For AI assistant, open full editor.
                  </p>
                </div>
              </>
            )}
          </Card>
        </div>

        {/* RIGHT: Campaign Context Card */}
        <div className="lg:col-span-1">
          <Card>
            {/* Research Suggestions - Show at top if available */}
            {filteredResearch && Object.keys(filteredResearch).length > 0 && (
              <div className="mb-6 pb-6 border-b border-gray-200">
                <div className="flex items-center gap-2 mb-3">
                  <Lightbulb className="w-5 h-5 text-blue-600" />
                  <h3 className="font-semibold text-gray-900">Research Suggestions</h3>
                  {reviewSummary && (
                    <span className="ml-auto text-xs text-gray-500">
                      {reviewSummary.kept} ideas
                    </span>
                  )}
                </div>
                <ResearchSuggestionsList research={filteredResearch} />
                {reviewSummary && (
                  <div className="mt-3 p-2 bg-blue-50 rounded text-xs text-blue-900">
                    <p>✅ {reviewSummary.kept} kept • 📝 {reviewSummary.expanded} expanded • ❌ {reviewSummary.removed} removed</p>
                  </div>
                )}
              </div>
            )}

            {/* Generated Article Display */}
            {generatedArticle && (
              <div className="mb-6 pb-6 border-b border-gray-200">
                <div className="flex items-center gap-2 mb-3">
                  <Sparkles className="w-5 h-5 text-green-600" />
                  <h3 className="font-semibold text-gray-900">Generated Article</h3>
                </div>
                <div className="mb-3 p-3 bg-gray-50 rounded border border-gray-200 max-h-96 overflow-y-auto">
                  <div 
                    className="prose prose-sm max-w-none"
                    dangerouslySetInnerHTML={{ __html: generatedArticle.html || "" }}
                  />
                </div>
                <div className="space-y-2">
                  <div className="p-2 bg-yellow-50 border border-yellow-200 rounded text-xs text-yellow-900">
                    <p className="font-semibold mb-1">📋 Instructions:</p>
                    <p>Copy the content above and paste it into the editor, or click "Insert to End" to add it automatically.</p>
                  </div>
                  <div className="flex gap-2">
                    <Button
                      variant="outline"
                      onClick={() => handleCopyToClipboard(generatedArticle.html)}
                      className="flex-1"
                    >
                      {copiedSection ? (
                        <>
                          <Check className="w-4 h-4" />
                          Copied!
                        </>
                      ) : (
                        <>
                          <Copy className="w-4 h-4" />
                          Copy to Clipboard
                        </>
                      )}
                    </Button>
                    <Button
                      onClick={handleInsertToEnd}
                      className="flex-1"
                    >
                      Insert to End
                    </Button>
                  </div>
                </div>
              </div>
            )}

            {/* Campaign Context - Always show */}
            {(
              <>
                {/* Action Buttons */}
                {isEditingInline && (
                  <div className="flex flex-col gap-2 mb-4 pb-4 border-b border-gray-200">
                    <Button variant="outline" onClick={handleOpenFullEditor} className="w-full">
                      <ExternalLink className="w-4 h-4" />
                      Open Full Editor
                    </Button>
                    <Button onClick={handleSaveContent} disabled={isSaving} className="w-full">
                      <Save className="w-4 h-4" />
                      {isSaving ? "Saving..." : "Save Changes"}
                    </Button>
                    <Button 
                      variant="outline" 
                      onClick={() => setShowDisassociateConfirm(true)} 
                      className="w-full text-red-600 hover:bg-red-50 hover:text-red-700 border-red-300"
                    >
                      <X className="w-4 h-4" />
                      Disassociate from Campaign
                    </Button>
                  </div>
                )}

                <div className="flex items-center gap-2 mb-4">
                  <Info className="w-5 h-5 text-blue-600" />
                  <h3 className="font-semibold text-gray-900">Campaign Context</h3>
                </div>
            
            <div className="space-y-4 text-sm">
              <div>
                <span className="text-gray-500">ICP:</span>
                <p className="font-medium text-gray-900">{campaign.icp?.name || 'Not set'}</p>
                {campaign.icp?.description && (
                  <p className="text-xs text-gray-600 mt-1">{campaign.icp.description}</p>
                )}
              </div>

              <div className="pt-3 border-t border-gray-200">
                <span className="text-gray-500">Offer:</span>
                <p className="font-medium text-gray-900">{campaign.offer?.name || 'Not set'}</p>
                {campaign.offer?.description && (
                  <p className="text-xs text-gray-600 mt-1">{campaign.offer.description}</p>
                )}
              </div>

              {campaign.outcome && (
                <div className="pt-3 border-t border-gray-200">
                  <span className="text-gray-500">Outcome:</span>
                  <p className="font-medium text-gray-900">{campaign.outcome}</p>
                </div>
              )}

              {campaign.peace_of_mind && (
                <div className="pt-3 border-t border-gray-200">
                  <span className="text-gray-500">Promise:</span>
                  <p className="font-medium text-gray-900">{campaign.peace_of_mind}</p>
                </div>
              )}

              {/* Campaign Roadmap */}
              <div className="pt-3 border-t border-gray-200">
                <span className="text-gray-500 font-semibold">Campaign Roadmap:</span>
                {campaign.campaign_roadmap ? (
                  <div className="mt-2 space-y-3 text-xs">
                    {campaign.campaign_roadmap.explanation && (
                      <p className="text-gray-600 italic mb-2">{campaign.campaign_roadmap.explanation}</p>
                    )}
                    
                    {/* Phase 2 */}
                    {campaign.campaign_roadmap.phase2_choice ? (
                      <div className="p-2 bg-blue-50 rounded border border-blue-200">
                        <p className="font-medium text-blue-900 mb-1">
                          Phase 2: {campaign.campaign_roadmap.phase2_choice === 'none' ? 'Skipped' : 'Enabled'}
                        </p>
                        {campaign.campaign_roadmap.phase2_choice !== 'none' && (
                          <p className="text-blue-700">
                            Format: <strong>{campaign.campaign_roadmap.phase2_choice === 'scenario_listicle' ? 'Scenario Listicle' : 'Comparison Guide'}</strong>
                          </p>
                        )}
                      </div>
                    ) : (
                      <div className="p-2 bg-gray-50 rounded border border-gray-200">
                        <p className="text-gray-600">Phase 2: Not configured</p>
                      </div>
                    )}
                    
                    {/* Phase 3 */}
                    {campaign.campaign_roadmap.phase3_choice ? (
                      <div className="p-2 bg-green-50 rounded border border-green-200">
                        <p className="font-medium text-green-900 mb-1">
                          Phase 3: {campaign.campaign_roadmap.phase3_choice === 'none' ? 'Skipped' : 'Enabled'}
                        </p>
                      </div>
                    ) : (
                      <div className="p-2 bg-gray-50 rounded border border-gray-200">
                        <p className="text-gray-600">Phase 3: Not configured</p>
                      </div>
                    )}
                  </div>
                ) : (
                  <div className="mt-2 text-xs text-gray-500 italic">
                    <p>No roadmap configured yet. Set up the roadmap in Campaign Settings.</p>
                  </div>
                )}
              </div>
            </div>

                <div className="mt-6 p-3 bg-blue-50 rounded-lg">
                  <p className="text-xs text-blue-900">
                    <strong>Tip:</strong> This context will be available to the AI assistant when you're writing.
                  </p>
                </div>
              </>
            )}
          </Card>
        </div>
      </div>

      {/* Disassociate Confirmation Modal */}
      {showDisassociateConfirm && (
        <div className="fixed inset-0 bg-black bg-opacity-50 flex items-center justify-center z-50">
          <div className="bg-white rounded-lg p-6 max-w-md mx-4 shadow-xl">
            <h3 className="text-lg font-bold text-gray-900 mb-3">
              Disassociate Article from Campaign?
            </h3>
            <p className="text-sm text-gray-700 mb-4">
              This will remove the link between this article and the campaign. The article will still exist in your Content Magic library.
            </p>
            <div className="bg-yellow-50 border border-yellow-200 rounded p-3 mb-4">
              <p className="text-xs text-yellow-900">
                <strong>Note:</strong> You can find and delete this article later in the Content Magic module if needed.
              </p>
            </div>
            <div className="flex gap-3 justify-end">
              <Button
                variant="outline"
                onClick={() => setShowDisassociateConfirm(false)}
                disabled={isDisassociating}
              >
                Cancel
              </Button>
              <Button
                onClick={handleDisassociateArticle}
                disabled={isDisassociating}
                className="bg-red-600 hover:bg-red-700 text-white"
              >
                {isDisassociating ? (
                  <>
                    <Loader className="w-4 h-4 animate-spin" />
                    Disassociating...
                  </>
                ) : (
                  'Yes, Disassociate'
                )}
              </Button>
            </div>
          </div>
        </div>
      )}
    </div>
    </WritingGuideProvider>
  );
}

export default function CampaignArticleOutline({ campaign, phase, onBack, onSaved, articleId: propArticleId = null }) {
  console.log("[app/(private)/campaigns/components/CampaignArticleOutline.js] CampaignArticleOutline");

  return (
    <CampaignArticleOutlineContent 
      campaign={campaign} 
      phase={phase} 
      onBack={onBack}
      onSaved={onSaved}
      articleId={propArticleId}
    />
  );
}
