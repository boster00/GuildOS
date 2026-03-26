// ARCHIVED: Original path was app/(private)/reputation-monitor/page.js

"use client";
import React, { useState } from "react";
import { Play, TrendingUp, MessageSquare, ThumbsUp } from "lucide-react";
import styles from "./ReputationMonitor.module.css";

// Simple Components
function Button({ children, className = "", variant = "default", onClick, ...props }) {
  console.log("[app/(private)/reputation-monitor/page.js] Button");
  const baseClasses = "inline-flex items-center justify-center rounded-md font-medium transition-colors focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-offset-2 disabled:pointer-events-none disabled:opacity-50";
  
  const variants = {
    default: "bg-blue-600 text-white hover:bg-blue-700 focus-visible:ring-blue-600",
    outline: "border border-gray-300 bg-white text-gray-700 hover:bg-gray-50 focus-visible:ring-blue-600"
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
  console.log("[app/(private)/reputation-monitor/page.js] Card");
  return <div className={`${styles.card} ${className}`}>{children}</div>;
}

function Badge({ children, className = "", variant = "default" }) {
  console.log("[app/(private)/reputation-monitor/page.js] Badge");
  const variants = {
    default: "bg-gray-100 text-gray-800",
    success: "bg-green-50 text-green-700",
    warning: "bg-yellow-50 text-yellow-700",
    info: "bg-blue-50 text-blue-700",
    neutral: "bg-gray-50 text-gray-600"
  };

  return (
    <span className={`${styles.badge} ${variants[variant]} ${className}`}>
      {children}
    </span>
  );
}

function Select({ value, onChange, children, className = "" }) {
  console.log("[app/(private)/reputation-monitor/page.js] Select");
  return (
    <select
      value={value}
      onChange={(e) => onChange(e.target.value)}
      className={`${styles.select} ${className}`}
    >
      {children}
    </select>
  );
}

// Tab Components
function Tabs({ defaultValue, children, className = "" }) {
  console.log("[app/(private)/reputation-monitor/page.js] Tabs");
  const [activeTab, setActiveTab] = useState(defaultValue);
  
  return (
    <div className={`${styles.tabs} ${className}`}>
      {React.Children.map(children, child => 
        React.cloneElement(child, { activeTab, setActiveTab })
      )}
    </div>
  );
}

function TabsList({ children, activeTab, setActiveTab, className = "" }) {
  console.log("[app/(private)/reputation-monitor/page.js] TabsList");
  return (
    <div className={`${styles.tabsList} ${className}`}>
      {React.Children.map(children, child =>
        React.cloneElement(child, { activeTab, setActiveTab })
      )}
    </div>
  );
}

function TabsTrigger({ value, children, activeTab, setActiveTab }) {
  console.log("[app/(private)/reputation-monitor/page.js] TabsTrigger");
  return (
    <button
      className={`${styles.tabsTrigger} ${activeTab === value ? styles.tabsActive : ''}`}
      onClick={() => setActiveTab(value)}
    >
      {children}
    </button>
  );
}

function TabsContent({ value, children, activeTab }) {
  console.log("[app/(private)/reputation-monitor/page.js] TabsContent");
  if (activeTab !== value) return null;
  return <div className={styles.tabsContent}>{children}</div>;
}

// Simple Chart Component (replacing Recharts)
function SimpleLineChart({ data }) {
  console.log("[app/(private)/reputation-monitor/page.js] SimpleLineChart");
  const maxValue = Math.max(...data.flatMap(d => [d.positive, d.neutral, d.negative]));
  const chartHeight = 250;
  const chartWidth = 600;
  const padding = 40;

  const getY = (value) => chartHeight - padding - ((value / maxValue) * (chartHeight - 2 * padding));
  const getX = (index) => padding + (index * (chartWidth - 2 * padding)) / (data.length - 1);

  const createPath = (dataKey) => {
  console.log("[app/(private)/reputation-monitor/page.js] createPath");
    return data.map((d, i) => `${i === 0 ? 'M' : 'L'} ${getX(i)} ${getY(d[dataKey])}`).join(' ');
  };

  return (
    <div className={styles.chartContainer}>
      <svg width="100%" height={chartHeight} viewBox={`0 0 ${chartWidth} ${chartHeight}`}>
        {/* Grid lines */}
        <defs>
          <pattern id="grid" width="40" height="40" patternUnits="userSpaceOnUse">
            <path d="M 40 0 L 0 0 0 40" fill="none" stroke="#e5e7eb" strokeWidth="1" strokeDasharray="3,3"/>
          </pattern>
        </defs>
        <rect width="100%" height="100%" fill="url(#grid)" />
        
        {/* Lines */}
        <path d={createPath('positive')} fill="none" stroke="#10b981" strokeWidth="2" />
        <path d={createPath('neutral')} fill="none" stroke="#6b7280" strokeWidth="2" />
        <path d={createPath('negative')} fill="none" stroke="#ef4444" strokeWidth="2" />
        
        {/* Data points */}
        {data.map((d, i) => (
          <g key={i}>
            <circle cx={getX(i)} cy={getY(d.positive)} r="3" fill="#10b981" />
            <circle cx={getX(i)} cy={getY(d.neutral)} r="3" fill="#6b7280" />
            <circle cx={getX(i)} cy={getY(d.negative)} r="3" fill="#ef4444" />
          </g>
        ))}
        
        {/* X-axis labels */}
        {data.map((d, i) => (
          <text key={i} x={getX(i)} y={chartHeight - 10} textAnchor="middle" fontSize="12" fill="#6b7280">
            {d.date}
          </text>
        ))}
      </svg>
      
      <div className={styles.chartLegend}>
        <div className={styles.legendItem}>
          <div className={styles.legendColor} style={{backgroundColor: '#10b981'}}></div>
          <span>Positive</span>
        </div>
        <div className={styles.legendItem}>
          <div className={styles.legendColor} style={{backgroundColor: '#6b7280'}}></div>
          <span>Neutral</span>
        </div>
        <div className={styles.legendItem}>
          <div className={styles.legendColor} style={{backgroundColor: '#ef4444'}}></div>
          <span>Negative</span>
        </div>
      </div>
    </div>
  );
}

// Modal Component
function Modal({ isOpen, onClose, children }) {
  console.log("[app/(private)/reputation-monitor/page.js] Modal");
  if (!isOpen) return null;

  return (
    <div className={styles.modalOverlay} onClick={onClose}>
      <div className={styles.modalContent} onClick={(e) => e.stopPropagation()}>
        {children}
      </div>
    </div>
  );
}

// Mentions Table Component
function MentionsTable({ filters, onRowClick }) {
  console.log("[app/(private)/reputation-monitor/page.js] MentionsTable");
  const mentions = [
    {
      id: 1,
      title: "Best enterprise software for scaling startups?",
      platform: "Reddit",
      sentiment: "Neutral",
      snippet: "Looking for recommendations on enterprise...",
      date: "Jan 13, 2025"
    },
    {
      id: 2,
      title: "What should I look for in enterprise software integrations?",
      platform: "Reddit",
      sentiment: "Positive",
      snippet: "We've had great success with platforms that...",
      date: "Jan 12, 2025"
    },
    {
      id: 3,
      title: "Ask HN: Which SaaS tools do you recommend?",
      platform: "HN",
      sentiment: "Neutral",
      snippet: "Curious what the HN community recommends...",
      date: "Jan 11, 2025"
    }
  ];

  const getPlatformColor = (platform) => {
  console.log("[app/(private)/reputation-monitor/page.js] getPlatformColor");
    switch (platform) {
      case "Reddit": return "🔴";
      case "HN": return "🟠";
      case "Quora": return "🔵";
      default: return "⚫";
    }
  };

  const getSentimentVariant = (sentiment) => {
  console.log("[app/(private)/reputation-monitor/page.js] getSentimentVariant");
    switch (sentiment) {
      case "Positive": return "success";
      case "Negative": return "warning";
      case "Neutral": return "neutral";
      default: return "default";
    }
  };

  return (
    <div className={styles.tableContainer}>
      <table className={styles.table}>
        <thead>
          <tr>
            <th>Thread / Post</th>
            <th>Sentiment</th>
            <th>Snippet</th>
            <th>Date</th>
          </tr>
        </thead>
        <tbody>
          {mentions.map((mention) => (
            <tr key={mention.id} onClick={() => onRowClick(mention)} className={styles.clickableRow}>
              <td>
                <div className={styles.threadCell}>
                  <span className={styles.platformEmoji}>{getPlatformColor(mention.platform)}</span>
                  <span className={styles.threadTitle}>{mention.title}</span>
                </div>
              </td>
              <td>
                <Badge variant={getSentimentVariant(mention.sentiment)}>
                  {mention.sentiment}
                </Badge>
              </td>
              <td className={styles.snippetCell}>{mention.snippet}</td>
              <td className={styles.dateCell}>{mention.date}</td>
            </tr>
          ))}
        </tbody>
      </table>
    </div>
  );
}

export default function ReputationMonitor() {
  console.log("[app/(private)/reputation-monitor/page.js] ReputationMonitor");
  const [filters, setFilters] = useState({
    platform: "all",
    sentiment: "all",
    icp: "all",
  });
  const [selectedMention, setSelectedMention] = useState(null);

  const mentionsData = [
    { date: "Jan 8", positive: 3, neutral: 5, negative: 1 },
    { date: "Jan 9", positive: 4, neutral: 6, negative: 2 },
    { date: "Jan 10", positive: 5, neutral: 7, negative: 1 },
    { date: "Jan 11", positive: 6, neutral: 5, negative: 3 },
    { date: "Jan 12", positive: 4, neutral: 8, negative: 2 },
    { date: "Jan 13", positive: 7, neutral: 6, negative: 1 },
    { date: "Jan 14", positive: 5, neutral: 9, negative: 2 },
  ];

  return (
    <div className={styles.pageContainer}>
      <div className={styles.pageHeader}>
        <div>
          <h1 className={styles.pageTitle}>Reputation Monitor</h1>
          <p className={styles.pageSubtitle}>
            Track mentions and manage your online presence
          </p>
        </div>
        <Button>
          <Play className="w-4 h-4" />
          Scan for Mentions
        </Button>
      </div>

      <Tabs defaultValue="mentions" className={styles.tabsContainer}>
        <TabsList className={styles.tabsListGrid}>
          <TabsTrigger value="mentions">Mentions Tracker</TabsTrigger>
          <TabsTrigger value="feeder">Feeder Sites</TabsTrigger>
          <TabsTrigger value="profiles">Profiles & Listings</TabsTrigger>
        </TabsList>

        <TabsContent value="mentions">
          <div className={styles.kpiGrid}>
            <Card className={styles.kpiCard}>
              <div className={styles.kpiContent}>
                <div className={styles.kpiInfo}>
                  <p className={styles.kpiLabel}>Mentions (7d)</p>
                  <p className={styles.kpiValue}>24</p>
                  <p className={styles.kpiTrend}>
                    <TrendingUp className="w-3 h-3" /> +15% vs last week
                  </p>
                </div>
                <MessageSquare className={styles.kpiIcon} />
              </div>
            </Card>

            <Card className={styles.kpiCard}>
              <div className={styles.kpiContent}>
                <div className={styles.kpiInfo}>
                  <p className={styles.kpiLabel}>% Positive</p>
                  <p className={`${styles.kpiValue} ${styles.positiveValue}`}>62%</p>
                  <p className={styles.kpiNote}>15 positive mentions</p>
                </div>
                <ThumbsUp className={`${styles.kpiIcon} ${styles.positiveIcon}`} />
              </div>
            </Card>

            <Card className={styles.kpiCard}>
              <div className={styles.kpiContent}>
                <div className={styles.kpiInfo}>
                  <p className={styles.kpiLabel}>New Threads</p>
                  <p className={styles.kpiValue}>8</p>
                  <p className={styles.kpiNote}>Being tracked</p>
                </div>
                <div className={styles.threadsBadge}>
                  <span>8</span>
                </div>
              </div>
            </Card>
          </div>

          <Card className={styles.chartCard}>
            <h3 className={styles.chartTitle}>Mentions Over Time</h3>
            <SimpleLineChart data={mentionsData} />
          </Card>

          <Card className={styles.filtersCard}>
            <div className={styles.filtersContainer}>
              <span className={styles.filtersLabel}>Filters:</span>
              <Select
                value={filters.platform}
                onChange={(value) => setFilters({ ...filters, platform: value })}
              >
                <option value="all">All Platforms</option>
                <option value="Reddit">Reddit</option>
                <option value="Quora">Quora</option>
                <option value="HN">HN</option>
              </Select>

              <Select
                value={filters.sentiment}
                onChange={(value) => setFilters({ ...filters, sentiment: value })}
              >
                <option value="all">All Sentiment</option>
                <option value="Positive">Positive</option>
                <option value="Neutral">Neutral</option>
                <option value="Negative">Negative</option>
              </Select>

              <Select
                value={filters.icp}
                onChange={(value) => setFilters({ ...filters, icp: value })}
              >
                <option value="all">All ICPs</option>
                <option value="enterprise">Enterprise SaaS Buyers</option>
              </Select>
            </div>

            <MentionsTable filters={filters} onRowClick={(mention) => setSelectedMention(mention)} />
          </Card>
        </TabsContent>

        <TabsContent value="feeder">
          <Card className={styles.comingSoonCard}>
            <div className={styles.comingSoon}>
              <h3>Feeder Sites</h3>
              <p>Coming soon - Track and manage your feeder site presence</p>
            </div>
          </Card>
        </TabsContent>

        <TabsContent value="profiles">
          <Card className={styles.comingSoonCard}>
            <div className={styles.comingSoon}>
              <h3>Profiles & Listings</h3>
              <p>Coming soon - Manage your business profiles and listings</p>
            </div>
          </Card>
        </TabsContent>
      </Tabs>

      <Modal isOpen={!!selectedMention} onClose={() => setSelectedMention(null)}>
        <div className={styles.modalHeader}>
          <h3 className={styles.modalTitle}>
            {selectedMention?.platform === "Reddit" && "🔴"} {selectedMention?.title}
          </h3>
          <p className={styles.modalDate}>{selectedMention?.date}</p>
        </div>
        
        <div className={styles.modalBody}>
          <div className={styles.contextSection}>
            <h4 className={styles.sectionTitle}>Full Context</h4>
            <div className={styles.contextBox}>
              {selectedMention?.snippet}
              <br /><br />
              Looking for recommendations on enterprise SaaS platforms that can grow with us.
              We're a 150-person company and need something with solid API capabilities and good
              customer support. Our main concerns are data migration and ongoing integration
              maintenance.
            </div>
          </div>

          <div className={styles.responseSection}>
            <h4 className={styles.sectionTitle}>Recommended Response</h4>
            <div className={styles.responseBox}>
              Hi! When evaluating enterprise platforms, integration capabilities should definitely
              be a top priority. Key things to look for: comprehensive API documentation, webhook
              support, pre-built connectors for common tools, and a proven migration methodology.
              Also ask about their support during implementation—that makes a huge difference.
            </div>
          </div>

          <div className={styles.modalActions}>
            <Button variant="outline" className={styles.modalButton}>
              View on {selectedMention?.platform}
            </Button>
            <Button className={styles.modalButton}>
              Add to Content Pipeline
            </Button>
          </div>
        </div>
      </Modal>
    </div>
  );
}