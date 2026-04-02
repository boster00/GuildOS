import { NextResponse } from 'next/server';
import { createClient } from '@/libs/supabase/server';

/**
 * POST /api/templates/reorder
 * 
 * Saves the new order of custom templates
 * Updates each template's order property in the database
 */
export async function POST(request) {
  try {
    const supabase = await createClient();
    const { data: { user }, error: authError } = await supabase.auth.getUser();

    if (authError || !user) {
      return NextResponse.json(
        { error: 'Unauthorized' },
        { status: 401 }
      );
    }

    const { templateIds } = await request.json();

    if (!templateIds || !Array.isArray(templateIds)) {
      return NextResponse.json(
        { error: 'templateIds array is required' },
        { status: 400 }
      );
    }

    // Get user's profile
    const { data: profile, error: profileError } = await supabase
      .from('profiles')
      .select('json')
      .eq('id', user.id)
      .single();

    if (profileError) {
      return NextResponse.json(
        { error: 'Failed to fetch profile' },
        { status: 500 }
      );
    }

    // Get existing templates
    const templates = profile?.json?.customizations?.templates || {};
    
    // Update order property for each template
    templateIds.forEach((templateId, index) => {
      if (templates[templateId]) {
        templates[templateId].order = index;
        templates[templateId].updatedAt = new Date().toISOString();
      }
    });

    // Save back to database
    const { error: updateError } = await supabase
      .from('profiles')
      .update({
        json: {
          ...profile.json,
          customizations: {
            ...profile.json?.customizations,
            templates: templates
          }
        }
      })
      .eq('id', user.id);

    if (updateError) {
      return NextResponse.json(
        { error: 'Failed to save template order' },
        { status: 500 }
      );
    }
    return NextResponse.json({
      success: true,
      message: `Successfully reordered ${templateIds.length} templates`
    });

  } catch (error) {
    return NextResponse.json(
      { error: error.message || 'Failed to reorder templates' },
      { status: 500 }
    );
  }
}
