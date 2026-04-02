"use client";
import React, { useState, useEffect, useRef } from "react";
import { initMonkey } from "@/libs/monkey";
import { Search, Check, Settings, Edit, Trash2, Bookmark, BookmarkCheck, X, Palette } from "lucide-react";
import Link from "next/link";
import "@/app/(private)/content-magic/editor.css";

/** Base styles for .editorContent inside shadow root (mirrors editor / editor.css so preview is visible) */
const TEMPLATE_PREVIEW_BASE_STYLES = `
.editorContent {
  font-family: 'Geist', -apple-system, BlinkMacSystemFont, 'Segoe UI', sans-serif;
  padding: 1.5rem;
  min-height: 6rem;
  line-height: 1.7;
  color: oklch(0.15 0 0);
  background: oklch(1 0 0);
}
.editorContent :where(em), .editorContent :where(i) { font-style: italic; }
.editorContent :where(u) { text-decoration: underline; }
.editorContent :where(s), .editorContent :where(del) { text-decoration: line-through; }
.editorContent :where(a) { text-decoration: underline; cursor: pointer; }
.editorContent :where(ul), .editorContent :where(ol) { list-style-position: inside; }
.editorContent :where(ul) { list-style-type: disc; }
.editorContent :where(ol) { list-style-type: decimal; }
.editorContent :where(table) { border-collapse: collapse; width: 100%; }
.editorContent :where(table td), .editorContent :where(table th) { text-align: left; }
`;

/**
 * Renders template preview: light-DOM div or shadow root with custom CSS when customStylesEnabled and template is custom.
 */
function TemplatePreview({ template, customStylesEnabled }) {
  const hostRef = useRef(null);
  const html = template?.html || template?.template || '<p class="text-gray-400">No preview available</p>';

  useEffect(() => {
    if (!customStylesEnabled || !template?.isCustom || !hostRef.current) return;
    const host = hostRef.current;
    let cancelled = false;

    if (!host.shadowRoot) {
      const shadow = host.attachShadow({ mode: "open" });
      const baseStyle = document.createElement("style");
      baseStyle.textContent = TEMPLATE_PREVIEW_BASE_STYLES;
      // shadow.appendChild(baseStyle);
      const previewDiv = document.createElement("div");
      previewDiv.className = "editorContent";
      previewDiv.innerHTML = html;
      shadow.appendChild(previewDiv);
    } else {
      const previewDiv = host.shadowRoot.querySelector(".editorContent");
      if (previewDiv) previewDiv.innerHTML = html;
    }

    (async () => {
      try {
        if (cancelled) return;
        const shadow = host.shadowRoot;
        if (!shadow) return;
        const previewDiv = shadow.querySelector(".editorContent");
        if (!previewDiv) return;
        if (shadow.querySelector('[data-custom-css-head]')) return;

        const monkey = await initMonkey(true);
        if (cancelled) return;
        await monkey.applyCustomCssToShadowDom(shadow, previewDiv);
      } catch (err) {
      }
    })();

    return () => { cancelled = true; };
  }, [customStylesEnabled, template?.isCustom, template?.id, html]);

  if (!customStylesEnabled || !template?.isCustom) {
    return (
      <div className="bg-white">
        <div className="editorContent" dangerouslySetInnerHTML={{ __html: html }} />
      </div>
    );
  }

  return <div ref={hostRef} className="bg-white min-h-[200px]" style={{ minHeight: '200px' }} />;
}

