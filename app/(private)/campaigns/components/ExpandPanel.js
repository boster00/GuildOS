"use client";

import React, { useState, useEffect, useMemo } from "react";
import { X, Sparkles, Plus, ChevronLeft, ChevronRight, Info, Lightbulb, ExternalLink } from "lucide-react";
import { createClient } from "@/libs/supabase/client";
import CampaignContentIdeasLab from "./CampaignContentIdeasLab";
import { useContentIdeasLab } from "../context/ContentIdeasLabContext";

export default function ExpandPanel({ 
  campaignId, 
  campaign, 
  isOpen, 
  onClose,
  onNewArticle
}) {
  const [articles, setArticles] = useState([]);
  const [isLoading, setIsLoading] = useState(true);
  const [search, setSearch] = useState("");
  const [statusFilter, setStatusFilter] = useState("all");
  const [typeFilter, setTypeFilter] = useState("all");
  const [selectedIds, setSelectedIds] = useState(new Set());
  const [currentPage, setCurrentPage] = useState(1);
  const articlesPerPage = 20;
  const supabase = createClient();
  
  // Use shared Content Ideas Lab state
  const { isOpen: showContentIdeasLab, toggle: toggleContentIdeasLab, close: closeContentIdeasLab } = useContentIdeasLab();

  // Get campaign context
  const phase3Article = campaign?.articleMetadata?.find(a => a.campaign_phase === 3);
  const pillarTitle = phase3Article?.title || "Phase 3 Pillar";
  const offerName = campaign?.offer?.name || "Your Offer";
  const outcome = campaign?.outcome || "Your Outcome";

  // Load existing articles on mount and when panel opens
  useEffect(() => {
    if (isOpen && campaignId) {
      loadArticles();
      // Clear selection when panel opens
      setSelectedIds(new Set());
    }
  }, [isOpen, campaignId]);

  const loadArticles = async () => {
    try {
      setIsLoading(true);
      const { data: { user } } = await supabase.auth.getUser();
      if (!user) return;

      // Load articles with campaign_phase = 4 (Expand)
      const { data, error } = await supabase
        .from("content_magic_articles")
        .select("*")
        .eq("campaign_id", campaignId)
        .eq("user_id", user.id)
        .eq("campaign_phase", 4)
        .order("created_at", { ascending: false });

      if (error) throw error;

      setArticles(data || []);
    } catch (error) {

    } finally {
      setIsLoading(false);
    }
  };

  // Filtered articles
  const filteredArticles = useMemo(() => {
    return articles.filter((article) => {
      const matchesTitle = article.title?.toLowerCase().includes(search.toLowerCase()) || false;
      const matchesStatus = statusFilter === "all" || article.status === statusFilter;
      const matchesType = typeFilter === "all" || article.type === typeFilter;
      return matchesTitle && matchesStatus && matchesType;
    });
  }, [articles, search, statusFilter, typeFilter]);

  // Pagination
  const totalPages = Math.ceil(filteredArticles.length / articlesPerPage);
  const startIndex = (currentPage - 1) * articlesPerPage;
  const endIndex = startIndex + articlesPerPage;
  const paginatedArticles = filteredArticles.slice(startIndex, endIndex);

  // Reset to page 1 when filters change
  useEffect(() => {
    setCurrentPage(1);
  }, [search, statusFilter, typeFilter]);

  // Get unique statuses and types for filters
  const uniqueStatuses = useMemo(() => {
    const statuses = new Set(articles.map(a => a.status).filter(Boolean));
    return Array.from(statuses).sort();
  }, [articles]);

  const uniqueTypes = useMemo(() => {
    const types = new Set(articles.map(a => a.type).filter(Boolean));
    return Array.from(types).sort();
  }, [articles]);

  const handleCreateNewArticle = () => {
    if (onNewArticle) {
      onNewArticle(null);
    }
  };

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

  if (!isOpen) return null;

  return (
    <div className="fixed inset-0 bg-white z-50 flex flex-col overflow-hidden">
      {/* Header */}
      <div className="border-b border-gray-200 p-6 bg-gradient-to-r from-purple-50 to-blue-50">
        <div className="max-w-6xl mx-auto">
          <div className="flex items-center justify-between mb-4">
            <div>
              <h1 className="text-2xl font-bold text-gray-900">
                EXPAND – Build Your Visibility Cluster
              </h1>
              <p className="text-sm text-gray-600 mt-1">
                Plan satellite topics around your Phase 3 pillar to grow search visibility.
              </p>
            </div>
            <div className="flex items-center gap-3">
              {/* <button
                onClick={handleCreateNewArticle}
                className="flex items-center gap-2 bg-purple-600 text-white px-4 py-2 rounded-lg hover:bg-purple-700 transition-colors"
              >
                <Plus className="w-4 h-4" />
                New Article
              </button> */}
              <button
                onClick={onClose}
                className="p-2 hover:bg-gray-200 rounded-lg transition-colors"
              >
                <X className="w-5 h-5" />
              </button>
            </div>
          </div>

        </div>
      </div>

      {/* Main Content */}
      <div className="flex-1 overflow-hidden flex">
        {/* Left: Main Content Area */}
        <div className="flex-1 overflow-y-auto">
          <div className="max-w-6xl mx-auto px-4 py-8">
          {/* Search and Filters */}
          <div className="mb-4 flex items-center gap-3 flex-wrap">
            <input
              type="text"
              placeholder="Search by title"
              className="border rounded px-3 py-2 flex-1 min-w-64"
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
            <button
              onClick={handleCreateNewArticle}
              className="flex items-center gap-2 bg-purple-600 text-white px-4 py-2 rounded-lg hover:bg-purple-700 transition-colors"
            >
              <Plus className="w-4 h-4" />
              New Article
            </button>
          </div>

          {/* Main Table */}
          {isLoading ? (
            <div className="flex items-center justify-center py-24">
              <div className="text-gray-500">Loading articles...</div>
            </div>
          ) : filteredArticles.length === 0 ? (
            <div className="flex flex-col items-center justify-center py-24">
              <div className="mb-4">
                <Sparkles className="w-12 h-12 text-purple-400" />
              </div>
              <div className="text-lg font-semibold mb-2">No satellites yet</div>
              <div className="text-gray-500 mb-4">Add satellite articles to get started.</div>
              <button
                onClick={handleCreateNewArticle}
                className="flex items-center gap-2 bg-purple-600 text-white px-4 py-2 rounded-lg hover:bg-purple-700 transition-colors"
              >
                <Plus className="w-4 h-4" />
                Create Your First Article
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
                          className="rounded border-gray-300 text-purple-600 focus:ring-purple-500"
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
                            className="rounded border-gray-300 text-purple-600 focus:ring-purple-500"
                          />
                        </td>
                        <td className="px-4 py-3 font-medium text-gray-900">{article.title || "Untitled"}</td>
                        <td className="px-4 py-3">
                          <span className={`px-2 py-1 rounded text-xs font-medium ${
                            article.status === "published" ? "bg-green-100 text-green-800" :
                            article.status === "draft" ? "bg-blue-100 text-blue-800" :
                            "bg-gray-100 text-gray-800"
                          }`}>
                            {article.status?.toUpperCase() || "DRAFT"}
                          </span>
                        </td>
                        <td className="px-4 py-3">
                          <span className="px-2 py-1 bg-blue-100 text-blue-800 text-xs rounded-full">
                            {article.type || "—"}
                          </span>
                        </td>
                        <td className="px-4 py-3">
                          <div className="flex items-center justify-center gap-2">
                            <a
                              href={`/content-magic/${article.id}`}
                              target="_blank"
                              rel="noopener noreferrer"
                              className="inline-flex items-center gap-1 text-purple-600 hover:text-purple-800 hover:bg-purple-50 px-2 py-1 rounded transition-colors text-sm"
                              title="Edit Article"
                            >
                              <ExternalLink className="w-4 h-4" />
                              Edit
                            </a>
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

              {/* Summary */}
              <div className="mt-4 p-3 bg-blue-50 rounded-lg text-sm text-gray-700">
                You have <strong>{articles.length}</strong> article{articles.length !== 1 ? 's' : ''} in the Expand phase.
              </div>
            </>
          )}
          </div>
        </div>

        {/* Right Panel */}
        <div className="w-80 bg-white border-l border-gray-200 p-6 overflow-y-auto">
          {/* Content Ideas Lab Button */}
          <button
            onClick={toggleContentIdeasLab}
            className="w-full mb-4 flex items-center justify-center gap-2 bg-purple-600 text-white px-4 py-2 rounded-lg hover:bg-purple-700 transition-colors"
          >
            <Lightbulb className="w-4 h-4" />
            Content Ideas Lab
          </button>

          {/* Show Content Ideas Lab or Campaign Context */}
          {showContentIdeasLab ? (
            <CampaignContentIdeasLab
              campaign={campaign}
              onUseTitle={(title) => {
                // TODO: Pass title to parent component to fill in article title field

              }}
              onClose={closeContentIdeasLab}
              onArticleCreated={loadArticles}
            />
          ) : (
            <>
              <div className="flex items-center gap-2 mb-4">
                <Info className="w-5 h-5 text-blue-600" />
                <h3 className="font-semibold text-gray-900">Campaign Context</h3>
              </div>
              
              <div className="space-y-4 text-sm">
                <div>
                  <span className="text-gray-500">ICP:</span>
                  <p className="font-medium text-gray-900">{campaign?.icp?.name || campaign?.icps?.name || 'Not set'}</p>
                  {(campaign?.icp?.description || campaign?.icps?.description) && (
                    <p className="text-xs text-gray-600 mt-1">{campaign?.icp?.description || campaign?.icps?.description}</p>
                  )}
                </div>

                <div className="pt-3 border-t border-gray-200">
                  <span className="text-gray-500">Offer:</span>
                  <p className="font-medium text-gray-900">{offerName || 'Not set'}</p>
                  {(campaign?.offer?.description || campaign?.offers?.description) && (
                    <p className="text-xs text-gray-600 mt-1">{campaign?.offer?.description || campaign?.offers?.description}</p>
                  )}
                </div>

                {outcome && (
                  <div className="pt-3 border-t border-gray-200">
                    <span className="text-gray-500">Outcome:</span>
                    <p className="font-medium text-gray-900">{outcome}</p>
                  </div>
                )}

                {campaign?.peace_of_mind && (
                  <div className="pt-3 border-t border-gray-200">
                    <span className="text-gray-500">Promise:</span>
                    <p className="font-medium text-gray-900">{campaign.peace_of_mind}</p>
                  </div>
                )}

                <div className="pt-3 border-t border-gray-200">
                  <span className="text-gray-500">Pillar Page:</span>
                  <p className="font-medium text-gray-900">{pillarTitle}</p>
                </div>
              </div>

              <div className="mt-6 p-3 bg-blue-50 rounded-lg">
                <p className="text-xs text-blue-900">
                  <strong>Tip:</strong> This context will be available to the AI assistant when you're writing.
                </p>
              </div>
            </>
          )}
        </div>
      </div>
    </div>
  );
}
