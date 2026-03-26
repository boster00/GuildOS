"use client";

import React, { useState, useEffect } from "react";
import { initMonkey } from "@/libs/monkey";
import { Check, X, RotateCcw, Save } from "lucide-react";

export default function TemplateManagementTab() {
  const [pageTypes, setPageTypes] = useState([]);
  const [sectionTemplates, setSectionTemplates] = useState({});
  const [componentHtmlTemplates, setComponentHtmlTemplates] = useState({});
  const [selectedPageType, setSelectedPageType] = useState(null);
  const [selectedSection, setSelectedSection] = useState(null);
  const [selectedFormat, setSelectedFormat] = useState(null);
  const [customHtml, setCustomHtml] = useState('');
  const [originalHtml, setOriginalHtml] = useState('');
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState(null);
  const [successMessage, setSuccessMessage] = useState('');
  
  // Load page types and templates on mount
  useEffect(() => {
    loadTemplateData();
  }, []);

  const loadTemplateData = async () => {
    setLoading(true);
    setError(null);
    
    try {
      const monkey = await initMonkey(true);
      
      // Load page type configurations from monkey
      const pageTypeModule = await import('@/libs/monkey/references/pageTypes/registry.ts');
      
      // Extract enums and objects - need to access the actual exported values
      const pageTypeConfigs = {};
      const pageTypeEnum = pageTypeModule.MarketingPageType || {};
      
      // Build configs from enum values
      Object.values(pageTypeEnum).forEach(pageType => {
        if (pageTypeModule.PAGE_TYPE_CONFIGS && pageTypeModule.PAGE_TYPE_CONFIGS[pageType]) {
          pageTypeConfigs[pageType] = pageTypeModule.PAGE_TYPE_CONFIGS[pageType];
        }
      });
      
      const sectionTemplatesData = pageTypeModule.SECTION_TEMPLATES || {};
      
      // Load HTML templates for formats
      const htmlTemplateModule = await import('@/libs/monkey/tools/renderers/templates.ts');
      
      // Convert page type configs to array
      const pageTypesArray = Object.values(pageTypeConfigs);
      
      setPageTypes(pageTypesArray);
      setSectionTemplates(sectionTemplatesData);
      
      // Load user customizations from profiles
      const profile = await monkey.read('profiles', [
        { operator: 'eq', args: ['id', monkey.user?.id] }
      ]);
      
      if (profile && profile[0]?.json?.customizations) {
        const customizations = profile[0].json.customizations;
        
        // Apply customizations to page types if any
        if (customizations.pageTypes) {
          // Merge custom page type configs
        }
        
        // Apply customizations to component HTML templates if any
        if (customizations.componentHtmlTemplates) {
          setComponentHtmlTemplates(customizations.componentHtmlTemplates);
        }
      }
      
      // Set initial selection to first page type
      if (pageTypesArray.length > 0) {
        setSelectedPageType(pageTypesArray[0]);
      }
    } catch (err) {
      setError(err.message);
    } finally {
      setLoading(false);
    }
  };

  const handleSelectPageType = (pageType) => {
    setSelectedPageType(pageType);
    setSelectedSection(null);
    setSelectedFormat(null);
    setCustomHtml('');
    setSuccessMessage('');
  };

  const handleSelectSection = async (sectionType) => {
    setSelectedSection(sectionType);
    setSelectedFormat(null);
    setSuccessMessage('');
    
    const template = sectionTemplates[sectionType];
    if (template && template.recommended_formats && template.recommended_formats.length > 0) {
      // Auto-select first format
      const firstFormat = template.recommended_formats[0];
      await handleSelectFormat(firstFormat);
    }
  };

  const handleSelectFormat = async (formatName) => {
    setSelectedFormat(formatName);
    setSuccessMessage('');
    
    try {
      // Load the HTML template for this format
      const htmlTemplateModule = await import('@/libs/monkey/tools/renderers/templates');
      
      // Get template HTML - this is a simplified approach
      // In reality, you'd need to parse the format name and call getTemplate appropriately
      const templateKey = `${selectedSection}_${formatName}`;
      const defaultHtml = getDefaultTemplateHtml(htmlTemplateModule, formatName);
      
      setOriginalHtml(defaultHtml);
      
      // Check if there's a user customization
      if (componentHtmlTemplates[templateKey]) {
        setCustomHtml(componentHtmlTemplates[templateKey]);
      } else {
        setCustomHtml(defaultHtml);
      }
    } catch (err) {
      setError(err.message);
    }
  };

  const getDefaultTemplateHtml = (htmlTemplateModule, formatName) => {
    // This is a helper to get the default HTML template for a format
    // In a real implementation, you'd parse formatName and call the appropriate getTemplate function
    try {
      // Map format names to template IDs
      const formatToTemplateId = {
        'hero': 'hero',
        'text_block': 'contentSection',
        'two_column_split': 'contentSection',
        'card_grid': 'cardGrid',
        'card_grid_icon': 'cardGrid',
        'steps_timeline': 'stepsTimeline',
        'steps_timeline_icon': 'stepsTimeline',
        'steps_timeline_icon_advanced': 'stepsTimeline',
        'faq_accordion': 'faqAccordion',
        'testimonials': 'quoteBlock',
        'quote_block': 'quoteBlock',
        'table': 'table',
        'pricing_table': 'table',
        'cta_banner': 'conversionBlock',
        'form_block': 'conversionBlock',
        'icon_list': 'keyValueList',
        'stats_strip': 'keyValueList',
        'comparison_table': 'table'
      };
      
      const templateId = formatToTemplateId[formatName] || 'contentSection';
      
      if (htmlTemplateModule.getTemplate) {
        return htmlTemplateModule.getTemplate(templateId);
      }
      
      return `<!-- Template HTML for ${formatName} -->\n<section>\n  <h2>Section Title</h2>\n  <p>Section content...</p>\n</section>`;
    } catch (err) {
      return '<!-- Template HTML not found -->';
    }
  };

  const handleSaveTemplate = async () => {
    if (!selectedSection || !selectedFormat) return;
    
    setSaving(true);
    setError(null);
    setSuccessMessage('');
    
    try {
      const monkey = await initMonkey(true);
      const templateKey = `${selectedSection}_${selectedFormat}`;
      
      // Fetch current profile
      const profile = await monkey.read('profiles', [
        { operator: 'eq', args: ['id', monkey.user?.id] }
      ]);
      
      if (!profile || profile.length === 0) {
        throw new Error('Profile not found');
      }
      
      const currentJson = profile[0]?.json || {};
      const customizations = currentJson.customizations || {};
      const htmlTemplates = customizations.componentHtmlTemplates || {};
      
      // Update HTML template customization
      htmlTemplates[templateKey] = customHtml;
      
      // Update profile
      await monkey.update('profiles', {
        id: monkey.user.id,
        json: {
          ...currentJson,
          customizations: {
            ...customizations,
            componentHtmlTemplates: htmlTemplates
          }
        }
      });
      
      // Update local state
      setComponentHtmlTemplates(htmlTemplates);
      
      setSuccessMessage('Template customization saved successfully!');
      
      // Clear success message after 3 seconds
      setTimeout(() => setSuccessMessage(''), 3000);
    } catch (err) {
      setError(err.message);
    } finally {
      setSaving(false);
    }
  };

  const handleResetToDefault = async () => {
    if (!selectedSection || !selectedFormat || !originalHtml) return;
    
    if (!confirm('Are you sure you want to reset this template to its default? This will remove your customization.')) {
      return;
    }
    
    setCustomHtml(originalHtml);
    await handleSaveTemplate();
  };

  // Get sections for selected page type
  const getPageTypeSections = () => {
    if (!selectedPageType) return [];
    
    const recommended = selectedPageType.recommended_sections || [];
    const optional = selectedPageType.optional_sections || [];
    
    return {
      recommended: recommended.map(st => ({
        type: st,
        template: sectionTemplates[st],
        isRecommended: true
      })),
      optional: optional.map(st => ({
        type: st,
        template: sectionTemplates[st],
        isRecommended: false
      }))
    };
  };

  const sections = getPageTypeSections();

  if (loading) {
    return (
      <div className="flex items-center justify-center py-12">
        <div className="flex items-center gap-2 text-gray-600">
          <div className="w-5 h-5 border-2 border-blue-600 border-t-transparent rounded-full animate-spin"></div>
          Loading templates...
        </div>
      </div>
    );
  }

  return (
    <div className="space-y-6">
      {/* Error/Success Messages */}
      {error && (
        <div className="bg-red-50 border border-red-200 rounded-lg p-4">
          <div className="flex items-center gap-2">
            <X className="w-5 h-5 text-red-600" />
            <p className="text-sm text-red-800">{error}</p>
          </div>
        </div>
      )}
      
      {successMessage && (
        <div className="bg-green-50 border border-green-200 rounded-lg p-4">
          <div className="flex items-center gap-2">
            <Check className="w-5 h-5 text-green-600" />
            <p className="text-sm text-green-800">{successMessage}</p>
          </div>
        </div>
      )}

      {/* Page Type Tabs */}
      <div className="border-b border-gray-200">
        <div className="flex overflow-x-auto">
          {pageTypes.map((pageType) => (
            <button
              key={pageType.pageType}
              onClick={() => handleSelectPageType(pageType)}
              className={`px-4 py-3 text-sm font-medium whitespace-nowrap border-b-2 transition-colors ${
                selectedPageType?.pageType === pageType.pageType
                  ? 'border-blue-600 text-blue-600'
                  : 'border-transparent text-gray-600 hover:text-gray-900 hover:border-gray-300'
              }`}
            >
              {pageType.pageType.replace(/_/g, ' ')}
            </button>
          ))}
        </div>
      </div>

      {/* Content Area */}
      {selectedPageType && (
        <div className="grid grid-cols-4 gap-6">
          {/* Left Sidebar: Section List */}
          <div className="col-span-1 space-y-4">
            <div>
              <h3 className="text-sm font-semibold text-gray-700 mb-2">Recommended Sections</h3>
              <div className="space-y-1">
                {sections.recommended.map((section) => (
                  <button
                    key={section.type}
                    onClick={() => handleSelectSection(section.type)}
                    className={`w-full text-left px-3 py-2 rounded-md text-sm transition-colors ${
                      selectedSection === section.type
                        ? 'bg-blue-100 text-blue-900'
                        : 'hover:bg-gray-100 text-gray-700'
                    }`}
                  >
                    <div className="flex items-center justify-between">
                      <span>{section.type.replace(/_/g, ' ')}</span>
                      <span className="text-xs text-green-600">✓</span>
                    </div>
                  </button>
                ))}
              </div>
            </div>

            {sections.optional.length > 0 && (
              <div>
                <h3 className="text-sm font-semibold text-gray-700 mb-2">Optional Sections</h3>
                <div className="space-y-1">
                  {sections.optional.map((section) => (
                    <button
                      key={section.type}
                      onClick={() => handleSelectSection(section.type)}
                      className={`w-full text-left px-3 py-2 rounded-md text-sm transition-colors ${
                        selectedSection === section.type
                          ? 'bg-blue-100 text-blue-900'
                          : 'hover:bg-gray-100 text-gray-700'
                      }`}
                    >
                      {section.type.replace(/_/g, ' ')}
                    </button>
                  ))}
                </div>
              </div>
            )}
          </div>

          {/* Middle: Format Selection & HTML Editor */}
          <div className="col-span-2 space-y-4">
            {selectedSection ? (
              <>
                {/* Section Info */}
                <div className="bg-gray-50 border border-gray-200 rounded-lg p-4">
                  <h3 className="text-lg font-semibold text-gray-900">{selectedSection.replace(/_/g, ' ')}</h3>
                  <p className="text-sm text-gray-600 mt-1">
                    {sectionTemplates[selectedSection]?.purpose}
                  </p>
                </div>

                {/* Format Selection */}
                <div>
                  <label className="block text-sm font-medium text-gray-700 mb-2">
                    Available Formats
                  </label>
                  <div className="flex flex-wrap gap-2">
                    {sectionTemplates[selectedSection]?.recommended_formats?.map((format) => (
                      <button
                        key={format}
                        onClick={() => handleSelectFormat(format)}
                        className={`px-3 py-2 text-sm rounded-md border transition-colors ${
                          selectedFormat === format
                            ? 'bg-blue-600 text-white border-blue-600'
                            : 'bg-white text-gray-700 border-gray-300 hover:bg-gray-50'
                        }`}
                      >
                        {format.replace(/_/g, ' ')}
                      </button>
                    ))}
                  </div>
                </div>

                {/* HTML Editor */}
                {selectedFormat && (
                  <div>
                    <div className="flex items-center justify-between mb-2">
                      <label className="block text-sm font-medium text-gray-700">
                        Template HTML
                      </label>
                      <div className="flex gap-2">
                        <button
                          onClick={handleResetToDefault}
                          disabled={saving}
                          className="flex items-center gap-1 px-3 py-1 text-xs border border-gray-300 text-gray-700 rounded-md hover:bg-gray-50 transition-colors disabled:opacity-50 disabled:cursor-not-allowed"
                        >
                          <RotateCcw className="w-3 h-3" />
                          Reset
                        </button>
                        <button
                          onClick={handleSaveTemplate}
                          disabled={saving}
                          className="flex items-center gap-1 px-3 py-1 text-xs bg-blue-600 text-white rounded-md hover:bg-blue-700 transition-colors disabled:opacity-50 disabled:cursor-not-allowed"
                        >
                          {saving ? (
                            <>
                              <div className="w-3 h-3 border-2 border-white border-t-transparent rounded-full animate-spin"></div>
                              Saving...
                            </>
                          ) : (
                            <>
                              <Save className="w-3 h-3" />
                              Save
                            </>
                          )}
                        </button>
                      </div>
                    </div>
                    <textarea
                      value={customHtml}
                      onChange={(e) => setCustomHtml(e.target.value)}
                      rows={20}
                      className="w-full px-3 py-2 border border-gray-300 rounded-lg font-mono text-xs focus:outline-none focus:ring-2 focus:ring-blue-500 focus:border-transparent"
                      placeholder="Enter template HTML..."
                    />
                    <p className="text-xs text-gray-500 mt-1">
                      Edit the HTML template. Changes will apply to all future uses of this format.
                    </p>
                  </div>
                )}
              </>
            ) : (
              <div className="flex items-center justify-center h-96 border-2 border-dashed border-gray-300 rounded-lg">
                <p className="text-gray-500">Select a section from the list to view templates</p>
              </div>
            )}
          </div>

          {/* Right: Preview */}
          <div className="col-span-1">
            {selectedFormat && customHtml && (
              <div>
                <label className="block text-sm font-medium text-gray-700 mb-2">
                  Preview
                </label>
                <div className="border border-gray-300 rounded-lg p-4 bg-white overflow-auto max-h-96">
                  <div 
                    dangerouslySetInnerHTML={{ __html: customHtml }}
                    className="prose prose-sm max-w-none"
                  />
                </div>
              </div>
            )}
          </div>
        </div>
      )}
    </div>
  );
}
