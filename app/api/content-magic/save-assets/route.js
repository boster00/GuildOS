import { NextResponse } from "next/server";
import { createClient } from "@/libs/supabase/server";
import { assertPlainJson } from "@/libs/shared/assertPlainJson";

export async function POST(request) {
  try {
    const body = await request.json();
    const { articleId, mode } = body;

    // Validate required fields
    if (!articleId) {
      return NextResponse.json(
        { ok: false, error: 'articleId is required' },
        { status: 400 }
      );
    }

    // Validate mode
    if (!mode || !['patch', 'replace'].includes(mode)) {
      return NextResponse.json(
        { ok: false, error: 'Invalid mode. Must be "patch" or "replace".' },
        { status: 400 }
      );
    }

    const supabase = await createClient();

    // PATCH MODE: Merge partial updates atomically
    if (mode === 'patch') {
      // Unambiguous contract: patch mode only accepts patch
      if (!('patch' in body)) {
        return NextResponse.json(
          { ok: false, error: 'Patch mode requires "patch" field (not "assets").' },
          { status: 400 }
        );
      }

      const { patch } = body;
      

      // CRITICAL: Deep validation of patch data
      try {
        assertPlainJson(patch, 'patch');
      } catch (validationError) {

        return NextResponse.json(
          { ok: false, error: `Invalid patch: ${validationError.message}` },
          { status: 400 }
        );
      }

      // Use Postgres JSONB merge operator for atomic update
      // This prevents lost updates under concurrent patching
      try {
        const { data, error } = await supabase.rpc('merge_article_assets', {
          article_id: articleId,
          patch_data: patch
        });

        if (error) {
          // If RPC doesn't exist yet, fall back to fetch-merge-update
          if (error.code === '42883') { // function does not exist

            const { data: current, error: fetchError } = await supabase
              .from('content_magic_articles')
              .select('assets')
              .eq('id', articleId)
              .single();

            if (fetchError) {

              throw fetchError;
            }

            const merged = { ...current?.assets, ...patch };
            

            const { error: updateError } = await supabase
              .from('content_magic_articles')
              .update({ assets: merged })
              .eq('id', articleId);

            if (updateError) {

              throw updateError;
            }

            return NextResponse.json({ ok: true, assets: merged });
          }

          throw error;
        }

        // RPC returns array with single row
        const mergedAssets = data?.[0]?.assets || {};
        
        return NextResponse.json({ ok: true, assets: mergedAssets });

      } catch (dbError) {

        return NextResponse.json(
          { ok: false, error: `Database error: ${dbError.message}` },
          { status: 500 }
        );
      }
    }

    // REPLACE MODE: Full object replacement (for deletions via controlled UI actions)
    if (mode === 'replace') {
      // Unambiguous contract: replace mode only accepts assets
      if (!('assets' in body)) {
        return NextResponse.json(
          { ok: false, error: 'Replace mode requires "assets" field (not "patch").' },
          { status: 400 }
        );
      }

      const { assets } = body;

      // CRITICAL: Deep validation of assets data
      try {
        assertPlainJson(assets, 'assets');
      } catch (validationError) {
        return NextResponse.json(
          { ok: false, error: `Invalid assets: ${validationError.message}` },
          { status: 400 }
        );
      }

      try {
        const { error } = await supabase
          .from('content_magic_articles')
          .update({ assets })
          .eq('id', articleId);

        if (error) throw error;

        return NextResponse.json({ ok: true, assets });

      } catch (dbError) {

        return NextResponse.json(
          { ok: false, error: `Database error: ${dbError.message}` },
          { status: 500 }
        );
      }
    }

  } catch (error) {

    return NextResponse.json(
      { ok: false, error: error.message || 'Internal server error' },
      { status: 500 }
    );
  }
}