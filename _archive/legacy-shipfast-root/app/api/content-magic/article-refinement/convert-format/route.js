// Convert article to other formats
import { createClient } from "@/libs/supabase/server";
import { NextResponse } from "next/server";
import monkey from "@/libs/monkey";

const FORMAT_PROMPTS = {
  social_media: (title, content) => `Convert this article into engaging social media posts.

Article Title: "${title}"

Article Content:
${content.substring(0, 3000)}

Create 3-5 social media posts (one for each platform):
- LinkedIn post (professional, 1300-3000 characters)
- Twitter/X post (concise, 280 characters)
- Facebook post (engaging, 500-1000 characters)

Format as JSON:
{
  "linkedin": "LinkedIn post text here",
  "twitter": "Twitter post text here",
  "facebook": "Facebook post text here"
}`,

  slideshare: (title, content) => `Convert this article into a SlideShare presentation outline.

Article Title: "${title}"

Article Content:
${content.substring(0, 3000)}

Create a presentation with 8-12 slides. For each slide, provide:
- Slide number
- Slide title
- Key bullet points (3-5 per slide)

Format as JSON array:
[
  {
    "slide": 1,
    "title": "Slide Title",
    "bullets": ["Point 1", "Point 2", "Point 3"]
  }
]`,

  short_video: (title, content) => `Convert this article into a short video script (60-90 seconds).

Article Title: "${title}"

Article Content:
${content.substring(0, 3000)}

Create a video script with:
- Hook (first 3 seconds)
- Main content (key points)
- Call to action (last 5 seconds)

Format as JSON:
{
  "hook": "Opening hook text",
  "mainContent": "Main script content",
  "cta": "Call to action text",
  "estimatedDuration": "60-90 seconds"
}`,

  podcast: (title, content) => `Convert this article into a podcast episode script.

Article Title: "${title}"

Article Content:
${content.substring(0, 3000)}

Create a conversational podcast script (5-10 minutes) with:
- Introduction
- Main discussion points
- Conclusion

Format as JSON:
{
  "introduction": "Opening segment",
  "mainPoints": ["Point 1", "Point 2", "Point 3"],
  "conclusion": "Closing segment",
  "estimatedDuration": "5-10 minutes"
}`,

  cold_outreach: (title, content) => `Convert this article into a cold outreach email or newsletter template.

Article Title: "${title}"

Article Content:
${content.substring(0, 3000)}

Create a professional cold email with:
- Subject line
- Opening hook
- Value proposition
- Call to action

Format as JSON:
{
  "subject": "Email subject line",
  "body": "Email body text",
  "cta": "Call to action"
}`,

  nurture_email: (title, content) => `Convert this article into a 3-email nurture sequence.

Article Title: "${title}"

Article Content:
${content.substring(0, 3000)}

Create 3 emails that build on each other:
- Email 1: Introduction and value
- Email 2: Deep dive into key points
- Email 3: Call to action

Format as JSON array:
[
  {
    "email": 1,
    "subject": "Subject line",
    "body": "Email body"
  }
]`,

  search_ads: (title, content) => `Convert this article into search ad copy.

Article Title: "${title}"

Article Content:
${content.substring(0, 3000)}

Create Google Ads / Bing Ads copy with:
- Headline 1 (30 characters)
- Headline 2 (30 characters)
- Headline 3 (30 characters)
- Description (90 characters)
- Long description (90 characters)

Format as JSON:
{
  "headlines": ["Headline 1", "Headline 2", "Headline 3"],
  "description": "Short description",
  "longDescription": "Long description"
}`,

  press_release: (title, content) => `Convert this article into a press release.

Article Title: "${title}"

Article Content:
${content.substring(0, 3000)}

Create a professional press release with:
- Headline
- Subheadline
- Dateline
- Body paragraphs
- Boilerplate

Format as JSON:
{
  "headline": "Press release headline",
  "subheadline": "Subheadline",
  "dateline": "CITY, STATE, DATE",
  "body": "Press release body text",
  "boilerplate": "Company boilerplate"
}`,

  one_pager: (title, content) => `Convert this article into a one-page PDF summary.

Article Title: "${title}"

Article Content:
${content.substring(0, 3000)}

Create a concise one-pager with:
- Title
- Key takeaways (3-5 bullet points)
- Main content summary
- Call to action

Format as JSON:
{
  "title": "One-pager title",
  "keyTakeaways": ["Takeaway 1", "Takeaway 2"],
  "summary": "Main summary text",
  "cta": "Call to action"
}`,
};

// MVP: Article refinement features are not available
export async function POST(request) {
  return NextResponse.json(
    { error: "Article refinement features are not available in MVP. Use ChatGPT, Cursor, or human writers." },
    { status: 404 }
  );
}

/* MVP - Disabled - Original code preserved below
export async function POST_ORIGINAL(request) {
  try {
    const supabase = await createClient();
    const { data: { user } } = await supabase.auth.getUser();

    if (!user) {
      return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
    }

    const { articleId, format, articleTitle, articleContent } = await request.json();

    if (!articleId || !format) {
      return NextResponse.json(
        { error: "articleId and format are required" },
        { status: 400 }
      );
    }

    const prompt = FORMAT_PROMPTS[format];
    if (!prompt) {
      return NextResponse.json(
        { error: "Invalid format specified" },
        { status: 400 }
      );
    }

    // Build prompt
    const fullPrompt = prompt(articleTitle || "Article", articleContent || "");

    // Call LLM
    const response = await monkey.AI(fullPrompt, {
      forceJson: true,
      vendor: "openai",
      model: process.env.AI_MODEL_STANDARD || "gpt-4o",
    });

    // Parse JSON response
    let convertedContent;
    if (typeof response === 'string') {
      const jsonMatch = response.match(/```(?:json)?\s*(\{[\s\S]*\}|\[[\s\S]*\])\s*```/);
      if (jsonMatch) {
        convertedContent = JSON.parse(jsonMatch[1]);
      } else {
        const directMatch = response.match(/(\{[\s\S]*\}|\[[\s\S]*\])/);
        if (directMatch) {
          convertedContent = JSON.parse(directMatch[1]);
        } else {
          convertedContent = JSON.parse(response);
        }
      }
    } else {
      convertedContent = response;
    }

    // Format as string for display
    const formattedContent = typeof convertedContent === 'string' 
      ? convertedContent 
      : JSON.stringify(convertedContent, null, 2);

    return NextResponse.json({ 
      success: true, 
      convertedContent: formattedContent,
      rawContent: convertedContent 
    }, { status: 200 });
  } catch (error) {
    return NextResponse.json(
      { error: "Internal server error", details: error.message },
      { status: 500 }
    );
  }
}
*/