/**
 * ShowTemplates Component
 * 
 * Displays available component templates in a searchable, filterable grid/list view.
 * This is a presentation component that only handles displaying templates - all interactivity
 * is handled via callback functions passed as props, making it versatile for different use cases.
 * 
 * USE CASES:
 * ==========
 * 
 * 1. Editor - Template Swapping via AI
 *    - User is editing content and wants to swap/convert a section to a different template
 *    - Clicking a template triggers AI-powered conversion (handled by parent component)
 *    - Interaction handler: Opens AI reformatting UI (defined in editor/quick actions code)
 *    - Example: ContentMagicQuickActions format change modal
 * 
 * 2. Settings - Template Management
 *    - User wants to view, edit, or manage all available templates
 *    - Clicking a template opens template editing/management UI (to be defined)
 *    - Interaction handler: Opens template editor or management options
 *    - Example: Settings page for template customization
 * 
 * REFACTORING NOTES:
 * ==================
 * When refactoring this component, ensure compatibility with all use cases:
 * - Keep the component focused on presentation (showing templates)
 * - All interactivity should be handled via props (onTemplateClick, onTemplateAction, etc.)
 * - Avoid hardcoding use-case-specific logic in this component
 * - Consider adding more interaction handler props if new use cases emerge
 * - Template data structure should remain consistent across use cases
 * 
 * @param {Object} props
 * @param {Function} props.onTemplateClick - Callback when a template is clicked (receives template object)
 *    This is the main interaction handler - different use cases pass different functions:
 *    - Editor: Opens AI conversion UI
 *    - Settings: Opens template editor/management UI
 * @param {string} props.selectedTemplateId - Currently selected template ID (optional)
 *    Used to highlight which template is currently selected/active
 * @param {string} props.viewMode - 'grid' or 'list' (default: 'grid')
 * @param {Array} props.categories - Filter by specific categories (optional)
 * @param {Array} props.pageTypes - Filter by page types (optional)
 * @param {Function} props.onTemplateAction - Optional secondary action handler (e.g., edit, delete, duplicate)
 *    For use cases that need multiple actions per template
 * @param {Object} props.customActions - Optional custom action buttons per template
 *    Format: { [templateId]: [{ label: string, onClick: function, icon: component }] }
 */
