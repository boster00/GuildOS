import { NextResponse } from 'next/server';
import { createClient } from '@/libs/supabase/server';
import { initMonkey } from '@/libs/monkey';

/**
 * Temporary: pull v0 chat session and return raw response (no processing).
 */
export async function POST(request) {
  try {
    const body = await request.json().catch(() => ({}));
    const { chatId } = body;

    if (!chatId || !String(chatId).trim()) {
      return NextResponse.json(
        { error: 'chatId is required' },
        { status: 400 }
      );
    }

    const supabase = await createClient();
    const { data: { user }, error: authError } = await supabase.auth.getUser();
    if (authError || !user) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
    }

    const monkey = await initMonkey();
    monkey.loadUserContext({ ...(body?.user_context ?? {}), userId: user?.id });
    const result = await monkey.v0GetChatRaw(String(chatId).trim());

    if (!result.success) {
      return NextResponse.json(
        { error: result.error || 'Failed to fetch chat' },
        { status: 500 }
      );
    }

    return NextResponse.json({ raw: result.raw });
  } catch (error) {
    return NextResponse.json(
      { error: error?.message || 'Failed to pull chat' },
      { status: 500 }
    );
  }
}
