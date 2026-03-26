"use client";

import React, { useState, useEffect, useMemo } from "react";
import { ArrowLeft, Plus, Sparkles, Edit2, Trash2, AlertTriangle, Loader, ChevronLeft, ChevronRight } from "lucide-react";
import { createClient } from "@/libs/supabase/client";
import CampaignArticleOutline from "./CampaignArticleOutline";

export default function CampaignSatelliteArticles({ campaign, onBack }) {
  const [satelliteArticles, setSatelliteArticles] = useState([]);
  const [isLoading, setIsLoading] = useState(true);
  const [selectedArticle, setSelectedArticle] = useState(null);
  const [selectedPhase, setSelectedPhase] = useState(null);
  const [selectedIds, setSelectedIds] = useState(new Set());
  const [search, setSearch] = useState("");
  const [statusFilter, setStatusFilter] = useState("all");
  const [typeFilter, setTypeFilter] = useState("all");
  const [showBulkActions, setShowBulkActions] = useState(false);
  const [showDeleteConfirm, setShowDeleteConfirm] = useState(false);
  const [showStatusChangeConfirm, setShowStatusChangeConfirm] = useState(false);
  const [newStatus, setNewStatus] = useState("draft");
  const [deleting, setDeleting] = useState(false);
  const [currentPage, setCurrentPage] = useState(1);
  const articlesPerPage = 20;
  const supabase = createClient();

  useEffect(() => {
    if (campaign?.id) {
      loadSatelliteArticles();
    }
  }, [campaign?.id]);

  const loadSatelliteArticles = async () => {
    try {
      setIsLoading(true);
      const { data: { user } } = await supabase.auth.getUser();
      if (!user) return;

      // Load articles with campaign_phase = 4 (Expand) or type = "satellite"
      const { data, error } = await supabase
        .from("content_magic_articles")
        .select("*")
        .eq("campaign_id", campaign.id)
        .eq("user_id", user.id)
        .or("campaign_phase.eq.4,type.eq.satellite")
        .order("created_at", { ascending: false });

      if (error) throw error;

      setSatelliteArticles(data || []);
    } catch (error) {
    } finally {
      setIsLoading(false);
    }
  };

  // Filtered articles
  const filteredArticles = useMemo(() => {
    return satelliteArticles.filter((article) => {
      const matchesTitle = article.title?.toLowerCase().includes(search.toLowerCase()) || false;
      const matchesStatus = statusFilter === "all" || article.status === statusFilter;
      const matchesType = typeFilter === "all" || article.type === typeFilter;
      return matchesTitle && matchesStatus && matchesType;
    });
  }, [satelliteArticles, search, statusFilter, typeFilter]);

  // Pagination
  const totalPages = Math.ceil(filteredArticles.length / articlesPerPage);
  const startIndex = (currentPage - 1) * articlesPerPage;
  const endIndex = startIndex + articlesPerPage;
  const paginatedArticles = filteredArticles.slice(startIndex, endIndex);

  // Reset to page 1 when filters change
  useEffect(() => {
    setCurrentPage(1);
  }, [search, statusFilter, typeFilter]);

  // Show bulk actions when items are selected
  useEffect(() => {
    setShowBulkActions(selectedIds.size > 0);
  }, [selectedIds]);

  const handleSelectAll = (checked) => {
    if (checked) {
      setSelectedIds(new Set(paginatedArticles.map(a => a.id)));
    } else {
      setSelectedIds(new Set());
    }
  };

  const handleSelectArticle = (articleId, checked) => {
    const newSelected = new Set(selectedIds);
    if (checked) {
      newSelected.add(articleId);
    } else {
      newSelected.delete(articleId);
    }
    setSelectedIds(newSelected);
  };

  const handleBulkDelete = async () => {
    if (!showDeleteConfirm) {
      setShowDeleteConfirm(true);
      return;
    }

    try {
      setDeleting(true);
      const ids = Array.from(selectedIds);
      
      const { initMonkey } = await import("@/libs/monkey");
      const monkey = await initMonkey();
      for (const id of ids) {
        const text = await monkey.apiCall("/api/content-magic/delete", { articleId: id }, { method: "DELETE" });
        const data = JSON.parse(text);
        if (data.error) throw new Error(data.error || `Failed to delete article ${id}`);
      }

      // Remove from local state
      setSatelliteArticles(prev => prev.filter(a => !selectedIds.has(a.id)));
      setSelectedIds(new Set());
      setShowDeleteConfirm(false);
      alert(`Deleted ${ids.length} article(s) successfully`);
    } catch (error) {
      alert(`Failed to delete articles: ${error.message}`);
    } finally {
      setDeleting(false);
    }
  };

  const handleBulkStatusChange = async () => {
    if (!showStatusChangeConfirm) {
      setShowStatusChangeConfirm(true);
      return;
    }

    try {
      const ids = Array.from(selectedIds);
      
      for (const id of ids) {
        const { error } = await supabase
          .from("content_magic_articles")
          .update({ status: newStatus })
          .eq("id", id);

        if (error) throw error;
      }

      // Update local state
      setSatelliteArticles(prev => prev.map(a => 
        selectedIds.has(a.id) ? { ...a, status: newStatus } : a
      ));
      setSelectedIds(new Set());
      setShowStatusChangeConfirm(false);
      alert(`Updated ${ids.length} article(s) status to ${newStatus}`);
    } catch (error) {
      alert(`Failed to update status: ${error.message}`);
    }
  };

  const handleCreateNewSatellite = () => {
    setSelectedPhase("Expand");
    setSelectedArticle(null);
  };

  const handleArticleClick = (article) => {
    setSelectedArticle(article);
    setSelectedPhase("Expand");
  };

  const handleArticleSaved = async () => {
    await loadSatelliteArticles();
    setSelectedArticle(null);
    setSelectedPhase(null);
  };

  // Get unique statuses and types for filters
  const uniqueStatuses = useMemo(() => {
    const statuses = [...new Set(satelliteArticles.map(a => a.status).filter(Boolean))];
    return statuses.sort();
  }, [satelliteArticles]);

  const uniqueTypes = useMemo(() => {
    const types = [...new Set(satelliteArticles.map(a => a.type).filter(Boolean))];
    return types.sort();
  }, [satelliteArticles]);

  // Get campaign context
  const phase3Article = campaign?.articleMetadata?.find(a => a.campaign_phase === 3);
  const pillarTitle = phase3Article?.title || "Phase 3 Pillar";
  const offerName = campaign?.offer?.name || campaign?.offers?.name || "Your Offer";
  const outcome = campaign?.outcome || "Your Outcome";
  const icpName = campaign?.icp?.name || campaign?.icps?.name || "Your ICP";

  // If an article is selected, show the outline editor
  if (selectedArticle || selectedPhase) {
    return (
      <CampaignArticleOutline
        key={selectedArticle?.id || 'new-satellite'}
        campaign={campaign}
        phase="4"
        articleId={selectedArticle?.id}
        onBack={() => {
          setSelectedArticle(null);
          setSelectedPhase(null);
        }}
        onSaved={handleArticleSaved}
      />
    );
  }

  return (
    <div className="flex h-screen overflow-hidden">
      {/* Main Content */}
      <div className="flex-1 overflow-y-auto">
        <div className="max-w-6xl mx-auto px-4 py-8">
          {/* Header */}
          <div className="mb-6">
            <button
              onClick={onBack}
              className="flex items-center gap-2 text-gray-600 hover:text-gray-900 mb-4"
            >
              <ArrowLeft className="w-4 h-4" />
              Back to Campaign Settings
            </button>
            <div className="flex items-center justify-between">
              <div>
                <h1 className="text-2xl font-bold text-gray-900">Satellite Articles</h1>
                <p className="text-gray-600 mt-2">
                  Supporting articles around your Phase 3 pillar to grow search visibility.
                </p>
              </div>
              <button
                onClick={handleCreateNewSatellite}
                className="flex items-center gap-2 bg-purple-600 text-white px-4 py-2 rounded hover:bg-purple-700 transition-colors"
              >
                <Plus className="w-4 h-4" />
                Deep Dive on Pillar Concepts
              </button>
            </div>
          </div>

          {/* Filters */}
          <div className="mb-4 flex items-center gap-3">
            <input
              type="text"
              placeholder="Search by title"
              className="border rounded px-3 py-2 w-64"
              value={search}
              onChange={(e) => setSearch(e.target.value)}
            />
            <select
              value={statusFilter}
              onChange={(e) => setStatusFilter(e.target.value)}
              className="border rounded px-3 py-2"
            >
              <option value="all">All Statuses</option>
              {uniqueStatuses.map(status => (
                <option key={status} value={status}>{status}</option>
              ))}
            </select>
            <select
              value={typeFilter}
              onChange={(e) => setTypeFilter(e.target.value)}
              className="border rounded px-3 py-2"
            >
              <option value="all">All Types</option>
              {uniqueTypes.map(type => (
                <option key={type} value={type}>{type}</option>
              ))}
            </select>
          </div>

          {/* Bulk Actions Bar */}
          {showBulkActions && (
            <div className="mb-4 p-3 bg-purple-50 border border-purple-200 rounded-lg flex items-center justify-between">
              <div className="text-sm font-medium text-purple-900">
                {selectedIds.size} article(s) selected
              </div>
              <div className="flex items-center gap-2">
                <button
                  onClick={() => setShowStatusChangeConfirm(true)}
                  className="px-3 py-1.5 bg-purple-600 text-white text-sm rounded hover:bg-purple-700"
                >
                  Change Status
                </button>
                <button
                  onClick={() => setShowDeleteConfirm(true)}
                  className="px-3 py-1.5 bg-red-600 text-white text-sm rounded hover:bg-red-700"
                >
                  Delete
                </button>
                <button
                  onClick={() => setSelectedIds(new Set())}
                  className="px-3 py-1.5 bg-gray-300 text-gray-800 text-sm rounded hover:bg-gray-400"
                >
                  Clear Selection
                </button>
              </div>
            </div>
          )}

          {/* Main Table */}
          {isLoading ? (
            <div className="text-center py-12">
              <Loader className="w-8 h-8 text-purple-600 animate-spin mx-auto" />
              <p className="mt-4 text-gray-600">Loading satellite articles...</p>
            </div>
          ) : filteredArticles.length === 0 ? (
            <div className="text-center py-24 border-2 border-dashed border-gray-300 rounded-lg">
              <Sparkles className="w-12 h-12 text-gray-400 mx-auto mb-4" />
              <p className="text-gray-600 mb-2">No satellite articles yet</p>
              <p className="text-sm text-gray-500 mb-4">
                Create supporting articles that expand on topics from your Phase 3 pillar page
              </p>
              <button
                onClick={handleCreateNewSatellite}
                className="inline-flex items-center gap-2 px-4 py-2 bg-purple-600 text-white rounded hover:bg-purple-700 transition-colors"
              >
                <Plus className="w-4 h-4" />
                Create Your First Satellite Article
              </button>
            </div>
          ) : (
            <>
              <div className="overflow-x-auto bg-white border rounded shadow">
                <table className="min-w-full">
                  <thead>
                    <tr className="bg-gray-50 border-b border-gray-200">
                      <th className="px-4 py-3 text-left text-sm font-semibold text-gray-700 w-12">
                        <input
                          type="checkbox"
                          checked={paginatedArticles.length > 0 && paginatedArticles.every(a => selectedIds.has(a.id))}
                          onChange={(e) => handleSelectAll(e.target.checked)}
                          className="rounded"
                        />
                      </th>
                      <th className="px-4 py-3 text-left text-sm font-semibold text-gray-700">Title</th>
                      <th className="px-4 py-3 text-left text-sm font-semibold text-gray-700">Status</th>
                      <th className="px-4 py-3 text-left text-sm font-semibold text-gray-700">Type</th>
                      <th className="px-4 py-3 text-center text-sm font-semibold text-gray-700">Actions</th>
                    </tr>
                  </thead>
                  <tbody>
                    {paginatedArticles.map((article) => (
                      <tr
                        key={article.id}
                        className="border-b border-gray-200 hover:bg-gray-50 transition-colors"
                      >
                        <td className="px-4 py-3">
                          <input
                            type="checkbox"
                            checked={selectedIds.has(article.id)}
                            onChange={(e) => handleSelectArticle(article.id, e.target.checked)}
                            className="rounded"
                          />
                        </td>
                        <td className="px-4 py-3 font-medium text-gray-900">{article.title || "Untitled Article"}</td>
                        <td className="px-4 py-3">
                          <span className={`px-2 py-1 rounded text-xs font-medium ${
                            article.status === "published" ? "bg-green-100 text-green-800" :
                            article.status === "draft" ? "bg-gray-100 text-gray-800" :
                            "bg-yellow-100 text-yellow-800"
                          }`}>
                            {article.status || "draft"}
                          </span>
                        </td>
                        <td className="px-4 py-3 text-gray-700">
                          <span className="px-2 py-1 bg-blue-100 text-blue-800 text-xs rounded">
                            {article.type || "—"}
                          </span>
                        </td>
                        <td className="px-4 py-3">
                          <div className="flex items-center justify-center gap-2">
                            <button
                              onClick={() => handleArticleClick(article)}
                              className="inline-flex items-center gap-1 text-purple-600 hover:text-purple-800 hover:bg-purple-50 px-2 py-1 rounded transition-colors"
                              title="Edit article"
                            >
                              <Edit2 className="w-4 h-4" />
                            </button>
                          </div>
                        </td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>

              {/* Pagination */}
              {totalPages > 1 && (
                <div className="flex items-center justify-between mt-4">
                  <div className="text-sm text-gray-600">
                    Showing {startIndex + 1} to {Math.min(endIndex, filteredArticles.length)} of {filteredArticles.length} articles
                  </div>
                  <div className="flex items-center gap-2">
                    <button
                      onClick={() => setCurrentPage(prev => Math.max(1, prev - 1))}
                      disabled={currentPage === 1}
                      className="px-3 py-1 border rounded hover:bg-gray-50 disabled:opacity-50 disabled:cursor-not-allowed transition-colors flex items-center gap-1"
                    >
                      <ChevronLeft className="w-4 h-4" />
                      Previous
                    </button>
                    <div className="text-sm text-gray-600">
                      Page {currentPage} of {totalPages}
                    </div>
                    <button
                      onClick={() => setCurrentPage(prev => Math.min(totalPages, prev + 1))}
                      disabled={currentPage === totalPages}
                      className="px-3 py-1 border rounded hover:bg-gray-50 disabled:opacity-50 disabled:cursor-not-allowed transition-colors flex items-center gap-1"
                    >
                      Next
                      <ChevronRight className="w-4 h-4" />
                    </button>
                  </div>
                </div>
              )}
            </>
          )}
        </div>
      </div>

      {/* Right Panel - Campaign Context */}
      <div className="w-80 bg-gray-50 border-l border-gray-200 p-6 overflow-y-auto">
        <h3 className="text-lg font-semibold text-gray-900 mb-4">Campaign Context</h3>
        
        <div className="space-y-4">
          <div>
            <h4 className="text-sm font-medium text-gray-700 mb-2">Pillar Page</h4>
            <p className="text-sm text-gray-600">{pillarTitle}</p>
          </div>

          <div>
            <h4 className="text-sm font-medium text-gray-700 mb-2">ICP</h4>
            <p className="text-sm text-gray-600">{icpName}</p>
          </div>

          <div>
            <h4 className="text-sm font-medium text-gray-700 mb-2">Offer</h4>
            <p className="text-sm text-gray-600">{offerName}</p>
          </div>

          <div>
            <h4 className="text-sm font-medium text-gray-700 mb-2">Outcome</h4>
            <p className="text-sm text-gray-600">{outcome}</p>
          </div>

          {campaign?.peace_of_mind && (
            <div>
              <h4 className="text-sm font-medium text-gray-700 mb-2">Promise</h4>
              <p className="text-sm text-gray-600">{campaign.peace_of_mind}</p>
            </div>
          )}
        </div>
      </div>

      {/* Delete Confirmation Modal */}
      {showDeleteConfirm && (
        <div className="fixed inset-0 bg-black bg-opacity-50 z-50 flex items-center justify-center p-4">
          <div className="bg-white rounded-lg shadow-lg max-w-sm w-full p-6">
            <div className="flex items-start gap-3 mb-4">
              <AlertTriangle className="w-6 h-6 text-red-600 flex-shrink-0 mt-0.5" />
              <div>
                <h3 className="text-lg font-semibold text-gray-900">Delete {selectedIds.size} Article(s)?</h3>
                <p className="text-sm text-gray-600 mt-1">
                  This action cannot be undone. The articles will be permanently deleted along with all their data.
                </p>
              </div>
            </div>
            <div className="flex gap-3 justify-end">
              <button
                onClick={() => setShowDeleteConfirm(false)}
                disabled={deleting}
                className="px-4 py-2 bg-gray-300 text-gray-800 rounded hover:bg-gray-400 font-medium disabled:opacity-50 disabled:cursor-not-allowed transition-colors"
              >
                Cancel
              </button>
              <button
                onClick={handleBulkDelete}
                disabled={deleting}
                className="px-4 py-2 bg-red-600 text-white rounded hover:bg-red-700 font-medium disabled:opacity-50 disabled:cursor-not-allowed transition-colors flex items-center gap-2"
              >
                {deleting ? (
                  <>
                    <Loader className="w-4 h-4 animate-spin" />
                    Deleting...
                  </>
                ) : (
                  <>
                    <Trash2 className="w-4 h-4" />
                    Delete Articles
                  </>
                )}
              </button>
            </div>
          </div>
        </div>
      )}

      {/* Status Change Confirmation Modal */}
      {showStatusChangeConfirm && (
        <div className="fixed inset-0 bg-black bg-opacity-50 z-50 flex items-center justify-center p-4">
          <div className="bg-white rounded-lg shadow-lg max-w-sm w-full p-6">
            <div className="mb-4">
              <h3 className="text-lg font-semibold text-gray-900 mb-2">Change Status for {selectedIds.size} Article(s)</h3>
              <p className="text-sm text-gray-600 mb-4">
                Select the new status for the selected articles.
              </p>
              <select
                value={newStatus}
                onChange={(e) => setNewStatus(e.target.value)}
                className="w-full px-3 py-2 border border-gray-300 rounded"
              >
                <option value="draft">Draft</option>
                <option value="published">Published</option>
                <option value="archived">Archived</option>
              </select>
            </div>
            <div className="flex gap-3 justify-end">
              <button
                onClick={() => {
                  setShowStatusChangeConfirm(false);
                  setNewStatus("draft");
                }}
                className="px-4 py-2 bg-gray-300 text-gray-800 rounded hover:bg-gray-400 font-medium transition-colors"
              >
                Cancel
              </button>
              <button
                onClick={handleBulkStatusChange}
                className="px-4 py-2 bg-purple-600 text-white rounded hover:bg-purple-700 font-medium transition-colors"
              >
                Change Status
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
