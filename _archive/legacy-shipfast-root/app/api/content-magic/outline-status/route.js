import { NextResponse } from 'next/server';
import { createClient } from '@/libs/supabase/server';
import { initMonkey } from '@/libs/monkey';
import { findResultHtmlFile } from '@/libs/content-magic/outlineAssembly';
import { decideRenderingStatus, toMs } from '@/libs/content-magic/utils/decideRenderingStatus';

const STUCK_QUEUED_THRESHOLD_MS = 60_000; // kick if queued for >60s
const MAX_SEND_ATTEMPTS = 3;

const LOG = '[outline-status]';
function logDecision(step, detail = {}) {
  console.log(LOG, step, detail);
}

/** Response outline when status is 'rendering' — strip files/content so client never shows previous version. */
function outlineForRendering(outline) {
  return { ...outline, files: [], content_html: undefined };
}

/**
 * Outline status check.
 *
 * chatIdCheckOnly mode (body.chatIdCheckOnly = true):
 *   Lightweight DB-only read. Returns { chatId, status } immediately.
 *   Used by the client during the init-polling phase to confirm chatId was saved.
 *
 * Normal mode:
 *   - If status is 'queued' and stuck (queued_at > STUCK_QUEUED_THRESHOLD_MS ago)
 *     and attempt_count < MAX_SEND_ATTEMPTS: re-fires sendMessage as a recovery kick.
 *   - If status is 'rendering' or 'failed' and chatId exists: fetches v0 for results.
 *   - If status is 'completed' but files missing: re-fetches v0.
 */
