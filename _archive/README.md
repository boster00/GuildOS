<!-- ARCHIVED: Original path was README.md -->

# CJGEO — SEO Content Writer (MVP)

**CJGEO** is an SEO content writer that helps users research, plan, draft, and write SEO-optimized content using structured keyword, prompt, and competitor research grounded in ICP and offer context.

## 🎯 Product Definition

CJGEO at MVP launch is an **SEO content writer** that combines research, planning, and writing capabilities.

**Primary Job:**
> Help users research, plan, draft outlines, and write SEO-optimized content using structured keyword, prompt, and competitor research grounded in ICP and offer context.

## ✅ MVP Scope

### Core Capabilities

1. **Keyword Research**
   - Traditional SEO keywords
   - Long-tail and intent-driven queries

2. **Prompt Research**
   - AI-search-style prompts
   - Conversational / task-based prompts
   - "How would a user ask an AI..." style inputs

3. **Vertical & Horizontal Expansion**
   - Vertical: depth within the same intent
   - Horizontal: adjacent intents (alternatives, comparisons, troubleshooting, awareness)

4. **Competitor Research**
   - Identify competing pages/topics
   - Surface coverage gaps and overlaps

5. **AI-Based Evaluation & Scoring**
   - Relevance to ICP
   - Alignment with offer
   - Suitability as a traffic-driving page
   - Explainable rationale (not just scores)

6. **Outline Generation**
   - Section-level outlines with topics and structure
   - AI-generated outlines based on research
   - Outline review and refinement

7. **Content Writing**
   - Section-by-section content generation
   - SEO-optimized prose generation
   - AI-assisted content writing with ICP and offer context
   - Content editing and refinement tools

8. **Outputs**
   - Ranked list of keywords/prompts
   - Intent classification
   - Clear rationale for prioritization
   - Draft outlines ready for writing
   - Written content sections
   - Page enrichment suggestions for existing webpages

## ❌ Explicitly Out of Scope (MVP)

- CMS publishing or auto-posting
- Ranking guarantees or SERP prediction
- UX polish beyond functional clarity
- Full repurposing workflows (future expansion)

## 🏗️ Tech Stack

- **Next.js**: 15.1.3 with React 19 and Turbopack
- **React**: 19.0.0
- **Tailwind CSS**: 4.0.0
- **DaisyUI**: 5.0.50
- **Supabase**: Latest SSR package
- **Stripe**: 17.3.1

## 🚀 Get Started

1. Clone the repository
2. Install dependencies: `npm install`
3. Set up environment variables (see `.env.example`)
4. Run development server: `npm run dev`

## 📋 Launch Criteria

This MVP is ready when:
- Given a URL or offer+ICP, CJGEO produces a ranked, explainable research output
- Users can generate outlines based on research
- Users can write SEO-optimized content section by section
- Content writing is integrated with research and planning
- Users can clearly answer: *"What should I build or improve next, and why?"*
- Users can draft and write content based on research outputs

## 🎯 Non-Goals

CJGEO is **not**:
- A replacement for ChatGPT or Cursor (though it complements them)
- A full CMS or publishing platform
- A ranking prediction tool

CJGEO **is**:
- An SEO content writer that combines research, planning, and writing
- A tool that helps users create SEO-optimized content grounded in ICP and offer context

---

**Branch:** `mvp-launch` | **Status:** MVP Development
