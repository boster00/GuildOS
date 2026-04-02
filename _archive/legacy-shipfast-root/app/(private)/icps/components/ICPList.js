"use client";

import React, { useState, useEffect } from "react";
import Link from "next/link";
import { Plus, Edit, Trash2, AlertCircle } from "lucide-react";
import { initICP } from "@/libs/icp/class";
import styles from "./ICPs.module.css";

// Simple Components (copy from your other files)
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

function Badge({ children, className = "", variant = "default" }) {
  const variants = {
    default: "bg-gray-100 text-gray-800",
    success: "bg-green-50 text-green-700",
    info: "bg-blue-50 text-blue-700",
    warning: "bg-yellow-50 text-yellow-700",
    danger: "bg-red-50 text-red-700"
  };

  return (
    <span className={`${styles.badge} ${variants[variant]} ${className}`}>
      {children}
    </span>
  );
}

export default function ICPList() {
  const [icps, setIcps] = useState([]);
  const [isLoading, setIsLoading] = useState(true);
  const [error, setError] = useState(null);
  const [icpInstance, setIcpInstance] = useState(null);
  const [deletingIds, setDeletingIds] = useState(new Set());

  // Initialize ICP instance and load data
  useEffect(() => {
    initializeICP();
  }, []);

  const initializeICP = async () => {
    try {
      setIsLoading(true);
      setError(null);
      const icp = await initICP();
      setIcpInstance(icp);
      await loadICPs(icp);
      
    } catch (error) {
      setError(`Failed to load ICPs: ${error.message}`);
    } finally {
      setIsLoading(false);
    }
  };

  const loadICPs = async (icp = icpInstance) => {
    if (!icp) return;
    
    try {
      const data = await icp.list();
      if (Array.isArray(data)) {
        setIcps(data);
      } else {
        setIcps([]);
      }
    } catch (error) {
      setError(`Failed to load ICPs: ${error.message}`);
      setIcps([]);
    }
  };


  const handleDelete = async (icpId) => {
    const icpToDelete = icps.find(icp => icp.id === icpId);
    const confirmMessage = `Are you sure you want to delete "${icpToDelete?.name}"? This action cannot be undone.`;
    
    if (!confirm(confirmMessage)) return;
    
    try {
      setDeletingIds(prev => new Set([...prev, icpId]));
      await icpInstance.delete(icpId);
      setIcps(prev => prev.filter(icp => icp.id !== icpId));
      
    } catch (error) {
      setError(`Failed to delete ICP: ${error.message}`);
    } finally {
      setDeletingIds(prev => {
        const newSet = new Set(prev);
        newSet.delete(icpId);
        return newSet;
      });
    }
  };


  const formatDate = (dateString) => {
    if (!dateString) return 'Never';
    try {
      return new Date(dateString).toLocaleDateString('en-US', {
        year: 'numeric',
        month: 'short',
        day: 'numeric'
      });
    } catch {
      return 'Invalid date';
    }
  };

  if (isLoading) {
    return (
      <div className={styles.pageContainer}>
        <div className={styles.loadingState}>
          <div className={styles.spinner}></div>
          <p>Loading ICPs from database...</p>
        </div>
      </div>
    );
  }

  if (error) {
    return (
      <div className={styles.pageContainer}>
        <Card className={styles.errorState}>
          <div className={styles.errorContent}>
            <AlertCircle className="w-12 h-12 text-red-500 mx-auto mb-4" />
            <h3 className={styles.errorTitle}>Error Loading ICPs</h3>
            <p className={styles.errorDescription}>{error}</p>
            <div className="flex gap-4 justify-center mt-4">
              <Button onClick={initializeICP} variant="default">
                <RefreshCw className="w-4 h-4" />
                Retry
              </Button>
              <Link href="/icps/playground">
                <Button variant="outline">
                  Test Backend
                </Button>
              </Link>
            </div>
          </div>
        </Card>
      </div>
    );
  }

  return (
    <div className={styles.pageContainer}>
      <div className={styles.pageHeader}>
        <div>
          <h1 className={styles.pageTitle}>Ideal Customer Profiles</h1>
          <p className={styles.pageSubtitle}>
            Manage your target customer segments and personas ({icps.length} total)
          </p>
        </div>
        <div className="flex gap-3">
          <Link href="/icps/new">
            <Button>
              <Plus className="w-4 h-4" />
              Add New ICP
            </Button>
          </Link>
        </div>
      </div>

      {icps.length === 0 ? (
        <Card className={styles.emptyState}>
          <div className={styles.emptyContent}>
            <div className={styles.emptyIcon}>👥</div>
            <h3 className={styles.emptyTitle}>No ICPs yet</h3>
            <p className={styles.emptyDescription}>
              Create your first Ideal Customer Profile to get started with targeted marketing
            </p>
            <div className="flex gap-3 justify-center">
              <Link href="/icps/new">
                <Button>
                  <Plus className="w-4 h-4" />
                  Create First ICP
                </Button>
              </Link>
              <Link href="/icps/playground">
                <Button variant="outline">
                  Test Backend Functions
                </Button>
              </Link>
            </div>
          </div>
        </Card>
      ) : (
        <Card>
          <div className={styles.tableContainer}>
            <table className={styles.table}>
              <thead>
                <tr>
                  <th>Title</th>
                  <th>Description</th>
                  <th>Updated</th>
                  <th>Actions</th>
                </tr>
              </thead>
              <tbody>
                {icps.map((icp) => {
                  const isDeleting = deletingIds.has(icp.id);
                  
                  return (
                    <tr key={icp.id} className={`${styles.tableRow} ${isDeleting ? styles.deleting : ''}`}>
                      <td>
                        <div className={styles.titleCell}>
                          <span className={styles.titleText}>{icp.title || icp.name || 'Untitled ICP'}</span>
                        </div>
                      </td>
                      <td>
                        <div className={styles.descriptionCell}>
                          <span className={styles.descriptionText}>
                            {icp.description || 'No description available'}
                          </span>
                        </div>
                      </td>
                      <td className={styles.dateCell}>
                        {formatDate(icp.updated_at || icp.created_at)}
                      </td>
                      <td>
                        <div className={styles.actionButtons}>
                          <Link href={`/icps/${icp.id}/edit`}>
                            <Button variant="outline" className={styles.actionButton}>
                              <Edit className="w-4 h-4" />
                              <span className="hidden sm:inline">Edit</span>
                            </Button>
                          </Link>
                          <Button 
                            variant="ghost" 
                            onClick={() => handleDelete(icp.id)}
                            className={styles.deleteButton}
                            disabled={isDeleting}
                          >
                            {isDeleting ? (
                              <div className={styles.miniSpinner}></div>
                            ) : (
                              <Trash2 className="w-4 h-4" />
                            )}
                          </Button>
                        </div>
                      </td>
                    </tr>
                  );
                })}
              </tbody>
            </table>
          </div>
        </Card>
      )}

      {/* Debug info in development */}
      {process.env.NODE_ENV === 'development' && (
        <Card className="mt-8 p-4 bg-gray-50">
          <h4 className="font-semibold mb-2">Debug Info:</h4>
          <pre className="text-xs text-gray-600">
            {JSON.stringify({
              icpsCount: icps.length,
              hasIcpInstance: !!icpInstance,
              error: error
            }, null, 2)}
          </pre>
        </Card>
      )}
    </div>
  );
}