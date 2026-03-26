"use client";
import React, { useState, useEffect } from "react";
import Link from "next/link";
import { Plus, Loader, Download, ArrowUpDown, ArrowLeft } from "lucide-react";
import ShowTemplates from "@/libs/monkey/components/ShowTemplates";
import { initMonkey } from "@/libs/monkey";
import TemplateEditPopup from "./components/TemplateEditPopup";
import CreateTemplateDialog from "./components/CreateTemplateDialog";
import ImportTemplateDialog from "./components/ImportTemplateDialog";
import ReorderTemplatesDialog from "./components/ReorderTemplatesDialog";

export default function PageTemplatesSettings() {
  const [selectedTemplate, setSelectedTemplate] = useState(null);
  const [showEditPopup, setShowEditPopup] = useState(false);
  const [showCreateDialog, setShowCreateDialog] = useState(false);
  const [showImportDialog, setShowImportDialog] = useState(false);
  const [showReorderDialog, setShowReorderDialog] = useState(false);
  const [bookmarkedIds, setBookmarkedIds] = useState([]);
  const [loading, setLoading] = useState(true);
  const [refreshKey, setRefreshKey] = useState(0);

  // Load bookmarks on mount
  useEffect(() => {
    loadBookmarks();
  }, []);

  const loadBookmarks = async () => {
    try {
      setLoading(true);
      const monkey = await initMonkey(true); // Initialize with fullInitMode (already calls initUser internally)
      
      // Check if user is authenticated
      if (!monkey.user?.id) {

        setLoading(false);
        return;
      }
      
      // Use cached profile loader to reduce database calls
      const profileData = await monkey.loadProfile();
      const profile = profileData ? [profileData] : [];
      
      if (profile && profile[0]?.json?.customizations?.bookmarks) {
        setBookmarkedIds(profile[0].json.customizations.bookmarks);
      }
    } catch (error) {

    } finally {
      setLoading(false);
    }
  };

  const handleTemplateClick = (template) => {

    setSelectedTemplate(template);
  };

  const handleEdit = (template) => {

    setSelectedTemplate(template);
    setShowEditPopup(true);
  };

  const handleDelete = async (template) => {
    if (!confirm(`Delete template "${template.name}"? This cannot be undone.`)) {
      return;
    }

    try {
      const monkey = await initMonkey();
      const text = await monkey.apiCall('/api/templates/delete', { templateId: template.id }, { method: 'DELETE' });
      const data = JSON.parse(text);
      if (data.error) throw new Error(data.error || 'Failed to delete template');

      await monkey.loadProfile(true);
      setRefreshKey(prev => prev + 1);
      setSelectedTemplate(null);
      
      alert(`Template "${template.name}" deleted successfully`);
    } catch (error) {

      alert(`Error: ${error.message}`);
    }
  };

  const handleBookmark = async (template) => {
    try {
      const isBookmarked = bookmarkedIds.includes(template.id);
      const method = isBookmarked ? 'DELETE' : 'POST';

      const monkey = await initMonkey();
      const text = await monkey.apiCall('/api/templates/bookmarks', { templateId: template.id }, { method });
      const data = JSON.parse(text);
      if (data.error) throw new Error(data.error || 'Failed to update bookmark');

      // Update local state
      if (isBookmarked) {
        setBookmarkedIds(prev => prev.filter(id => id !== template.id));
      } else {
        setBookmarkedIds(prev => [...prev, template.id]);
      }
    } catch (error) {

      alert(`Error: ${error.message}`);
    }
  };

  const handleSaveEdit = async () => {
    // Invalidate profile cache so ShowTemplates loads fresh template data
    const monkey = await initMonkey();
    await monkey.loadProfile(true);
    setRefreshKey(prev => prev + 1);
    loadBookmarks();
    setShowEditPopup(false);
    setSelectedTemplate(null);
  };

  const handleCreateComplete = async () => {
    const monkey = await initMonkey();
    await monkey.loadProfile(true);
    setRefreshKey(prev => prev + 1);
    loadBookmarks();
    setShowCreateDialog(false);
  };

  const handleImportComplete = async () => {
    const monkey = await initMonkey();
    await monkey.loadProfile(true);
    setRefreshKey(prev => prev + 1);
    loadBookmarks();
    setShowImportDialog(false);
  };

  const handleReorderSave = () => {
    // Reload the entire page to refresh templates with new order
    window.location.reload();
  };

  if (loading) {
    return (
      <div className="max-w-6xl mx-auto py-8">
        <div className="flex items-center justify-center p-12">
          <div className="text-center">
            <Loader className="w-8 h-8 animate-spin text-blue-500 mx-auto mb-4" />
            <p className="text-sm text-gray-600">Loading templates...</p>
          </div>
        </div>
      </div>
    );
  }

  return (
    <div className="max-w-6xl mx-auto py-8">
      {/* Back Link */}
      <Link
        href="/settings"
        className="inline-flex items-center gap-2 text-sm text-gray-600 hover:text-gray-900 mb-6"
      >
        <ArrowLeft className="w-4 h-4" />
        Back to Settings
      </Link>

      {/* Header */}
      <div className="mb-6">
        <h1 className="text-2xl font-bold text-gray-900 mb-2">Page Templates</h1>
        <p className="text-sm text-gray-600">
          View, edit, create, and bookmark your page templates.
        </p>
      </div>

      {/* Templates Card */}
      <div className="bg-white rounded-lg border border-gray-200 shadow-sm">
        {/* Card Header with Actions */}
        <div className="px-6 py-4 border-b border-gray-200 bg-gray-50 flex items-center justify-between flex-wrap gap-3">
          <div>
            <h2 className="text-lg font-semibold text-gray-900">Your Templates</h2>
            <p className="text-sm text-gray-600 mt-1">
              Search, filter, and manage your page templates. Use bookmarks to pin favorites.
            </p>
          </div>
          <div className="flex items-center gap-3">
            <button
              onClick={() => setShowReorderDialog(true)}
              className="flex items-center gap-2 px-4 py-2 bg-gray-600 text-white rounded-lg hover:bg-gray-700 transition-colors text-sm font-medium"
            >
              <ArrowUpDown className="w-4 h-4" />
              Reorder Custom Templates
            </button>
            <button
              onClick={() => setShowImportDialog(true)}
              className="flex items-center gap-2 px-4 py-2 bg-purple-600 text-white rounded-lg hover:bg-purple-700 transition-colors text-sm font-medium"
            >
              <Download className="w-4 h-4" />
              Import from Page
            </button>
            <button
              onClick={() => setShowCreateDialog(true)}
              className="flex items-center gap-2 px-4 py-2 bg-blue-600 text-white rounded-lg hover:bg-blue-700 transition-colors text-sm font-medium"
            >
              <Plus className="w-4 h-4" />
              Create New Template
            </button>
          </div>
        </div>

        {/* Templates Display */}
        <div className="min-h-[400px] overflow-hidden">
          <ShowTemplates
            key={refreshKey}
            onTemplateClick={handleTemplateClick}
            selectedTemplateId={selectedTemplate?.id}
            editMode={true}
            onEdit={handleEdit}
            onDelete={handleDelete}
            onBookmark={handleBookmark}
            bookmarkedIds={bookmarkedIds}
          />
        </div>
      </div>

      {/* Template Edit Popup */}
      {showEditPopup && selectedTemplate && (
        <TemplateEditPopup
          isOpen={showEditPopup}
          onClose={() => {
            setShowEditPopup(false);
            setSelectedTemplate(null);
          }}
          template={selectedTemplate}
          onSave={handleSaveEdit}
        />
      )}

      {/* Create Template Dialog */}
      {showCreateDialog && (
        <CreateTemplateDialog
          isOpen={showCreateDialog}
          onClose={() => setShowCreateDialog(false)}
          onComplete={handleCreateComplete}
        />
      )}

      {/* Import Template Dialog */}
      {showImportDialog && (
        <ImportTemplateDialog
          isOpen={showImportDialog}
          onClose={() => setShowImportDialog(false)}
          onComplete={handleImportComplete}
        />
      )}

      {/* Reorder Templates Dialog */}
      {showReorderDialog && (
        <ReorderTemplatesDialog
          isOpen={showReorderDialog}
          onClose={() => setShowReorderDialog(false)}
          onSave={handleReorderSave}
        />
      )}
    </div>
  );
}
