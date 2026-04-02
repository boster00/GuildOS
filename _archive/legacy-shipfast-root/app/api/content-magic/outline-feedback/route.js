import { NextResponse } from 'next/server';
import { createClient } from '@/libs/supabase/server';
import { initMonkey } from '@/libs/monkey';
import { finishExternalRequest } from '@/libs/monkey/tools/external_requests';

async function processFeedbackApplication({
  articleId,
  chatId,
  message,
  userId,
  userContext,
  renderingOutline,
  onMessageSent,
  externalRequestId,
}) {
  const supabase = await createClient();
  const startTime = Date.now();
  try {
    const monkey = await initMonkey();
    monkey.loadUserContext({ ...(userContext ?? {}), userId });
    const result = await monkey.v0SendMessage(chatId, message, {
      userId,
      maxWaitTime: 30 * 60 * 1000,
      pollingInterval: 2000,
      onMessageSent,
    });

    if (!result.success) {
      await finishExternalRequest(supabase, {
        externalRequestId,
        status: "failed",
        errorMessage: result.error || "Feedback application failed",
        latencyMs: Date.now() - startTime,
      });
      const failedStatus = {
        ...renderingOutline,
        status: 'failed',
        error: result.error || 'Feedback application failed',
        failedAt: new Date().toISOString(),
      };
      await supabase
        .from('content_magic_articles')
        .update({ outline: failedStatus })
        .eq('id', articleId)
        .eq('user_id', userId);
      return;
    }

    await finishExternalRequest(supabase, {
      externalRequestId,
      status: "success",
      responsePreview: JSON.stringify({ success: true, chatId }),
      latencyMs: Date.now() - startTime,
    });

    const completedStatus = {
      ...renderingOutline,
      status: 'completed',
      chatId,
      demoUrl: result.demoUrl,
      content_html: result.htmlContent,
      files: result.files,
      completedAt: new Date().toISOString(),
      generationTime: result.generationTime,
    };

    await supabase
      .from('content_magic_articles')
      .update({ outline: completedStatus })
      .eq('id', articleId)
      .eq('user_id', userId);
  } catch (error) {
    await finishExternalRequest(supabase, {
      externalRequestId,
      status: "failed",
      errorMessage: error?.message ?? String(error),
      latencyMs: Date.now() - startTime,
    });
    const failedStatus = {
      ...renderingOutline,
      status: 'failed',
      error: error.message || 'Feedback application failed',
      failedAt: new Date().toISOString(),
    };
    await supabase
      .from('content_magic_articles')
      .update({ outline: failedStatus })
      .eq('id', articleId)
      .eq('user_id', userId);
  }
}

export async function POST(request) {
  const externalRequestId = request.headers.get("x-external-request-id") ?? null;
  try {
    const body = await request.json().catch(() => ({}));
    const { articleId, chatId, message } = body;

    if (!articleId || !chatId || !message || !String(message).trim()) {
      return NextResponse.json(
        { error: 'articleId, chatId, and feedback message are required' },
        { status: 400 }
      );
    }

    const supabase = await createClient();
    const { data: { user }, error: authError } = await supabase.auth.getUser();
    if (authError || !user) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
    }

    const trimmedMessage = String(message).trim();
    const { data: article, error: articleError } = await supabase
      .from('content_magic_articles')
      .select('outline')
      .eq('id', articleId)
      .eq('user_id', user.id)
      .single();

    if (articleError || !article) {
      return NextResponse.json(
        { error: 'Article not found' },
        { status: 404 }
      );
    }

    const feedbackSubmittedAt = new Date().toISOString();
    const renderingOutline = {
      status: 'rendering',
      chatId,
      startedAt: feedbackSubmittedAt,
      feedbackSubmittedAt,
      lastFeedbackMessage: trimmedMessage,
    };

    const onMessageSent = async (chat) => {
      const status = chat?.latestVersion?.status === 'pending' ? 'rendering' : (chat?.latestVersion?.status || 'rendering');
      const outlineFromV0 = {
        status,
        chatId,
        startedAt: renderingOutline.startedAt,
        feedbackSubmittedAt: renderingOutline.feedbackSubmittedAt,
        lastFeedbackMessage: trimmedMessage,
      };
      const client = await createClient();
      await client
        .from('content_magic_articles')
        .update({ outline: outlineFromV0 })
        .eq('id', articleId)
        .eq('user_id', user.id);
    };

    const { data: updateData, error: updateError } = await supabase
      .from('content_magic_articles')
      .update({ outline: renderingOutline })
      .eq('id', articleId)
      .eq('user_id', user.id)
      .select('id');

    if (updateError) {
      return NextResponse.json(
        { error: 'Failed to update article status', details: updateError.message },
        { status: 500 }
      );
    }
    if (!updateData?.length) {
      return NextResponse.json(
        { error: 'Failed to update article status', details: 'No row updated' },
        { status: 500 }
      );
    }

    processFeedbackApplication({
      articleId,
      chatId,
      message: trimmedMessage,
      userId: user.id,
      userContext: body?.user_context,
      renderingOutline,
      onMessageSent,
      externalRequestId,
    }).catch((err) => {
    });

    return NextResponse.json({
      success: true,
      status: 'rendering',
      message: 'Feedback submitted. Please check back in a few minutes.',
    });
  } catch (error) {
    return NextResponse.json(
      { error: error.message || 'Failed to submit feedback' },
      { status: 500 }
    );
  }
}

