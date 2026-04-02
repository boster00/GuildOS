// app/api/content-magic/crawl/route.js
import { NextResponse } from "next/server";

export async function POST(request) {
  try {
    const { url, crawlDepth = 0, extractSectionsOnly = false } = await request.json();
    // Validation
    if (!url || typeof url !== "string") {
      return NextResponse.json(
        { error: "URL is required and must be a string" },
        { status: 400 }
      );
    }

    // Validate URL format
    try {
      new URL(url);
    } catch (err) {
      return NextResponse.json(
        { error: "Invalid URL format" },
        { status: 400 }
      );
    }

    let result;

    try {
      // Fetch the webpage using native fetch
      const response = await fetch(url, {
        method: "GET",
        headers: {
          "User-Agent": "Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/91.0.4472.124 Safari/537.36",
        },
        timeout: 10000,
      });
      if (!response.ok) {
        return NextResponse.json(
          { 
            error: `Failed to fetch URL (${response.status})`, 
            details: response.statusText 
          },
          { status: 400 }
        );
      }

      const html = await response.text();
      // Extract page title from meta tags (used for both paths)
      const titleMatch = html.match(/<title[^>]*>([^<]+)<\/title>/i);
      const metaTitleMatch = html.match(/<meta\s+(?:property|name)=["']og:title["'][^>]*content=["']([^"']+)["']/i);
      const pageTitle = metaTitleMatch?.[1] || titleMatch?.[1] || "Untitled Article";

      if (extractSectionsOnly) {
        const firstSection = html.indexOf("<section");
        const lastSectionEnd = html.lastIndexOf("</section>");
        let extractedHtml;
        if (firstSection !== -1 && lastSectionEnd !== -1 && lastSectionEnd >= firstSection) {
          extractedHtml = html.substring(firstSection, lastSectionEnd + "</section>".length);
        } else {
          extractedHtml = `<section class="imported">${html}</section>`;
        }
        return NextResponse.json({
          success: true,
          url,
          title: pageTitle.trim(),
          content_html: extractedHtml,
        });
      }

      // Return raw crawled HTML (no cleaning or conversion)
      result = {
        method: "raw",
        crawlDepth: crawlDepth || 0,
        url,
        title: pageTitle.trim(),
        content_html: html,
        content: [{ html }],
        success: true,
      };
    } catch (error) {
      return NextResponse.json(
        { error: "Failed to fetch webpage content", details: error.message },
        { status: 500 }
      );
    }
    return NextResponse.json(result, { status: 200 });
  } catch (error) {
    return NextResponse.json(
      { 
        error: "Internal server error", 
        details: error.message 
      },
      { status: 500 }
    );
  }
}