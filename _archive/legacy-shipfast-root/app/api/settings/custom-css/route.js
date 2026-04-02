import { NextResponse } from 'next/server';
import { createClient } from '@/libs/supabase/server';

/**
 * GET: Return custom CSS configuration status for the current user.
 * Used by the editor to decide whether Custom CSS Mode can be enabled.
 */
export async function GET() {
  try {
    const supabase = await createClient();

    const { data: { user }, error: authError } = await supabase.auth.getUser();
    if (authError || !user) {
      return NextResponse.json(
        { error: 'Unauthorized' },
        { status: 401 }
      );
    }

    const { data: profile, error: profileError } = await supabase
      .from('profiles')
      .select('json')
      .eq('id', user.id)
      .single();

    if (profileError || !profile) {
      return NextResponse.json(
        { error: 'Profile not found' },
        { status: 404 }
      );
    }

    const customizations = profile.json?.customizations || {};
    const links = Array.isArray(customizations.external_css_links)
      ? customizations.external_css_links.filter((l) => typeof l === 'string' && l.trim())
      : [];
    const inlineCss = typeof customizations.css === 'string' ? customizations.css : '';
    const cssClassReferences = customizations.css_class_references != null
      ? String(customizations.css_class_references)
      : '';
    const configured = links.length > 0 || inlineCss.trim().length > 0;

    return NextResponse.json({
      configured,
      enabled: configured,
      links,
      inlineCss,
      cssClassReferences,
      summary: {
        linksCount: links.length,
        inlineCssLength: inlineCss.length,
      },
    });
  } catch (error) {
    return NextResponse.json(
      { error: error.message || 'Failed to load custom CSS config' },
      { status: 500 }
    );
  }
}

/**
 * Custom CSS API Route
 * Saves custom CSS to profiles.json.customizations.css
 * Validates size limit (300 KB) before saving
 */
export async function POST(request) {
  try {
    const supabase = await createClient();
    
    // Check authentication
    const { data: { user }, error: authError } = await supabase.auth.getUser();
    if (authError || !user) {
      return NextResponse.json(
        { error: 'Unauthorized' },
        { status: 401 }
      );
    }

    const body = await request.json();
    const { css, external_css_links, css_class_references } = body;

    // At least one field must be provided
    if (css === undefined && external_css_links === undefined && css_class_references === undefined) {
      return NextResponse.json(
        { error: 'Missing required field: css, external_css_links, or css_class_references' },
        { status: 400 }
      );
    }

    // Validate external_css_links if provided
    if (external_css_links !== undefined && !Array.isArray(external_css_links)) {
      return NextResponse.json(
        { error: 'external_css_links must be an array' },
        { status: 400 }
      );
    }

    // Validate size limit for CSS if provided (300 KB = 300 * 1024 bytes)
    if (css !== undefined) {
      const sizeInBytes = new Blob([css]).size;
      const sizeInKB = sizeInBytes / 1024;
      const maxSizeKB = 300;

      if (sizeInKB > maxSizeKB) {
        return NextResponse.json(
          { 
            error: `CSS is too large (${sizeInKB.toFixed(2)} KB). Maximum size is ${maxSizeKB} KB.`,
            size: sizeInKB,
            maxSize: maxSizeKB
          },
          { status: 400 }
        );
      }
    }

    // Fetch current profile
    const { data: profile, error: profileError } = await supabase
      .from('profiles')
      .select('json')
      .eq('id', user.id)
      .single();

    if (profileError || !profile) {
      return NextResponse.json(
        { error: 'Profile not found' },
        { status: 404 }
      );
    }

    const currentJson = profile.json || {};
    const existingCustomizations = currentJson.customizations || {};

    // Deep-merge: only update provided fields, preserve siblings (e.g. templates)
    const customizations = {
      ...existingCustomizations,
      ...(css !== undefined && { css: typeof css === 'string' ? css.trim() : '' }),
      ...(external_css_links !== undefined && {
        external_css_links: external_css_links.filter(link => link && typeof link === 'string' && link.trim()),
      }),
      ...(css_class_references !== undefined && {
        css_class_references: typeof css_class_references === 'string' ? css_class_references.trim() : '',
      }),
    };

    // Save to database
    const { error: updateError } = await supabase
      .from('profiles')
      .update({
        json: {
          ...currentJson,
          customizations,
        },
      })
      .eq('id', user.id);

    if (updateError) {
      return NextResponse.json(
        { error: 'Failed to save custom CSS' },
        { status: 500 }
      );
    }

    if (css !== undefined) {
      const sizeInKB = new Blob([css]).size / 1024;
      
    }
    if (external_css_links !== undefined) {
      
    }

    return NextResponse.json({
      success: true,
      message: 'Custom CSS saved successfully',
    });

  } catch (error) {
    return NextResponse.json(
      { error: error.message || 'Failed to save custom CSS' },
      { status: 500 }
    );
  }
}
