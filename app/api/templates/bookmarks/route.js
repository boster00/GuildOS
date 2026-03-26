import { NextResponse } from 'next/server';
import { createClient } from '@/libs/supabase/server';

/**
 * Bookmarks API Route
 * Manages template bookmarks for users
 * GET: returns user's bookmarked template IDs
 * POST: adds template ID to bookmarks
 * DELETE: removes template ID from bookmarks
 */

export async function GET(request) {
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

    // Fetch profile
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

    const bookmarks = profile.json?.customizations?.bookmarks || [];

    return NextResponse.json({
      success: true,
      bookmarks
    });

  } catch (error) {
    return NextResponse.json(
      { error: error.message || 'Failed to get bookmarks' },
      { status: 500 }
    );
  }
}

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
    const bookmarks = customizations.bookmarks || [];

    // Check if already bookmarked
    if (bookmarks.includes(templateId)) {
      return NextResponse.json(
        { error: 'Template is already bookmarked' },
        { status: 400 }
      );
    }

    // Add to bookmarks
    const updatedBookmarks = [...bookmarks, templateId];

    // Save to database
    const { error: updateError } = await supabase
      .from('profiles')
      .update({
        json: {
          ...currentJson,
          customizations: {
            ...customizations,
            bookmarks: updatedBookmarks
          }
        }
      })
      .eq('id', user.id);

    if (updateError) {
      return NextResponse.json(
        { error: 'Failed to add bookmark' },
        { status: 500 }
      );
    }
    return NextResponse.json({
      success: true,
      bookmarks: updatedBookmarks
    });

  } catch (error) {
    return NextResponse.json(
      { error: error.message || 'Failed to add bookmark' },
      { status: 500 }
    );
  }
}

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
    const bookmarks = customizations.bookmarks || [];

    // Remove from bookmarks
    const updatedBookmarks = bookmarks.filter(id => id !== templateId);

    // Save to database
    const { error: updateError } = await supabase
      .from('profiles')
      .update({
        json: {
          ...currentJson,
          customizations: {
            ...customizations,
            bookmarks: updatedBookmarks
          }
        }
      })
      .eq('id', user.id);

    if (updateError) {
      return NextResponse.json(
        { error: 'Failed to remove bookmark' },
        { status: 500 }
      );
    }
    return NextResponse.json({
      success: true,
      bookmarks: updatedBookmarks
    });

  } catch (error) {
    return NextResponse.json(
      { error: error.message || 'Failed to remove bookmark' },
      { status: 500 }
    );
  }
}