export default function ShowTemplates({
  onTemplateClick,
  selectedTemplateId = null,
  categories = null,
  pageTypes = null,
  onTemplateAction = null,
  customActions = null,
  // Legacy prop name for backward compatibility
  onSelectTemplate = null,
  // Edit mode props
  editMode = false,
  onEdit = null,
  onDelete = null,
  onBookmark = null,
  bookmarkedIds = []
}) {
  // Support legacy prop name
  const handleTemplateClick = onTemplateClick || onSelectTemplate;
  const [templates, setTemplates] = useState([]);
  const [loading, setLoading] = useState(true);
  const [searchQuery, setSearchQuery] = useState('');
  const [selectedCategory, setSelectedCategory] = useState(null);
  const [customStylesEnabled, setCustomStylesEnabled] = useState(true);
  const [deleteConfirmTemplate, setDeleteConfirmTemplate] = useState(null);
  const [deleting, setDeleting] = useState(false);

  // Load templates
  useEffect(() => {
    const loadTemplates = async () => {
      try {
        setLoading(true);
        const monkey = await initMonkey(true); // Initialize with fullInitMode (already calls initUser internally)
        const componentsData = await monkey.loadComponents();
        let componentsList = Object.values(componentsData);
        
        // Sort templates: custom templates by order property, then others by default order
        componentsList.sort((a, b) => {
          // Both are custom templates with order property
          if (a.isCustom && b.isCustom && a.order !== undefined && b.order !== undefined) {
            return a.order - b.order;
          }
          // One has order, one doesn't - ordered ones come first
          if (a.isCustom && a.order !== undefined && (!b.isCustom || b.order === undefined)) {
            return -1;
          }
          if (b.isCustom && b.order !== undefined && (!a.isCustom || a.order === undefined)) {
            return 1;
          }
          // Neither has order or neither is custom - maintain default order
          return 0;
        });
        
        // Analyze templates
        const totalTemplates = componentsList.length;
        const customTemplates = componentsList.filter(t => t.isCustom);
        const userCreatedTemplates = componentsList.filter(t => t.isUserCreated);
        const defaultTemplates = componentsList.filter(t => !t.isCustom);
        const editedDefaultTemplates = componentsList.filter(t => t.isCustom && !t.isUserCreated);
        
        // Log details of custom templates
        if (customTemplates.length > 0) {
          customTemplates.forEach(template => {
            const templateType = template.isUserCreated ? 'USER-CREATED' : 'EDITED-DEFAULT';
          });
        } else {
        }
        
        // Log which templates replaced defaults
        if (editedDefaultTemplates.length > 0) {
          
          editedDefaultTemplates.forEach(template => {
            
          });
        }
        
        // Log all template IDs for reference
        
        setTemplates(componentsList);
      } catch (error) {
      } finally {
        setLoading(false);
      }
    };

    loadTemplates();
  }, []);

  // Handler to open delete confirmation modal
  const handleRemoveCustomClick = (template, e) => {
    e.stopPropagation();
    setDeleteConfirmTemplate(template);
  };

  // Handler for confirmation in modal
  const handleConfirmDelete = async () => {
    if (!deleteConfirmTemplate) return;
    
    setDeleting(true);
    try {
      const monkey = await initMonkey();
      const text = await monkey.apiCall('/api/templates/delete', { templateId: deleteConfirmTemplate.id }, { method: 'DELETE' });
      const data = JSON.parse(text);
      if (data.error) throw new Error(data.error || 'Failed to remove custom template');

      // Close modal first
      setDeleteConfirmTemplate(null);
      
      // Refresh the page to reload all data
      window.location.reload();
    } catch (error) {
      alert(`Failed to remove custom template: ${error.message}`);
    } finally {
      setDeleting(false);
    }
  };

  // Handler to cancel/close modal
  const handleCancelDelete = () => {
    setDeleteConfirmTemplate(null);
  };

  // Get unique column structures (excluding "custom" which will be handled separately)
  const allCategories = React.useMemo(() => {
    const structures = new Set();
    templates.forEach(t => {
      if (t.columnStructure && t.category !== 'custom') structures.add(t.columnStructure);
    });
    // Sort in specific order: single, two-column, multi-column
    const structureOrder = ['single', 'two-column', 'multi-column'];
    const categoriesArray = Array.from(structures).sort((a, b) => 
      structureOrder.indexOf(a) - structureOrder.indexOf(b)
    );
    
    // Add "Bookmarks" category first if bookmarks exist
    if (bookmarkedIds && bookmarkedIds.length > 0) {
      categoriesArray.unshift('bookmarks');
    }
    
    return categoriesArray;
  }, [templates, bookmarkedIds]);
  
  // Check if "custom" category exists
  const hasCustomCategory = React.useMemo(() => {
    return templates.some(t => t.category === 'custom');
  }, [templates]);
  
  // Set default selected category (only on initial load)
  // Priority: bookmarks > custom > All (null)
  useEffect(() => {
    if (loading) return; // Wait for templates to load
    if (selectedCategory !== null) return; // Don't override if user has selected something
    
    // First priority: bookmarks
    if (bookmarkedIds && bookmarkedIds.length > 0) {
      setSelectedCategory('bookmarks');
      return;
    }
    
    // Second priority: custom templates
    if (hasCustomCategory) {
      setSelectedCategory('custom');
      return;
    }
    
    // Default: All (null)
    // selectedCategory is already null, so no need to set it
  }, [loading, bookmarkedIds, hasCustomCategory]); // Only depend on these, not selectedCategory to avoid loops

  // Filter templates
  const filteredTemplates = React.useMemo(() => {
    let filtered = templates;

    // Filter by categories prop if provided (can be columnStructure or legacy category)
    if (categories && categories.length > 0) {
      filtered = filtered.filter(t => 
        categories.includes(t.columnStructure) || categories.includes(t.category)
      );
    }

    // Filter by pageTypes prop if provided
    if (pageTypes && pageTypes.length > 0) {
      filtered = filtered.filter(t => 
        !t.pageTypes || t.pageTypes.some(pt => pageTypes.includes(pt))
      );
    }

    // Filter by selected category (which is now columnStructure)
    if (selectedCategory) {
      if (selectedCategory === 'bookmarks') {
        // Show only bookmarked templates
        filtered = filtered.filter(t => bookmarkedIds.includes(t.id));
      } else {
        // Filter by columnStructure or legacy category
        filtered = filtered.filter(t => 
          t.columnStructure === selectedCategory || t.category === selectedCategory
        );
      }
    }

    // Filter by search query
    if (searchQuery.trim()) {
      const query = searchQuery.toLowerCase();
      filtered = filtered.filter(t => 
        t.name.toLowerCase().includes(query) ||
        t.category?.toLowerCase().includes(query) ||
        t.columnStructure?.toLowerCase().includes(query) ||
        (t.useCases && t.useCases.some(uc => uc.toLowerCase().includes(query))) ||
        (t.description && t.description.toLowerCase().includes(query))
      );
    }

    return filtered;
  }, [templates, categories, pageTypes, selectedCategory, searchQuery, bookmarkedIds]);

  const isShowingCustomTemplates = filteredTemplates.some(t => t.isCustom);

  const handleTemplateClickInternal = (template) => {
    if (handleTemplateClick) {
      handleTemplateClick(template);
    }
  };

  if (loading) {
    return (
      <div className="flex items-center justify-center p-12">
        <div className="text-center">
          <div className="w-8 h-8 border-4 border-blue-500 border-t-transparent rounded-full animate-spin mx-auto mb-4"></div>
          <p className="text-sm text-gray-600">Loading templates...</p>
        </div>
      </div>
    );
  }

  return (
    <div className="show-templates-container flex flex-col h-full min-h-0">
      {/* Search and Filter Bar */}
      <div className="flex-shrink-0 border-b border-gray-200 p-4 space-y-3">
        {/* Search */}
        <div className="relative">
          <Search className="absolute left-3 top-1/2 transform -translate-y-1/2 w-4 h-4 text-gray-400" />
          <input
            type="text"
            placeholder="Search templates..."
            value={searchQuery}
            onChange={(e) => setSearchQuery(e.target.value)}
            className="w-full pl-10 pr-4 py-2 border border-gray-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-blue-500 text-sm"
          />
        </div>

        {/* Category Filter, Custom Styles Toggle, and Edit Button */}
        <div className="flex items-center justify-between gap-4 flex-wrap">
          {(allCategories.length > 0 || hasCustomCategory || (bookmarkedIds && bookmarkedIds.length > 0)) && (
            <div className="flex items-center gap-2 flex-wrap">
              {/* Bookmarks button (first, if bookmarks exist) */}
              {bookmarkedIds && bookmarkedIds.length > 0 && (
                <button
                  onClick={() => setSelectedCategory('bookmarks')}
                  className={`px-3 py-1 text-xs font-medium rounded-full transition-colors capitalize ${
                    selectedCategory === 'bookmarks'
                      ? 'bg-blue-600 text-white'
                      : 'bg-gray-100 text-gray-700 hover:bg-gray-200'
                  }`}
                >
                  Bookmarks
                </button>
              )}
              {/* Show "custom" category before "All" if it exists */}
              {hasCustomCategory && (
                <button
                  onClick={() => setSelectedCategory('custom')}
                  className={`px-3 py-1 text-xs font-medium rounded-full transition-colors capitalize ${
                    selectedCategory === 'custom'
                      ? 'bg-blue-600 text-white'
                      : 'bg-gray-100 text-gray-700 hover:bg-gray-200'
                  }`}
                >
                  Custom
                </button>
              )}
              {/* "All" button */}
              <button
                onClick={() => setSelectedCategory(null)}
                className={`px-3 py-1 text-xs font-medium rounded-full transition-colors ${
                  selectedCategory === null
                    ? 'bg-blue-600 text-white'
                    : 'bg-gray-100 text-gray-700 hover:bg-gray-200'
                }`}
              >
                All
              </button>
              {/* Other categories (excluding bookmarks since it's shown above) */}
              {allCategories.filter(cat => cat !== 'bookmarks').map(category => {
                // Map columnStructure to human-readable names
                const categoryLabels = {
                  'single': 'Single Column',
                  'two-column': '2-Column',
                  'multi-column': '3+ Columns'
                };
                const displayName = categoryLabels[category] || category;
                
                return (
                  <button
                    key={category}
                    onClick={() => setSelectedCategory(category)}
                    className={`px-3 py-1 text-xs font-medium rounded-full transition-colors ${
                      selectedCategory === category
                        ? 'bg-blue-600 text-white'
                        : 'bg-gray-100 text-gray-700 hover:bg-gray-200'
                    }`}
                  >
                    {displayName}
                  </button>
                );
              })}
            </div>
          )}
          <div className="flex items-center gap-3">
            {/* Custom Styles Toggle - only when showing custom templates */}
            {isShowingCustomTemplates && (
              <label className="flex items-center gap-2 cursor-pointer">
                <div className="relative">
                  <input
                    type="checkbox"
                    checked={customStylesEnabled}
                    onChange={(e) => setCustomStylesEnabled(e.target.checked)}
                    className="sr-only"
                  />
                  <div className={`w-11 h-6 rounded-full transition-colors ${
                    customStylesEnabled ? 'bg-blue-600' : 'bg-gray-300'
                  }`}>
                    <div className={`w-5 h-5 bg-white rounded-full shadow-md transform transition-transform mt-0.5 ml-0.5 ${
                      customStylesEnabled ? 'translate-x-5' : 'translate-x-0'
                    }`} />
                  </div>
                </div>
                <span className="text-sm font-medium text-gray-700 flex items-center gap-1">
                  <Palette className="w-4 h-4" />
                  Custom Styles
                </span>
              </label>
            )}
            <Link
              href="/settings/page-templates"
              target="_blank"
              rel="noopener noreferrer"
              className="flex items-center gap-2 px-3 py-1.5 text-xs font-medium text-gray-700 bg-white border border-gray-300 rounded-lg hover:bg-gray-50 hover:border-gray-400 transition-colors"
            >
              <Settings className="w-4 h-4" />
              Edit Templates
            </Link>
          </div>
        </div>
      </div>

      {/* Templates Display */}
      <div className="flex-1 overflow-y-auto overflow-x-hidden min-h-0 p-4">
        {filteredTemplates.length === 0 ? (
          <div className="text-center py-12">
            <p className="text-gray-500 text-sm">No templates found</p>
            {searchQuery && (
              <p className="text-gray-400 text-xs mt-2">Try a different search term</p>
            )}
          </div>
        ) : (
          <div className="space-y-6">
            {filteredTemplates.map(template => {
              const isSelected = selectedTemplateId === template.id;
              
              return (
                <div
                  key={template.id}
                  onClick={() => handleTemplateClickInternal(template)}
                  className={`
                    relative rounded-lg transition-all overflow-hidden
                    ${handleTemplateClick ? 'cursor-pointer' : 'cursor-default'}
                    ${isSelected 
                      ? 'ring-4 ring-blue-600' 
                      : 'ring-2 ring-gray-200 hover:ring-blue-300 hover:shadow-lg'
                    }
                  `}
                >
                  {/* Template Header */}
                  <div className={`px-6 py-4 border-b-2 ${isSelected ? 'bg-blue-50 border-blue-600' : 'bg-gray-50 border-gray-200'}`}>
                    <div className="flex items-start justify-between gap-4">
                      <div className="flex flex-col gap-2 flex-1 min-w-0">
                        <h2 className="text-2xl font-bold text-gray-900">{template.name}</h2>
                        {/* Display use cases below template name */}
                        {template.useCases && template.useCases.length > 0 && (
                          <p className="text-sm text-gray-600">
                            {template.useCases.join(' • ')}
                          </p>
                        )}
                      </div>
                      <div className="flex items-center gap-2 flex-shrink-0">
                        {isSelected && !editMode && (
                          <div className="bg-blue-600 text-white rounded-full p-2">
                            <Check className="w-5 h-5" />
                          </div>
                        )}
                        {editMode && (
                          <>
                            {/* Bookmark Button */}
                            {onBookmark && (
                              <button
                                onClick={(e) => {
                                  e.stopPropagation();
                                  onBookmark(template);
                                }}
                                className={`p-2 rounded-lg transition-colors ${
                                  bookmarkedIds.includes(template.id)
                                    ? 'bg-yellow-100 text-yellow-700 hover:bg-yellow-200'
                                    : 'bg-white border border-gray-300 text-gray-600 hover:bg-gray-100'
                                }`}
                                title={bookmarkedIds.includes(template.id) ? 'Remove bookmark' : 'Add bookmark'}
                              >
                                {bookmarkedIds.includes(template.id) ? (
                                  <BookmarkCheck className="w-5 h-5" />
                                ) : (
                                  <Bookmark className="w-5 h-5" />
                                )}
                              </button>
                            )}
                            {/* Edit Button */}
                            {onEdit && (
                              <button
                                onClick={(e) => {
                                  e.stopPropagation();
                                  onEdit(template);
                                }}
                                className="p-2 bg-blue-600 text-white rounded-lg hover:bg-blue-700 transition-colors"
                                title="Edit template"
                              >
                                <Edit className="w-5 h-5" />
                              </button>
                            )}
                            {/* Delete Button (only for user-created templates) */}
                            {onDelete && template.isUserCreated && (
                              <button
                                onClick={(e) => {
                                  e.stopPropagation();
                                  onDelete(template);
                                }}
                                className="p-2 bg-red-600 text-white rounded-lg hover:bg-red-700 transition-colors"
                                title="Delete template"
                              >
                                <Trash2 className="w-5 h-5" />
                              </button>
                            )}
                          </>
                        )}
                      </div>
                    </div>
                    {template.description && (
                      <p className="text-sm text-gray-600 mt-2">{template.description}</p>
                    )}
                  </div>

                  {/* Template Preview - uses shadow DOM with custom CSS when toggle on and template is custom */}
                  <TemplatePreview template={template} customStylesEnabled={customStylesEnabled} />
                </div>
              );
            })}
          </div>
        )}
      </div>

      {/* Footer Info */}
      <div className="flex-shrink-0 border-t border-gray-200 px-4 py-2 bg-gray-50">
        <p className="text-xs text-gray-500 text-center">
          {filteredTemplates.length} template{filteredTemplates.length !== 1 ? 's' : ''} found
        </p>
      </div>

      {/* Delete Confirmation Modal */}
      {deleteConfirmTemplate && (
        <div className="fixed inset-0 bg-black bg-opacity-50 flex items-center justify-center z-50 p-4">
          <div className="bg-white rounded-lg shadow-lg max-w-md w-full p-6">
            <div className="flex items-start gap-3 mb-4">
              <div className="flex-shrink-0 w-10 h-10 rounded-full bg-red-100 flex items-center justify-center">
                <X className="w-5 h-5 text-red-600" />
              </div>
              <div className="flex-1">
                <h3 className="text-lg font-semibold text-gray-900 mb-2">
                  Remove Custom Template?
                </h3>
                <p className="text-sm text-gray-600">
                  This will remove the custom template <strong>"{deleteConfirmTemplate.name}"</strong> and revert it to the original default template. This action cannot be undone.
                </p>
              </div>
            </div>
            <div className="flex justify-end gap-3 mt-6">
              <button
                onClick={handleCancelDelete}
                disabled={deleting}
                className="px-4 py-2 text-sm font-medium text-gray-700 bg-white border border-gray-300 rounded-md hover:bg-gray-50 disabled:opacity-50 disabled:cursor-not-allowed"
              >
                Cancel
              </button>
              <button
                onClick={handleConfirmDelete}
                disabled={deleting}
                className="px-4 py-2 text-sm font-medium text-white bg-red-600 rounded-md hover:bg-red-700 disabled:opacity-50 disabled:cursor-not-allowed flex items-center gap-2"
              >
                {deleting ? (
                  <>
                    <div className="w-4 h-4 border-2 border-white border-t-transparent rounded-full animate-spin"></div>
                    Removing...
                  </>
                ) : (
                  'Remove Template'
                )}
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
