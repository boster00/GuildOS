import { NextResponse } from 'next/server';
import { createClient } from '@/libs/supabase/server';

/**
 * Save Template API Route
 * Updates an existing template's HTML in user customizations
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
    const { templateId, html, name, category, pageTypes, isUserCreated } = body;

    if (!templateId || !html) {
      return NextResponse.json(
        { error: 'Missing required fields: templateId and html' },
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

    // If template already exists in customizations, preserve all its data
    // Otherwise, we're editing a default template - create customization entry with metadata
    const existingTemplate = templates[templateId];
    
    if (existingTemplate) {
      // Update existing custom template, preserving all fields
      templates[templateId] = {
        ...existingTemplate,
        html,
        // Update metadata if provided
        ...(name && { name }),
        ...(category && { category }),
        ...(pageTypes && { pageTypes }),
        updatedAt: new Date().toISOString()
      };
    } else {
      // This is a default template being edited for the first time
      // Create a customization entry with the template's metadata
      templates[templateId] = {
        id: templateId,
        name: name || templateId,
        html,
        category: category || 'custom',
        pageTypes: pageTypes || [],
        isCustom: true,
        isUserCreated: isUserCreated || false, // false because it's an edited default template
        updatedAt: new Date().toISOString()
      };
    }

    // Save back to database
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
        { error: 'Failed to save template' },
        { status: 500 }
      );
    }

    return NextResponse.json({
      success: true,
      template: templates[templateId]
    });

  } catch (error) {
    return NextResponse.json(
      { error: error.message || 'Failed to save template' },
      { status: 500 }
    );
  }
}
