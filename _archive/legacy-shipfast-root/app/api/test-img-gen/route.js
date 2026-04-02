import { NextResponse } from 'next/server';
import { createClient } from '@/libs/supabase/server';
import { initMonkey } from '@/libs/monkey';

export async function POST(request) {
  try {
    const body = await request.json().catch(() => ({}));
    const { prompt } = body;

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
    const options = { responseFormat: 'url', size: '1024x1024', quality: 'standard' };
    if (user?.id) {
      options.userId = user.id;
    }

    const result = await monkey.generateImage(prompt.trim(), options);

    const images = (result.images || []).map((image) => ({
      url: image.url,
      prompt: prompt,
      revised_prompt: image.revised_prompt,
    }));

    return NextResponse.json({
      success: true,
      images,
      credits: result.credits,
    });
  } catch (error) {
    if (error.message?.includes('OpenAI API key')) {
      return NextResponse.json(
        { error: 'OpenAI API key is not configured' },
        { status: 500 }
      );
    }
    if (error.message?.includes('content policy')) {
      return NextResponse.json(
        { error: 'Invalid request. The prompt may violate OpenAI content policy.' },
        { status: 400 }
      );
    }
    if (error.status === 401) {
      return NextResponse.json(
        { error: 'Invalid OpenAI API key' },
        { status: 500 }
      );
    }
    return NextResponse.json(
      { error: error.message || 'Failed to generate image' },
      { status: 500 }
    );
  }
}
