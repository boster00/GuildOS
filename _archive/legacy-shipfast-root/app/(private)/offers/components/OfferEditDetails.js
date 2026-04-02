"use client";

import React, { useState, useEffect } from "react";
import { useRouter } from "next/navigation";
import Link from "next/link";
import { ArrowLeft, Save, Trash2, Loader2, Package } from "lucide-react";
import { initOffers } from "@/libs/offers/class";

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
  return <div className={`bg-white rounded-lg shadow-sm border border-gray-200 overflow-hidden ${className}`}>{children}</div>;
}

function Input({ className = "", ...props }) {
  return (
    <input
      className={`flex h-10 w-full rounded-md border border-gray-300 bg-white px-3 py-2 text-sm ring-offset-white file:border-0 file:bg-transparent file:text-sm file:font-medium placeholder:text-gray-500 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-blue-600 focus-visible:ring-offset-2 disabled:cursor-not-allowed disabled:opacity-50 ${className}`}
      {...props}
    />
  );
}

function Textarea({ className = "", ...props }) {
  return (
    <textarea
      className={`flex min-h-[120px] w-full rounded-md border border-gray-300 bg-white px-3 py-2 text-sm ring-offset-white placeholder:text-gray-500 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-blue-600 focus-visible:ring-offset-2 disabled:cursor-not-allowed disabled:opacity-50 ${className}`}
      {...props}
    />
  );
}

function Label({ children, className = "", ...props }) {
  return (
    <label
      className={`text-sm font-medium leading-none peer-disabled:cursor-not-allowed peer-disabled:opacity-70 ${className}`}
      {...props}
    >
      {children}
    </label>
  );
}

export default function OfferEditDetails({ offerId }) {
  const router = useRouter();
  const [isLoading, setIsLoading] = useState(true);
  const [isSaving, setIsSaving] = useState(false);
  const [isDeleting, setIsDeleting] = useState(false);
  const [offersInstance, setOffersInstance] = useState(null);
  const [formData, setFormData] = useState({
    name: "",
    description: "",
    transactional_facts: ""
  });

  useEffect(() => {
    initializeAndLoad();
  }, [offerId]);

  const initializeAndLoad = async () => {
    try {
      setIsLoading(true);
      const offers = await initOffers();
      setOffersInstance(offers);
      
      if (offerId) {
        const data = await offers.get(offerId);
        if (data) {
          setFormData({
            name: data.name || "",
            description: data.description || "",
            transactional_facts: data.transactional_facts || ""
          });
        }
      }
    } catch (error) {
      alert('Failed to load offer: ' + error.message);
    } finally {
      setIsLoading(false);
    }
  };

  const handleChange = (field, value) => {
    setFormData((prev) => ({ ...prev, [field]: value }));
  };

  const handleSave = async () => {
    if (!offersInstance) return;
    
    if (!formData.name?.trim()) {
      alert('Offer name is required');
      return;
    }

    setIsSaving(true);
    try {
      // Validate before saving
      const validation = await offersInstance.validate(formData);
      if (!validation.isValid) {
        alert(validation.errors.join(', '));
        return;
      }

      if (offerId) {
        // Update existing offer
        await offersInstance.update(offerId, formData);
      } else {
        // Create new offer
        const newOffer = await offersInstance.create(formData);
        if (newOffer?.id) {
          router.replace(`/offers/${newOffer.id}/edit`);
        }
      }
      
      alert(offerId ? 'Offer updated successfully!' : 'Offer created successfully!');
    } catch (error) {
      alert('Failed to save offer: ' + error.message);
    } finally {
      setIsSaving(false);
    }
  };

  const handleDelete = async () => {
    if (!offerId || !offersInstance) return;
    
    const confirmMessage = `Are you sure you want to delete "${formData.name}"? This action cannot be undone.`;
    if (!confirm(confirmMessage)) return;
    
    setIsDeleting(true);
    try {
      await offersInstance.delete(offerId);
      router.push('/offers');
    } catch (error) {
      alert('Failed to delete offer: ' + error.message);
    } finally {
      setIsDeleting(false);
    }
  };

  if (isLoading) {
    return (
      <div className="max-w-7xl mx-auto p-8">
        <div className="flex items-center justify-center py-12">
          <div className="text-center">
            <div className="animate-spin rounded-full h-12 w-12 border-b-2 border-blue-600 mx-auto"></div>
            <p className="mt-4 text-gray-600">Loading offer...</p>
          </div>
        </div>
      </div>
    );
  }

  return (
    <div className="max-w-7xl mx-auto p-8">
      {/* Header */}
      <div className="mb-8 flex items-center justify-between">
        <div>
          <div className="flex items-center gap-4 mb-2">
            <Link href="/offers">
              <Button variant="ghost" className="p-2">
                <ArrowLeft className="w-5 h-5" />
              </Button>
            </Link>
            <h1 className="text-3xl font-bold text-gray-900 flex items-center gap-3">
              <Package className="w-8 h-8 text-blue-600" />
              {offerId ? 'Edit Offer' : 'New Offer'}
            </h1>
          </div>
          <p className="mt-2 text-gray-600">
            {offerId ? 'Update your product or service offering' : 'Create a new product or service offering'}
          </p>
        </div>
        <div className="flex gap-3">
          {offerId && (
            <Button 
              variant="destructive" 
              onClick={handleDelete}
              disabled={isDeleting}
            >
              {isDeleting ? (
                <>
                  <Loader2 className="w-4 h-4 animate-spin" />
                  Deleting...
                </>
              ) : (
                <>
                  <Trash2 className="w-4 h-4" />
                  Delete
                </>
              )}
            </Button>
          )}
          <Button 
            onClick={handleSave}
            disabled={isSaving || !formData.name?.trim()}
          >
            {isSaving ? (
              <>
                <Loader2 className="w-4 h-4 animate-spin" />
                Saving...
              </>
            ) : (
              <>
                <Save className="w-4 h-4" />
                Save
              </>
            )}
          </Button>
        </div>
      </div>

      {/* Form */}
      <Card>
        <div className="p-6 space-y-6">
          <div>
            <Label htmlFor="name" className="text-base block mb-2">
              Offer Name <span className="text-red-500">*</span>
            </Label>
            <Input
              id="name"
              value={formData.name}
              onChange={(e) => handleChange("name", e.target.value)}
              placeholder="e.g., Premium SaaS Package"
              className="mt-1"
            />
          </div>

          <div>
            <Label htmlFor="description" className="text-base block mb-2">
              Description
            </Label>
            <Textarea
              id="description"
              value={formData.description}
              onChange={(e) => handleChange("description", e.target.value)}
              placeholder="Describe this offer, its features, benefits, pricing, etc..."
              rows={8}
              className="mt-1"
            />
          </div>

          <div>
            <Label htmlFor="transactional_facts" className="text-base block mb-2">
              Transactional Facts
            </Label>
            <p className="text-sm text-gray-600 mb-2">
              List factual details customers must know before buying (price, lead time, MOQ, options, shipping, compatibility, etc.). 
              These are logistics facts, not marketing benefits.
            </p>
            <Textarea
              id="transactional_facts"
              value={formData.transactional_facts}
              onChange={(e) => handleChange("transactional_facts", e.target.value)}
              placeholder="e.g., Price: $99/month, Lead time: 2-3 weeks, Minimum order: 10 units, Shipping: Free in US, Compatible with: Windows, Mac, Linux..."
              rows={6}
              className="mt-1"
            />
          </div>
        </div>
      </Card>
    </div>
  );
}

