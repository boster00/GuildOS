// ARCHIVED: Original path was app/(private)/offers/components/OffersList.js

"use client";

import React, { useState, useEffect } from "react";
import Link from "next/link";
import { Plus, Edit, Trash2, Package } from "lucide-react";
import { initOffers } from "@/libs/offers/class";

// Simple Components (reuse pattern from ICPs)
function Button({ children, className = "", variant = "default", onClick, disabled = false, ...props }) {
  console.log("[app/(private)/offers/components/OffersList.js] Button");
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
  console.log("[app/(private)/offers/components/OffersList.js] Card");
  return <div className={`bg-white rounded-lg shadow-sm border border-gray-200 p-6 ${className}`}>{children}</div>;
}

export default function OffersList() {
  console.log("[app/(private)/offers/components/OffersList.js] OffersList");
  const [offers, setOffers] = useState([]);
  const [isLoading, setIsLoading] = useState(true);
  const [error, setError] = useState(null);
  const [offersInstance, setOffersInstance] = useState(null);
  const [deletingIds, setDeletingIds] = useState(new Set());

  useEffect(() => {
    initializeOffers();
  }, []);

  const initializeOffers = async () => {
    try {
      setIsLoading(true);
      setError(null);
      const offersInst = await initOffers();
      setOffersInstance(offersInst);
      await loadOffers(offersInst);
      
    } catch (error) {
      setError(`Failed to load offers: ${error.message}`);
    } finally {
      setIsLoading(false);
    }
  };

  const loadOffers = async (offersInst = offersInstance) => {
    if (!offersInst) return;
    
    try {
      const data = await offersInst.list();
      if (Array.isArray(data)) {
        setOffers(data);
      } else {
        setOffers([]);
      }
    } catch (error) {
      setError(`Failed to load offers: ${error.message}`);
      setOffers([]);
    }
  };

  const handleDelete = async (offerId) => {
    const offerToDelete = offers.find(o => o.id === offerId);
    const confirmMessage = `Are you sure you want to delete "${offerToDelete?.name}"? This action cannot be undone.`;
    
    if (!confirm(confirmMessage)) return;
    
    try {
      setDeletingIds(prev => new Set([...prev, offerId]));
      await offersInstance.delete(offerId);
      setOffers(prev => prev.filter(o => o.id !== offerId));
      
    } catch (error) {
      alert(`Failed to delete offer: ${error.message}`);
    } finally {
      setDeletingIds(prev => {
        const newSet = new Set(prev);
        newSet.delete(offerId);
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
            <p className="mt-4 text-gray-600">Loading offers...</p>
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
            <Button onClick={initializeOffers}>Try Again</Button>
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
            <Package className="w-8 h-8 text-blue-600" />
            Offers
          </h1>
          <p className="mt-2 text-gray-600">
            Manage your product and service offerings
          </p>
        </div>
        <Link href="/offers/new">
          <Button>
            <Plus className="w-4 h-4" />
            New Offer
          </Button>
        </Link>
      </div>

      {/* Offers List */}
      {offers.length === 0 ? (
        <Card>
          <div className="text-center py-12">
            <Package className="w-16 h-16 text-gray-400 mx-auto mb-4" />
            <h3 className="text-lg font-medium text-gray-900 mb-2">No offers yet</h3>
            <p className="text-gray-600 mb-6">Get started by creating your first offer</p>
            <Link href="/offers/new">
              <Button>
                <Plus className="w-4 h-4" />
                Create First Offer
              </Button>
            </Link>
          </div>
        </Card>
      ) : (
        <div className="grid gap-4">
          {offers.map((offer) => (
            <Card key={offer.id} className="hover:shadow-md transition-shadow">
              <div className="flex items-start justify-between">
                <div className="flex-1">
                  <h3 className="text-lg font-semibold text-gray-900 mb-2">
                    {offer.name}
                  </h3>
                  {offer.description && (
                    <p className="text-gray-600 text-sm mb-3">{offer.description}</p>
                  )}
                  <div className="flex items-center gap-4 text-sm text-gray-500">
                    <span>Created {new Date(offer.created_at).toLocaleDateString()}</span>
                  </div>
                </div>
                <div className="flex items-center gap-2 ml-4">
                  <Link href={`/offers/${offer.id}/edit`}>
                    <Button variant="outline" className="px-3 py-1">
                      <Edit className="w-4 h-4" />
                    </Button>
                  </Link>
                  <Button
                    variant="destructive"
                    className="px-3 py-1"
                    onClick={() => handleDelete(offer.id)}
                    disabled={deletingIds.has(offer.id)}
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