# 3-Tier Cognitive Prioritization Model

## Overview

The 3-tier model organizes landing page content to match how users evaluate pages under time pressure. Rather than organizing by topic or structure, we organize by **cognitive priority** - when the user cares about each piece of information.

## The Three Tiers

### Tier 1: What the Customer Wants to Know
**Goal**: Establish relevance within 3-5 seconds

**Key Questions**:
- Am I in the right place?
- Does this page do what I'm looking for?
- What can I do next?

**Content Types**:
- Core offer/topic definition
- ICP relevance check
- Primary outcome/benefit
- Immediate CTA

**Failure Mode**: User bounces because relevance not established

**Examples**:
- "Fast IHC Services for Pharma R&D Teams"
- "24-Hour Antibody Conjugation Kit"
- "Get a Quote in 2 Minutes"

### Tier 2: What We Want the Customer to Know
**Goal**: Build conviction and differentiation

**Key Questions**:
- Why this instead of alternatives?
- Can I trust this?
- Is it worth my time/money?

**Content Types**:
- Unique selling points
- Competitive differentiators
- Proof and validation
- Guarantees, certifications
- Strategic explanations

**Failure Mode**: User understands but isn't convinced

**Examples**:
- "GLP-Certified Laboratory"
- "Same Scientists Who Developed HER2 CDx Assays"
- "100% Money-Back Guarantee"

### Tier 3: Everything Else
**Goal**: Reduce friction and answer edge cases

**Key Questions**:
- What if I have specific concerns?
- How does this work in my situation?
- Where can I learn more?

**Content Types**:
- FAQs
- Technical details
- Edge cases
- Supporting resources

**Failure Mode**: Page feels cluttered or overwhelming

**Examples**:
- "What antibody hosts are supported?"
- "Can I use this with frozen samples?"
- "Related Resources"

## Classification Guidelines

### When to Use Tier 1
- Directly matches campaign outcome
- Answers search query intent
- Essential for ICP to confirm relevance
- User would bounce without it

### When to Use Tier 2
- Differentiates from competitors
- Provides proof or validation
- Addresses "why us?" question
- Strategic messaging

### When to Use Tier 3
- Addresses edge cases
- Provides additional detail
- Answers "what if?" questions
- Not critical to main decision

## Implementation in Code

See:
- Talk Points: `libs/monkey/pipelines/summarizeTalkPointsPipeline.ts`
- Outline Organization: `libs/monkey/pipelines/organizeOutlinePipeline.ts`
- UI Display: `libs/content-magic/rules/planOutline.js`
- Types: `libs/monkey/types/prioritization.ts`

## Strategic Context

### Brief Strategic Context (Step 1: Talk Points)
Generated during talk point summarization to provide initial strategic understanding:
- **primaryIntent**: What user primarily wants to do
- **secondaryIntents**: Other possible intents
- **immediateQuestions**: Questions user has right now
- **decisionCriteria**: What will convince them

### Detailed Strategic Context (Step 2: Outline)
Generated during outline organization for comprehensive strategic analysis:
- **icpMentalState**: What's their mindset when landing?
- **expectedQuestions**: Comprehensive question list (prioritized by tier)
- **whatTheyWantToSee**: Info they're actively seeking
- **whatWeWantThemToSee**: Strategic messaging priorities
- **decisionFactors**: What will influence their decision
- **riskFactors**: What might make them hesitate
- **competitiveContext**: How this differs from alternatives

## Tier Validation

The system validates tier ordering to ensure:
- Tier 1 sections always appear first
- No tier mixing (all Tier 1, then all Tier 2, then all Tier 3)
- At least one Tier 1 section exists
- No gaps in tier progression

Warnings are displayed in the UI if tier ordering is incorrect, allowing manual override.

## Manual Override

Users can manually override tier assignments in the UI:
- Talk points: Dropdown to change tier
- Sections: Dropdown to change tier with automatic re-sorting
- Full drag-and-drop support (future enhancement)

## Success Metrics

### Qualitative
- Tier 1 sections clearly establish relevance
- USPs no longer crowd hero section
- FAQs and details appear at the end
- Page "flow" feels natural

### Quantitative
- Tier 1 sections always appear first (100%)
- Average Tier 1 section count: 2-3
- Tier ordering violations: 0 (with warnings if user overrides)
