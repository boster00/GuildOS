import { NextResponse } from 'next/server';
import { createClient } from '@/libs/supabase/server';

/**
 * Create Template API Route
 * Creates a new custom template in user customizations
 * Adds section wrapper if missing
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
    const { id, name, html, category = 'custom' } = body;

    if (!id || !name || !html) {
      return NextResponse.json(
        { error: 'Missing required fields: id, name, and html' },
        { status: 400 }
      );
    }

    // Validate ID format
    if (!/^[a-z0-9-]+$/.test(id)) {
      return NextResponse.json(
        { error: 'Template ID must contain only lowercase letters, numbers, and hyphens' },
        { status: 400 }
      );
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
    const customizations = currentJson.customizations || {};
    const templates = customizations.templates || {};

    // Check if template ID already exists
    if (templates[id]) {
      return NextResponse.json(
        { error: 'Template with this ID already exists. Please use a different ID.' },
        { status: 400 }
      );
    }

    // Add section wrapper if missing
    let processedHtml = html.trim();
    const hasSectionWrapper = /^\s*<section[\s>]/i.test(processedHtml);
    
    if (!hasSectionWrapper) {
      processedHtml = `<section>\n${processedHtml}\n</section>`;
    }

    // Create new template
    const newTemplate = {
      id,
      name,
      html: processedHtml,
      category,
      isCustom: true,
      isUserCreated: true,
      createdAt: new Date().toISOString(),
      updatedAt: new Date().toISOString()
    };

    templates[id] = newTemplate;

    // Save to database
    const { error: updateError } = await supabase
      .from('profiles')
      .update({
        json: {
          ...currentJson,
          customizations: {
            ...customizations,
            templates
          }
        }
      })
      .eq('id', user.id);

    if (updateError) {
      return NextResponse.json(
        { error: 'Failed to create template' },
        { status: 500 }
      );
    }
    return NextResponse.json({
      success: true,
      template: newTemplate
    });

  } catch (error) {
    return NextResponse.json(
      { error: error.message || 'Failed to create template' },
      { status: 500 }
    );
  }
}
