import { NextResponse, after } from 'next/server';
import { createClient } from '@/libs/supabase/server';
import { initMonkey } from '@/libs/monkey';
import { assembleInlinePrompt, buildFilesAndShortPrompt } from '@/libs/content-magic/outlineAssembly';
import { buildKeywordEvaluationPrompts, buildKeywordRetryPrompt, parseKeywordEvaluationResponse } from '@/libs/content-magic/utils/buildKeywordEvaluationPrompt';
import AI_MODELS from '@/config/ai-models';

export const maxDuration = 120;

// ── URL helpers ──────────────────────────────────────────────────────────────

function getOrigin() {
  if (process.env.SITE_URL) return process.env.SITE_URL;
  if (process.env.NEXTAUTH_URL) return process.env.NEXTAUTH_URL;
  if (process.env.NEXT_PUBLIC_SITE_URL) return process.env.NEXT_PUBLIC_SITE_URL;
  if (process.env.VERCEL_URL) return `https://${process.env.VERCEL_URL}`;
  return 'http://localhost:3000';
}

async function internalPost(path, body) {
  const url = `${getOrigin()}${path}`;
  const res = await fetch(url, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify(body),
  });
  const data = await res.json();
  if (!res.ok) {
    throw new Error(data?.error || `${path} failed (${res.status})`);
  }
  return data;
}

// ── Step 1: competitors + topics ─────────────────────────────────────────────

async function runStep1({ articleId, mainKeyword, supabase, topicCount, maxCompetitors }) {
  // 1a. Search for competitor URLs
  const searchData = await internalPost('/api/content-magic/search', {
    query: mainKeyword,
    maxResults: maxCompetitors,
  });
  const urls = (searchData.results || []).map(r => r.url).filter(Boolean).slice(0, maxCompetitors);
  if (urls.length === 0) throw new Error('No competitor URLs found for keyword');

  // 1b. Crawl all competitor pages in parallel (best-effort)
  const crawlSettled = await Promise.allSettled(
    urls.map(url => internalPost('/api/content-magic/crawl', { url }))
  );
  const crawledPages = crawlSettled
    .map((r, i) => {
      if (r.status !== 'fulfilled') return null;
      const d = r.value;
      return {
        url: urls[i],
        title: d.title || urls[i],
        content: d.content_html || d.content || '',
      };
    })
    .filter(p => p && p.content.length > 100);

  if (crawledPages.length < 2) {
    throw new Error(`Only ${crawledPages.length} page(s) crawled successfully (minimum 2 required)`);
  }

  // 1c. Benchmark topics
  const benchmarkData = await internalPost('/api/content-magic/benchmark', {
    pages: crawledPages.map(p => ({ url: p.url, title: p.title, content: p.content })),
    assetType: 'key_topics',
    topicGranularity: topicCount,
  });

  const topics = benchmarkData.assets?.topics || [];

  // 1d. Persist via merge_article_assets RPC (inline, same Supabase client)
  await supabase.rpc('merge_article_assets', {
    article_id: articleId,
    patch_data: {
      main_keyword: mainKeyword,
      topics,
      // Store lightweight version (no full HTML) for record-keeping
      competitorPages: crawledPages.map(p => ({
        url: p.url,
        title: p.title,
        savedAt: new Date().toISOString(),
      })),
    },
  });

  return { topics, crawledPages, competitorUrls: urls };
}

// ── Step 2a: vertical keyword research (runs in parallel with step 1) ─────────

async function runVerticalKeywords(mainKeyword) {
  const data = await internalPost('/api/dataforseo/related-keywords', {
    keywords: [mainKeyword],
    limit: 50,
  });
  return (data.candidates || []).map(c => ({
    keyword: c.keyword,
    search_volume: c.volume ?? null,
  }));
}

// ── Step 2b: horizontal keywords + AI evaluate (after step 1 resolves) ────────

