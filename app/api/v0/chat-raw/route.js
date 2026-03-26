import { NextResponse } from 'next/server';
import { createClient } from '@/libs/supabase/server';
import { initMonkey } from '@/libs/monkey';

/**
 * v0.dev get raw chat object — unprocessed, for debug/inspection only.
 */
export async function POST(request) {
  try {
    const body = await request.json();
    const { chatId } = body;

    if (!chatId || !chatId.trim()) {
      return NextResponse.json(
        { success: false, error: 'Chat ID is required' },
        { status: 400 }
      );
    }

    // Best-effort auth — not enforced so test page works without full login flow
    const supabase = await createClient();
    const { data: { user } } = await supabase.auth.getUser();

    const monkey = await initMonkey();
    if (user?.id) {
      monkey.loadUserContext({ userId: user.id });
    }

    const result = await monkey.v0GetChatRaw(chatId.trim());

    return NextResponse.json(result);
  } catch (error) {
    return NextResponse.json(
      {
        success: false,
        error: `Failed to fetch raw chat: ${error.message}`,
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
