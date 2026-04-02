import { NextResponse } from 'next/server';
import { createClient } from '@/libs/supabase/server';
import { initMonkey } from '@/libs/monkey';

/**
 * v0.dev page generation - routes through monkey for usage metering
 */
export async function POST(request) {
  try {
    const body = await request.json();
    const { prompt, competitorContent, maxWaitTime = 90000, pollingInterval = 2000 } = body;

    if (!prompt || !prompt.trim()) {
      return NextResponse.json(
        { error: 'Prompt is required' },
        { status: 400 }
      );
    }

    const supabase = await createClient();
    const { data: { user } } = await supabase.auth.getUser();
    const monkey = await initMonkey();
    monkey.loadUserContext({ ...(body?.user_context ?? {}), userId: user?.id });
    const options = { competitorContent, maxWaitTime, pollingInterval };
    if (user?.id) {
      options.userId = user.id;
    }

    const result = await monkey.v0Generate(prompt.trim(), options);

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
