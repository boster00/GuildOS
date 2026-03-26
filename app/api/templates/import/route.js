import { NextResponse } from 'next/server';
import { createClient } from '@/libs/supabase/server';

/**
 * Template Import API Route
 * Extracts section elements from HTML and saves them as individual templates
 */

// Generate unique template ID
const generateTemplateId = () => {
  const timestamp = Date.now();
  const random = Math.floor(1000 + Math.random() * 9000);
  return `template-${timestamp}-${random}`;
};

// Extract section elements from HTML
const extractSections = (html) => {
  const sectionRegex = /<section[\s\S]*?<\/section>/gi;
  const sections = [];
  let match;
  
  while ((match = sectionRegex.exec(html)) !== null) {
    sections.push(match[0].trim());
  }
  
  return sections;
};

/**
 * POST /api/templates/import
 * Body: { html: string, saveTemplates?: boolean }
 * 
 * If saveTemplates is false/undefined: just extract and return sections for preview
 * If saveTemplates is true: extract sections and save to database
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
    const { html, saveTemplates = false } = body;

    if (!html || !html.trim()) {
      return NextResponse.json(
        { error: 'HTML content is required' },
        { status: 400 }
      );
    }

    // Extract sections from HTML
    const sections = extractSections(html);

    // Validate sections
    if (sections.length === 0) {
      return NextResponse.json(
        { 
          error: 'No section elements found. Please ensure your HTML contains multiple <section> tags.',
          sections: [],
          count: 0
        },
        { status: 400 }
      );
    }

    if (sections.length === 1) {
      return NextResponse.json(
        { 
          error: 'Only one section found. Please provide HTML with multiple sections.',
          sections: [],
          count: 1
        },
        { status: 400 }
      );
    }

    // If just extracting for preview, return sections without saving
    if (!saveTemplates) {
      return NextResponse.json({
        success: true,
        sections: sections.map((html, index) => ({
          html,
          preview: html.substring(0, 200) + (html.length > 200 ? '...' : '')
        })),
        count: sections.length
      });
    }

    // Save templates to database
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
    const existingTemplates = customizations.templates || {};

    // Create new templates from sections
    const newTemplates = { ...existingTemplates };
    const createdTemplateIds = [];
    
    sections.forEach((sectionHtml) => {
      const id = generateTemplateId();
      const now = new Date().toISOString();
      
      newTemplates[id] = {
        id,
        html: sectionHtml,
        name: id,
        category: 'custom',
        isCustom: true,
        createdAt: now,
        updatedAt: now,
        isUserCreated: true
      };
      
      createdTemplateIds.push(id);
    });

    // Save to database
    const { error: updateError } = await supabase
      .from('profiles')
      .update({
        json: {
          ...currentJson,
          customizations: {
            ...customizations,
            templates: newTemplates
          }
        }
      })
      .eq('id', user.id);

    if (updateError) {
      return NextResponse.json(
        { error: 'Failed to save templates' },
        { status: 500 }
      );
    }
    return NextResponse.json({
      success: true,
      count: sections.length,
      templateIds: createdTemplateIds,
      message: `Successfully imported ${sections.length} template${sections.length > 1 ? 's' : ''}`
    });

  } catch (error) {
    return NextResponse.json(
      { error: error.message || 'Failed to import templates' },
      { status: 500 }
    );
  }
}
