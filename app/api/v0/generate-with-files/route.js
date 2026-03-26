import { NextResponse } from 'next/server';
import { createClient } from '@/libs/supabase/server';
import { initMonkey } from '@/libs/monkey';
import { finishExternalRequest } from '@/libs/monkey/tools/external_requests';

/** Max chars per file (align with generate-outline: 15k template, 10k competitor) */
const MAX_TEMPLATE_CHARS = 15000;
const MAX_COMPETITOR_CHARS = 10000;
const DEFAULT_ARTICLE_ID = 'e3eac24f-f1d1-4ee0-b03e-0e8d2e93d1d5';

/**
 * Build prompt + files for v0 file-based workflow from article + profile.
 * @param {Object} article - content_magic_articles row (outline, assets)
 * @param {Object} profile - profiles row (json.customizations)
 * @returns {{ prompt: string, files: Array<{ name: string, content: string }> }}
 */
function buildPromptAndFiles(article, profile) {
  const outline = article.outline || {};
  const assets = article.assets || {};
  const userPrompt = outline.prompt || 'Generate a professional landing page.';
  const contextPrompt = outline.contextPrompt || '';

  let customTemplates = [];
  let customCss = '';
  if (profile?.json?.customizations) {
    const cust = profile.json.customizations;
    customCss = typeof cust.css === 'string' ? cust.css : '';
    if (cust.templates && typeof cust.templates === 'object') {
      customTemplates = Object.values(cust.templates)
        .filter(t => t && t.isCustom === true && t.html)
        .map(t => ({ name: t.name || t.id || 'template', html: t.html }));
    }
  }

  const competitorPages = Array.isArray(assets.competitorPages) ? assets.competitorPages : [];
  const files = [];

  if (customCss.trim()) {
    files.push({
      name: 'custom.css',
      content: customCss.trim().substring(0, MAX_TEMPLATE_CHARS),
    });
  }

  // Combine all templates into one file with clear labels (v0 limit: 20 files max)
  if (customTemplates.length > 0) {
    const parts = [
      '<!-- Multiple custom HTML templates below. Use their structure and patterns. Each section is labeled TEMPLATE: name -->',
      '<!-- Do NOT generate any custom CSS. Use only the structure, classes, and styles from these templates. -->',
      '',
    ];
    customTemplates.forEach((t, idx) => {
      const name = t.name || t.id || `Template ${idx + 1}`;
      const content = (t.html || '').trim().substring(0, MAX_TEMPLATE_CHARS);
      if (content) {
        parts.push(`<!-- ========== TEMPLATE: ${name} ========== -->`);
        parts.push('');
        parts.push(content);
        parts.push('');
      }
    });
    files.push({ name: 'custom-templates.html', content: parts.join('\n') });
  }

  // Each competitor gets its own file
  if (competitorPages.length > 0) {
    competitorPages.slice(0, 3).forEach((page, idx) => {
      const content = (page.content || '').substring(0, MAX_COMPETITOR_CHARS);
      if (content) {
        files.push({ name: `competitor-${idx + 1}.html`, content });
      }
    });
  }

  if (files.length === 0) {
    files.push({
      name: 'competitor-placeholder.html',
      content: '<!DOCTYPE html><html><head><title>Reference</title></head><body><h1>Reference page</h1><p>Use this as design reference.</p></body></html>',
    });
  }

  const noCustomCssWhenTemplates = customTemplates.length > 0
    ? ' When custom templates are attached, do NOT generate any custom CSS; use only the structure, classes, and styles from those templates.'
    : '';
  const requirements = `REQUIREMENTS: Output a single file named exactly "index.html". Pure HTML + Tailwind converted to CSS in a <style> tag. No React. Fully offline. No CDN. No emoji. Use the attached files for style and structure.${noCustomCssWhenTemplates}`;

  const prompt = [
    `USER PROMPT:\n${userPrompt}`,
    contextPrompt.trim() ? `CONTEXT:\n${contextPrompt}` : '',
    requirements,
  ].filter(Boolean).join('\n\n');

  return { prompt, files };
}

/**
 * POST /api/v0/generate-with-files
 * Body: { articleId? } — defaults to demo article e3eac24f-f1d1-4ee0-b03e-0e8d2e93d1d5
 * Uses v0 init + sendMessage + poll (file-based workflow). Same response shape as generate-page.
 */
export async function POST(request) {
  const externalRequestId = request.headers.get("x-external-request-id") ?? null;
  const startTime = Date.now();
  const supabase = await createClient();
  try {
    const body = await request.json().catch(() => ({}));
    const articleId = body.articleId || DEFAULT_ARTICLE_ID;
    const maxWaitTime = body.maxWaitTime ?? 30 * 60 * 1000;
    const pollingInterval = body.pollingInterval ?? 2000;

    const { data: { user }, error: authError } = await supabase.auth.getUser();
    if (authError || !user) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
    }

    const { data: article, error: articleError } = await supabase
      .from('content_magic_articles')
      .select('id, user_id, outline, assets')
      .eq('id', articleId)
      .eq('user_id', user.id)
      .single();

    if (articleError || !article) {
      return NextResponse.json(
        { error: 'Article not found or access denied' },
        { status: 404 }
      );
    }

    const { data: profile } = await supabase
      .from('profiles')
      .select('json')
      .eq('id', article.user_id)
      .single();

    const { prompt, files } = buildPromptAndFiles(article, profile || {});

    if (!files.length) {
      return NextResponse.json(
        { error: 'No files to send (add custom CSS, templates, or competitor pages)' },
        { status: 400 }
      );
    }

    const monkey = await initMonkey();
    monkey.loadUserContext({ ...(body?.user_context ?? {}), userId: user?.id });
    const result = await monkey.v0GenerateWithFiles(prompt, files, {
      userId: user.id,
      maxWaitTime,
      pollingInterval,
    });

    await finishExternalRequest(supabase, {
      externalRequestId,
      status: "success",
      responsePreview: JSON.stringify({ success: result.success, chatId: result.chatId }),
      latencyMs: Date.now() - startTime,
    });

    if (result.success === false) {
      return NextResponse.json({
        success: false,
        error: result.error,
        chatId: result.chatId,
        demoUrl: result.demoUrl,
        files: result.files || [],
        pollingAttempts: result.pollingAttempts,
        generationTime: result.generationTime,
        credits: result.credits,
      });
    }

    return NextResponse.json({
      success: true,
      chatId: result.chatId,
      demoUrl: result.demoUrl,
      htmlContent: result.htmlContent,
      files: result.files,
      generationTime: result.generationTime,
      pollingAttempts: result.pollingAttempts,
      credits: result.credits,
      rawChat: {
        id: result.chatId,
        demo: result.demoUrl,
        url: result.demoUrl,
        filesCount: result.files?.length || 0,
      },
    });
  } catch (error) {
    await finishExternalRequest(supabase, {
      externalRequestId,
      status: "failed",
      errorMessage: error?.message ?? String(error),
      latencyMs: Date.now() - startTime,
    });
    return NextResponse.json(
      {
        error: `v0 generation failed: ${error.message}`,
        details: {
          name: error.name,
          message: error.message,
          stack: process.env.NODE_ENV === 'development' ? error.stack : undefined,
        },
      },
      { status: 500 }
    );
  }
}
