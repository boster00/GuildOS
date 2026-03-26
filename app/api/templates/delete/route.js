import { NextResponse } from 'next/server';
import { createClient } from '@/libs/supabase/server';

/**
 * Delete Template API Route
 * Removes a custom template from user customizations
 * Handles both customizations.components and customizations.templates
 * Also removes from bookmarks if present
 */
export async function DELETE(request) {
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
    const { templateId } = body;

    if (!templateId) {
      return NextResponse.json(
        { error: 'Missing required field: templateId' },
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
    const components = customizations.components || {};
    const templates = customizations.templates || {};
    const bookmarks = customizations.bookmarks || [];

    let foundInComponents = false;
    let foundInTemplates = false;

    // Check if template exists in components (edited default templates)
    if (components[templateId]) {
      foundInComponents = true;
    }

    // Check if template exists in templates (user-created templates)
    if (templates[templateId]) {
      foundInTemplates = true;
    }

    // If not found in either location, return error
    if (!foundInComponents && !foundInTemplates) {
      return NextResponse.json(
        { error: 'Template not found in user customizations' },
        { status: 404 }
      );
    }

    // Remove from components if present
    if (foundInComponents) {
      delete components[templateId];
    }

    // Remove from templates if present
    if (foundInTemplates) {
      delete templates[templateId];
    }

    // Remove from bookmarks if present
    const updatedBookmarks = bookmarks.filter(id => id !== templateId);

    // Save to database
    const { error: updateError } = await supabase
      .from('profiles')
      .update({
        json: {
          ...currentJson,
          customizations: {
            ...customizations,
            components,
            templates,
            bookmarks: updatedBookmarks
          }
        }
      })
      .eq('id', user.id);

    if (updateError) {
      return NextResponse.json(
        { error: 'Failed to delete template' },
        { status: 500 }
      );
    }
    return NextResponse.json({
      success: true,
      templateId
    });

  } catch (error) {
    return NextResponse.json(
      { error: error.message || 'Failed to delete template' },
      { status: 500 }
    );
  }
}
