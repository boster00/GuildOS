"use client";

import React, { useState, useEffect } from "react";
import { useRouter } from "next/navigation";
import Link from "next/link";
import { ArrowLeft, Save, Trash2, Loader2 } from "lucide-react";
import { initICP } from "@/libs/icp/class";
import styles from "./ICPs.module.css";

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
  return <div className={`${styles.card} ${className}`}>{children}</div>;
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

export default function ICPEditDetails({ icpId }) {
  const router = useRouter();
  const [isLoading, setIsLoading] = useState(true);
  const [isSaving, setIsSaving] = useState(false);
  const [isDeleting, setIsDeleting] = useState(false);
  const [icpInstance, setIcpInstance] = useState(null);
  const [formData, setFormData] = useState({
    title: "",
    description: ""
  });

  useEffect(() => {
    initializeAndLoad();
  }, [icpId]);

  const initializeAndLoad = async () => {
    try {
      setIsLoading(true);
      const icp = await initICP();
      setIcpInstance(icp);
      
      if (icpId) {
        const data = await icp.get(icpId);
        if (data) {
          setFormData({
            title: data.title || data.name || "",
            description: data.description || ""
          });
        }
      }
    } catch (error) {
      alert('Failed to load ICP: ' + error.message);
    } finally {
      setIsLoading(false);
    }
  };

  const handleChange = (field, value) => {
    setFormData((prev) => ({ ...prev, [field]: value }));
  };

  const handleSave = async () => {
    if (!icpInstance) return;
    
    if (!formData.title?.trim()) {
      alert('Title is required');
      return;
    }

    setIsSaving(true);
    try {
      if (icpId) {
        // Update existing ICP
        await icpInstance.update(icpId, {
          name: formData.title,
          description: formData.description
        });
      } else {
        // Create new ICP
        const newIcp = await icpInstance.create({
          name: formData.title,
          description: formData.description
        });
        if (newIcp?.id) {
          router.replace(`/icps/${newIcp.id}/edit`);
        }
      }
      
      alert(icpId ? 'ICP updated successfully!' : 'ICP created successfully!');
    } catch (error) {
      alert('Failed to save ICP: ' + error.message);
    } finally {
      setIsSaving(false);
    }
  };

  const handleDelete = async () => {
    if (!icpId || !icpInstance) return;
    
    const confirmMessage = `Are you sure you want to delete this ICP? This action cannot be undone.`;
    if (!confirm(confirmMessage)) return;
    
    setIsDeleting(true);
    try {
      await icpInstance.delete(icpId);
      router.push('/icps');
    } catch (error) {
      alert('Failed to delete ICP: ' + error.message);
    } finally {
      setIsDeleting(false);
    }
  };

  if (isLoading) {
    return (
      <div className={styles.pageContainer}>
        <div className={styles.loadingState}>
          <div className={styles.spinner}></div>
          <p>Loading ICP...</p>
        </div>
      </div>
    );
  }

  return (
    <div className={styles.pageContainer}>
      {/* Header */}
      <div className={styles.pageHeader}>
        <div>
          <div className="flex items-center gap-4 mb-2">
            <Link href="/icps">
              <Button variant="ghost" className="p-2">
                <ArrowLeft className="w-5 h-5" />
              </Button>
            </Link>
            <h1 className={styles.pageTitle}>
              {icpId ? 'Edit ICP' : 'New ICP'}
            </h1>
          </div>
          <p className={styles.pageSubtitle}>
            {icpId ? 'Update your Ideal Customer Profile' : 'Create a new Ideal Customer Profile'}
          </p>
        </div>
        <div className="flex gap-3">
          {icpId && (
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
            disabled={isSaving || !formData.title?.trim()}
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
            <Label htmlFor="title" className="text-base block mb-2">
              Title <span className="text-red-500">*</span>
            </Label>
            <Input
              id="title"
              value={formData.title}
              onChange={(e) => handleChange("title", e.target.value)}
              placeholder="e.g., Enterprise SaaS Buyers"
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
              placeholder="Describe your ideal customer profile..."
              rows={8}
              className="mt-1"
            />
          </div>
        </div>
      </Card>
    </div>
  );
}

