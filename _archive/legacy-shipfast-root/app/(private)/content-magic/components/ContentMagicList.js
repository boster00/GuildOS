"use client";
import React, { useState, useEffect, useMemo } from "react";
import { useRouter } from "next/navigation";
import { Plus, AlertTriangle, Loader, Trash2, Edit2, ChevronLeft, ChevronRight } from "lucide-react";
import { Sparkles } from "lucide-react";
import { createClient } from "@/libs/supabase/client";


export default function ContentMagicListPage() {
    const router = useRouter();
    const [articles, setArticles] = useState([]);
    const [loading, setLoading] = useState(true);
    const [error, setError] = useState(null);
    const [search, setSearch] = useState("");
    const [deleteConfirm, setDeleteConfirm] = useState(null); // null or articleId
    const [deleting, setDeleting] = useState(false);
    const [currentPage, setCurrentPage] = useState(1);
    const articlesPerPage = 20;

    // Fetch articles on mount
    useEffect(() => {
        const fetchArticles = async () => {
            try {
                setLoading(true);
                setError(null);
                const supabase = createClient();

                // Get current user
                const {
                    data: { user },
                } = await supabase.auth.getUser();

                if (!user) {
                    setError("Not authenticated");
                    setLoading(false);
                    return;
                }

                // Fetch articles
                const { data: articleData, error: fetchError } = await supabase
                    .from("content_magic_articles")
                    .select(
                        `
                        *
                    `
                    )
                    .eq("user_id", user.id)
                    .order("updated_at", { ascending: false });

                if (fetchError) {
                    setError("Failed to load articles");
                    setLoading(false);
                    return;
                }

                // Fetch campaigns to build a map
                const campaignIds = [...new Set(articleData.map(a => a.campaign_id).filter(Boolean))];
                let campaignMapById = {};
                if (campaignIds.length > 0) {
                    const { data: campaignsData, error: campaignsError } = await supabase
                        .from("campaigns")
                        .select("id, name")
                        .eq("user_id", user.id)
                        .in("id", campaignIds);

                    if (campaignsError) {
                    } else if (campaignsData) {
                        campaignsData.forEach(campaign => {
                            campaignMapById[campaign.id] = campaign.name;
                        });
                    }
                }

                // Enrich articles with campaign info
                const enrichedArticles = articleData.map(article => ({
                    ...article,
                    campaign_name: campaignMapById[article.campaign_id] || null,
                }));

                setArticles(enrichedArticles);
                setLoading(false);
            } catch (err) {
                setError("Failed to load articles");
                setLoading(false);
            }
        };

        fetchArticles();
    }, []);

    // Filtered articles by search
    const filteredArticles = useMemo(() => {
        return articles.filter((a) => {
            const matchesTitle = a.title?.toLowerCase().includes(search.toLowerCase()) || false;
            return matchesTitle;
        });
    }, [articles, search]);

    // Pagination
    const totalPages = Math.ceil(filteredArticles.length / articlesPerPage);
    const startIndex = (currentPage - 1) * articlesPerPage;
    const endIndex = startIndex + articlesPerPage;
    const paginatedArticles = filteredArticles.slice(startIndex, endIndex);

    // Reset to page 1 when search changes
    useEffect(() => {
        setCurrentPage(1);
    }, [search]);

    const handleDeleteArticle = async (articleId) => {
        try {
            setDeleting(true);
            const { initMonkey } = await import("@/libs/monkey");
            const monkey = await initMonkey();
            await monkey.apiCall("/api/content-magic/delete", { articleId }, { method: "DELETE" });
            setArticles(prev => prev.filter(a => a.id !== articleId));
            setDeleteConfirm(null);
        } catch (err) {
            alert(`Failed to delete: ${err.message}`);
        } finally {
            setDeleting(false);
        }
    };

    if (loading) {
        return (
            <div className="max-w-6xl mx-auto px-4 py-8">
                <div className="flex items-center justify-between mb-6">
                    <div>
                        <h1 className="text-2xl font-bold">Content Magic</h1>
                        <p className="text-gray-500 text-sm">Optimize your pages for AI &amp; SEO</p>
                    </div>
                </div>
                <div className="flex items-center justify-center py-24">
                    <Loader className="w-8 h-8 text-blue-600 animate-spin" />
                </div>
            </div>
        );
    }

    if (error) {
        return (
            <div className="max-w-6xl mx-auto px-4 py-8">
                <div className="flex items-center justify-between mb-6">
                    <div>
                        <h1 className="text-2xl font-bold">Content Magic</h1>
                        <p className="text-gray-500 text-sm">Optimize your pages for AI &amp; SEO</p>
                    </div>
                </div>
                <div className="bg-red-50 border border-red-200 rounded p-4 text-red-800">
                    {error}
                </div>
            </div>
        );
    }

    return (
        <div className="max-w-6xl mx-auto px-4 py-8">
            {/* Top bar */}
            <div className="flex items-center justify-between mb-6">
                <div>
                    <h1 className="text-2xl font-bold">Content Magic</h1>
                    <p className="text-gray-500 text-sm">Optimize your pages for AI &amp; SEO</p>
                </div>
                <button
                    className="flex items-center gap-2 bg-blue-600 text-white px-4 py-2 rounded hover:bg-blue-700"
                    onClick={() => router.push("/content-magic/new")}
                >
                    <Plus className="w-4 h-4" />
                    New article
                </button>
            </div>

            {/* Search */}
            <div className="mb-4">
                <input
                    type="text"
                    placeholder="Search by title"
                    className="border rounded px-3 py-2 w-64"
                    value={search}
                    onChange={(e) => setSearch(e.target.value)}
                />
            </div>

            {/* Main table */}
            {filteredArticles.length === 0 ? (
                <div className="flex flex-col items-center justify-center py-24">
                    <div className="mb-4">
                        <Sparkles className="w-12 h-12 text-blue-400" />
                    </div>
                    <div className="text-lg font-semibold mb-2">No content yet</div>
                    <div className="text-gray-500 mb-4">Create your first article to get started.</div>
                    <button
                        className="flex items-center gap-2 bg-blue-600 text-white px-4 py-2 rounded hover:bg-blue-700"
                        onClick={() => router.push("/content-magic/new")}
                    >
                        <Plus className="w-4 h-4" />
                        Create your first article
                    </button>
                </div>
            ) : (
                <>
                    <div className="overflow-x-auto bg-white border rounded shadow">
                        <table className="min-w-full">
                            <thead>
                                <tr className="bg-gray-50 border-b border-gray-200">
                                    <th className="px-4 py-3 text-left text-sm font-semibold text-gray-700">Title</th>
                                    <th className="px-4 py-3 text-left text-sm font-semibold text-gray-700">Campaign</th>
                                    <th className="px-4 py-3 text-center text-sm font-semibold text-gray-700">Actions</th>
                                </tr>
                            </thead>
                            <tbody>
                                {paginatedArticles.map((article) => (
                                    <tr
                                        key={article.id}
                                        className="border-b border-gray-200 hover:bg-gray-50 transition-colors"
                                    >
                                        <td className="px-4 py-3 font-medium text-gray-900">{article.title || "Untitled"}</td>
                                        <td className="px-4 py-3 text-gray-700">
                                            {article.campaign_name ? (
                                                <div>
                                                    <span className="font-medium">{article.campaign_name}</span>
                                                    {article.campaign_phase && (
                                                        <span className="text-xs text-gray-500 ml-1">
                                                            (Phase {article.campaign_phase})
                                                        </span>
                                                    )}
                                                </div>
                                            ) : (
                                                <span className="text-gray-400">—</span>
                                            )}
                                        </td>
                                        <td className="px-4 py-3">
                                            <div className="flex items-center justify-center gap-2">
                                                <button
                                                    onClick={() => router.push(`/content-magic/${article.id}`)}
                                                    className="inline-flex items-center gap-1 text-blue-600 hover:text-blue-800 hover:bg-blue-50 px-2 py-1 rounded transition-colors"
                                                    title="Edit article"
                                                >
                                                    <Edit2 className="w-4 h-4" />
                                                </button>
                                                <button
                                                    onClick={() => setDeleteConfirm(article.id)}
                                                    className="inline-flex items-center gap-1 text-red-600 hover:text-red-800 hover:bg-red-50 px-2 py-1 rounded transition-colors"
                                                    title="Delete article"
                                                >
                                                    <Trash2 className="w-4 h-4" />
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
            {/* Delete Confirmation Modal */}
            {deleteConfirm && (
                <div className="fixed inset-0 bg-black bg-opacity-50 flex items-center justify-center z-50 p-4">
                <div className="bg-white rounded-lg shadow-lg max-w-sm w-full p-6">
                    <div className="flex items-start gap-3 mb-4">
                    <AlertTriangle className="w-6 h-6 text-red-600 flex-shrink-0 mt-0.5" />
                    <div>
                        <h3 className="text-lg font-semibold text-gray-900">Delete Article?</h3>
                        <p className="text-sm text-gray-600 mt-1">
                        This action cannot be undone. The article will be permanently deleted along with all its data.
                        </p>
                    </div>
                    </div>
                    <div className="flex gap-3 justify-end">
                    <button
                        onClick={() => setDeleteConfirm(null)}
                        disabled={deleting}
                        className="px-4 py-2 bg-gray-300 text-gray-800 rounded hover:bg-gray-400 font-medium disabled:opacity-50 disabled:cursor-not-allowed transition-colors"
                    >
                        Cancel
                    </button>
                    <button
                        onClick={() => handleDeleteArticle(deleteConfirm)}
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
                            Delete Article
                        </>
                        )}
                    </button>
                    </div>
                </div>
                </div>
            )}

        </div>
    );
}