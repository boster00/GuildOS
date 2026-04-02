import { NextResponse } from 'next/server';
import { createClient } from '@/libs/supabase/server';

// TODO: REMOVE — test-only endpoint, created for test-decide-status debug page.
// Returns the raw outline JSONB from content_magic_articles without side effects (no v0 calls, no DB writes).

export async function POST(request) {
  try {
    const body = await request.json().catch(() => ({}));
    const { articleId } = body;

    if (!articleId || !String(articleId).trim()) {
      return NextResponse.json(
        { error: 'articleId is required' },
        { status: 400 }
      );
    }

    const supabase = await createClient();
    const { data: { user }, error: authError } = await supabase.auth.getUser();
    if (authError || !user) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
    }

    const { data: article, error: articleError } = await supabase
      .from('content_magic_articles')
      .select('outline')
      .eq('id', articleId.trim())
      .eq('user_id', user.id)
      .single();

    if (articleError || !article) {
      return NextResponse.json({ error: 'Article not found' }, { status: 404 });
    }

    return NextResponse.json({ outline: article.outline ?? null });
  } catch (error) {
    return NextResponse.json(
      { error: error?.message || 'Failed to fetch outline' },
      { status: 500 }
    );
  }
}
