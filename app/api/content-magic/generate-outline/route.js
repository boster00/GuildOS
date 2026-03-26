import { NextResponse, after } from 'next/server';
import { createClient } from '@/libs/supabase/server';
import { initMonkey } from '@/libs/monkey';
import { finishExternalRequest } from '@/libs/monkey/tools/external_requests';
import { assembleInlinePrompt, buildFilesAndShortPrompt } from '@/libs/content-magic/outlineAssembly';

// Allow background task (after()) to outlive the HTTP response
export const maxDuration = 300;

export async function POST(request) {
  const externalRequestId = request.headers.get("x-external-request-id") ?? null;
  const startTime = Date.now();
  try {
    const body = await request.json();
    const { 
      articleId, 
      mode = 'generate', // 'generate' | 'improve'
      userPrompt, 
      contextPrompt, 
      competitorUrls = [],
      competitorContents = [],
      selectedAssets = [],
      useCustomTemplates = false,
      allowGeneratingCustomCss = false,
      allowImageGeneration = false,
      fileMode = true,
      // Improve mode only
      improvementInstructions,
      currentPageContent,
      improveCoverageOption,
      // Idempotency: client sends a stable UUID per submission attempt
      request_id = null,
    } = body;

    if (!articleId) {
      return NextResponse.json({ error: 'articleId is required' }, { status: 400 });
    }
    if (mode === 'generate' && !userPrompt) {
      return NextResponse.json({ error: 'articleId and userPrompt are required' }, { status: 400 });
    }
    if (mode === 'improve') {
      const trimmed = (improvementInstructions || '').trim();
      if (!trimmed) {
        return NextResponse.json({ error: 'improvementInstructions is required for improve mode' }, { status: 400 });
      }
      if (!currentPageContent || String(currentPageContent).trim().length < 50) {
        return NextResponse.json({ error: 'currentPageContent is required (article must have content to improve)' }, { status: 400 });
      }
    }

    if (!process.env.V0_API_KEY) {
      return NextResponse.json({ 
        error: 'API key not configured',
        message: 'Please contact support to enable outline generation.'
      }, { status: 500 });
    }

    const supabase = await createClient();
    const { data: { user }, error: authError } = await supabase.auth.getUser();
    if (authError || !user) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
    }

    // Verify article belongs to user and fetch current outline
    const { data: article, error: articleError } = await supabase
      .from('content_magic_articles')
      .select('id, outline')
      .eq('id', articleId)
      .eq('user_id', user.id)
      .single();

    if (articleError || !article) {
      return NextResponse.json({ error: 'Article not found' }, { status: 404 });
    }

    const existingOutline = article.outline || {};

    // Block overlapping generate jobs (double-submit). Client keeps buttons disabled while in progress.
    if (
      mode === 'generate' &&
      ['queued', 'sending', 'rendering'].includes(existingOutline.status)
    ) {
      await finishExternalRequest(supabase, {
        externalRequestId,
        status: 'success',
        responsePreview: JSON.stringify({ blocked: true }),
        latencyMs: Date.now() - startTime,
      });
      return NextResponse.json(
        {
          error:
            'A draft session is already in progress. Wait for it to finish, then generate again.',
        },
        { status: 409 }
      );
    }

    // Load custom templates and CSS when useCustomTemplates is true
    let customTemplates = [];
    let customCss = '';
    let cssClassReferences = '';
    if (useCustomTemplates && user.id) {
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

    // Assemble prompt (inline mode) or prompt + files (file mode)
    const assemblyParams = {
      userPrompt: userPrompt || '',
      contextPrompt: contextPrompt || '',
      competitorUrls: competitorUrls || [],
      competitorContents: competitorContents || [],
      allowImageGeneration: !!allowImageGeneration,
      allowGeneratingCustomCss: Boolean(useCustomTemplates && allowGeneratingCustomCss),
      useCustomTemplates: !!useCustomTemplates,
      customTemplates,
      customCss,
      cssClassReferences,
      improvementInstructions: (improvementInstructions || '').trim(),
      currentPageContent: mode === 'improve' ? (currentPageContent || '') : '',
      improveCoverageOption: improveCoverageOption || 'instructions_only',
    };

    let capturedPrompt;
    let capturedFiles = null;

    if (fileMode) {
      const { prompt, files } = buildFilesAndShortPrompt(mode, assemblyParams);
      capturedPrompt = prompt;
      capturedFiles = files;
    } else {
      capturedPrompt = assembleInlinePrompt(mode, assemblyParams);
    }

    // ── Write initial "queued" status to DB ──────────────────────────────────
    // Status = queued: chatId not yet assigned. prompt stored for stuck-kick retries.
    const startedAt = new Date().toISOString();
    const queuedOutline = {
      status: 'queued',
      startedAt,
      queued_at: startedAt,
      attempt_count: 0,
      mode,
      fileMode: !!fileMode,
      prompt: mode === 'improve' ? (improvementInstructions || '').trim() : userPrompt,
      contextPrompt: contextPrompt,
      selectedCompetitors: competitorUrls,
      selectedAssets: selectedAssets,
      ...(request_id && { request_id }),
      ...(mode === 'improve' && {
        improvementInstructions: (improvementInstructions || '').trim(),
        improveCoverageOption: improveCoverageOption || 'instructions_only'
      })
    };

    const { error: queuedWriteError } = await supabase
      .from('content_magic_articles')
      .update({ outline: queuedOutline })
      .eq('id', articleId)
      .eq('user_id', user.id);

    if (queuedWriteError) {

      return NextResponse.json({ error: 'Failed to update article status', details: queuedWriteError.message }, { status: 500 });
    }

    // ── Init v0 chat (fast — just creates the session, no generation yet) ────
    const monkey = await initMonkey();
    monkey.loadUserContext({ ...(body?.user_context ?? {}), userId: user.id });

    let chatId;
    let sendMessageFn;

    if (capturedFiles) {
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
        await finishExternalRequest(supabase, {
          externalRequestId,
          status: "failed",
          errorMessage: createResult.error || "v0 chat init failed",
          latencyMs: Date.now() - startTime,
        });
        return NextResponse.json({ error: createResult.error || 'v0 chat init failed' }, { status: 500 });
      }

      chatId = createResult.chatId;
      sendMessageFn = createResult.sendMessage;
    } else {
      // Inline (non-file) mode: v0CreateChat does not support returnAfterInit yet; fall back to full await
      const createResult = await monkey.v0CreateChat(capturedPrompt, { userId: user.id });
      if (!createResult.success || !createResult.chatId) {
        
        await supabase
          .from('content_magic_articles')
          .update({ outline: { ...queuedOutline, status: 'failed', last_error: createResult.error || 'v0 chat creation failed', last_error_at: new Date().toISOString() } })
          .eq('id', articleId)
          .eq('user_id', user.id);
        await finishExternalRequest(supabase, {
          externalRequestId,
          status: "failed",
          errorMessage: createResult.error || "v0 chat creation failed",
          latencyMs: Date.now() - startTime,
        });
        return NextResponse.json({ error: createResult.error || 'v0 chat creation failed' }, { status: 500 });
      }
      chatId = createResult.chatId;
      sendMessageFn = null; // already sent in v0CreateChat
    }

    // ── Atomic DB write: set chatId only if still null ────────────────────────
    // Guards against duplicate submissions winning the same outline slot.
    const outlineWithChatId = {
      ...queuedOutline,
      chatId: String(chatId),
      // Keep status queued until sendMessage fires (background task will update to sending/rendering)
    };

    const { data: rpcResult, error: rpcError } = await supabase.rpc('set_outline_chat_id_if_null', {
      p_article_id: articleId,
      p_user_id: user.id,
      p_outline_patch: outlineWithChatId,
    });

    if (rpcError) {
      // RPC failed — fall back to a direct update

      await supabase
        .from('content_magic_articles')
        .update({ outline: outlineWithChatId })
        .eq('id', articleId)
        .eq('user_id', user.id);
    } else {
      // If the RPC returned an outline that already had a chatId, use that one
      const returnedChatId = rpcResult?.chatId;
      if (returnedChatId && returnedChatId !== chatId) {
        chatId = returnedChatId;
        // Don't fire sendMessage for the existing session
        sendMessageFn = null;
      }
    }

    await finishExternalRequest(supabase, {
      externalRequestId,
      status: "success",
      responsePreview: JSON.stringify({ chatId }),
      latencyMs: Date.now() - startTime,
    });

    // ── Schedule sendMessage as a background task ─────────────────────────────
    // after() runs after the HTTP response is sent. If the platform reclaims the
    // function before it fires, the stuck-kick in outline-status serves as fallback.
    if (typeof sendMessageFn === 'function') {
      after(async () => {
        try {

          // Mark as sending
          await supabase
            .from('content_magic_articles')
            .update({
              outline: {
                ...outlineWithChatId,
                chatId: String(chatId),
                status: 'sending',
                send_started_at: new Date().toISOString(),
                attempt_count: (outlineWithChatId.attempt_count ?? 0) + 1,
              }
            })
            .eq('id', articleId)
            .eq('user_id', user.id);

          await sendMessageFn({
            onError: async (err) => {

              await supabase
                .from('content_magic_articles')
                .update({
                  outline: {
                    ...outlineWithChatId,
                    chatId: String(chatId),
                    status: 'failed',
                    last_error: err?.message || 'sendMessage failed',
                    last_error_at: new Date().toISOString(),
                  }
                })
                .eq('id', articleId)
                .eq('user_id', user.id);
            }
          });

          // sendMessage succeeded — v0 is now generating
          await supabase
            .from('content_magic_articles')
            .update({
              outline: {
                ...outlineWithChatId,
                chatId: String(chatId),
                status: 'rendering',
                send_finished_at: new Date().toISOString(),
              }
            })
            .eq('id', articleId)
            .eq('user_id', user.id);

        } catch (bgErr) {

          await supabase
            .from('content_magic_articles')
            .update({
              outline: {
                ...outlineWithChatId,
                chatId: String(chatId),
                status: 'failed',
                last_error: bgErr?.message || 'background task failed',
                last_error_at: new Date().toISOString(),
              }
            })
            .eq('id', articleId)
            .eq('user_id', user.id)
            .catch(() => {});
        }
      });
    } else if (chatId) {
      // sendMessage already completed (inline mode or race winner reuse) — set to rendering
      await supabase
        .from('content_magic_articles')
        .update({ outline: { ...outlineWithChatId, chatId: String(chatId), status: 'rendering', send_finished_at: new Date().toISOString() } })
        .eq('id', articleId)
        .eq('user_id', user.id);
    }

    return NextResponse.json({
      success: true,
      status: 'queued',
      chatId: String(chatId),
      message: 'Page writing task initiated. Polling for confirmation.',
    });

  } catch (error) {

    return NextResponse.json({ 
      error: error.message || 'Failed to start outline generation',
      details: error.toString()
    }, { status: 500 });
  }
}
