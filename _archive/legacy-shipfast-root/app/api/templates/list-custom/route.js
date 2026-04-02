import { NextResponse } from 'next/server';
import { createClient } from '@/libs/supabase/server';

/**
 * GET /api/templates/list-custom
 * 
 * Returns list of custom templates (user-created or edited) with basic info
 * Used for reordering interface
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

    // Get user's profile with templates
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

    // Extract custom templates
    const customTemplates = profile?.json?.customizations?.templates || {};
    
    // Convert to array and filter for custom templates only
    const templatesList = Object.values(customTemplates)
      .filter(t => t.isCustom === true)
      .map(t => ({
        id: t.id,
        name: t.name || t.id,
        isUserCreated: t.isUserCreated || false,
        createdAt: t.createdAt,
        updatedAt: t.updatedAt,
        order: t.order
      }))
      .sort((a, b) => {
        // Sort by order property if exists, otherwise by creation date
        if (a.order !== undefined && b.order !== undefined) {
          return a.order - b.order;
        }
        if (a.order !== undefined) return -1;
        if (b.order !== undefined) return 1;
        
        // Fallback to creation date (oldest first)
        const dateA = new Date(a.createdAt || 0);
        const dateB = new Date(b.createdAt || 0);
        return dateA - dateB;
      });

    return NextResponse.json({
      success: true,
      templates: templatesList,
      count: templatesList.length
    });

  } catch (error) {
    return NextResponse.json(
      { error: error.message || 'Failed to list custom templates' },
      { status: 500 }
    );
  }
}