export async function POST(request) {
  try {
    const body = await request.json().catch(() => ({}));
    const { articleId, chatIdCheckOnly = false, initialCheck = false } = body;

    if (!articleId) {
      return NextResponse.json({ error: 'articleId is required' }, { status: 400 });
    }

    const supabase = await createClient();
    const { data: { user }, error: authError } = await supabase.auth.getUser();
    if (authError || !user) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
    }

    const { data: article, error: articleError } = await supabase
      .from('content_magic_articles')
      .select('outline')
      .eq('id', articleId)
      .eq('user_id', user.id)
      .single();

    if (articleError || !article) {
      return NextResponse.json({ error: 'Article not found' }, { status: 404 });
    }

    const outline = article.outline || {};

    logDecision('request', {
      articleId,
      chatIdCheckOnly,
      initialCheck,
      dbStatus: outline.status ?? 'none',
      chatId: outline.chatId ? `${String(outline.chatId).slice(0, 8)}…` : null,
    });

    // ── chatIdCheckOnly: pure DB read, no v0 calls ──────────────────────────
    if (chatIdCheckOnly) {
      logDecision('exit', {
        path: 'chatIdCheckOnly',
        v0Pull: false,
        reason: 'DB-only mode for client chatId confirmation',
      });
      return NextResponse.json({
        chatId: outline.chatId || null,
        status: outline.status || 'none',
      });
    }

    // ── Stuck-queued kick ───────────────────────────────────────────────────
    // If status is 'queued' (chatId saved but sendMessage never fired) and the
    // job has been sitting for longer than the threshold, retry sendMessage here.
    if (outline.status === 'queued' && outline.chatId) {
      const queuedAt = outline.queued_at ? new Date(outline.queued_at).getTime() : 0;
      const ageMs = Date.now() - queuedAt;
      const attemptCount = outline.attempt_count ?? 0;

      logDecision('branch_queued', {
        ageMs,
        stuckThresholdMs: STUCK_QUEUED_THRESHOLD_MS,
        attemptCount,
        willStuckKick: ageMs > STUCK_QUEUED_THRESHOLD_MS && attemptCount < MAX_SEND_ATTEMPTS,
      });

      if (ageMs > STUCK_QUEUED_THRESHOLD_MS && attemptCount < MAX_SEND_ATTEMPTS) {
        logDecision('stuck_kick', {
          v0Call: 'v0SendMessage',
          note: 'Recovery: queued too long, sending prompt to v0',
        });
        // Mark as sending + increment attempt count
        const sendingOutline = {
          ...outline,
          status: 'sending',
          send_started_at: new Date().toISOString(),
          attempt_count: attemptCount + 1,
        };
        await supabase
          .from('content_magic_articles')
          .update({ outline: sendingOutline })
          .eq('id', articleId)
          .eq('user_id', user.id);

        try {
          const monkey = await initMonkey();
          monkey.loadUserContext({ ...(body?.user_context ?? {}), userId: user.id });
          const prompt = outline.prompt || '';
          const sendResult = await monkey.v0SendMessage(outline.chatId, prompt);

          if (sendResult.success) {
            await supabase
              .from('content_magic_articles')
              .update({ outline: { ...sendingOutline, status: 'rendering', send_finished_at: new Date().toISOString() } })
              .eq('id', articleId)
              .eq('user_id', user.id);
            logDecision('exit', {
              path: 'stuck_kick_success',
              v0Pull: false,
              v0Send: true,
              responseStatus: 'rendering',
            });
            return NextResponse.json({ status: 'rendering', outline: outlineForRendering({ ...sendingOutline, status: 'rendering' }) });
          } else {
            const errOutline = {
              ...sendingOutline,
              status: attemptCount + 1 >= MAX_SEND_ATTEMPTS ? 'failed' : 'queued',
              last_error: sendResult.error,
              last_error_at: new Date().toISOString(),
              queued_at: new Date().toISOString(), // reset timer for next attempt
            };
            await supabase
              .from('content_magic_articles')
              .update({ outline: errOutline })
              .eq('id', articleId)
              .eq('user_id', user.id);
            logDecision('exit', {
              path: 'stuck_kick_send_failed',
              v0Pull: false,
              v0Send: true,
              responseStatus: errOutline.status,
            });
            return NextResponse.json({ status: errOutline.status, outline: errOutline });
          }
        } catch (kickErr) {
          const failedOutline = {
            ...sendingOutline,
            status: 'failed',
            last_error: kickErr?.message || 'stuck-kick failed',
            last_error_at: new Date().toISOString(),
          };
          await supabase
            .from('content_magic_articles')
            .update({ outline: failedOutline })
            .eq('id', articleId)
            .eq('user_id', user.id);
          logDecision('exit', {
            path: 'stuck_kick_exception',
            v0Pull: false,
            v0Send: true,
            responseStatus: 'failed',
          });
          return NextResponse.json({ status: 'failed', outline: failedOutline });
        }
      }

      if (attemptCount >= MAX_SEND_ATTEMPTS) {
        // Exhausted retries — mark permanently failed
        const failedOutline = { ...outline, status: 'failed', last_error: 'Max sendMessage attempts reached' };
        await supabase
          .from('content_magic_articles')
          .update({ outline: failedOutline })
          .eq('id', articleId)
          .eq('user_id', user.id);
        logDecision('exit', {
          path: 'queued_max_attempts',
          v0Pull: false,
          v0Send: false,
          responseStatus: 'failed',
        });
        return NextResponse.json({ status: 'failed', outline: failedOutline });
      }

      // Still queued but within threshold — just return current state
      logDecision('exit', {
        path: 'queued_no_pull_yet',
        v0Pull: false,
        v0Send: false,
        reason: 'Within stuck threshold or waiting for background sendMessage',
        responseStatus: 'queued',
      });
      return NextResponse.json({ status: 'queued', outline });
    }

    // ── Determine whether to pull from v0 ────────────────────────────────────
    // Treat 'sending' and 'rendering' the same as the old 'rendering' — both mean
    // v0 is working on it and we should poll for results.
    let needsPull = false;
    let needsPullReason = 'no_chatId';
    if (outline.chatId) {
      if (outline.status === 'rendering' || outline.status === 'sending' || outline.status === 'failed') {
        needsPull = true;
        needsPullReason =
          outline.status === 'sending'
            ? 'status_sending_or_rendering_failed → poll v0 for progress/result'
            : `status_${outline.status}_→ poll v0`;
      } else if (outline.status === 'completed') {
        const hasIndexHtml = Array.isArray(outline.files)
          ? outline.files.some(f => f?.name === 'index.html')
          : false;
        if (!hasIndexHtml || initialCheck) {
          needsPull = true;
          needsPullReason = !hasIndexHtml
            ? 'completed_but_missing_index_html'
            : 'initialCheck_force_pull';
        } else {
          needsPullReason = 'completed_with_index_html_no_pull';
        }
      } else {
        needsPullReason = `status_${outline.status || 'none'}_no_v0_pull_rule`;
      }
    }

    logDecision('needsPull_decision', {
      needsPull,
      needsPullReason,
      dbStatus: outline.status,
    });

    if (!needsPull) {
      logDecision('exit', {
        path: 'no_v0_pull',
        v0Pull: false,
        v0GetChatRaw: false,
        responseStatus: outline.status || 'none',
        note: 'Returning DB outline as-is (no v0GetChatRaw)',
      });
      return NextResponse.json({ status: outline.status || 'none', outline });
    }

    // ── Fetch v0 for results (raw chat for decideRenderingStatus) ──────────────
    logDecision('v0GetChatRaw_start', {
      chatId: String(outline.chatId).slice(0, 12) + '…',
    });
    const monkey = await initMonkey();
    monkey.loadUserContext({ ...(body?.user_context ?? {}), userId: user.id });
    const rawResult = await monkey.v0GetChatRaw(outline.chatId);
    logDecision('v0GetChatRaw_done', {
      success: rawResult.success,
      error: rawResult.success ? undefined : String(rawResult.error || '').slice(0, 200),
    });

    if (!rawResult.success) {
      const isHardError = (rawResult.error && (
        String(rawResult.error).includes('404') ||
        String(rawResult.error).toLowerCase().includes('not found') ||
        String(rawResult.error).includes('Unauthorized')
      ));
      if (isHardError) {
        const failedOutline = {
          ...outline,
          status: 'failed',
          last_error: rawResult.error,
          last_error_at: new Date().toISOString(),
        };
        await supabase
          .from('content_magic_articles')
          .update({ outline: failedOutline })
          .eq('id', articleId)
          .eq('user_id', user.id);
        logDecision('exit', {
          path: 'v0GetChatRaw_hard_error',
          v0Pull: true,
          responseStatus: 'failed',
        });
        return NextResponse.json({ status: 'failed', outline: failedOutline });
      }
      logDecision('exit', {
        path: 'v0GetChatRaw_transient',
        v0Pull: true,
        responseStatus: 'rendering',
        reason: 'v0_fetch_transient_error',
      });
      return NextResponse.json({ status: 'rendering', outline: outlineForRendering(outline), reason: 'v0_fetch_transient_error' });
    }

    const raw = rawResult.raw;

    // Stale detection: if feedbackSubmittedAt exists, ensure v0 response is newer (normalize to ms)
    const v0UpdatedMs = toMs(raw?.latestVersion?.updatedAt);
    if (outline.feedbackSubmittedAt) {
      const feedbackMs = toMs(outline.feedbackSubmittedAt);
      if (!isNaN(v0UpdatedMs) && !isNaN(feedbackMs) && v0UpdatedMs < feedbackMs) {
        logDecision('exit', {
          path: 'v0_stale_vs_feedback',
          v0Pull: true,
          responseStatus: 'rendering',
          reason: 'v0_response_predates_feedback',
        });
        return NextResponse.json({ status: 'rendering', outline: outlineForRendering(outline), reason: 'v0_response_predates_feedback' });
      }
    }
    // If lastImproveStartedAt exists, v0 response must be from this improvement round
    if (outline.lastImproveStartedAt && !isNaN(v0UpdatedMs)) {
      const improveMs = toMs(outline.lastImproveStartedAt);
      if (!isNaN(improveMs) && v0UpdatedMs < improveMs) {
        logDecision('exit', {
          path: 'v0_stale_vs_improve',
          v0Pull: true,
          responseStatus: 'rendering',
          reason: 'v0_response_predates_improvement',
        });
        return NextResponse.json({
          status: 'rendering',
          outline: outlineForRendering(outline),
          reason: 'v0_response_predates_improvement',
        });
      }
    }

    const attemptStartedAtMs = outline.retryStartedAt
      ? new Date(outline.retryStartedAt).getTime()
      : undefined;
    // When latestVersion is missing, we need "initiated" time to decide pending vs fail (past time limit).
    const initiatedAtMs = attemptStartedAtMs
      ?? (outline.send_finished_at ? new Date(outline.send_finished_at).getTime() : undefined)
      ?? (outline.startedAt ? new Date(outline.startedAt).getTime() : undefined);
    const { status: renderingStatus, reason } = decideRenderingStatus(raw, { attemptStartedAtMs, initiatedAtMs });

    if (renderingStatus === 'Rendering') {
      logDecision('exit', {
        path: 'decideRenderingStatus_still_rendering',
        v0Pull: true,
        responseStatus: 'rendering',
        decideReason: reason,
      });
      return NextResponse.json({ status: 'rendering', outline: outlineForRendering(outline), reason });
    }

    if (renderingStatus === 'Failed') {
      const failedOutline = {
        ...outline,
        status: 'failed',
        last_error: reason,
        last_error_at: new Date().toISOString(),
      };
      await supabase
        .from('content_magic_articles')
        .update({ outline: failedOutline })
        .eq('id', articleId)
        .eq('user_id', user.id);
      logDecision('exit', {
        path: 'decideRenderingStatus_failed',
        v0Pull: true,
        responseStatus: 'failed',
        decideReason: reason,
      });
      return NextResponse.json({ status: 'failed', outline: failedOutline, reason });
    }

    if (renderingStatus === 'Completed') {
      const rawFiles = raw.latestVersion?.files || [];
      const files = rawFiles.map((f) => ({
        name: f?.name ?? f?.meta?.file ?? 'unnamed',
        content: f?.source ?? f?.content ?? f?.code ?? '',
      }));

      let content_html = null;
      const resultHtml = findResultHtmlFile(files);
      if (resultHtml?.content) {
        content_html = resultHtml.content;
      } else {
        const pageTsx = files.find((f) => f.name === 'app/page.tsx');
        if (pageTsx?.content) content_html = pageTsx.content;
      }
      if (!content_html) {
        
      }

      const chatId = outline.chatId;
      const demoUrl = `https://v0.dev/chat/${chatId}`;
      const completedAt = new Date().toISOString();
      // Generation time = latestVersion.updatedAt − latestVersion.createdAt
      const version = raw.latestVersion;
      const createdMs = version?.createdAt ? new Date(version.createdAt).getTime() : NaN;
      const updatedMs = version?.updatedAt ? new Date(version.updatedAt).getTime() : NaN;
      let generationTime;
      if (!isNaN(createdMs) && !isNaN(updatedMs) && updatedMs >= createdMs) {
        const elapsedSec = ((updatedMs - createdMs) / 1000).toFixed(1);
        generationTime = `${elapsedSec}s`;
      } else {
        const startMs = outline.startedAt ? new Date(outline.startedAt).getTime() : Date.now();
        const elapsedSec = ((Date.now() - startMs) / 1000).toFixed(1);
        generationTime = `${elapsedSec}s`;
      }
      const completedOutline = {
        ...outline,
        status: 'completed',
        chatId,
        demoUrl,
        content_html,
        files,
        completedAt,
        generationTime,
      };

      const { error: updateError } = await supabase
        .from('content_magic_articles')
        .update({ outline: completedOutline })
        .eq('id', articleId)
        .eq('user_id', user.id);

      if (updateError) {
        logDecision('exit', {
          path: 'completed_db_update_failed',
          v0Pull: true,
          responseStatus: 'rendering',
        });
        return NextResponse.json({ status: 'rendering', outline: outlineForRendering(outline) });
      }

      logDecision('exit', {
        path: 'completed',
        v0Pull: true,
        responseStatus: 'completed',
        hasContentHtml: Boolean(content_html),
      });
      return NextResponse.json({ status: 'completed', outline: completedOutline });
    }

    // Fallback (should not reach)
    logDecision('exit', {
      path: 'fallback',
      v0Pull: true,
      responseStatus: outline.status || 'rendering',
    });
    return NextResponse.json({ status: outline.status || 'rendering', outline: outlineForRendering(outline) });

  } catch (error) {
    logDecision('exit', {
      path: 'exception',
      error: error?.message,
      status: 500,
    });
    return NextResponse.json(
      { error: error.message || 'Failed to check outline status' },
      { status: 500 }
    );
  }
}
