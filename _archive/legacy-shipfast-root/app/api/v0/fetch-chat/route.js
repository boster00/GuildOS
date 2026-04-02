import { NextResponse } from 'next/server';
import { createClient } from '@/libs/supabase/server';
import { initMonkey } from '@/libs/monkey';

/**
 * v0.dev fetch chat - routes through monkey for usage metering
 */
export async function POST(request) {
  try {
    const body = await request.json();
    const { chatId } = body;

    if (!chatId || !chatId.trim()) {
      return NextResponse.json(
        { error: 'Chat ID is required' },
        { status: 400 }
      );
    }

    const supabase = await createClient();
    const { data: { user } } = await supabase.auth.getUser();
    const monkey = await initMonkey();
    monkey.loadUserContext({ ...(body?.user_context ?? {}), userId: user?.id });
    const options = {};
    if (user?.id) {
      options.userId = user.id;
    }

    const result = await monkey.v0Fetch(chatId.trim(), options);

    if (result.success === false) {
      return NextResponse.json({
        success: false,
        error: result.error,
        chatId: result.chatId,
        demoUrl: result.demoUrl,
        files: result.files || [],
      });
    }

    return NextResponse.json({
      success: true,
      chatId: result.chatId,
      demoUrl: result.chatId,
      htmlContent: result.htmlContent,
      files: result.files,
      credits: result.credits,
      rawChat: {
        id: result.chatId,
        demo: result.chatId,
        url: result.chatId,
        filesCount: result.files?.length || 0,
      },
    });
  } catch (error) {
    return NextResponse.json(
      {
        error: `Failed to fetch chat: ${error.message}`,
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
