import { initMonkey } from "@/libs/monkey";
import { createClient } from "@/libs/supabase/server";
import { finishExternalRequest } from "@/libs/monkey/tools/external_requests";
import { NextResponse } from "next/server";

/**
 * Convert HTML to plain text for evaluation
 */
function htmlToPlainText(html) {
  if (!html) return "";
  
  let text = html;
  
  // Remove script and style tags with content
  text = text.replace(/<script\b[^<]*(?:(?!<\/script>)<[^<]*)*<\/script>/gi, "");
  text = text.replace(/<style\b[^<]*(?:(?!<\/style>)<[^<]*)*<\/style>/gi, "");
  
  // Convert common HTML entities
  text = text.replace(/&nbsp;/g, " ");
  text = text.replace(/&amp;/g, "&");
  text = text.replace(/&lt;/g, "<");
  text = text.replace(/&gt;/g, ">");
  text = text.replace(/&quot;/g, '"');
  text = text.replace(/&#39;/g, "'");
  
  // Replace block elements with newlines
  text = text.replace(/<\/?(h[1-6]|p|div|section|article|header|footer|nav|aside|blockquote|li|ul|ol)[^>]*>/gi, "\n");
  
  // Replace line breaks
  text = text.replace(/<br\s*\/?>/gi, "\n");
  
  // Remove all remaining HTML tags
  text = text.replace(/<[^>]+>/g, "");
  
  // Decode HTML entities (basic)
  text = text.replace(/&#(\d+);/g, (match, dec) => String.fromCharCode(dec));
  text = text.replace(/&#x([a-f\d]+);/gi, (match, hex) => String.fromCharCode(parseInt(hex, 16)));
  
  // Clean up whitespace
  text = text.replace(/\n\s*\n\s*\n/g, "\n\n");
  text = text.replace(/[ \t]+/g, " ");
  text = text.trim();
  
  return text;
}

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
    const { articleId, contentHtml } = body;

    if (!articleId) {
      return NextResponse.json(
        { error: "articleId is required" },
        { status: 400 }
      );
    }

    // Fetch article with all necessary data
    const { data: article, error: articleError } = await supabase
      .from("content_magic_articles")
      .select("*")
      .eq("id", articleId)
      .eq("user_id", user.id)
      .single();

    if (articleError || !article) {
      return NextResponse.json(
        { error: "Article not found" },
        { status: 404 }
      );
    }

    // Initialize monkey early for logging
    const monkey = await initMonkey();
    monkey.loadUserContext({ ...(body?.user_context ?? {}), userId: user?.id });

    // Use provided contentHtml if available (current editor content), otherwise use article.content_html
    const articleContentHtml = contentHtml || article.content_html || "";
    
    // Get prompts from assets
    const prompts = article.assets?.prompts || [];
    
    monkey.log('[ai-optimization-score] Raw prompts from assets:', JSON.stringify(prompts, null, 2));
    
    if (!Array.isArray(prompts) || prompts.length === 0) {
      monkey.log('[ai-optimization-score] No prompts array or empty array');
      return NextResponse.json(
        { error: "No prompts found in article assets. Please add prompts first." },
        { status: 400 }
      );
    }

    // Extract prompt texts and IDs (handle both {text, id} objects and plain strings)
    // Filter out corrupted "[object Object]" strings and invalid entries
    const promptTextsAndIds = prompts
      .filter(p => {
        if (!p || (typeof p === 'string' && p === '[object Object]')) {
          return false;
        }
        return true;
      })
      .map((p, idx) => {
        let text = null;
        const id = (p && typeof p === 'object' && !Array.isArray(p) && p.id) ? p.id : `prompt-${idx}`;
        if (typeof p === 'string') {
          const trimmed = p.trim();
          text = trimmed.length > 0 ? trimmed : null;
        } else if (p && typeof p === 'object' && !Array.isArray(p)) {
          const textValue = p.text || p.prompt || p.label;
          if (textValue && typeof textValue === 'string') {
            const trimmed = textValue.trim();
            text = trimmed.length > 0 ? trimmed : null;
          }
        }
        return text != null ? { text, id } : null;
      })
      .filter(Boolean);

    const promptTexts = promptTextsAndIds.map(x => x.text);
    const promptIds = promptTextsAndIds.map(x => x.id);

    monkey.log('[ai-optimization-score] Extracted prompt texts:', promptTexts);

    if (promptTexts.length === 0) {
      monkey.log('[ai-optimization-score] No valid prompts after extraction. Original prompts:', prompts);
      return NextResponse.json(
        { error: "No valid prompts found in article assets. Please ensure prompts have text content." },
        { status: 400 }
      );
    }

    // Fetch ICP data from context if available
    let icpData = null;
    const icpId = article.context?.icpId;
    if (icpId) {
      const { data: icp } = await supabase
        .from("icps")
        .select("*")
        .eq("id", icpId)
        .eq("user_id", user.id)
        .single();
      
      icpData = icp;
    }


    // Build ICP context string
    let contextString = "";
    
    if (icpData) {
      contextString += `\n## Target Audience (ICP):\n`;
      
      // Dynamically iterate through all ICP attributes
      Object.entries(icpData).forEach(([key, value]) => {
        // Skip system fields and empty values
        if (!value || key === 'id' || key === 'user_id' || key === 'created_at' || key === 'updated_at') {
          return;
        }
        
        // Convert snake_case to readable format
        const label = key
          .split('_')
          .map(word => word.charAt(0).toUpperCase() + word.slice(1))
          .join(' ');
        
        contextString += `- ${label}: ${value}\n`;
      });
    }


    // Convert HTML content to plain text for evaluation
    const articleText = htmlToPlainText(articleContentHtml);
    
    if (!articleText || articleText.trim().length === 0) {
      return NextResponse.json(
        { error: "Article content is empty. Please add content first." },
        { status: 400 }
      );
    }

    // Evaluate each prompt using LLM (direct evaluation, not vectorize-test)
    monkey.log(`[AI-OPTIMIZATION] Starting LLM evaluation for ${promptTexts.length} prompt(s)`);
    const evaluationStartTime = Date.now();
    
    const promptEvaluations = [];
    
    for (let i = 0; i < promptTexts.length; i++) {
      const promptText = promptTexts[i];
      const promptStartTime = Date.now();
      
      try {
        // Build evaluation prompt
        const evaluationPrompt = `You are evaluating how well an article addresses a specific user prompt.

Article text:
${articleText.substring(0, 80000)}${articleText.length > 80000 ? '\n\n[... article continues ...]' : ''}

User prompt to evaluate: "${promptText}"

Evaluate the article against this prompt and provide:
1. Score (0-100): Be critical and spread the scores:
   - 95-100: Prompt is directly and thoroughly addressed
   - 80-94: Prompt is well addressed but could be more comprehensive
   - 50-79: Prompt is indirectly or partially addressed
   - 20-49: Prompt is tangentially related but not well addressed
   - 0-19: Prompt is not related or barely mentioned
2. Most relevant match: Extract the most relevant sentence or short passage (max 100 words) from the article that best addresses the prompt. If the score is below 50, return null for this field.
3. Quick comment: A brief 10-20 word assessment of how well the article addresses the prompt.
4. Recommendations: If the score is below 70, provide 2-4 sentences on what to add or clarify so the article better addresses this prompt (focused, actionable). If the score is 70 or above, set this to null.
5. Priority: Suggested priority for this prompt - "high" (critical to address), "low" (relevant but not essential), or "done" (already sufficiently addressed; use "done" when score is 70 or above).
6. Reasoning: One short sentence (15-25 words) explaining the priority choice.

Return ONLY valid JSON in this exact format (no markdown, no extra text):
{
  "score": 85,
  "mostRelevantMatch": "The relevant sentence or passage here, or null if score < 50",
  "comment": "Brief 10-20 word comment here",
  "recommendations": "2-4 sentences on what to add or clarify, or null if score >= 70",
  "priority": "high",
  "reasoning": "One sentence explaining why this priority."
}`;

        const aiResponse = await monkey.AI(evaluationPrompt, {
          vendor: "openai",
          model: "gpt-4o",
          forceJson: true,
          returnMetadata: false,
        });

        // Parse JSON response
        let evaluation;
        try {
          evaluation = typeof aiResponse === 'string' ? JSON.parse(aiResponse) : aiResponse;
        } catch (parseError) {
          monkey.log(`[AI-OPTIMIZATION] Error parsing JSON for prompt ${i + 1}:`, parseError);
          evaluation = {
            score: 0,
            mostRelevantMatch: null,
            comment: "Error parsing evaluation response",
            recommendations: null
          };
        }

        // Ensure score is within 0-100 range
        const score = Math.max(0, Math.min(100, parseInt(evaluation.score) || 0));
        
        // Only include mostRelevantMatch if score is >= 50
        const mostRelevantMatch = (score >= 50 && evaluation.mostRelevantMatch) 
          ? evaluation.mostRelevantMatch.trim() 
          : null;

        // Binary "done" for Implement Prompts: 70+ = sufficient
        const isSufficient = score >= 70;
        const recommendations = (score < 70 && evaluation.recommendations && typeof evaluation.recommendations === 'string')
          ? evaluation.recommendations.trim()
          : null;

        // Normalize priority for downstream (suggest priorities shape)
        const rawPriority = (evaluation.priority && typeof evaluation.priority === 'string')
          ? evaluation.priority.trim().toLowerCase()
          : (isSufficient ? 'done' : 'low');
        const priority = ['high', 'low', 'done'].includes(rawPriority) ? rawPriority : (isSufficient ? 'done' : 'low');
        const reasoning = (evaluation.reasoning && typeof evaluation.reasoning === 'string')
          ? evaluation.reasoning.trim()
          : (isSufficient ? 'Prompt is sufficiently addressed in the article.' : 'Please review and assign priority.');

        const evaluationTime = Date.now() - promptStartTime;
        
        monkey.log(`[AI-OPTIMIZATION] Prompt ${i + 1}/${promptTexts.length}: "${promptText.substring(0, 60)}${promptText.length > 60 ? '...' : ''}"`);
        monkey.log(`   Score: ${score}/100`);
        monkey.log(`   Comment: ${evaluation.comment || 'No comment'}`);
        monkey.log(`   Most relevant match: ${mostRelevantMatch ? mostRelevantMatch.substring(0, 100) + '...' : 'None (score too low)'}`);
        monkey.log(`   Evaluation time: ${evaluationTime}ms`);

        promptEvaluations.push({
          prompt: promptText,
          score: score,
          score0to100: score, // Same as score for consistency
          comment: evaluation.comment || "",
          mostRelevantMatch: mostRelevantMatch,
          recommendations: recommendations,
          isSufficient: isSufficient,
          priority,
          reasoning,
        });

      } catch (error) {
        monkey.log(`[AI-OPTIMIZATION] Error evaluating prompt "${promptText}":`, error);
        promptEvaluations.push({
          prompt: promptText,
          score: 0,
          score0to100: 0,
          comment: `Error: ${error.message}`,
          mostRelevantMatch: null,
          recommendations: null,
          isSufficient: false,
          priority: 'low',
          reasoning: 'Unable to evaluate. Please review manually.',
        });
      }
    }

    // Build suggestions array for Implement Prompts (same shape as suggest-priorities API)
    const suggestions = promptEvaluations.map((evaluation, idx) => ({
      promptId: promptIds[idx] ?? `prompt-${idx}`,
      priority: evaluation.priority ?? 'low',
      reasoning: evaluation.reasoning ?? 'No reasoning provided.',
    }));

    const totalEvaluationTime = Date.now() - evaluationStartTime;
    const totalTimeSeconds = (totalEvaluationTime / 1000).toFixed(2);
    
    monkey.log(`✅ [AI-OPTIMIZATION] Evaluation completed in ${totalTimeSeconds}s`);

    // Calculate total score (average of all prompt scores)
    const totalScore = promptEvaluations.length > 0
      ? Math.round(promptEvaluations.reduce((sum, evaluation) => sum + evaluation.score, 0) / promptEvaluations.length)
      : 0;

    // Log final summary
    monkey.log(`\n📊 [AI-OPTIMIZATION] Final score: ${totalScore}/100 across ${promptEvaluations.length} prompt${promptEvaluations.length !== 1 ? 's' : ''}`);

    // Build overall rationale
    const overallRationale = `This article scored ${totalScore}/100 for AI optimization across ${promptEvaluations.length} prompt${promptEvaluations.length !== 1 ? 's' : ''}. ` +
      `The article ${totalScore >= 80 ? 'performs well' : totalScore >= 60 ? 'performs adequately' : 'needs significant improvement'} ` +
      `in addressing the user prompts.`;

    // Build rationale object
    const rationale = {
      totalScore: totalScore,
      prompts: promptEvaluations,
      overallRationale: overallRationale,
      evaluationMetadata: {
        totalTimeMs: totalEvaluationTime,
        totalTimeSeconds: parseFloat(totalTimeSeconds),
        promptsEvaluated: promptEvaluations.length,
      }
    };

    // Build GEOReport object to save in assets (shallow-copy evaluationMetadata to avoid circular reference)
    const geoReport = {
      score: totalScore,
      rationale: rationale,
      generatedAt: new Date().toISOString(),
      promptsEvaluated: promptEvaluations.length,
      evaluationMetadata: rationale.evaluationMetadata ? { ...rationale.evaluationMetadata } : null,
    };

    // Get current assets and update with GEOReport
    // Fetch current article to ensure we have the latest assets
    const { data: currentArticle, error: fetchError } = await supabase
      .from("content_magic_articles")
      .select("assets")
      .eq("id", articleId)
      .eq("user_id", user.id)
      .single();

    if (fetchError) {
      monkey.log("⚠️ [AI-OPTIMIZATION] Warning: Could not fetch current assets, using article from initial fetch");
    }

    const currentAssets = currentArticle?.assets || article.assets || {};
    const updatedAssets = {
      ...currentAssets,
      GEOReport: geoReport
    };

    monkey.log(`[AI-OPTIMIZATION] Saving GEOReport to assets. Current assets keys: ${Object.keys(currentAssets).join(", ")}`);

    // Store results in database - only save to assets.GEOReport
    // Note: ai_score and ai_rationale columns don't exist, so we only save to assets.GEOReport
    const updatePayload = {
      assets: updatedAssets,
    };
    
    monkey.log(`[AI-OPTIMIZATION] Attempting to update article ${articleId} with payload:`, JSON.stringify({
      assets_keys: Object.keys(updatePayload.assets),
      GEOReport_exists: !!updatePayload.assets.GEOReport,
      GEOReport_score: updatePayload.assets.GEOReport?.score,
      GEOReport_promptsEvaluated: updatePayload.assets.GEOReport?.promptsEvaluated,
    }, null, 2));
    
    const { error: updateError } = await supabase
      .from("content_magic_articles")
      .update(updatePayload)
      .eq("id", articleId)
      .eq("user_id", user.id);

    if (updateError) {
      monkey.log("❌ [AI-OPTIMIZATION] Error updating article with GEOReport:", updateError);
      // Still return the results even if database update fails
    } else {
      monkey.log("✅ [AI-OPTIMIZATION] GEOReport saved to article.assets.GEOReport");
      monkey.log(`[AI-OPTIMIZATION] Updated assets keys: ${Object.keys(updatedAssets).join(", ")}`);
    }

    await finishExternalRequest(supabase, {
      externalRequestId,
      status: "success",
      responsePreview: JSON.stringify({ score: totalScore, suggestions }),
      latencyMs: Date.now() - startTime,
    });

    return NextResponse.json({
      success: true,
      score: totalScore,
      rationale: rationale,
      suggestions,
    }, { status: 200 });

  } catch (error) {
    await finishExternalRequest(supabase, {
      externalRequestId,
      status: "failed",
      errorMessage: error?.message ?? String(error),
      latencyMs: Date.now() - startTime,
    });
    // Try to log with monkey if available, otherwise use console
    try {
      const monkey = await initMonkey();
      monkey.log("Error in /api/content-magic/ai-optimization-score:", error);
    } catch (e) {
    }
    return NextResponse.json(
      { error: "Internal server error", details: error.message },
      { status: 500 }
    );
  }
}