"use client";
import React, { useState, useEffect, useCallback } from "react";
import { MessageCircle, Plus, Trash2, Sparkles, FileText, Check } from "lucide-react";
import { toast } from "react-hot-toast";
import { useWritingGuide } from "@/libs/content-magic/context/WritingGuideContext";
import { initMonkey } from "@/libs/monkey";
import CreditCostBadge from "@/components/CreditCostBadge";

// Types (JSDoc comments for reference)
// PromptIdea: { id, text, reason?, target? }
// ResearchPromptsState: { acceptedPrompts[], aiSuggestions[] }

const PAGE_TYPES = [
  { value: 'transactional', label: 'Transactional' },
  { value: 'compare_choose', label: 'Compare & Choose' },
  { value: 'informational', label: 'Informational' },
];

const researchPrompts = {
  key: "research_prompts",
  pageType: ["all"],
  meta: {
    label: "Research Prompts (GEO)",
    category: "research_plan",
    description: "Select prompts you want to show up for in AI results. Enter prompts that your ICP would actually type into AI.",
    defaultActive: true,
    tutorialTitle: "CJGEO Tutorial 5: Research Prompts for Effective GEO Content 🚀",
    tutorialURL: "https://www.loom.com/share/eaf38205a48e4a47be7607572b8ae054",
  },
  DetailsUIDisplayMode: "fullscreen",

  is_complete: (context) => {
    return !!(context.assets?.prompts?.length > 0);
  },

  components: {
    ListingUI: ({ rule, context, onExecute }) => {
      const isComplete = rule.is_complete && rule.is_complete(context);

      return (
        <div className="flex items-center justify-between p-2 bg-white rounded border border-purple-200 hover:border-purple-400 transition-colors group cursor-pointer">
          <div className="flex-1">
            <span className="text-xs font-medium text-gray-700">
              {isComplete && (
                <span className="text-xs text-green-600 pr-1">✓ </span>
              )}
              {rule.meta.label}
            </span>
          </div>
          <button
            onClick={(e) => {
              e.stopPropagation();
              onExecute();
            }}
            className="p-1 text-purple-600 hover:bg-purple-50 rounded transition-colors opacity-0 group-hover:opacity-100"
            title="Open Q&A Targeting"
          >
            <MessageCircle className="w-4 h-4" />
          </button>
        </div>
      );
    },

    DetailedUI: ({ rule, context, onUpdate, onRegisterCloseHandler, isSaving }) => {
      const { article, updateArticle, getEditorHtml } = useWritingGuide();

      // Check if ICP and Offer are set - required for research
      // Check for direct structure (context.icp, context.icpId) and campaign context
      const hasIcp = !!(
        article?.context?.icp || 
        article?.context?.campaignSettings?.icp || 
        context?.context?.icp || 
        context?.context?.campaignSettings?.icp ||
        article?.context?.icpId || 
        context?.context?.icpId
      );
      const hasOffer = !!(
        article?.context?.offer || 
        article?.context?.campaignSettings?.offer || 
        context?.context?.offer || 
        context?.context?.campaignSettings?.offer ||
        article?.context?.offerId || 
        context?.context?.offerId || 
        article?.offer_id
      );
      
      // Check if prompt type is already selected in context
      const promptTypeFromContext = context?.assets?.prompt_type || null;
      
      // Show warning if ICP or Offer is missing - required before research
      if ((!hasIcp || !hasOffer) && !promptTypeFromContext) {
        return (
          <div className="px-6 py-6">
            <div className="max-w-2xl mx-auto">
              <div className="bg-yellow-50 border-2 border-yellow-400 rounded-lg p-6 space-y-4">
                <div className="flex items-start gap-3">
                  <div className="flex-shrink-0">
                    <svg className="w-6 h-6 text-yellow-600" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                      <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 9v2m0 4h.01m-6.938 4h13.856c1.54 0 2.502-1.667 1.732-3L13.732 4c-.77-1.333-2.694-1.333-3.464 0L3.34 16c-.77 1.333.192 3 1.732 3z" />
                    </svg>
                  </div>
                  <div className="flex-1">
                    <h3 className="text-lg font-semibold text-yellow-900 mb-2">
                      Required Information Missing
                    </h3>
                    <p className="text-sm text-yellow-800 mb-4">
                      Before proceeding with prompt research, you need to set the following:
                    </p>
                    <ul className="list-disc list-inside space-y-2 text-sm text-yellow-800 mb-4">
                      {!hasIcp && (
                        <li>
                          <strong>ICP (Ideal Customer Profile)</strong> - Required to understand your target audience
                        </li>
                      )}
                      {!hasOffer && (
                        <li>
                          <strong>Offer</strong> - Required to understand what you're promoting
                        </li>
                      )}
                    </ul>
                    <p className="text-sm text-yellow-700 italic">
                      Please set up your ICP and Offer in the article settings before conducting prompt research.
                    </p>
                  </div>
                </div>
              </div>
            </div>
          </div>
        );
      }

      // Initialize state from existing assets
      const existingPrompts = context?.assets?.prompts || [];
      
      // Get context data for AI suggestions
      const icpData = context?.context?.icpId ? context.context : null;
      const mainKeyword = context?.assets?.main_keyword || context?.assets?.mainKeyword || '';
      const secondaryKeywords = context?.assets?.keywords || [];
      const articleTitle = context?.title || '';
      const articleBody = context?.content_html || context?.content || '';
      const originalVision = context?.assets?.original_vision || '';
      
      // Get content topics from competitor analysis
      const contentTopics = context?.assets?.topics || [];
      const contentTopicsText = Array.isArray(contentTopics) 
        ? contentTopics.map((topic, idx) => {
            if (typeof topic === 'string') {
              return `${idx + 1}. ${topic}`;
            } else if (topic.topic) {
              return `${idx + 1}. ${topic.topic}${topic.notes ? ` (${topic.notes})` : ''}`;
            }
            return '';
          }).filter(Boolean).join('\n')
        : '';

      const [acceptedPrompts, setAcceptedPrompts] = useState(
        existingPrompts
          .filter(p => p !== null && p !== undefined) // Filter out null/undefined
          .map((prompt, idx) => {
            // Skip if already corrupted as "[object Object]" string
            if (typeof prompt === 'string' && prompt === '[object Object]') {
              return null; // Will be filtered out
            }
            
            if (typeof prompt === 'string') {
              return {
                id: `existing-${idx}`,
                text: prompt,
              };
            } else if (prompt && typeof prompt === 'object' && !Array.isArray(prompt)) {
              // Handle different prompt object structures
              // Ensure we have a valid text property
              const textValue = prompt.text || prompt.label || prompt.prompt;
              if (!textValue || typeof textValue !== 'string') {
                // If no valid text property, skip this prompt
                return null; // Will be filtered out
              }
              
              return {
                id: prompt.id || `existing-${idx}`,
                text: textValue,
                reason: prompt.reason || prompt.notes || '',
                target: prompt.target || '',
                intentType: prompt.intentType || null,
              };
            } else {
              // Fallback for unexpected types - skip instead of converting to string
              return null; // Will be filtered out
            }
          })
          .filter(p => p !== null) // Remove null entries
      );
      const [aiSuggestions, setAiSuggestions] = useState([]);
      const [manualInput, setManualInput] = useState('');
      const [isGenerating, setIsGenerating] = useState(false);

      // Prompt type selection state - check if already saved in article assets, context, or prompts
      // Priority: context.pageType > assets.prompt_type > first prompt's intentType
      const getPromptTypeFromPrompts = () => {
        if (existingPrompts.length > 0) {
          const firstPrompt = existingPrompts[0];
          if (firstPrompt && typeof firstPrompt === 'object' && firstPrompt.intentType) {
            return firstPrompt.intentType;
          }
        }
        return null;
      };
      
      // Load pageType from context or article.type, merge with prompt_type
      // Check multiple locations: article.context.pageType, context.context.pageType, article.type
      const pageTypeFromContext = article?.context?.pageType || 
                                   context?.context?.pageType || 
                                   article?.type || 
                                   null;
      const promptTypeFromAssets = context?.assets?.prompt_type || null;
      const promptTypeFromPrompts = getPromptTypeFromPrompts();
      
      // Use pageType from context as primary source, fallback to assets.prompt_type, then prompts.
      // Default to 'transactional' when none set or value is empty/invalid.
      const rawPromptType = pageTypeFromContext || promptTypeFromAssets || promptTypeFromPrompts || null;
      const validValues = PAGE_TYPES.map(({ value }) => value);
      const existingPromptType =
        rawPromptType && String(rawPromptType).trim() && validValues.includes(String(rawPromptType).trim())
          ? String(rawPromptType).trim()
          : null;
      const [promptType, setPromptType] = useState(existingPromptType ?? 'transactional');
      // Seed keywords state - from previous research, saved assets, or user input
      const savedSeedKeywords = context?.assets?.prompt_seed_keywords || null;
      const allSeedKeywords = savedSeedKeywords || [
        ...(mainKeyword ? [mainKeyword] : []),
        ...(secondaryKeywords || []).map(kw => typeof kw === 'string' ? kw : (kw.keyword_text || kw.keyword || '')).filter(Boolean)
      ];
      const [seedKeywords, setSeedKeywords] = useState(allSeedKeywords);
      const [additionalSeedInput, setAdditionalSeedInput] = useState('');
      const [seedKeywordsConfirmed, setSeedKeywordsConfirmed] = useState(
        context?.assets?.prompt_seed_keywords_confirmed || (allSeedKeywords.length > 0 ? true : false)
      );
      const [isSavingPrompts, setIsSavingPrompts] = useState(false);

      // Build asset updates from current state (for Save and for Close via getPendingUpdates)
      const buildAssetUpdates = useCallback(() => {
        const newPrompts = acceptedPrompts
          .filter(p => p && p.text && typeof p.text === 'string' && p.text.trim().length > 0)
          .map(p => {
            const keywords = p.seedKeywords || seedKeywords;
            const plainKeywords = keywords ? [...keywords] : null;
            return {
              text: p.text.trim(),
              reason: (p.reason && typeof p.reason === 'string') ? p.reason.trim() : '',
              target: (p.target && typeof p.target === 'string') ? p.target.trim() : '',
              intentType: p.intentType || promptType || null,
              seedKeywords: plainKeywords,
              origin: p.origin || 'PromptResearch',
              relevanceScore: p.relevanceScore ?? null,
            };
          });
        if (newPrompts.length === 0) return null;
        const updates = {
          prompts: newPrompts,
          prompt_type: promptType || undefined,
          prompt_seed_keywords: seedKeywords.length > 0 ? [...seedKeywords] : undefined,
          prompt_seed_keywords_confirmed: seedKeywordsConfirmed,
        };
        return updates;
      }, [acceptedPrompts, promptType, seedKeywords, seedKeywordsConfirmed]);

      // Register getPendingUpdates so panel Close button saves current state
      useEffect(() => {
        if (typeof onRegisterCloseHandler !== 'function') return;
        onRegisterCloseHandler(() => buildAssetUpdates());
        return () => onRegisterCloseHandler(null);
      }, [onRegisterCloseHandler, buildAssetUpdates]);

      // Clean up corrupted prompts on mount if needed
      useEffect(() => {
        if (!article?.id || !article?.assets?.prompts) return;
        
        const prompts = article.assets.prompts || [];
        const hasCorruptedPrompts = prompts.some(p => 
          typeof p === 'string' && p === '[object Object]'
        );
        
        if (hasCorruptedPrompts) {
          const cleanedPrompts = prompts.filter(p => {
            if (typeof p === 'string' && p === '[object Object]') {
              return false; // Remove corrupted strings
            }
            if (typeof p === 'object' && p !== null) {
              // Keep only valid prompt objects with text property
              return !!(p.text && typeof p.text === 'string' && p.text.trim().length > 0);
            }
            if (typeof p === 'string' && p.trim().length > 0) {
              return true; // Keep valid string prompts
            }
            return false; // Remove everything else
          });
          
          // Save cleaned prompts back to database
          // Clean up corrupted prompts using centralized asset manager
          (async () => {
            const monkey = await initMonkey();
            monkey.articleAssets.savePatch(
              article.id,
              { prompts: cleanedPrompts },
              article.assets,
              updateArticle
            ).catch(err => {
            });
          })();
        }
      }, [article?.id]); // Only run once on mount

      // Add manual prompt
      const handleAddPrompt = () => {
        const trimmed = manualInput.trim();
        if (!trimmed) {
          return;
        }

        const newPrompt = {
          id: `manual-${Date.now()}`,
          text: trimmed,
        };

        setAcceptedPrompts(prev => [...prev, newPrompt]);
        setManualInput('');
      };

      // Remove prompt
      const handleRemovePrompt = (id) => {
        setAcceptedPrompts(prev => prev.filter(p => p.id !== id));
      };

      // Suggest prompts with AI using contextual meta-prompt
      const suggestPromptsWithAI = async () => {
        // Check ICP and Offer requirements
        // Check for direct structure (context.icp, context.icpId) and campaign context
        const currentHasIcp = !!(
          article?.context?.icp || 
          article?.context?.campaignSettings?.icp || 
          context?.context?.icp || 
          context?.context?.campaignSettings?.icp ||
          article?.context?.icpId || 
          context?.context?.icpId
        );
        const currentHasOffer = !!(
          article?.context?.offer || 
          article?.context?.campaignSettings?.offer || 
          context?.context?.offer || 
          context?.context?.campaignSettings?.offer ||
          article?.context?.offerId || 
          context?.context?.offerId || 
          article?.offer_id
        );
        
        if (!currentHasIcp || !currentHasOffer) {
          const missing = [];
          if (!currentHasIcp) missing.push('ICP (Ideal Customer Profile)');
          if (!currentHasOffer) missing.push('Offer');
          toast.error(`Cannot generate prompts: Missing ${missing.join(' and ')}. Please set these in article settings before proceeding.`);
          return;
        }
        
        if (!promptType) {
          toast.error('Please select a prompt type first');
          return;
        }
        
        if (seedKeywords.length === 0) {
          toast.error('Please confirm or add at least one seed keyword');
          return;
        }

        setIsGenerating(true);
        setAiSuggestions([]);

        try {
          

          // Prepare context for AI
          const articleText = articleBody.replace(/<[^>]*>/g, '').trim();
          const pageSummary = articleText.substring(0, 1000); // First 1000 chars as summary
          
          // Get user-entered prompts for anchoring
          const userEnteredPrompts = acceptedPrompts.map(p => p.text).join('\n- ');
          
          // Map prompt type to readable name
          const intentTypeMap = {
            'transactional': 'Transactional',
            'compare_choose': 'Compare & Choose',
            'informational': 'Informational'
          };
          const intentTypeName = intentTypeMap[promptType] || promptType;
          
          // Build offer/ICP description
          let offerDescription = '';
          if (icpData) {
            const icpFields = Object.entries(icpData)
              .filter(([key, value]) => value && typeof value === 'string' && value.trim().length > 0 && !['id', 'user_id', 'created_at', 'updated_at'].includes(key))
              .map(([key, value]) => {
                const label = key.split('_').map(word => word.charAt(0).toUpperCase() + word.slice(1)).join(' ');
                return `- ${label}: ${value}`;
              });
            if (icpFields.length > 0) {
              offerDescription = icpFields.join('\n');
            }
          }
          // Build contextual meta-prompt with user input examples and non-overlapping requirement
          const message = `You are generating AI search prompt suggestions for CJGEO.

Article Context:
- Article title: ${articleTitle || 'Not available'}
- Article summary (first 1000 chars): ${pageSummary || 'Not available'}
- Seed keywords: ${seedKeywords.join(', ')}
- Intent type: ${intentTypeName}
- ICP / Offer context: ${offerDescription || 'Not provided'}

User-Entered Prompt Examples (use these to anchor intent):
${userEnteredPrompts.length > 0 ? `- ${userEnteredPrompts}` : 'None provided'}

Task:
Generate 3-5 high-quality AI search prompts that:
1. Serve a SIMILAR intent to the user-entered prompt(s) above
2. Have NON-OVERLAPPING intent - each prompt should address a different angle, question type, or user need
3. Read like something a real user would ask an AI assistant or search engine
4. Include meaningful context and sufficient specificity
5. Align with the intent type: ${intentTypeName}

Intent Type Guidelines:
${intentTypeName === "Informational" ? `
  - Focus on explanations, clarifications, how-tos, definitions
  - Example forms: "Explain...", "What is...", "How does...", "Why does...", "Describe..."
` : intentTypeName === "Transactional" ? `
  - Focus on actions, purchases, quotes, ordering, setup
  - Example forms: "How to get a quote...", "Steps to order...", "What questions to ask when purchasing..."
` : intentTypeName === "Compare & Choose" ? `
  - Focus on comparisons, evaluations, alternatives, decisions
  - Example forms: "Compare X vs Y...", "Which is better for...", "What's the difference between..."
` : ''}

Critical Requirements:
- Generate EXACTLY 3-5 prompts (no more, no less)
- Each prompt must have DISTINCT, NON-OVERLAPPING intent from the user-entered examples and from each other
- Prompts should be similar in style and context to the user-entered examples but ask different questions or approach from different angles
- If the user entered: "How do I choose a nanobody CRO?", generate prompts like:
  * "What questions should I ask a nanobody CRO before hiring?" (similar intent: decision-making, but different angle: questions vs. criteria)
  * "What are red flags to watch for when selecting a nanobody CRO?" (similar intent: evaluation, but different angle: warnings vs. positives)
  * "How long does the nanobody CRO selection process typically take?" (similar intent: practical decision-making, but different angle: timeline vs. criteria)

Output:
Return EXACTLY 3-5 unique prompts, one per line.
Do not include bullets, numbers, or metadata — just the prompt text itself.
Each prompt should be a complete, natural question or request.

Important:
- Do not output structured JSON
- Do not repeat the user-entered prompts
- Ensure each prompt has clearly distinct intent that doesn't overlap with others`;

          

          const monkey = await initMonkey();
          const text = await monkey.apiCall('/api/content-magic/suggest-research-prompts', { message });
          const data = JSON.parse(text);
          if (data.error) throw new Error(data.error || 'Failed to generate suggestions');

          // Parse AI response - expect plain text (one prompt per line)
          let rawResponse = '';
          
          if (data.message) {
            rawResponse = data.message;
          } else if (typeof data === 'string') {
            rawResponse = data;
          } else {
            throw new Error('Unexpected response format from AI');
          }

          

          // Split by newlines and filter out empty lines
          let promptLines = rawResponse
            .split('\n')
            .map(line => line.trim())
            .filter(line => line.length > 0 && !line.match(/^(```|\[|\{|#|[*•\-])/)) // Filter out markdown/code markers
            .filter(line => line.length > 10); // Filter out very short lines (likely formatting artifacts)
          if (promptLines.length === 0) {
            // Fallback: Try to extract from any JSON structure if present
            try {
              const jsonMatch = rawResponse.match(/\[[\s\S]*\]/);
              if (jsonMatch) {
                const jsonResults = JSON.parse(jsonMatch[0]);
                if (Array.isArray(jsonResults)) {
                  promptLines = jsonResults.map(item => 
                    typeof item === 'string' ? item : (item.prompt || item.text || String(item))
                  ).filter(Boolean);
                }
              }
            } catch (fallbackError) {
            }
          }

          if (promptLines.length === 0) {
            toast.error('AI did not return valid prompts. Please try again.');
            setIsGenerating(false);
            return;
          }

          // Filter out prompts that are too similar to user-entered prompts
          const userPromptTexts = acceptedPrompts.map(p => p.text.toLowerCase());
          const filteredPrompts = promptLines.filter(line => {
            const lineLower = line.toLowerCase();
            // Check if prompt is too similar to any user-entered prompt
            const isTooSimilar = userPromptTexts.some(userPrompt => {
              // Check for high similarity (same words in same order, or very similar phrasing)
              const words = userPrompt.split(/\s+/);
              const lineWords = lineLower.split(/\s+/);
              // If more than 70% of words overlap, consider it too similar
              const overlap = words.filter(w => w.length > 3 && lineWords.includes(w)).length;
              const similarityRatio = overlap / Math.max(words.length, lineWords.length);
              return similarityRatio > 0.7;
            });
            return !isTooSimilar;
          });

          

          // Limit to 3-5 prompts as requested
          const limitedPrompts = filteredPrompts.slice(0, 5);
          
          

          // Calculate relevance scores (simple keyword overlap + intent alignment)
          const seedKeywordsLower = seedKeywords.map(k => k.toLowerCase());
          const articleTitleLower = articleTitle.toLowerCase();
          const articleTextLower = articleBody.replace(/<[^>]*>/g, '').toLowerCase();

          const scoredPrompts = limitedPrompts.map((text, idx) => {
            const textLower = text.toLowerCase();
            
            // Keyword overlap score
            let keywordOverlap = 0;
            seedKeywordsLower.forEach(seed => {
              if (textLower.includes(seed)) keywordOverlap += 2;
            });
            
            // Context relevance (title and content overlap)
            let contextRelevance = 0;
            const titleWords = articleTitleLower.split(/\s+/);
            titleWords.forEach(word => {
              if (word.length > 3 && textLower.includes(word)) contextRelevance += 1;
            });
            
            // Simple intent alignment check (keyword matching in text)
            let intentAlignment = 0;
            if (promptType === 'transactional') {
              if (textLower.match(/(how|what|where|when|steps|order|buy|purchase|quote|contact)/)) intentAlignment += 2;
            } else if (promptType === 'compare_choose') {
              if (textLower.match(/(compare|vs|versus|difference|better|which|should|choose)/)) intentAlignment += 2;
            } else if (promptType === 'informational') {
              if (textLower.match(/(what|how|why|explain|describe|summarize|define|understand)/)) intentAlignment += 2;
            }
            
            const relevanceScore = keywordOverlap + contextRelevance + intentAlignment;
            
            return {
              id: `ai-${Date.now()}-${idx}`,
              text: text,
              relevanceScore: relevanceScore,
            };
          });

          // Sort by relevance score (descending)
          scoredPrompts.sort((a, b) => b.relevanceScore - a.relevanceScore);

          

          // Save AI optimization score report results to state and DB once available
          setAiSuggestions(scoredPrompts);
          
          // Save optimization score report to article assets
          if (article?.id && scoredPrompts.length > 0) {
            try {
              const existingAssets = article.assets || {};
              const optimizationReport = {
                generatedAt: new Date().toISOString(),
                totalSuggestions: scoredPrompts.length,
                suggestions: scoredPrompts.map(p => ({
                  id: p.id,
                  text: p.text,
                  relevanceScore: p.relevanceScore,
                  intentType: promptType,
                  seedKeywords: [...seedKeywords], // Convert to plain array
                })),
                averageScore: scoredPrompts.reduce((sum, p) => sum + (p.relevanceScore || 0), 0) / scoredPrompts.length,
                maxScore: Math.max(...scoredPrompts.map(p => p.relevanceScore || 0)),
                minScore: Math.min(...scoredPrompts.map(p => p.relevanceScore || 0)),
              };

              const updatedAssets = {
                ...existingAssets,
                prompt_optimization_report: optimizationReport,
              };
              // Save using centralized asset manager
              const monkey = await initMonkey();
              monkey.articleAssets.savePatch(
                article.id,
                {
                  prompt_optimization_report: optimizationReport
                },
                article.assets,
                updateArticle
              ).then(() => {
              }).catch((error) => {
              });
            } catch (error) {
            }
          }
        } catch (error) {
          toast.error(`Failed to generate suggestions: ${error.message}`);
        } finally {
          setIsGenerating(false);
        }
      };

      // Toggle AI suggestion selection (checkboxes, max 5)
      const MAX_SELECTED_PROMPTS = 5;
      const handleToggleSuggestion = (suggestion) => {
        const exists = acceptedPrompts.some(p => p.id === suggestion.id || p.text === suggestion.text);
        
        if (exists) {
          // Remove if already selected
          setAcceptedPrompts(prev => prev.filter(p => p.id !== suggestion.id && p.text !== suggestion.text));
        } else {
          // Check max limit
          if (acceptedPrompts.length >= MAX_SELECTED_PROMPTS) {
            toast.error(`You can select a maximum of ${MAX_SELECTED_PROMPTS} prompts. Please remove one first.`);
            return;
          }
          
          // Add new prompt
          const newPrompt = {
            id: suggestion.id,
            text: suggestion.text,
            intentType: promptType,
            seedKeywords: seedKeywords,
            origin: 'PromptResearch',
            relevanceScore: suggestion.relevanceScore || 0,
          };

          setAcceptedPrompts(prev => [...prev, newPrompt]);
        }
      };
      
      // Legacy function for backward compatibility
      const handleAdoptSuggestion = (suggestion) => {
        handleToggleSuggestion(suggestion);
      };

      // Discard AI suggestion
      const handleDiscardSuggestion = (id) => {
        setAiSuggestions(prev => prev.filter(s => s.id !== id));
      };

      // Add additional seed keyword
      const handleAddSeedKeyword = () => {
        const trimmed = additionalSeedInput.trim();
        if (!trimmed) return;
        if (seedKeywords.includes(trimmed)) {
          toast.error('This keyword is already in the list');
          return;
        }
        setSeedKeywords(prev => [...prev, trimmed]);
        setAdditionalSeedInput('');
      };

      // Remove seed keyword
      const handleRemoveSeedKeyword = (keywordToRemove) => {
        setSeedKeywords(prev => prev.filter(kw => kw !== keywordToRemove));
      };

      // Confirm seed keywords
      const handleConfirmSeedKeywords = async () => {
        if (seedKeywords.length === 0) {
          toast.error('Please add at least one seed keyword');
          return;
        }
        setSeedKeywordsConfirmed(true);
        // Save to article assets
        if (article?.id) {
          // Save seed keywords using centralized asset manager
          const monkey = await initMonkey();
          await monkey.articleAssets.savePatch(
            article.id,
            {
              prompt_seed_keywords: seedKeywords,
              prompt_seed_keywords_confirmed: true
            },
            article.assets,
            updateArticle
          );
        }
      };

      // If seed keywords not confirmed yet, show confirmation UI
      if (!seedKeywordsConfirmed) {
        return (
          <div className="px-6 py-6">
            <div className="max-w-3xl mx-auto space-y-6">
              <div>
                <h2 className="text-xl font-semibold text-gray-900 mb-2">
                  Confirm Seed Keywords
                </h2>
                <p className="text-sm text-gray-600">
                  Review and confirm the seed keywords that will be used to generate prompt suggestions. You can add additional keywords if needed.
                </p>
              </div>

              <div className="border border-gray-200 rounded-lg p-6 space-y-4">
                <div>
                  <label className="block text-sm font-medium text-gray-700 mb-2">
                    Current Seed Keywords
                  </label>
                  {seedKeywords.length === 0 ? (
                    <p className="text-sm text-gray-500 italic">
                      No seed keywords found from previous research. Please add at least one.
                    </p>
                  ) : (
                    <div className="flex flex-wrap gap-2">
                      {seedKeywords.map((kw, idx) => (
                        <span
                          key={idx}
                          className="inline-flex items-center gap-1 px-3 py-1 bg-blue-50 text-blue-700 rounded-full text-sm"
                        >
                          {kw}
                          <button
                            onClick={() => handleRemoveSeedKeyword(kw)}
                            className="text-blue-600 hover:text-blue-800"
                            title="Remove"
                          >
                            ×
                          </button>
                        </span>
                      ))}
                    </div>
                  )}
                </div>

                <div>
                  <label className="block text-sm font-medium text-gray-700 mb-2">
                    Add Additional Seed Keyword
                  </label>
                  <div className="flex gap-2">
                    <input
                      type="text"
                      value={additionalSeedInput}
                      onChange={(e) => setAdditionalSeedInput(e.target.value)}
                      onKeyDown={(e) => {
                        if (e.key === 'Enter') {
                          e.preventDefault();
                          handleAddSeedKeyword();
                        }
                      }}
                      placeholder="Enter a keyword phrase..."
                      className="flex-1 px-4 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-transparent"
                    />
                    <button
                      onClick={handleAddSeedKeyword}
                      disabled={!additionalSeedInput.trim()}
                      className="px-4 py-2 bg-blue-600 text-white rounded-lg hover:bg-blue-700 transition-colors font-medium disabled:bg-gray-300 disabled:cursor-not-allowed"
                    >
                      <Plus className="w-4 h-4" />
                    </button>
                  </div>
                </div>

                {seedKeywords.length === 0 && (
                  <div className="bg-yellow-50 border border-yellow-200 rounded-lg p-4">
                    <p className="text-sm text-yellow-800">
                      <strong>Warning:</strong> Your seed terms are empty. Consider adding keywords to improve prompt generation quality.
                    </p>
                  </div>
                )}

                <div className="flex gap-3 pt-2">
                  <button
                    onClick={handleConfirmSeedKeywords}
                    disabled={seedKeywords.length === 0}
                    className="px-6 py-2 bg-green-600 text-white rounded-lg hover:bg-green-700 transition-colors font-medium disabled:bg-gray-300 disabled:cursor-not-allowed"
                  >
                    Confirm & Continue
                  </button>
                  <button
                    onClick={() => {
                      setSeedKeywords(allSeedKeywords);
                      setAdditionalSeedInput('');
                    }}
                    className="px-6 py-2 border border-gray-300 text-gray-700 rounded-lg hover:bg-gray-50 transition-colors font-medium"
                  >
                    Reset to Defaults
                  </button>
                </div>
              </div>
            </div>
          </div>
        );
      }

      return (
        <div className="px-6 py-6">
          <div className="flex gap-6 h-full">
            {/* Left Panel - Selected Prompts */}
            <div className="w-80 flex-shrink-0 border-r border-gray-200 pr-6">
              <div className="space-y-6">
                <div>
                  <h3 className="text-sm font-semibold text-gray-700 uppercase mb-3">
                    Selected Prompts
                  </h3>
                  <div className="bg-gray-50 border border-gray-200 rounded-lg p-4">
                    {acceptedPrompts.length === 0 ? (
                      <p className="text-xs text-gray-500">
                        No prompts selected yet. Add prompts using the options on the right.
                      </p>
                    ) : (
                      <div className="space-y-2 max-h-[calc(100vh-200px)] overflow-y-auto">
                        {acceptedPrompts.map((prompt, idx) => (
                          <div
                            key={prompt.id}
                            className="bg-white border border-gray-200 rounded p-3"
                          >
                            <div className="flex items-start justify-between gap-2 mb-1">
                              <span className="text-xs font-medium text-gray-500">
                                {idx + 1}.
                              </span>
                              <button
                                onClick={() => handleRemovePrompt(prompt.id)}
                                className="p-1 text-gray-400 hover:text-red-600 hover:bg-red-50 rounded transition-colors flex-shrink-0"
                                title="Delete"
                              >
                                <Trash2 className="w-3 h-3" />
                              </button>
                            </div>
                            <p className="text-xs text-gray-700 mb-1">
                              {typeof prompt.text === 'string' ? prompt.text : String(prompt.text || '')}
                            </p>
                            {prompt.reason && typeof prompt.reason === 'string' && (
                              <p className="text-xs text-gray-500 italic mb-1">{prompt.reason}</p>
                            )}
                            {prompt.target && typeof prompt.target === 'string' && (
                              <p className="text-xs text-gray-500">
                                <span className="font-medium">Target:</span> {prompt.target}
                              </p>
                            )}
                          </div>
                        ))}
                      </div>
                    )}
                  </div>
                </div>

                {/* Save Prompts Button - goes through panel saveAndClose (save then close) */}
                <div>
                  <button
                    type="button"
                    title={acceptedPrompts.length === 0 ? 'Add at least one prompt to the accepted list to save' : undefined}
                    onClick={async () => {
                      let updates = buildAssetUpdates();
                      if (!updates) {
                        toast.error('No valid prompts to save. Please ensure all prompts have text.');
                        return;
                      }
                      if (!article?.id) {
                        toast.error('Article not loaded. Please refresh and try again.');
                        return;
                      }
                      setIsSavingPrompts(true);
                      try {
                        const monkey = await initMonkey();
                        // Save prompts to the server first so ai-optimization-score can read them
                        await monkey.articleAssets.savePatch(
                          article.id,
                          updates,
                          article?.assets ?? {},
                          updateArticle
                        );
                        try {
                          const contentHtml = (getEditorHtml?.() || article?.content_html || "").trim() || article?.content_html || "";
                          const aiScoreResult = await monkey.articleAssets.refreshGeoReport(
                            article.id,
                            contentHtml
                          );
                          updates = {
                            ...updates,
                            GEOReport: {
                              score: aiScoreResult.score,
                              rationale: aiScoreResult.rationale,
                              generatedAt: new Date().toISOString(),
                              promptsEvaluated: aiScoreResult.rationale?.prompts?.length || 0,
                            },
                          };
                        } catch (aiScoreError) {
                        }
                        if (onUpdate) onUpdate(updates);
                      } catch (err) {
                        toast.error('Failed to save prompts. Check the console for details.');
                      } finally {
                        setIsSavingPrompts(false);
                      }
                    }}
                    disabled={acceptedPrompts.length === 0 || isSaving || isSavingPrompts}
                    className="w-full px-4 py-2 bg-green-600 text-white rounded-lg hover:bg-green-700 transition-colors font-medium disabled:bg-gray-300 disabled:cursor-not-allowed flex items-center justify-center gap-2"
                  >
                    {(isSaving || isSavingPrompts) ? (
                      <>
                        <div className="w-4 h-4 border-2 border-white border-t-transparent rounded-full animate-spin" />
                        Saving...
                      </>
                    ) : (
                      <>
                        <Check className="w-4 h-4" />
                        Save Prompts
                      </>
                    )}
                  </button>
                </div>
              </div>
            </div>

            {/* Right Panel - Options (header from RuleDetailPanel) */}
            <div className="flex-1 space-y-6">
              {/* Step 1: Manual Input */}
              <div className="border border-gray-200 rounded-lg p-6">
                <h3 className="text-sm font-semibold text-gray-700 mb-3">
                  Option 1: Enter A Prompt Manually
                </h3>
                
                <div className="space-y-3">
                  <textarea
                    value={manualInput}
                    onChange={(e) => setManualInput(e.target.value)}
                    onKeyDown={(e) => {
                      if (e.key === 'Enter' && (e.metaKey || e.ctrlKey)) {
                        e.preventDefault();
                        handleAddPrompt();
                      }
                    }}
                    placeholder='e.g. "How do I choose a nanobody CRO that can handle my rare target?"'
                    className="w-full px-4 py-3 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-transparent resize-none"
                    rows={3}
                  />
                  <p className="text-xs text-gray-500">
                    Write in your ICP's words. Think about questions that show buying intent, confusion, or 'what should I do?' moments.
                  </p>
                  <button
                    onClick={handleAddPrompt}
                    disabled={!manualInput.trim()}
                    className="px-4 py-2 bg-blue-600 text-white rounded-lg hover:bg-blue-700 transition-colors font-medium disabled:bg-gray-300 disabled:cursor-not-allowed flex items-center gap-2"
                  >
                    <Plus className="w-4 h-4" />
                    Add Prompt
                  </button>
                </div>
              </div>

              {/* Step 2: AI Suggestions */}
              <div className="border border-gray-200 rounded-lg p-6">
                <h3 className="text-sm font-semibold text-gray-700 mb-1">
                  Option 2: AI Suggest Additional Prompts
                </h3>
                <p className="text-xs text-gray-500 mb-4">
                  AI will generate 3-5 additional prompts based on your manually entered prompt(s), article context, prompt type, and ICP. Prompts will have similar but non-overlapping intent to your input.
                </p>
                
                {/* Page Type: radio group, labels only */}
                <fieldset className="mb-4" aria-label="Page type">
                  <legend className="sr-only">Page type</legend>
                  <div className="flex flex-wrap gap-4">
                    {PAGE_TYPES.map(({ value, label }) => (
                      <label
                        key={value}
                        className="inline-flex items-center gap-2 cursor-pointer"
                      >
                        <input
                          type="radio"
                          name="promptPageType"
                          value={value}
                          checked={promptType === value}
                          onChange={async () => {
                            setPromptType(value);
                            if (article?.id) {
                              const monkey = await initMonkey();
                              await monkey.articleAssets.savePatch(
                                article.id,
                                { prompt_type: value },
                                article.assets,
                                updateArticle
                              );
                              initMonkey().then(m => m.saveArticle({ articleId: article.id, pageType: value })).catch(() => {});
                            }
                          }}
                          className="w-4 h-4 text-blue-600 border-gray-300 focus:ring-blue-500"
                        />
                        <span className="text-sm text-gray-700">{label}</span>
                      </label>
                    ))}
                  </div>
                </fieldset>
                
                <button
                  onClick={suggestPromptsWithAI}
                  disabled={isGenerating || !promptType}
                  className="mb-4 px-4 py-2 bg-purple-600 text-white rounded-lg hover:bg-purple-700 transition-colors font-medium disabled:bg-gray-300 disabled:cursor-not-allowed flex items-center gap-2"
                  title={!promptType ? "select a page type to generate with AI" : ""}
                >
                  {isGenerating ? (
                    <>
                      <div className="w-4 h-4 border-2 border-white border-t-transparent rounded-full animate-spin" />
                      Generating...
                    </>
                  ) : (
                    <>
                      <Sparkles className="w-4 h-4" />
                      Generate AI Suggestions
                      <CreditCostBadge path="/api/content-magic/suggest-research-prompts" size="sm" className="ml-1" />
                    </>
                  )}
                </button>

                {/* AI Suggestions List with Checkboxes */}
                  {aiSuggestions.length === 0 ? (
                  <div className="border border-gray-200 rounded-lg p-4 text-center text-sm text-gray-500">
                    Click 'Generate AI Suggestions' to get 3-5 prompt ideas with similar but non-overlapping intent to your input.
                  </div>
                ) : (
                  <div className="space-y-3">
                    <div className="flex items-center justify-between mb-2">
                      <p className="text-xs text-gray-600">
                        Select up to {MAX_SELECTED_PROMPTS} prompts ({acceptedPrompts.length}/{MAX_SELECTED_PROMPTS} selected)
                      </p>
                      {acceptedPrompts.length >= MAX_SELECTED_PROMPTS && (
                        <p className="text-xs text-orange-600 font-medium">
                          Maximum reached
                        </p>
                      )}
                    </div>
                    <div className="space-y-2 max-h-[600px] overflow-y-auto">
                      {aiSuggestions.map((suggestion) => {
                        const isSelected = acceptedPrompts.some(p => p.id === suggestion.id || p.text === suggestion.text);
                        return (
                          <label
                            key={suggestion.id}
                            className={`flex items-start gap-3 p-3 border rounded-lg cursor-pointer transition-colors ${
                              isSelected 
                                ? 'border-purple-500 bg-purple-50' 
                                : 'border-gray-200 bg-white hover:bg-gray-50'
                            }`}
                          >
                            <input
                              type="checkbox"
                              checked={isSelected}
                              onChange={() => handleToggleSuggestion(suggestion)}
                              disabled={!isSelected && acceptedPrompts.length >= MAX_SELECTED_PROMPTS}
                              className="mt-1 w-4 h-4 text-purple-600 border-gray-300 rounded focus:ring-purple-500 disabled:opacity-50 disabled:cursor-not-allowed"
                            />
                            <div className="flex-1">
                              <p className="text-sm text-gray-900 mb-1">
                                {typeof suggestion.text === 'string' ? suggestion.text : String(suggestion.text || '')}
                              </p>
                              {suggestion.relevanceScore !== undefined && (
                                <p className="text-xs text-gray-500">
                                  Relevance: {suggestion.relevanceScore}
                                </p>
                              )}
                            </div>
                          </label>
                        );
                      })}
                    </div>
                  </div>
                )}
              </div>
            </div>
          </div>
        </div>
      );
    },
  },
};

export default researchPrompts;
