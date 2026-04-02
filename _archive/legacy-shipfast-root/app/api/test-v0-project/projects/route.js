import { NextResponse } from 'next/server';
import { createClient } from 'v0-sdk';

/**
 * Test-only: Lists v0 projects, optionally filtered by name.
 * Remove app/api/test-v0-project when done.
 */
export async function GET(request) {
  const apiKey = process.env.V0_API_KEY;
  if (!apiKey) {
    return NextResponse.json(
      { error: 'V0_API_KEY not configured', projects: [] },
      { status: 401 }
    );
  }

  try {
    const { searchParams } = new URL(request.url);
    const search = searchParams.get('search')?.trim() || '';

    const v0 = createClient({
      apiKey,
      baseUrl: 'https://api.v0.dev/v1',
    });

    const { data } = await v0.projects.find();
    let projects = Array.isArray(data) ? data : [];

    if (search) {
      const q = search.toLowerCase();
      projects = projects.filter(
        (p) => p.name && String(p.name).toLowerCase().includes(q)
      );
    }

    return NextResponse.json({
      projects: projects.map((p) => ({
        id: p.id,
        name: p.name,
        privacy: p.privacy,
        createdAt: p.createdAt,
        webUrl: p.webUrl,
      })),
    });
  } catch (error) {
    return NextResponse.json(
      {
        error: `v0 projects fetch failed: ${error.message}`,
        projects: [],
      },
      { status: 500 }
    );
  }
}
