import { NextResponse } from "next/server";
import { initMonkey } from "@/libs/monkey";

export async function POST(request) {
  try {
    const body = await request.json();
    const { keyword, direction = "to", currentArticleHtml = "", targetUrl, targetHtml } = body || {};

    if (!keyword || typeof keyword !== "string") {
      return NextResponse.json({ error: "keyword is required" }, { status: 400 });
    }
    if (!["to", "from"].includes(direction)) {
      return NextResponse.json({ error: "direction must be 'to' or 'from'" }, { status: 400 });
    }

    let finalTargetHtml = targetHtml || "";
    let finalTargetUrl = targetUrl || null;

    const monkey = await initMonkey();
    monkey.loadUserContext(body?.user_context ?? {});

    if (!finalTargetHtml && finalTargetUrl) {
      // Use internal crawl API to fetch clean HTML via monkey
      const text = await monkey.apiCall("/api/content-magic/crawl", { url: finalTargetUrl, crawlDepth: 0 });
      const crawlData = JSON.parse(text);
      if (crawlData?.error) {
        return NextResponse.json({ error: crawlData.error || "Failed to crawl target" }, { status: 400 });
      }
      finalTargetHtml = crawlData?.content?.[0]?.html || crawlData?.content?.[0]?.content || "";
    }

    const analyzePrompt = `You identify natural, user-first internal linking opportunities.

Inputs:
- Direction: ${direction === "to" ? "Insert link in the CURRENT article pointing TO the target page." : "Insert link in the TARGET page pointing TO the current article."}
- Keyword: ${keyword}
- Current Article (HTML excerpt, may be empty):
${(currentArticleHtml || "").slice(0, 7000)}

- Target Page (HTML excerpt, may be empty):
${(finalTargetHtml || "").slice(0, 7000)}

Task:
1) Propose up to 3 suggestions where a link would be natural and helpful.
2) For each suggestion, provide:
   - type: "inline" | "sentence" | "paragraph"
   - anchorText: a concise, natural text including or related to the keyword
   - htmlSnippet: the HTML to insert (include <a href="..."> with the target URL)
   - rationale: short explanation of why this fits here for the user
   - locationHint: short description of surrounding text (quote a few words before/after)
3) Keep tone consistent with the existing content. No pushy marketing language.
4) Output strict JSON: {"suggestions":[{...},{...}]}.

Notes:
- If content is too sparse to place a natural link, propose a sentence/paragraph that would fit and why.
- Prefer minimal changes when possible, otherwise give a short helpful sentence.
`;

    const aiRaw = await monkey.AI(analyzePrompt, {
      vendor: "openai",
      model: "gpt-4o",
      forceJson: true,
    });

    let parsed = { suggestions: [] };
    try {
      parsed = JSON.parse(aiRaw);
    } catch (e) {
      parsed = { suggestions: [] };
    }

    // Normalize fields, inject URL
    const safeUrl = finalTargetUrl || "";
    const suggestions = (parsed.suggestions || []).map(s => {
      const anchorText = s.anchorText || keyword;
      const type = s.type || "inline";
      let htmlSnippet = s.htmlSnippet || "";
      if (!htmlSnippet) {
        htmlSnippet = type === "inline"
          ? `<a href="${safeUrl}" rel="noopener nofollow">${anchorText}</a>`
          : `<p><a href="${safeUrl}" rel="noopener nofollow">${anchorText}</a></p>`;
      } else if (safeUrl && !htmlSnippet.includes('href="')) {
        htmlSnippet = htmlSnippet.replace("<a ", `<a href="${safeUrl}" `);
      }
      return {
        type,
        anchorText,
        htmlSnippet,
        rationale: s.rationale || "",
        locationHint: s.locationHint || "",
      };
    });

    return NextResponse.json({
      suggestions,
      targetMeta: { title: "", url: safeUrl },
    });
  } catch (error) {
    return NextResponse.json({ error: error.message || "Failed to generate suggestions" }, { status: 500 });
  }
}


