# CJGEO – MVP Scope & Architecture Guardrails

**Branch name:** `mvp-launch` | `launch/mvp-seo-content-writer`

## Purpose

This memo defines the **CJGEO MVP** scope as an **SEO content writer** that helps users research, plan, draft, and write SEO-optimized content grounded in ICP and offer context.

This memo defines **what must exist**, **what must not exist**, and **how future expansions attach cleanly**.

---

## Product Definition (MVP)

CJGEO at launch is an **SEO content writer** that combines research, planning, and writing capabilities.

**Primary job:**

> Help users research, plan, draft outlines, and write SEO-optimized content using structured keyword, prompt, and competitor research grounded in ICP and offer context.

---

## MVP Scope (Hard Boundary)

### ✅ In Scope (Must Work Reliably)

#### Inputs (one of the following):

* Existing webpage URL
  **OR**
* Offer + ICP + seed topics

#### Core Capabilities:

1. **Keyword Research**
   * Traditional SEO keywords
   * Long-tail and intent-driven queries

2. **Prompt Research**
   * AI-search-style prompts
   * Conversational / task-based prompts
   * "How would a user ask an AI…" style inputs

3. **Vertical & Horizontal Expansion**
   * Vertical: depth within the same intent
   * Horizontal: adjacent intents (alternatives, comparisons, troubleshooting, awareness)

4. **Competitor Research**
   * Identify competing pages/topics
   * Surface coverage gaps and overlaps
   * No scraping-based ranking claims required

5. **AI-Based Evaluation & Scoring**
   * Relevance to ICP
   * Alignment with offer
   * Suitability as a traffic-driving page
   * Output must be explainable (not just a score)

6. **Outline Generation**
   * Section-level outlines with topics and structure
   * AI-generated outlines based on research
   * Outline review and refinement

7. **Content Writing**
   * Section-by-section content generation
   * SEO-optimized prose generation
   * AI-assisted content writing with ICP and offer context
   * Content editing and refinement tools

8. **Outputs**
   * Ranked list of keywords/prompts
   * Intent classification
   * Clear rationale for prioritization
   * Draft outlines ready for writing
   * Written content sections
   * Page enrichment suggestions for existing webpages

---

### ❌ Explicitly Out of Scope (Do NOT Implement)

* CMS publishing or auto-posting
* Ranking guarantees or SERP prediction
* UX polish beyond functional clarity
* Full repurposing workflows (future expansion)
* Automated distribution to multiple channels

---

## Expansion Hooks (Future Enhancements)

These are **future enhancements**, not MVP requirements.

### Expansion 1: Downstream Publishing Conversion

* Input: existing article/page content
* Output: format conversions (social, email, ads, snippets)
* Repurposing only, not authorship

### Expansion 2: SERP & Prompt Tracking

* Keyword movement
* AI prompt visibility
* Feedback loop for research refinement

### Expansion 3: Advanced Content Optimization

* Real-time SEO scoring
* Content performance tracking
* A/B testing for content variations

**Design MVP outputs so they can feed these later.**

---

## Architectural Guardrails

* Treat **research outputs as first-class artifacts**
* Writing is downstream and replaceable
* Optimize for:
  * Explainability
  * Trust
  * Actionability
* Avoid coupling MVP logic to any single LLM or writer workflow

---

## Launch Criteria (Definition of Done)

This branch is ready to merge if:

* Given a URL or offer+ICP, CJGEO produces a ranked, explainable research output
* Users can generate outlines based on research
* Users can write SEO-optimized content section by section
* Content writing is integrated with research and planning
* Users can clearly answer: *"What should I build or improve next, and why?"*
* Users can draft and write content based on research outputs

---

## Non-Goals (Reminder)

CJGEO is **not**:
* A replacement for ChatGPT or Cursor (though it complements them)
* A full CMS or publishing platform
* A ranking prediction tool

CJGEO **is**:
* An SEO content writer that combines research, planning, and writing
* A tool that helps users create SEO-optimized content grounded in ICP and offer context

---

**End of memo**
