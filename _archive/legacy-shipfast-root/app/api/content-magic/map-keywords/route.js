import { NextResponse } from "next/server";
import { initMonkey } from "@/libs/monkey";
import { createClient } from "@/libs/supabase/server";
import { extractOutlineFromHtml } from "@/libs/content-magic/article-refinement/utils.js";
import { migrateLegacyOutline } from "@/libs/content-magic/utils/migrateLegacyOutline.js";

export async function POST(request) {
  const startTime = Date.now();
  try {
    const supabase = await createClient();
    const {
      data: { user },
    } = await supabase.auth.getUser();

    if (!user) {
      return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
    }
    const { articleId, outline_sections, keywords } = await request.json();
    // Extract outline_sections from HTML if not provided
    let finalOutlineSections = outline_sections;
    if ((!finalOutlineSections || finalOutlineSections.length === 0) && articleId) {
      const { data: article, error: articleError } = await supabase
        .from("content_magic_articles")
        .select("content_html, assets")
        .eq("id", articleId)
        .eq("user_id", user.id)
        .single();

      if (articleError || !article) {
      } else {
        // Try to get from assets first (top-level, no refinement wrapper)
        if (article.assets?.outlineSections) {
          finalOutlineSections = article.assets.outlineSections;
        } else if (article.content_html) {
          // Extract from HTML
          finalOutlineSections = extractOutlineFromHtml(article.content_html);
        }
      }
    }

    if (!finalOutlineSections || finalOutlineSections.length === 0 || !keywords || keywords.length === 0) {
      return NextResponse.json(
        { error: "outline_sections and keywords are required" },
        { status: 400 }
      );
    }

    // Validate and normalize section structure (backward compatibility)
    finalOutlineSections = migrateLegacyOutline(finalOutlineSections);
    // Initialize Monkey
    const monkeyStart = Date.now();
    const monkey = await initMonkey();
    monkey.loadUserContext({ ...(body?.user_context ?? {}), userId: user?.id });
    const monkeyTime = Date.now() - monkeyStart;
    

    // Format sections for AI with exact keys
    const sectionsText = finalOutlineSections
      .map(s => `- KEY: "${s.key}" | TITLE: "${s.title}" | FORMAT: "${s.format || 'text_block'}"${s.purpose ? ` | PURPOSE: "${s.purpose}"` : ''}`)
      .join('\n');
    
    // Format keywords for AI (handle both string and object formats)
    // Prioritize keyword_text (database format) over keyword or label
    // Preserve search_volume (support both snake_case and camelCase for backward compatibility)
    const keywordsText = keywords
      .map(kw => {
        if (typeof kw === 'string') return `- "${kw}"`;
        const keywordText = kw.keyword_text || kw.keyword || kw.label || String(kw);
        const searchVolume = kw.search_volume !== undefined ? kw.search_volume : (kw.searchVolume !== undefined ? kw.searchVolume : null);
        const sv = searchVolume ? ` (SV: ${searchVolume})` : '';
        const stage = kw.journey_stage ? ` [${kw.journey_stage}]` : '';
        return `- "${keywordText}"${sv}${stage}`;
      })
      .join('\n');
    
    const prompt = `You are a content strategist. Your task is to map keywords to content outline sections.

CRITICAL: You MUST use the EXACT section keys provided in the list below. Do NOT generate new keys, do NOT modify keys. Copy them exactly as shown.

Content Outline Sections (with exact keys to use):
${sectionsText}

Available Keywords:
${keywordsText}

Task:
For each section, identify which keywords are most relevant and should be included in that section. Consider:
1. Keyword relevance to section title and purpose
2. Natural fit for the section's content format
3. Search intent alignment with the topic
4. Each keyword can be assigned to multiple sections if relevant

Return a JSON array where each object represents a section mapping. You MUST:
- Use the EXACT sectionKey values from the section list above
- Do NOT create new keys
- Do NOT modify the keys in any way
- Copy the sectionKey exactly as shown in the section list
- Include all sections in the response

Response format MUST be:
[
  {
    "sectionKey": "section_maximizing_signal_detection",
    "sectionTitle": "Maximizing Signal Detection in Western Blotting",
    "keywords": ["keyword1", "keyword2", "keyword3"]
  },
  {
    "sectionKey": "section_examples_case_studies",
    "sectionTitle": "Examples and Case Studies",
    "keywords": ["keyword2", "keyword4"]
  }
]

IMPORTANT RULES:
1. Return ONLY valid JSON, no additional text or markdown
2. Use the exact sectionKey from the section list - copy and paste the key values
3. Include all sections, even if keywords array is empty
4. keywords array should contain strings matching the keywords provided
5. Each keyword string should match exactly as provided in the Keywords list (case-sensitive)
6. If a section has no relevant keywords, use an empty array: "keywords": []
7. Do not add new section keys or modify existing ones in any way`;

    
    // Call AI with forceJson option to extract JSON
    const aiStart = Date.now();
    const response = await monkey.AI(prompt, {
      vendor: "openai",
      model: "gpt-4o",
      forceJson: true,
    });
    const aiTime = Date.now() - aiStart;
    
    
    // Parse AI response
    let keyword_mapping = [];
    try {
      // Response should already be parsed JSON due to forceJson: true
      if (typeof response === 'string') {
        const jsonMatch = response.match(/\[[\s\S]*\]/);
        if (jsonMatch) {
          keyword_mapping = JSON.parse(jsonMatch[0]);
        } else {
          throw new Error("Could not extract JSON array from response");
        }
      } else if (Array.isArray(response)) {
        keyword_mapping = response;
      } else {
        throw new Error("Response is not an array or string");
      }

      // Validate structure
      if (!Array.isArray(keyword_mapping)) {
        throw new Error("Parsed response is not an array");
      }
      // Validate that all returned sectionKeys match input sections
      const validSectionKeys = new Set(finalOutlineSections.map(s => s.key));
      

      const mappedKeys = new Set(keyword_mapping.map(m => m.sectionKey));
      

      const invalidKeys = keyword_mapping
        .map(m => m.sectionKey)
        .filter(key => !validSectionKeys.has(key));
      
      if (invalidKeys.length > 0) {
        
        keyword_mapping = keyword_mapping.filter(m => validSectionKeys.has(m.sectionKey));
      }

      // Ensure all sections are represented
      const missingKeys = Array.from(validSectionKeys).filter(key => !mappedKeys.has(key));
      
      if (missingKeys.length > 0) {
        
        missingKeys.forEach(key => {
          const section = finalOutlineSections.find(s => s.key === key);
          if (section) {
            keyword_mapping.push({
              sectionKey: key,
              sectionTitle: section.title,
              keywords: [],
            });
            
          }
        });
      }

      // Log mapping details
      keyword_mapping.forEach((mapping, idx) => {
        
      });

    } catch (parseError) {
      // Fallback: create empty mapping structure with all sections
      keyword_mapping = finalOutlineSections.map(section => ({
        sectionKey: section.key,
        sectionTitle: section.title,
        keywords: [],
      }));
      keyword_mapping.forEach((mapping, idx) => {
        
      });
    }

    const totalTime = Date.now() - startTime;
    return NextResponse.json({ keyword_mapping });
  } catch (error) {
    const totalTime = Date.now() - startTime;
    return NextResponse.json(
      { error: error.message || "Failed to generate keyword mapping" },
      { status: 500 }
    );
  }
}