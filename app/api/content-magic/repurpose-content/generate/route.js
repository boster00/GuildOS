import { createClient } from "@/libs/supabase/server";
import { NextResponse } from "next/server";
import { initMonkey } from "@/libs/monkey";
import { finishExternalRequest } from "@/libs/monkey/tools/external_requests";

export async function POST(request) {
  const externalRequestId = request.headers.get("x-external-request-id") ?? null;
  const startTime = Date.now();
  const supabase = await createClient();
  try {
    const {
      data: { user },
    } = await supabase.auth.getUser();

    if (!user) {
      return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
    }

    const body = await request.json();
    const {
      articleId,
      format,
      articleTitle,
      articleContent,
      context,
      options,
      feedback,
      previousOutput,
    } = body;

    if (!articleId || !format || !articleTitle || !articleContent) {
      return NextResponse.json(
        { error: "articleId, format, articleTitle, and articleContent are required" },
        { status: 400 }
      );
    }

    // Fetch article for context
    const { data: article } = await supabase
      .from("content_magic_articles")
      .select("*")
      .eq("id", articleId)
      .eq("user_id", user.id)
      .single();

    if (!article) {
      return NextResponse.json(
        { error: "Article not found" },
        { status: 404 }
      );
    }

    // Build ICP context from article.context.icpId
    let icpContext = "";
    let icpDescription = "";
    const icpId = article.context?.icpId;
    if (icpId) {
      const { data: icp } = await supabase
        .from("icps")
        .select("*")
        .eq("id", icpId)
        .eq("user_id", user.id)
        .single();

      if (icp) {
        icpDescription = icp.name || "";
        icpContext = "\n## Target Audience (ICP):\n";
        Object.entries(icp).forEach(([key, value]) => {
          if (!value || key === 'id' || key === 'user_id' || key === 'created_at' || key === 'updated_at') {
            return;
          }
          const label = key
            .split('_')
            .map(word => word.charAt(0).toUpperCase() + word.slice(1))
            .join(' ');
          icpContext += `- ${label}: ${value}\n`;
        });
      }
    }

    // Get offer description if available
    let offerDescription = "";
    if (article.context?.offerId) {
      const { data: offer } = await supabase
        .from("offers")
        .select("*")
        .eq("id", article.context.offerId)
        .eq("user_id", user.id)
        .single();
      
      if (offer) {
        offerDescription = offer.description || offer.name || "";
      }
    }

    // Initialize Monkey
    const monkey = await initMonkey();
    monkey.loadUserContext({ ...(body?.user_context ?? {}), userId: user?.id });

    // Build base prompt context
    const baseContext = `
## Article Information:
- Title: ${articleTitle}
- Content: ${articleContent.substring(0, 5000)}${articleContent.length > 5000 ? '...' : ''}
${icpContext}
${offerDescription ? `\n## Offer/Product:\n${offerDescription}\n` : ''}
## Shared Context:
- Audience: ${context?.audience || "B2B – technical & business decision makers"}
- Tone: ${context?.tone || "Neutral"}
- Goal: ${context?.goal || "Awareness"}
`;

    // Generate format-specific prompt and call AI
    let prompt = "";
    let responseFormat = "json";

    switch (format) {
      case "social_posts":
        prompt = buildSocialPostsPrompt(baseContext, options, feedback, previousOutput);
        break;
      case "slides_ppt":
        prompt = buildSlidesPPTPrompt(baseContext, options, feedback, previousOutput);
        break;
      case "short_video":
        prompt = buildShortVideoPrompt(baseContext, options, feedback, previousOutput);
        break;
      case "podcast":
        prompt = buildPodcastPrompt(baseContext, options, feedback, previousOutput);
        break;
      case "cold_email":
        prompt = buildColdEmailPrompt(baseContext, options, feedback, previousOutput);
        break;
      case "nurture_series":
        prompt = buildNurtureSeriesPrompt(baseContext, options, feedback, previousOutput);
        break;
      case "search_ads":
        prompt = buildSearchAdsPrompt(baseContext, options, feedback, previousOutput);
        break;
      case "press_release":
        prompt = buildPressReleasePrompt(baseContext, options, feedback, previousOutput);
        break;
      case "one_pager":
        prompt = buildOnePagerPrompt(baseContext, options, feedback, previousOutput);
        break;
      case "image_prompts":
        prompt = buildImagePromptsPrompt(baseContext, options, feedback, previousOutput);
        break;
      default:
        return NextResponse.json(
          { error: `Unsupported format: ${format}` },
          { status: 400 }
        );
    }

    // Call AI
    const aiResponse = await monkey.AI(prompt, {
      forceJson: responseFormat === "json",
      vendor: "openai",
      model: process.env.AI_MODEL_STANDARD || "gpt-4o",
    });

    // Parse response
    let content;
    if (responseFormat === "json") {
      if (typeof aiResponse === 'string') {
        try {
          const jsonMatch = aiResponse.match(/```(?:json)?\s*(\{[\s\S]*\})\s*```/);
          if (jsonMatch) {
            content = JSON.parse(jsonMatch[1]);
          } else {
            const directMatch = aiResponse.match(/(\{[\s\S]*\})/);
            if (directMatch) {
              content = JSON.parse(directMatch[1]);
            } else {
              content = JSON.parse(aiResponse);
            }
          }
        } catch (e) {
          content = { error: "Failed to parse AI response", raw: aiResponse };
        }
      } else {
        content = aiResponse;
      }
    } else {
      content = { text: aiResponse };
    }

    await finishExternalRequest(supabase, {
      externalRequestId,
      status: "success",
      responsePreview: JSON.stringify(content).slice(0, 500),
      latencyMs: Date.now() - startTime,
    });

    return NextResponse.json({
      content,
    }, { status: 200 });
  } catch (error) {
    await finishExternalRequest(supabase, {
      externalRequestId,
      status: "failed",
      errorMessage: error?.message ?? String(error),
      latencyMs: Date.now() - startTime,
    });
    return NextResponse.json(
      { error: "Internal server error", details: error.message },
      { status: 500 }
    );
  }
}

// Prompt builders for each format
function buildSocialPostsPrompt(baseContext, options, feedback, previousOutput) {
  const platforms = options?.platforms || ["LinkedIn", "X", "Facebook"];
  const numVariations = options?.numVariations || 1;
  const emphasis = [];
  if (options?.emphasizeKeyInsight) emphasis.push("key insight/takeaway");
  if (options?.emphasizeProblemSolution) emphasis.push("problem-solution");
  if (options?.emphasizeStory) emphasis.push("story/case study");
  const customCTA = options?.customCTA || "";

  let prompt = `${baseContext}

You are an expert social media content creator. Transform the article above into social media posts optimized for ${platforms.join(", ")}.

${feedback ? `\n## User Feedback on Previous Version:\n${feedback}\n\nPlease incorporate this feedback into the new version.\n` : ''}
${previousOutput ? `\n## Previous Output (for reference):\n${JSON.stringify(previousOutput, null, 2)}\n` : ''}

## Requirements:
- Generate posts for: ${platforms.join(", ")}
- Number of variations per platform: ${numVariations} (so ${platforms.length} platforms × ${numVariations} = ${platforms.length * numVariations} total posts)
- Emphasis: ${emphasis.length > 0 ? emphasis.join(", ") : "balanced approach"}
${customCTA ? `- Include this specific CTA: "${customCTA}"` : "- Include a clear, relevant CTA"}
- Each post should focus on ONE core idea or benefit
- Use short paragraphs, line breaks, and bullet-like formatting
- Include relevant hashtags (2-5 for LinkedIn/X, fewer for Facebook)
- For LinkedIn: slightly longer, expert tone, consider asking a question
- For X: shorter, punchier, hook-focused

Return JSON format:
{
  "posts": [
    {
      "id": "post-1",
      "platform": "LinkedIn",
      "variantNumber": 1,
      "text": "Full post text here...",
      "suggestedHashtags": ["tag1", "tag2"]
    }
  ]
}`;

  return prompt;
}

function buildSlidesPPTPrompt(baseContext, options, feedback, previousOutput) {
  const numSlides = options?.numSlides || 10;
  const detailLevel = options?.detailLevel || "high-level";
  const includeDataSlide = options?.includeDataSlide !== false;
  const includeCaseStudy = options?.includeCaseStudy !== false;
  const generateYouTubeMetadata = options?.generateYouTubeMetadata !== false;

  let prompt = `${baseContext}

You are an expert presentation designer. Transform the article above into a slide deck with ${numSlides} slides, plus voiceover scripts for each slide.

${feedback ? `\n## User Feedback on Previous Version:\n${feedback}\n\nPlease incorporate this feedback into the new version.\n` : ''}
${previousOutput ? `\n## Previous Output (for reference):\n${JSON.stringify(previousOutput, null, 2)}\n` : ''}

## Requirements:
- Number of slides: ${numSlides}
- Detail level: ${detailLevel}
${includeDataSlide ? "- Include a data-driven slide if applicable" : ""}
${includeCaseStudy ? "- Include a case study/example slide if applicable" : ""}
- One key idea per slide
- Short bullet points (not paragraphs)
- Clear story arc: hook → problem → insights → solution → next steps/CTA
- Include a slide linking back to the original article
- Each slide needs a natural, spoken-style voiceover script (not just reading bullets)
- Use transitions between slides

${generateYouTubeMetadata ? `
Also generate YouTube metadata:
- Title: specific, benefit-driven, mention topic and audience
- Description: summarize benefits, include link to article, short outline
- Tags: mix of topic, industry, and intent keywords
` : ''}

Return JSON format:
{
  "slides": [
    {
      "slideNumber": 1,
      "title": "Slide title",
      "bullets": ["Bullet 1", "Bullet 2"],
      "notes": "Optional presenter notes",
      "voiceoverScript": "Full spoken script for this slide..."
    }
  ]${generateYouTubeMetadata ? `,
  "youtubeMetadata": {
    "title": "YouTube video title",
    "description": "Full description with link to article",
    "tags": ["tag1", "tag2", "tag3"]
  }` : ''}
}`;

  return prompt;
}

function buildShortVideoPrompt(baseContext, options, feedback, previousOutput) {
  const targetLength = options?.targetLength || "60s";
  const primaryPlatform = options?.primaryPlatform || "YouTube Shorts";
  const hookStyle = options?.hookStyle || "Bold claim / surprising stat";
  const ctaType = options?.ctaType || "Drive traffic to article";

  let prompt = `${baseContext}

You are an expert video scriptwriter. Create a ${targetLength} short video script based on the article above, optimized for ${primaryPlatform}.

${feedback ? `\n## User Feedback on Previous Version:\n${feedback}\n\nPlease incorporate this feedback into the new version.\n` : ''}
${previousOutput ? `\n## Previous Output (for reference):\n${JSON.stringify(previousOutput, null, 2)}\n` : ''}

## Requirements:
- Target length: ${targetLength}
- Platform: ${primaryPlatform}
- Hook style: ${hookStyle}
- CTA type: ${ctaType}
- Structure: Hook (3-5 seconds) → Context → 2-3 key points → CTA
- Keep sentences concise and conversational
- Suggest on-screen text for main phrases
- Suggest B-roll or visuals where appropriate

Return JSON format:
{
  "hookLine": "Opening hook line (3-5 seconds)",
  "script": "Full spoken script in order...",
  "beats": [
    {
      "timecode": "0-5s",
      "narration": "What's said here",
      "onScreenText": "Text to display",
      "suggestedVisuals": "Visual suggestion"
    }
  ],
  "suggestedCTA": "Final CTA text"
}`;

  return prompt;
}

function buildPodcastPrompt(baseContext, options, feedback, previousOutput) {
  const episodeLength = options?.episodeLength || "20 min";
  const format = options?.format || "Solo episode (host only)";
  const style = options?.style || "Educational walkthrough";

  let prompt = `${baseContext}

You are an expert podcast producer. Transform the article above into a ${episodeLength} podcast episode script.

${feedback ? `\n## User Feedback on Previous Version:\n${feedback}\n\nPlease incorporate this feedback into the new version.\n` : ''}
${previousOutput ? `\n## Previous Output (for reference):\n${JSON.stringify(previousOutput, null, 2)}\n` : ''}

## Requirements:
- Episode length: ${episodeLength}
- Format: ${format}
- Style: ${style}
- Clear episode title and 2-3 sentence summary
- Structure: Intro → Main sections → Recap → CTA
${format.includes("Interview") ? "- Include question prompts that pull stories from the article topic" : ""}
- Use natural language (avoid reading article verbatim)
- Include prompts for ID and brand mentions at start and end

Return JSON format:
{
  "episodeTitle": "Episode title",
  "episodeSummary": "2-3 sentence summary",
  "segments": [
    {
      "segmentTitle": "Segment name",
      "approxDuration": "3-5 min",
      "script": "Full script text...",
      "keyTalkingPoints": ["Point 1", "Point 2"]
    }
  ],
  "suggestedCTA": "Final CTA"
}`;

  return prompt;
}

function buildColdEmailPrompt(baseContext, options, feedback, previousOutput) {
  const mode = options?.mode || "cold";
  const audienceSegment = options?.audienceSegment || "";
  const primaryObjective = options?.primaryObjective || "Get reply / start conversation";
  const generateABSubjects = options?.generateABSubjects !== false;

  let prompt = `${baseContext}

You are an expert email copywriter. Create ${mode === "cold" ? "cold outbound emails" : "a newsletter email"} based on the article above.

${feedback ? `\n## User Feedback on Previous Version:\n${feedback}\n\nPlease incorporate this feedback into the new version.\n` : ''}
${previousOutput ? `\n## Previous Output (for reference):\n${JSON.stringify(previousOutput, null, 2)}\n` : ''}

## Requirements:
- Mode: ${mode}
${audienceSegment ? `- Target audience: ${audienceSegment}` : ''}
- Primary objective: ${primaryObjective}
${generateABSubjects ? "- Generate A/B subject line variants" : ""}
${mode === "cold" ? `
- Keep under 120-150 words
- Start with relevant context showing you understand the recipient
- Reference one concrete insight from the article
- Single clear CTA
- Make it about them, not you
` : `
- Lead with why the topic matters now
- Summarize article in bullets or short paragraphs
- Include skimmable sub-headings
- Clear link back to full article
- One main CTA
`}

Return JSON format:
{
  "mode": "${mode}",
  "subjectLines": ["Subject 1", "Subject 2"]${generateABSubjects ? ', "Subject 3"' : ''},
  "emails": [
    {
      "variantNumber": 1,
      "body": "Full email body text..."
    }
  ]
}`;

  return prompt;
}

function buildNurtureSeriesPrompt(baseContext, options, feedback, previousOutput) {
  const numEmails = options?.numEmails || 5;
  const delayDays = options?.delayDays || 3;
  const seriesGoal = options?.seriesGoal || "Educate and build trust";
  const systems = options?.systems || [];

  let prompt = `${baseContext}

You are an expert email marketing strategist. Create a ${numEmails}-email nurture sequence based on the article above.

${feedback ? `\n## User Feedback on Previous Version:\n${feedback}\n\nPlease incorporate this feedback into the new version.\n` : ''}
${previousOutput ? `\n## Previous Output (for reference):\n${JSON.stringify(previousOutput, null, 2)}\n` : ''}

## Requirements:
- Number of emails: ${numEmails}
- Delay between emails: ${delayDays} days
- Series goal: ${seriesGoal}
- Email 1: Big problem + relevance + link to main article
- Email 2: Insight/lesson with practical tips
- Email 3: Case study or example
- Email 4: Objection handling / FAQs
- Email 5+: Strong CTA (demo, consultation, or resource)
- Keep consistent cadence and tone

Return JSON format:
{
  "overview": {
    "totalEmails": ${numEmails},
    "cadenceDays": ${delayDays},
    "goal": "${seriesGoal}"
  },
  "emails": [
    {
      "stepNumber": 1,
      "delayDaysAfterPrevious": 0,
      "purpose": "Email purpose",
      "subjectLine": "Subject line",
      "body": "Full email body..."
    }
  ]
}`;

  return prompt;
}

function buildSearchAdsPrompt(baseContext, options, feedback, previousOutput) {
  const keywordTheme = options?.keywordTheme || "";
  const intent = options?.intent || "Informational";
  const numAds = options?.numAds || 3;

  let prompt = `${baseContext}

You are an expert search ads copywriter. Create Google Ads-style search ad copy based on the article above.

${feedback ? `\n## User Feedback on Previous Version:\n${feedback}\n\nPlease incorporate this feedback into the new version.\n` : ''}
${previousOutput ? `\n## Previous Output (for reference):\n${JSON.stringify(previousOutput, null, 2)}\n` : ''}

## Requirements:
${keywordTheme ? `- Main keyword theme: ${keywordTheme}` : ''}
- Intent: ${intent}
- Number of ads: ${numAds}
- Headlines: clear, benefit-driven, ≤30 characters where possible
- Descriptions: concise, strong CTA, ~90 characters per line
- Include keywords naturally
- Consider multiple angles: problem-focused, benefit-focused, proof-focused
- Suggest path fields for relevance

Return JSON format:
{
  "ads": [
    {
      "adNumber": 1,
      "headlines": ["Headline 1", "Headline 2", "Headline 3", "Headline 4", "Headline 5"],
      "descriptions": ["Description 1", "Description 2"],
      "suggestedPath": "/relevant/path",
      "suggestedFinalUrlNote": "Note: point to article or related landing page"
    }
  ]
}`;

  return prompt;
}

function buildPressReleasePrompt(baseContext, options, feedback, previousOutput) {
  const announcementType = options?.announcementType || "Thought leadership / expert commentary";
  const orgName = options?.orgName || "";
  const orgDescription = options?.orgDescription || "";
  const includeQuote = options?.includeQuote || false;
  const quoteName = options?.quoteName || "";
  const quoteTitle = options?.quoteTitle || "";

  let prompt = `${baseContext}

You are an expert PR writer. Create a press release based on the article above.

${feedback ? `\n## User Feedback on Previous Version:\n${feedback}\n\nPlease incorporate this feedback into the new version.\n` : ''}
${previousOutput ? `\n## Previous Output (for reference):\n${JSON.stringify(previousOutput, null, 2)}\n` : ''}

## Requirements:
- Announcement type: ${announcementType}
${orgName ? `- Organization: ${orgName}` : ''}
${orgDescription ? `- Organization description: ${orgDescription}` : ''}
${includeQuote ? `- Include quote from ${quoteName}, ${quoteTitle}` : ''}
- Structure: Headline → Sub-headline (optional) → Dateline + lead paragraph → 2-3 body paragraphs → Quote (if enabled) → Boilerplate
- Professional, factual tone
- Highlight unique standpoint from article
- Include links back to article and landing pages
- Repeat brand name and key terms naturally
- Clear next steps

Return JSON format:
{
  "headline": "Press release headline",
  "subHeadline": "Optional sub-headline",
  "bodyParagraphs": ["Paragraph 1", "Paragraph 2", "Paragraph 3"]${includeQuote ? `,
  "quoteSection": {
    "quote": "Quote text",
    "speakerName": "${quoteName}",
    "speakerTitle": "${quoteTitle}"
  }` : ''},
  "boilerplate": "Company boilerplate text"
}`;

  return prompt;
}

function buildOnePagerPrompt(baseContext, options, feedback, previousOutput) {
  const useCase = options?.useCase || "Sales leave-behind";
  const primaryCTA = options?.primaryCTA || "";
  const includePricing = options?.includePricing || false;

  let prompt = `${baseContext}

You are an expert one-pager designer. Create a single-page summary based on the article above.

${feedback ? `\n## User Feedback on Previous Version:\n${feedback}\n\nPlease incorporate this feedback into the new version.\n` : ''}
${previousOutput ? `\n## Previous Output (for reference):\n${JSON.stringify(previousOutput, null, 2)}\n` : ''}

## Requirements:
- Use case: ${useCase}
${primaryCTA ? `- Primary CTA: ${primaryCTA}` : ''}
${includePricing ? "- Include pricing snapshot" : ''}
- Structure: Headline + sub-headline → Problem statement → Key insights (3-5 bullets) → Visual sections (Who it's for, Key benefits, Next step/CTA) → Clear CTA box
- Keep it skimmable and scannable

Return JSON format:
{
  "title": "One-pager title",
  "subtitle": "Subtitle",
  "sections": [
    {
      "heading": "Section heading",
      "bullets": ["Bullet 1", "Bullet 2"],
      "body": "Optional body text"
    }
  ],
  "callToAction": "${primaryCTA || "Clear CTA text"}"
}`;

  return prompt;
}

function buildImagePromptsPrompt(baseContext, options, feedback, previousOutput) {
  const graphicType = options?.graphicType || "inline_images";
  const stylePreferences = options?.stylePreferences || ["Professional"];

  const typeLabels = {
    inline_images: "Inline Images",
    memes: "Memes",
    infographics: "Infographics",
    flyers: "Flyers",
  };

  const typeGuidance = {
    inline_images: `- Scan the ENTIRE article carefully
- Identify 1-5 strategic opportunities where inline images would:
  * Break up dense text sections
  * Illustrate key concepts, metaphors, or analogies
  * Visualize data points, statistics, or comparisons
  * Show before/after scenarios
  * Demonstrate processes or workflows
  * Create visual interest at critical reading points
- Think critically: Which concepts would benefit most from visual representation?
- Be creative: Consider unique angles, metaphors, or visual storytelling approaches
- Each angle should have a clear purpose and placement strategy`,
    memes: `- Scan the ENTIRE article carefully
- Identify 1-5 strategic opportunities where memes would:
  * Add humor to serious topics (if appropriate)
  * Create shareable moments
  * Build community through relatable content
  * Simplify complex concepts through humor
  * Reference popular culture or trends (if on-brand)
- Think critically: Which moments in the article could use levity or relatability?
- Be creative: Consider meme formats that align with the article's tone and audience
- Each meme should have a clear purpose and align with brand voice`,
    infographics: `- Scan the ENTIRE article carefully
- Identify 1-5 strategic opportunities where infographics would:
  * Visualize data, statistics, or research findings
  * Break down complex processes into step-by-step visuals
  * Compare options, features, or solutions
  * Show timelines, roadmaps, or progressions
  * Create shareable, linkable visual content
- Think critically: Which data or processes would be most impactful as visual content?
- Be creative: Consider unique layouts, color schemes, and information hierarchies
- Each infographic should tell a complete story or convey key insights`,
    flyers: `- Scan the ENTIRE article carefully
- Identify 1-5 strategic opportunities where flyers would:
  * Promote events, webinars, or workshops related to the article topic
  * Create physical marketing materials for conferences or trade shows
  * Summarize key takeaways for distribution
  * Generate leads through downloadable resources
  * Create leave-behind materials for sales or networking
- Think critically: Which aspects of the article would work best as a standalone promotional piece?
- Be creative: Consider eye-catching designs, clear CTAs, and print-friendly layouts
- Each flyer should have a clear purpose and call-to-action`,
  };

  let prompt = `${baseContext}

You are an expert graphic design strategist. Your task is to analyze the article above and generate creative, strategic design prompts for ${typeLabels[graphicType]}.

${feedback ? `\n## User Feedback on Previous Version:\n${feedback}\n\nPlease incorporate this feedback into the new version.\n` : ''}
${previousOutput ? `\n## Previous Output (for reference):\n${JSON.stringify(previousOutput, null, 2)}\n` : ''}

## Your Mission:
Carefully read and analyze the ENTIRE article. Think critically and creatively about where ${typeLabels[graphicType]} would add the most value. Identify 1-5 strategic opportunities (angles/strategies) that would enhance the article's impact.

${typeGuidance[graphicType]}

## Requirements:
- Style preferences: ${stylePreferences.join(", ")}
- Be extremely specific about subject, setting, style, and mood in each prompt
- Include text overlays or labels if needed
- Avoid brand logos (describe conceptually)
- For memes, reference format conceptually, not copyrighted characters

## Output Format:
Generate 1-5 design angles/strategies (aim for 3-5 for inline_images, memes, and infographics; 1-3 for flyers).

Return JSON format:
{
  "angles": [
    {
      "angleName": "Strategic angle name (e.g., 'Visual Metaphor for Problem Statement' or 'Data Visualization for Key Statistic')",
      "description": "What this visual represents, why it's strategically valuable, and where it should be placed in the article",
      "prompt": "Full, detailed prompt text to paste into image generator (be extremely specific about composition, colors, style, mood, text overlays)",
      "suggestedUseCases": ["Specific use case 1", "Specific use case 2"],
      "type": "${graphicType}",
      "riskLevel": "safe" | "casual" | "edgy" (only for memes, default to "safe" for conservative audiences)
    }
  ],
  "abTestingIdeas": [
    {
      "label": "Angle A vs Angle B",
      "description": "What to test and why (e.g., 'Test a minimalist illustration vs. a photo-realistic image to see which increases time on page')",
      "suggestedMetric": "click-through rate" | "engagement" | "time on page" | "shares" | "scroll depth"
    }
  ]
}

IMPORTANT:
- Think critically: Don't just suggest generic images. Identify the MOST strategic opportunities where visuals would add real value.
- Be creative: Consider unique angles, metaphors, visual storytelling, and unexpected approaches.
- Quality over quantity: Better to have 3-4 excellent, strategic angles than 5 generic ones.
- Each angle should be specific, actionable, and tied to a clear purpose in the article.`;

  return prompt;
}

