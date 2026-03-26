// ARCHIVED: Original path was app/(private)/settings/components/ComponentCustomizationTab.js

"use client";

import React, { useState, useEffect } from "react";
import { initMonkey } from "@/libs/monkey";
import { Check, X, RotateCcw, Save } from "lucide-react";

export default function ComponentCustomizationTab() {
  const [components, setComponents] = useState({});
  const [pageTypes, setPageTypes] = useState({});
  const [selectedComponent, setSelectedComponent] = useState(null);
  const [customHtml, setCustomHtml] = useState('');
  const [originalHtml, setOriginalHtml] = useState('');
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState(null);
  const [successMessage, setSuccessMessage] = useState('');
  const [filterCategory, setFilterCategory] = useState('all');
  
  // Load components and page types
  useEffect(() => {
    loadComponentsData();
  }, []);

  const loadComponentsData = async () => {
    setLoading(true);
    setError(null);
    
    try {
      const monkey = await initMonkey(true);
      const componentsData = await monkey.loadComponents();
      
      // Also load page types and get default registry for reset functionality
      const registryModule = await import('@/libs/content-magic/components/registry.js');
      
      setComponents(componentsData);
      setPageTypes(registryModule.PAGE_TYPES);
      
      console.log('[ComponentCustomization] Loaded', Object.keys(componentsData).length, 'components');
    } catch (err) {
      console.error('[ComponentCustomization] Error loading components:', err);
      setError(err.message);
    } finally {
      setLoading(false);
    }
  };

  const handleSelectComponent = async (component) => {
    setSelectedComponent(component);
    setCustomHtml(component.html);
    setSuccessMessage('');
    
    // Load original HTML for comparison
    try {
      const registryModule = await import('@/libs/content-magic/components/registry.js');
      const originalComponent = registryModule.COMPONENTS[component.id];
      setOriginalHtml(originalComponent?.html || '');
    } catch (err) {
      console.error('[ComponentCustomization] Error loading original:', err);
      setOriginalHtml('');
    }
  };

  const handleSaveComponent = async () => {
    if (!selectedComponent) return;
    
    setSaving(true);
    setError(null);
    setSuccessMessage('');
    
    try {
      const monkey = await initMonkey(true);
      await monkey.saveComponentCustomization(selectedComponent.id, customHtml);
      
      // Refresh components list
      const updated = await monkey.loadComponents();
      setComponents(updated);
      
      // Update the selected component to show the custom badge
      const updatedComponent = updated[selectedComponent.id];
      setSelectedComponent(updatedComponent);
      
      setSuccessMessage('Component customization saved successfully!');
      
      // Clear success message after 3 seconds
      setTimeout(() => setSuccessMessage(''), 3000);
    } catch (err) {
      console.error('[ComponentCustomization] Error saving:', err);
      setError(err.message);
    } finally {
      setSaving(false);
    }
  };

  const handleResetToDefault = async () => {
    if (!selectedComponent || !originalHtml) return;
    
    if (!confirm('Are you sure you want to reset this component to its default template? This will remove your customization.')) {
      return;
    }
    
    setSaving(true);
    setError(null);
    setSuccessMessage('');
    
    try {
      const monkey = await initMonkey(true);
      await monkey.saveComponentCustomization(selectedComponent.id, originalHtml);
      
      // Refresh components list
      const updated = await monkey.loadComponents();
      setComponents(updated);
      
      // Update the selected component
      const updatedComponent = updated[selectedComponent.id];
      setSelectedComponent(updatedComponent);
      setCustomHtml(originalHtml);
      
      setSuccessMessage('Component reset to default successfully!');
      
      // Clear success message after 3 seconds
      setTimeout(() => setSuccessMessage(''), 3000);
    } catch (err) {
      console.error('[ComponentCustomization] Error resetting:', err);
      setError(err.message);
    } finally {
      setSaving(false);
    }
  };

  // Get unique categories
  const categories = ['all', ...new Set(Object.values(components).map(c => c.category))];

  // Filter components by category
  const filteredComponents = Object.values(components).filter(component => 
    filterCategory === 'all' || component.category === filterCategory
  );

  // Group components by category for display
  const componentsByCategory = filteredComponents.reduce((acc, component) => {
    const cat = component.category;
    if (!acc[cat]) acc[cat] = [];
    acc[cat].push(component);
    return acc;
  }, {});

  if (loading) {
    return (
      <div className="flex items-center justify-center py-12">
        <div className="flex items-center gap-2 text-gray-600">
          <div className="w-5 h-5 border-2 border-blue-600 border-t-transparent rounded-full animate-spin"></div>
          Loading component templates...
        </div>
      </div>
    );
  }

  return (
    <div className="space-y-6">
      {/* Header */}
      <div>
        <h2 className="text-lg font-semibold text-gray-900">Component Templates</h2>
        <p className="text-sm text-gray-600 mt-1">
          Customize default component templates to match your brand. Your customizations will apply globally whenever you insert components.
        </p>
      </div>

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

      {/* Main Grid Layout */}
      <div className="grid grid-cols-3 gap-6">
        {/* Left: Component List */}
        <div className="col-span-1 space-y-4">
          <div>
            <label className="block text-sm font-medium text-gray-700 mb-2">
              Filter by Category
            </label>
            <select
              value={filterCategory}
              onChange={(e) => setFilterCategory(e.target.value)}
              className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-blue-500"
            >
              {categories.map(cat => (
                <option key={cat} value={cat}>
                  {cat === 'all' ? 'All Categories' : cat.replace(/-/g, ' ').replace(/\b\w/g, l => l.toUpperCase())}
                </option>
              ))}
            </select>
          </div>

          <div>
            <h3 className="text-sm font-semibold text-gray-700 mb-2">Select Component</h3>
            <div className="space-y-1 max-h-96 overflow-y-auto border border-gray-200 rounded-lg p-2">
              {Object.entries(componentsByCategory).map(([category, categoryComponents]) => (
                <div key={category} className="mb-2">
                  <p className="text-xs font-semibold text-gray-500 uppercase tracking-wide px-2 py-1">
                    {category.replace(/-/g, ' ')}
                  </p>
                  {categoryComponents.map(component => (
                    <button
                      key={component.id}
                      onClick={() => handleSelectComponent(component)}
                      className={`w-full text-left px-3 py-2 rounded-md text-sm transition-colors ${
                        selectedComponent?.id === component.id
                          ? 'bg-blue-100 text-blue-900'
                          : component.isCustom
                            ? 'bg-blue-50 hover:bg-blue-100 text-gray-900'
                            : 'hover:bg-gray-100 text-gray-700'
                      }`}
                    >
                      <div className="flex items-center justify-between">
                        <span>{component.name}</span>
                        {component.isCustom && (
                          <span className="inline-flex items-center rounded-full border px-2 py-0.5 text-xs font-semibold bg-blue-600 text-white border-blue-600">
                            Custom
                          </span>
                        )}
                      </div>
                    </button>
                  ))}
                </div>
              ))}
            </div>
          </div>
        </div>

        {/* Middle & Right: HTML Editor and Preview */}
        <div className="col-span-2">
          {selectedComponent ? (
            <div className="space-y-4">
              {/* Header */}
              <div className="flex items-center justify-between">
                <div>
                  <h3 class="text-lg font-semibold text-gray-900">{selectedComponent.name}</h3>
                  <p className="text-sm text-gray-600">
                    Category: <span className="font-medium">{selectedComponent.category}</span>
                    {selectedComponent.isCustom && (
                      <span className="ml-2 inline-flex items-center rounded-full border px-2 py-0.5 text-xs font-semibold bg-blue-50 text-blue-700 border-blue-200">
                        Customized
                      </span>
                    )}
                  </p>
                </div>
                <div className="flex gap-2">
                  <button
                    onClick={handleResetToDefault}
                    disabled={saving || !selectedComponent.isCustom}
                    className="flex items-center gap-2 px-4 py-2 border border-gray-300 text-gray-700 rounded-lg hover:bg-gray-50 transition-colors disabled:opacity-50 disabled:cursor-not-allowed text-sm font-medium"
                  >
                    <RotateCcw className="w-4 h-4" />
                    Reset to Default
                  </button>
                  <button
                    onClick={handleSaveComponent}
                    disabled={saving}
                    className="flex items-center gap-2 px-4 py-2 bg-blue-600 text-white rounded-lg hover:bg-blue-700 transition-colors disabled:opacity-50 disabled:cursor-not-allowed text-sm font-medium"
                  >
                    {saving ? (
                      <>
                        <div className="w-4 h-4 border-2 border-white border-t-transparent rounded-full animate-spin"></div>
                        Saving...
                      </>
                    ) : (
                      <>
                        <Save className="w-4 h-4" />
                        Save Override
                      </>
                    )}
                  </button>
                </div>
              </div>

              {/* HTML Editor */}
              <div>
                <label className="block text-sm font-medium text-gray-700 mb-2">
                  Component HTML
                </label>
                <textarea
                  value={customHtml}
                  onChange={(e) => setCustomHtml(e.target.value)}
                  rows={15}
                  className="w-full px-3 py-2 border border-gray-300 rounded-lg font-mono text-sm focus:outline-none focus:ring-2 focus:ring-blue-500 focus:border-transparent"
                  placeholder="Enter component HTML..."
                />
                <p className="text-xs text-gray-500 mt-1">
                  Edit the HTML template. Changes will apply to all future insertions of this component.
                </p>
              </div>

              {/* Preview */}
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

              {/* Placeholders Info */}
              {selectedComponent.placeholders && Object.keys(selectedComponent.placeholders).length > 0 && (
                <div className="bg-gray-50 border border-gray-200 rounded-lg p-4">
                  <h4 className="text-sm font-semibold text-gray-700 mb-2">Placeholders (for AI Fill)</h4>
                  <div className="space-y-1">
                    {Object.entries(selectedComponent.placeholders).map(([placeholder, description]) => (
                      <div key={placeholder} className="text-xs text-gray-600">
                        <span className="font-mono bg-gray-200 px-1 py-0.5 rounded">{placeholder}</span>
                        <span className="ml-2 text-gray-500">→ {description}</span>
                      </div>
                    ))}
                  </div>
                </div>
              )}
            </div>
          ) : (
            <div className="flex items-center justify-center h-64 border-2 border-dashed border-gray-300 rounded-lg">
              <p className="text-gray-500">Select a component from the list to customize</p>
            </div>
          )}
        </div>
      </div>
    </div>
  );
}
