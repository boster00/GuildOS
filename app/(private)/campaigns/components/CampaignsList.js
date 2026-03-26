"use client";

import React, { useState, useEffect } from "react";
import Link from "next/link";
import { Plus, Edit, Trash2, Target, Flag } from "lucide-react";
import { initCampaigns } from "@/libs/campaigns/class";

// Simple Components
function Button({ children, className = "", variant = "default", onClick, disabled = false, ...props }) {
  const baseClasses = "inline-flex items-center justify-center rounded-md font-medium transition-colors focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-offset-2 disabled:pointer-events-none disabled:opacity-50";
  
  const variants = {
    default: "bg-blue-600 text-white hover:bg-blue-700 focus-visible:ring-blue-600",
    outline: "border border-gray-300 bg-white text-gray-700 hover:bg-gray-50 focus-visible:ring-blue-600",
    ghost: "text-gray-700 hover:bg-gray-100 focus-visible:ring-blue-600",
    destructive: "bg-red-600 text-white hover:bg-red-700 focus-visible:ring-red-600"
  };

  return (
    <button
      className={`${baseClasses} ${variants[variant]} px-4 py-2 gap-2 ${className}`}
      onClick={onClick}
      disabled={disabled}
      {...props}
    >
      {children}
    </button>
  );
}

function Card({ children, className = "" }) {
  return <div className={`bg-white rounded-lg shadow-sm border border-gray-200 p-6 ${className}`}>{children}</div>;
}

function Badge({ children, variant = "default" }) {
  const variants = {
    default: "bg-gray-100 text-gray-800",
    planning: "bg-yellow-100 text-yellow-800",
    in_progress: "bg-blue-100 text-blue-800",
    completed: "bg-green-100 text-green-800",
    archived: "bg-gray-100 text-gray-600"
  };

  return (
    <span className={`inline-flex items-center px-2.5 py-0.5 rounded-full text-xs font-medium ${variants[variant]}`}>
      {children}
    </span>
  );
}

export default function CampaignsList() {
  const [campaigns, setCampaigns] = useState([]);
  const [isLoading, setIsLoading] = useState(true);
  const [error, setError] = useState(null);
  const [campaignsInstance, setCampaignsInstance] = useState(null);
  const [deletingIds, setDeletingIds] = useState(new Set());

  useEffect(() => {
    initializeCampaigns();
  }, []);

  const initializeCampaigns = async () => {
    try {
      setIsLoading(true);
      setError(null);
      const campaignsInst = await initCampaigns();
      setCampaignsInstance(campaignsInst);
      await loadCampaigns(campaignsInst);
      
    } catch (error) {
      setError(`Failed to load campaigns: ${error.message}`);
    } finally {
      setIsLoading(false);
    }
  };

  const loadCampaigns = async (campaignsInst = campaignsInstance) => {
    if (!campaignsInst) return;
    
    try {
      // Single query to campaigns table - no joins or additional queries
      const data = await campaignsInst.list();
      if (Array.isArray(data)) {
        setCampaigns(data);
      } else {
        setCampaigns([]);
      }
    } catch (error) {
      setError(`Failed to load campaigns: ${error.message}`);
      setCampaigns([]);
    }
  };

  const handleDelete = async (campaignId) => {
    const campaignToDelete = campaigns.find(c => c.id === campaignId);
    const confirmMessage = `Are you sure you want to delete "${campaignToDelete?.name}"? This action cannot be undone.`;
    
    if (!confirm(confirmMessage)) return;
    
    try {
      setDeletingIds(prev => new Set([...prev, campaignId]));
      await campaignsInstance.delete(campaignId);
      setCampaigns(prev => prev.filter(c => c.id !== campaignId));
      
    } catch (error) {
      alert(`Failed to delete campaign: ${error.message}`);
    } finally {
      setDeletingIds(prev => {
        const newSet = new Set(prev);
        newSet.delete(campaignId);
        return newSet;
      });
    }
  };

  if (isLoading) {
    return (
      <div className="max-w-7xl mx-auto p-8">
        <div className="flex items-center justify-center py-12">
          <div className="text-center">
            <div className="animate-spin rounded-full h-12 w-12 border-b-2 border-blue-600 mx-auto"></div>
            <p className="mt-4 text-gray-600">Loading campaigns...</p>
          </div>
        </div>
      </div>
    );
  }

  if (error) {
    return (
      <div className="max-w-7xl mx-auto p-8">
        <Card>
          <div className="text-center py-8">
            <p className="text-red-600 mb-4">{error}</p>
            <Button onClick={initializeCampaigns}>Try Again</Button>
          </div>
        </Card>
      </div>
    );
  }

  return (
    <div className="max-w-7xl mx-auto p-8">
      {/* Header */}
      <div className="mb-8 flex items-center justify-between">
        <div>
          <h1 className="text-3xl font-bold text-gray-900 flex items-center gap-3">
            <Flag className="w-8 h-8 text-blue-600" />
            Campaigns
          </h1>
          <p className="mt-2 text-gray-600">
            Manage your content campaigns
          </p>
        </div>
        <Link href="/campaigns/new">
          <Button>
            <Plus className="w-4 h-4" />
            New Campaign
          </Button>
        </Link>
      </div>

      {/* Campaigns List */}
      {campaigns.length === 0 ? (
        <Card>
          <div className="text-center py-12">
            <Flag className="w-16 h-16 text-gray-400 mx-auto mb-4" />
            <h3 className="text-lg font-medium text-gray-900 mb-2">No campaigns yet</h3>
            <p className="text-gray-600 mb-6">Create your first campaign to start generating content</p>
            <Link href="/campaigns/new">
              <Button>
                <Plus className="w-4 h-4" />
                Create First Campaign
              </Button>
            </Link>
          </div>
        </Card>
      ) : (
        <div className="grid gap-4">
          {campaigns.map((campaign) => (
            <Card key={campaign.id} className="hover:shadow-md transition-shadow">
              <div className="flex items-start justify-between">
                <div className="flex-1">
                  <div className="flex items-center gap-3 mb-2">
                    <h3 className="text-lg font-semibold text-gray-900">
                      {campaign.name}
                    </h3>
                    <Badge variant={campaign.status}>{campaign.status}</Badge>
                  </div>
                  
                  {campaign.outcome && (
                    <p className="text-sm text-gray-600 mb-2">
                      <strong>Outcome:</strong> {campaign.outcome}
                    </p>
                  )}
                  
                  <div className="flex items-center gap-4 text-sm text-gray-500">
                    <span>Created {new Date(campaign.created_at).toLocaleDateString()}</span>
                    {campaign.updated_at && campaign.updated_at !== campaign.created_at && (
                      <span>Updated {new Date(campaign.updated_at).toLocaleDateString()}</span>
                    )}
                  </div>
                </div>
                
                <div className="flex items-center gap-2 ml-4">
                  <Link href={`/campaigns/${campaign.id}`}>
                    <Button variant="outline" className="px-3 py-1">
                      <Edit className="w-4 h-4" />
                    </Button>
                  </Link>
                  <Button
                    variant="destructive"
                    className="px-3 py-1"
                    onClick={() => handleDelete(campaign.id)}
                    disabled={deletingIds.has(campaign.id)}
                  >
                    <Trash2 className="w-4 h-4" />
                  </Button>
                </div>
              </div>
            </Card>
          ))}
        </div>
      )}
    </div>
  );
}