async function runStep2Finalize({ articleId, mainKeyword, title, supabase, step1Value, verticalCandidates }) {
  let allCandidates = [...(verticalCandidates || [])];

  // Horizontal keywords using competitor URLs from step 1 (if available)
  if (step1Value?.competitorUrls?.length > 0) {
    const horizontalUrls = step1Value.competitorUrls.slice(0, 2);
    try {
      const rankData = await internalPost('/api/dataforseo/ranking-keywords', {
        urls: horizontalUrls,
        limit: 50,
      });
      const horizontal = (rankData.results || []).flatMap(r =>
        (r.keywords || []).map(kw => ({
          keyword: kw.keyword || kw.keyword_text || '',
          search_volume: kw.search_volume ?? null,
        }))
      ).filter(c => c.keyword);
      allCandidates = [...allCandidates, ...horizontal];
    } catch {
      // Horizontal fails gracefully; proceed with vertical only
    }
  }

  // Deduplicate by keyword text (case-insensitive)
  const seen = new Set();
  const uniqueCandidates = allCandidates.filter(c => {
    const k = c.keyword?.toLowerCase().trim();
    if (!k || seen.has(k)) return false;
    seen.add(k);
    return true;
  });

  if (uniqueCandidates.length === 0) {
    throw new Error('No keyword candidates found');
  }

  // AI evaluate — batched
  const keywordModel = AI_MODELS.LARGE_CONTEXT || AI_MODELS.ADVANCED || AI_MODELS.STANDARD;
  const prompts = buildKeywordEvaluationPrompts({
    offer: title,
    candidates: uniqueCandidates,
  });

  let allResults = [];
  for (const prompt of prompts) {
    let batchResults = [];
    for (let attempt = 0; attempt < 2; attempt++) {
      try {
        const aiData = await internalPost('/api/ai', { query: prompt, model: keywordModel });
        const aiText = aiData.response || aiData.result || aiData.message || '';
        batchResults = parseKeywordEvaluationResponse(aiText);
        if (batchResults.length > 0) break;
      } catch {
        if (attempt === 1) throw new Error('Keyword AI evaluation failed after 2 attempts');
        await new Promise(r => setTimeout(r, 1000));
      }
    }
    allResults = allResults.concat(batchResults);
  }

  // Retry missing keywords (best-effort)
  const resultSet = new Set(allResults.map(r => r.keyword?.toLowerCase()));
  const missingKeywords = uniqueCandidates
    .map(c => c.keyword)
    .filter(k => k && !resultSet.has(k.toLowerCase()));

  if (missingKeywords.length > 0) {
    try {
      const retryPrompt = buildKeywordRetryPrompt({ offer: title, missingKeywords });
      const retryData = await internalPost('/api/ai', { query: retryPrompt, model: keywordModel });
      const retryText = retryData.response || retryData.result || retryData.message || '';
      const retryResults = parseKeywordEvaluationResponse(retryText);
      allResults = allResults.concat(retryResults);
    } catch {
      // Retry fails silently
    }
  }

  // Build final keyword list (included ones only)
  const finalKeywords = allResults
    .filter(r => r.include)
    .map(r => ({
      keyword: r.keyword,
      keyword_text: r.keyword,
      note: r.note || '',
      search_volume: uniqueCandidates.find(c => c.keyword.toLowerCase() === r.keyword.toLowerCase())?.search_volume || null,
    }));

  // Persist
  await supabase.rpc('merge_article_assets', {
    article_id: articleId,
    patch_data: { keywords: finalKeywords },
  });

  return { keywords: finalKeywords };
}

// ── Build userPrompt for generate-outline (mirrors createOutline ASSET_CONFIGS) ─

function buildUserPrompt({ title, mainKeyword, topics, keywords }) {
  const parts = [`Write a comprehensive, well-structured article page.\n\nTitle: ${title}\n`];

  if (mainKeyword) {
    parts.push(`Main Keyword: ${mainKeyword}\n`);
  }

  if (Array.isArray(topics) && topics.length > 0) {
    parts.push(`Topics to Cover:\n${topics.map(t => {
      const text = (typeof t === 'string') ? t : (t.topic || t.label || t.title || '');
      return text ? `- ${text}` : null;
    }).filter(Boolean).join('\n')}\n`);
  }

  if (Array.isArray(keywords) && keywords.length > 0) {
    parts.push(`Keywords to Incorporate:\n${keywords.map(kw => {
      const text = kw.keyword_text || kw.keyword || '';
      return text ? `- ${text}` : null;
    }).filter(Boolean).join('\n')}\n`);
  }

  return parts.join('\n');
}

// ── Main route ────────────────────────────────────────────────────────────────

