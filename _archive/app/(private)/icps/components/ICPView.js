// ARCHIVED: Original path was app/(private)/icps/components/ICPView.js

"use client";

import { useState, useEffect } from "react";
import { useRouter } from "next/navigation";
import Link from "next/link";
import { Pencil, ArrowLeft, BarChart3, MessageSquare, Calendar, Trash2, FileText } from "lucide-react";
import { initICP } from "@/libs/icp/class";
import styles from "./ICPs.module.css";

// Simple Components
function Button({ children, className = "", variant = "default", onClick, ...props }) {
  const baseClasses = "inline-flex items-center justify-center rounded-md font-medium transition-colors focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-offset-2 disabled:pointer-events-none disabled:opacity-50";
  
  const variants = {
    default: "bg-blue-600 text-white hover:bg-blue-700 focus-visible:ring-blue-600",
    outline: "border border-gray-300 bg-white text-gray-700 hover:bg-gray-50 focus-visible:ring-blue-600",
    destructive: "bg-red-600 text-white hover:bg-red-700 focus-visible:ring-red-600"
  };

  return (
    <button
      className={`${baseClasses} ${variants[variant]} px-4 py-2 gap-2 ${className}`}
      onClick={onClick}
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
    warning: "bg-yellow-50 text-yellow-700",
    info: "bg-blue-50 text-blue-700"
  };

  return (
    <span className={`${styles.badge} ${variants[variant]} ${className}`}>
      {children}
    </span>
  );
}

export default function ICPView({ icpId }) {
  const router = useRouter();
  const [icp, setIcp] = useState(null);
  const [isLoading, setIsLoading] = useState(true);
  const [error, setError] = useState(null);
  const [stats, setStats] = useState({});
  const [icpInstance, setIcpInstance] = useState(null);

  useEffect(() => {
    initializeAndFetch();
  }, [icpId]);

  const initializeAndFetch = async () => {
    try {
      setIsLoading(true);
      setError(null);
      
      console.log('🚀 Initializing ICP instance...');
      const icp = await initICP();
      setIcpInstance(icp);
      
      console.log('📋 Loading ICP details for ID:', icpId);
      await fetchICPDetails(icp);
      
    } catch (error) {
      console.error('❌ Failed to initialize:', error);
      setError(`Failed to load ICP: ${error.message}`);
    } finally {
      setIsLoading(false);
    }
  };

  const fetchICPDetails = async (icp = icpInstance) => {
    if (!icp || !icpId) return;
    
    try {
      // Get ICP details
      const icpData = await icp.get(icpId);
      console.log('✅ ICP data loaded:', icpData);
      
      if (!icpData) {
        throw new Error('ICP not found');
      }
      
      setIcp(icpData);
      
      // Get ICP stats
      try {
        const icpStats = await icp.getStats(icpId);
        console.log('📊 ICP stats loaded:', icpStats);
        setStats(icpStats || {});
      } catch (statsError) {
        console.warn('⚠️ Failed to load stats:', statsError);
        setStats({
          promptsCount: 0,
          websitesCount: 0,
          contentCount: 0,
          lastUsed: null
        });
      }
      
    } catch (error) {
      console.error('❌ Error fetching ICP:', error);
      if (error.message.includes('not found')) {
        setError('ICP not found');
      } else {
        setError(`Failed to load ICP details: ${error.message}`);
      }
    }
  };

  const handleDelete = async () => {
    const confirmMessage = `Are you sure you want to delete "${icp?.name}"? This action cannot be undone.`;
    
    if (!confirm(confirmMessage)) return;
    
    try {
      console.log('🗑️ Deleting ICP:', icpId);
      await icpInstance.delete(icpId);
      console.log('✅ ICP deleted successfully');
      router.push('/icps');
    } catch (error) {
      console.error('❌ Delete error:', error);
      setError(`Failed to delete ICP: ${error.message}`);
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
          <p>Loading ICP details...</p>
        </div>
      </div>
    );
  }

  if (error) {
    return (
      <div className={styles.pageContainer}>
        <div className={styles.emptyState}>
          <h1 className={styles.emptyTitle}>Error Loading ICP</h1>
          <p className={styles.emptyDescription}>{error}</p>
          <div className="flex gap-3 justify-center">
            <Button onClick={initializeAndFetch}>Try Again</Button>
            <Link href="/icps">
              <Button variant="outline">Back to ICPs</Button>
            </Link>
          </div>
        </div>
      </div>
    );
  }

  if (!icp) {
    return (
      <div className={styles.pageContainer}>
        <div className={styles.emptyState}>
          <h1 className={styles.emptyTitle}>ICP Not Found</h1>
          <p className={styles.emptyDescription}>The requested ICP could not be found.</p>
          <Link href="/icps">
            <Button>Back to ICPs</Button>
          </Link>
        </div>
      </div>
    );
  }

  return (
    <div className={styles.pageContainer}>
      {/* Header */}
      <div className={styles.viewHeader}>
        <div className={styles.headerContent}>
          <Link href="/icps" className={styles.backButton}>
            <ArrowLeft className="w-4 h-4" />
            Back to ICPs
          </Link>
          <div className={styles.titleSection}>
            <h1 className={styles.pageTitle}>{icp.name || 'Untitled ICP'}</h1>
            <Badge variant={icp.status === "active" ? "success" : "default"}>
              {icp.status || 'draft'}
            </Badge>
          </div>
          <p className={styles.pageSubtitle}>
            {icp.description || 'No description available'}
          </p>
        </div>
        
        <div className="flex gap-3">
          <Link href={`/icps/${icpId}/edit`}>
            <Button>
              <Pencil className="w-4 h-4" />
              Edit
            </Button>
          </Link>
          <Button variant="destructive" onClick={handleDelete}>
            <Trash2 className="w-4 h-4" />
            Delete
          </Button>
        </div>
      </div>

      {/* Info Grid - Created, Last Updated, Linked Prompts */}
      <div className={styles.infoGrid}>
        <div className={styles.infoCard}>
          <h3>Created</h3>
          <p>{formatDate(icp.created_at)}</p>
        </div>
        <div className={styles.infoCard}>
          <h3>Last Updated</h3>
          <p>{formatDate(icp.updated_at)}</p>
        </div>
        <div className={styles.infoCard}>
          <h3>Linked Prompts</h3>
          <p>{stats.promptsCount || 0}</p>
        </div>
      </div>

      {/* ICP Description */}
      <Card className={styles.descriptionCard}>
        <div className={styles.cardHeader}>
          <h2 className={styles.cardTitle}>Description</h2>
        </div>
        <div className={styles.cardContent}>
          <div className={styles.description}>
            {icp.description ? (
              <pre className={styles.descriptionText}>
                {icp.description}
              </pre>
            ) : (
              <p className={styles.emptyDescription}>
                No description provided. 
                <Link href={`/icps/${icpId}/edit`} className={styles.editLink}>
                  Add description
                </Link>
              </p>
            )}
          </div>
        </div>
      </Card>

      {/* Debug info in development */}
      {process.env.NODE_ENV === 'development' && (
        <Card className="mt-8 p-4 bg-gray-50">
          <h4 className="font-semibold mb-2">Debug Info:</h4>
          <pre className="text-xs text-gray-600">
            {JSON.stringify({
              icpId,
              hasIcp: !!icp,
              hasStats: !!stats,
              statsKeys: Object.keys(stats),
              error: error
            }, null, 2)}
          </pre>
        </Card>
      )}
    </div>
  );
}