export async function POST(request) {
  const startTime = Date.now();
  try {
    const body = await request.json();
    const {
      title,
      mainKeyword,
      topicCount = 12,
      maxCompetitors = 5,
      useCustomTemplates = true,
    } = body;

    if (!title?.trim()) {
      return NextResponse.json({ error: 'title is required' }, { status: 400 });
    }
    if (!mainKeyword?.trim()) {
      return NextResponse.json({ error: 'mainKeyword is required' }, { status: 400 });
    }

    const supabase = await createClient();
    const { data: { user }, error: authError } = await supabase.auth.getUser();
    if (authError || !user) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
    }

    // ── Step 0: Create article (inlined) ────────────────────────────────────
    const { data: articleData, error: createError } = await supabase
      .from('content_magic_articles')
      .insert({
        user_id: user.id,
        title: title.trim(),
        content_html: `<h1>${title.trim()}</h1>\n<p>Generating content...</p>`,
        type: 'other',
        status: 'draft',
        context: { createdAt: new Date().toISOString() },
      })
      .select('id')
      .single();

    if (createError || !articleData) {
      return NextResponse.json({ error: 'Failed to create article', details: createError?.message }, { status: 500 });
    }
    const articleId = articleData.id;

    // ── Steps 1 + 2a: run in parallel ────────────────────────────────────────
    const [step1Settled, verticalSettled] = await Promise.allSettled([
      runStep1({ articleId, mainKeyword: mainKeyword.trim(), supabase, topicCount, maxCompetitors }),
      runVerticalKeywords(mainKeyword.trim()),
    ]);

    const step1Value = step1Settled.status === 'fulfilled' ? step1Settled.value : null;
    const verticalCandidates = verticalSettled.status === 'fulfilled' ? verticalSettled.value : [];
    const step1Error = step1Settled.status === 'rejected' ? step1Settled.reason?.message : null;

    // ── Step 2b: horizontal + AI evaluate + persist ───────────────────────────
    let step2Value = null;
    let step2Error = null;
    try {
      step2Value = await runStep2Finalize({
        articleId,
        mainKeyword: mainKeyword.trim(),
        title: title.trim(),
        supabase,
        step1Value,
        verticalCandidates,
      });
    } catch (err) {
      step2Error = err?.message || String(err);
    }

    // ── Step 3: generate draft (inlined from generate-outline) ────────────────
    const topics = step1Value?.topics || [];
    const keywords = step2Value?.keywords || [];
    const userPrompt = buildUserPrompt({ title: title.trim(), mainKeyword: mainKeyword.trim(), topics, keywords });
    const competitorUrls = step1Value?.competitorUrls || [];
    const competitorContents = (step1Value?.crawledPages || []).map(p => p.content);

    // Load custom templates if requested
    let customTemplates = [];
    let customCss = '';
    let cssClassReferences = '';
    if (useCustomTemplates) {
      const { data: profile } = await supabase
        .from('profiles')
        .select('json')
        .eq('id', user.id)
        .single();
      const cust = profile?.json?.customizations;
      if (cust) {
        customCss = typeof cust.css === 'string' ? cust.css : '';
        cssClassReferences = cust?.css_class_references ?? '';
        if (cust.templates && typeof cust.templates === 'object') {
          customTemplates = Object.values(cust.templates)
            .filter(t => t && t.isCustom === true && t.html)
            .map(t => ({ name: t.name || t.id || 'template', html: t.html }));
        }
      }
    }

    const assemblyParams = {
      userPrompt,
      contextPrompt: '',
      competitorUrls,
      competitorContents,
      allowImageGeneration: false,
      allowGeneratingCustomCss: false,
      useCustomTemplates: !!useCustomTemplates,
      customTemplates,
      customCss,
      cssClassReferences,
    };

    const { prompt: capturedPrompt, files: capturedFiles } = buildFilesAndShortPrompt('generate', assemblyParams);

    // Write initial "queued" status to DB
    const startedAt = new Date().toISOString();
    const queuedOutline = {
      status: 'queued',
      startedAt,
      queued_at: startedAt,
      attempt_count: 0,
      mode: 'generate',
      fileMode: true,
      prompt: userPrompt,
      contextPrompt: '',
      selectedCompetitors: competitorUrls,
      selectedAssets: [],
    };

    const { error: queuedWriteError } = await supabase
      .from('content_magic_articles')
      .update({ outline: queuedOutline })
      .eq('id', articleId)
      .eq('user_id', user.id);

    if (queuedWriteError) {
      return NextResponse.json({ error: 'Failed to queue outline', details: queuedWriteError.message, articleId }, { status: 500 });
    }

    // Init v0 chat
    const monkey = await initMonkey();
    monkey.loadUserContext({ userId: user.id });

    let chatId;
    let sendMessageFn;

    const createResult = await monkey.v0CreateChatWithFiles(capturedPrompt, capturedFiles, {
      userId: user.id,
      returnAfterInit: true,
    });

    if (!createResult.success || !createResult.chatId) {
      await supabase
        .from('content_magic_articles')
        .update({ outline: { ...queuedOutline, status: 'failed', last_error: createResult.error || 'v0 chat init failed', last_error_at: new Date().toISOString() } })
        .eq('id', articleId)
        .eq('user_id', user.id);
      return NextResponse.json({ error: createResult.error || 'v0 chat init failed', articleId }, { status: 500 });
    }

    chatId = createResult.chatId;
    sendMessageFn = createResult.sendMessage;

    // Atomic DB write: set chatId only if still null
    const outlineWithChatId = { ...queuedOutline, chatId: String(chatId) };

    const { data: rpcResult, error: rpcError } = await supabase.rpc('set_outline_chat_id_if_null', {
      p_article_id: articleId,
      p_user_id: user.id,
      p_outline_patch: outlineWithChatId,
    });

    if (rpcError) {
      await supabase
        .from('content_magic_articles')
        .update({ outline: outlineWithChatId })
        .eq('id', articleId)
        .eq('user_id', user.id);
    } else {
      const returnedChatId = rpcResult?.chatId;
      if (returnedChatId && returnedChatId !== chatId) {
        chatId = returnedChatId;
        sendMessageFn = null;
      }
    }

    // Schedule sendMessage as background task
    if (typeof sendMessageFn === 'function') {
      after(async () => {
        try {
          await supabase
            .from('content_magic_articles')
            .update({ outline: { ...outlineWithChatId, chatId: String(chatId), status: 'sending', send_started_at: new Date().toISOString(), attempt_count: (outlineWithChatId.attempt_count ?? 0) + 1 } })
            .eq('id', articleId)
            .eq('user_id', user.id);

          await sendMessageFn({
            onError: async (err) => {
              await supabase
                .from('content_magic_articles')
                .update({ outline: { ...outlineWithChatId, chatId: String(chatId), status: 'failed', last_error: err?.message || 'sendMessage failed', last_error_at: new Date().toISOString() } })
                .eq('id', articleId)
                .eq('user_id', user.id)
                .catch(() => {});
            },
          });

          await supabase
            .from('content_magic_articles')
            .update({ outline: { ...outlineWithChatId, chatId: String(chatId), status: 'rendering', send_finished_at: new Date().toISOString() } })
            .eq('id', articleId)
            .eq('user_id', user.id);
        } catch (bgErr) {
          await supabase
            .from('content_magic_articles')
            .update({ outline: { ...outlineWithChatId, chatId: String(chatId), status: 'failed', last_error: bgErr?.message || 'background task failed', last_error_at: new Date().toISOString() } })
            .eq('id', articleId)
            .eq('user_id', user.id)
            .catch(() => {});
        }
      });
    } else if (chatId) {
      await supabase
        .from('content_magic_articles')
        .update({ outline: { ...outlineWithChatId, chatId: String(chatId), status: 'rendering', send_finished_at: new Date().toISOString() } })
        .eq('id', articleId)
        .eq('user_id', user.id);
    }

    return NextResponse.json({
      success: true,
      articleId,
      status: 'outline_queued',
      chatId: String(chatId),
      steps: {
        competitors: step1Value?.crawledPages?.length ?? 0,
        topics: topics.length,
        keywords: keywords.length,
        outline: 'queued',
        ...(step1Error ? { competitorsError: step1Error } : {}),
        ...(step2Error ? { keywordsError: step2Error } : {}),
      },
      elapsedMs: Date.now() - startTime,
    });

  } catch (error) {
    return NextResponse.json({
      error: error.message || 'Full auto run failed',
      details: error.toString(),
    }, { status: 500 });
  }
}
