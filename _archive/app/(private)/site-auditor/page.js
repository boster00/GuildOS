// ARCHIVED: Original path was app/(private)/site-auditor/page.js

"use client";
import React, { useState } from "react";
import { Play, FileDown, Zap, Globe, FileCheck, Database, Search, Settings } from "lucide-react";
import styles from "./SiteAuditor.module.css";

// Simple Components
function Button({ children, className = "", variant = "default", onClick, ...props }) {
  console.log("[app/(private)/site-auditor/page.js] Button");
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
  console.log("[app/(private)/site-auditor/page.js] Card");
  return <div className={`${styles.card} ${className}`}>{children}</div>;
}

function Badge({ children, className = "", variant = "default" }) {
  console.log("[app/(private)/site-auditor/page.js] Badge");
  const variants = {
    default: "bg-gray-100 text-gray-800",
    success: "bg-green-50 text-green-700",
    warning: "bg-yellow-50 text-yellow-700",
    danger: "bg-red-50 text-red-700"
  };

  return (
    <span className={`${styles.badge} ${variants[variant]} ${className}`}>
      {children}
    </span>
  );
}

function Select({ value, onChange, children, className = "" }) {
  console.log("[app/(private)/site-auditor/page.js] Select");
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
  console.log("[app/(private)/site-auditor/page.js] Tabs");
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
  console.log("[app/(private)/site-auditor/page.js] TabsList");
  return (
    <div className={`${styles.tabsList} ${className}`}>
      {React.Children.map(children, child =>
        React.cloneElement(child, { activeTab, setActiveTab })
      )}
    </div>
  );
}

function TabsTrigger({ value, children, activeTab, setActiveTab }) {
  console.log("[app/(private)/site-auditor/page.js] TabsTrigger");
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
  console.log("[app/(private)/site-auditor/page.js] TabsContent");
  if (activeTab !== value) return null;
  return <div className={styles.tabsContent}>{children}</div>;
}

// Data
const kpiCardsTech = [
  { label: "Core Web Vitals", value: "2 / 3 Pass", icon: Zap, color: "text-yellow-600" },
  { label: "Schema Coverage", value: "45%", icon: FileCheck, color: "text-blue-600" },
  { label: "Sitemap Status", value: "Valid", icon: Globe, color: "text-green-600" },
  { label: "Indexable Pages", value: "87 / 95", icon: Database, color: "text-purple-600" },
];

const kpiCardsContent = [
  { label: "ICP Coverage", value: "67%", color: "text-blue-600" },
  { label: "USP Clarity", value: "72%", color: "text-green-600" },
  { label: "Content Depth", value: "68%", color: "text-purple-600" },
];

const technicalIssues = [
  {
    id: 1,
    category: "Speed",
    issue: "Slow Largest Contentful Paint (LCP)",
    severity: "High",
    impact: "High",
    difficulty: "Medium",
    url: "/products/enterprise-suite",
    status: "Open"
  },
  {
    id: 2,
    category: "Schema",
    issue: "Missing Organization Schema",
    severity: "Medium",
    impact: "Medium",
    difficulty: "Easy",
    url: "/about",
    status: "Open"
  },
  {
    id: 3,
    category: "Meta",
    issue: "Duplicate meta descriptions",
    severity: "Medium",
    impact: "Medium",
    difficulty: "Easy",
    url: "/blog/post-1, /blog/post-2",
    status: "Open"
  },
  {
    id: 4,
    category: "Images",
    issue: "Images missing alt text",
    severity: "High",
    impact: "High",
    difficulty: "Easy",
    url: "/products/platform-pro",
    status: "Fixed"
  },
  {
    id: 5,
    category: "Crawl",
    issue: "Mixed content warnings (HTTP resources)",
    severity: "High",
    impact: "High",
    difficulty: "Hard",
    url: "/checkout",
    status: "Open"
  }
];

// Technical Issues Table Component
function TechnicalIssuesTable({ filters, onRowClick }) {
  console.log("[app/(private)/site-auditor/page.js] TechnicalIssuesTable");
  const filteredIssues = technicalIssues.filter(issue => {
    if (filters.category !== "all" && issue.category !== filters.category) return false;
    if (filters.severity !== "all" && issue.severity !== filters.severity) return false;
    if (filters.difficulty !== "all" && issue.difficulty !== filters.difficulty) return false;
    return true;
  });

  const getSeverityColor = (severity) => {
  console.log("[app/(private)/site-auditor/page.js] getSeverityColor");
    switch (severity) {
      case "High": return "text-red-600 bg-red-50";
      case "Medium": return "text-yellow-600 bg-yellow-50";
      case "Low": return "text-green-600 bg-green-50";
      default: return "text-gray-600 bg-gray-50";
    }
  };

  const getCategoryColor = (category) => {
  console.log("[app/(private)/site-auditor/page.js] getCategoryColor");
    switch (category) {
      case "Speed": return "text-red-600 bg-red-50";
      case "Schema": return "text-purple-600 bg-purple-50";
      case "Meta": return "text-blue-600 bg-blue-50";
      case "Images": return "text-green-600 bg-green-50";
      case "Crawl": return "text-orange-600 bg-orange-50";
      default: return "text-gray-600 bg-gray-50";
    }
  };

  return (
    <div className={styles.tableContainer}>
      <div className={styles.tableHeader}>
        <h3 className={styles.tableTitle}>Technical Issues</h3>
      </div>
      <table className={styles.table}>
        <thead>
          <tr>
            <th>Issue</th>
            <th>Severity</th>
            <th>Impact</th>
            <th>Difficulty</th>
            <th>Affected URL</th>
            <th>Status</th>
            <th>Actions</th>
          </tr>
        </thead>
        <tbody>
          {filteredIssues.map((issue) => (
            <tr key={issue.id} className={styles.tableRow}>
              <td>
                <div className={styles.issueCell}>
                  <Badge className={getCategoryColor(issue.category)}>
                    {issue.category}
                  </Badge>
                  <span className={styles.issueText}>{issue.issue}</span>
                </div>
              </td>
              <td>
                <Badge className={getSeverityColor(issue.severity)}>
                  {issue.severity}
                </Badge>
              </td>
              <td>{issue.impact}</td>
              <td>{issue.difficulty}</td>
              <td className={styles.urlCell}>{issue.url}</td>
              <td>
                <Badge variant={issue.status === "Fixed" ? "success" : "default"}>
                  {issue.status}
                </Badge>
              </td>
              <td>
                <Button variant="outline" onClick={() => onRowClick(issue)}>
                  View
                </Button>
              </td>
            </tr>
          ))}
        </tbody>
      </table>
    </div>
  );
}

// Audit Summary Panel Component
function AuditSummaryPanel() {
  console.log("[app/(private)/site-auditor/page.js] AuditSummaryPanel");
  return (
    <Card className={styles.summaryPanel}>
      <div className={styles.summaryHeader}>
        <h3 className={styles.summaryTitle}>Audit Summary</h3>
      </div>
      <div className={styles.summaryContent}>
        <div className={styles.scoreSection}>
          <div className={styles.scoreItem}>
            <span className={styles.scoreLabel}>Technical Score</span>
            <span className={styles.scoreValue}>72%</span>
            <div className={styles.progressBar}>
              <div className={styles.progressFill} style={{ width: '72%' }}></div>
            </div>
            <span className={styles.scoreNote}>8 issues need attention</span>
          </div>
          
          <div className={styles.scoreItem}>
            <span className={styles.scoreLabel}>Content Score</span>
            <span className={styles.scoreValue}>68%</span>
            <div className={styles.progressBar}>
              <div className={styles.progressFill} style={{ width: '68%' }}></div>
            </div>
            <span className={styles.scoreNote}>6 recommendations pending</span>
          </div>
        </div>

        <div className={styles.todoSection}>
          <Button variant="outline" className={styles.todoButton}>
            <Settings className="w-4 h-4" />
            Open To-Do Tracker
          </Button>
          
          <div className={styles.priorityList}>
            <div className={styles.priorityItem}>
              <span className={styles.priorityLabel}>High Priority</span>
              <span className={styles.priorityCount}>5</span>
            </div>
            <div className={styles.priorityItem}>
              <span className={styles.priorityLabel}>Medium Priority</span>
              <span className={styles.priorityCount}>6</span>
            </div>
            <div className={styles.priorityItem}>
              <span className={styles.priorityLabel}>Low Priority</span>
              <span className={styles.priorityCount}>3</span>
            </div>
          </div>
        </div>
      </div>
    </Card>
  );
}

export default function SiteAuditor() {
  console.log("[app/(private)/site-auditor/page.js] SiteAuditor");
  const [techFilters, setTechFilters] = useState({
    category: "all",
    severity: "all",
    difficulty: "all",
  });
  const [selectedIcp, setSelectedIcp] = useState("all");
  const [selectedIssue, setSelectedIssue] = useState(null);

  const lastAudit = new Date();

  const formatDate = (date) => {
  console.log("[app/(private)/site-auditor/page.js] formatDate");
    return date.toLocaleDateString('en-US', { 
      month: 'short', 
      day: 'numeric', 
      year: 'numeric' 
    });
  };

  return (
    <div className={styles.pageContainer}>
      <div className={styles.pageHeader}>
        <div>
          <h1 className={styles.pageTitle}>Site Auditor</h1>
          <p className={styles.pageSubtitle}>
            Last audit: {formatDate(lastAudit)}
          </p>
        </div>
        <div className={styles.actionButtons}>
          <Button variant="outline">
            <FileDown className="w-4 h-4" />
            Export Report
          </Button>
          <Button>
            <Play className="w-4 h-4" />
            Run New Audit
          </Button>
        </div>
      </div>

      <div className={styles.mainGrid}>
        <div className={styles.contentArea}>
          <Tabs defaultValue="technical" className={styles.tabsContainer}>
            <TabsList className={styles.tabsListGrid}>
              <TabsTrigger value="technical">Technical Audit</TabsTrigger>
              <TabsTrigger value="content">Content Audit</TabsTrigger>
            </TabsList>

            <TabsContent value="technical">
              <div className={styles.kpiGrid}>
                {kpiCardsTech.map((kpi, index) => {
                  const Icon = kpi.icon;
                  return (
                    <Card key={index} className={styles.kpiCard}>
                      <div className={styles.kpiHeader}>
                        <span className={styles.kpiLabel}>{kpi.label}</span>
                        <Icon className={`w-5 h-5 ${kpi.color}`} />
                      </div>
                      <div className={styles.kpiValue}>{kpi.value}</div>
                    </Card>
                  );
                })}
              </div>

              <Card className={styles.filtersCard}>
                <div className={styles.filtersContainer}>
                  <span className={styles.filtersLabel}>Filters:</span>
                  <Select
                    value={techFilters.category}
                    onChange={(value) =>
                      setTechFilters({ ...techFilters, category: value })
                    }
                  >
                    <option value="all">All Categories</option>
                    <option value="Speed">Speed</option>
                    <option value="Schema">Schema</option>
                    <option value="Meta">Meta</option>
                    <option value="Images">Images</option>
                    <option value="Crawl">Crawl</option>
                  </Select>

                  <Select
                    value={techFilters.severity}
                    onChange={(value) =>
                      setTechFilters({ ...techFilters, severity: value })
                    }
                  >
                    <option value="all">All Severity</option>
                    <option value="High">High</option>
                    <option value="Medium">Medium</option>
                    <option value="Low">Low</option>
                  </Select>

                  <Select
                    value={techFilters.difficulty}
                    onChange={(value) =>
                      setTechFilters({ ...techFilters, difficulty: value })
                    }
                  >
                    <option value="all">All Difficulty</option>
                    <option value="Easy">Easy</option>
                    <option value="Medium">Medium</option>
                    <option value="Hard">Hard</option>
                  </Select>
                </div>
              </Card>

              <Card>
                <TechnicalIssuesTable
                  filters={techFilters}
                  onRowClick={(issue) => setSelectedIssue(issue)}
                />
              </Card>
            </TabsContent>

            <TabsContent value="content">
              <div className={styles.contentKpiGrid}>
                {kpiCardsContent.map((kpi, index) => (
                  <Card key={index} className={styles.kpiCard}>
                    <div className={styles.kpiLabel}>{kpi.label}</div>
                    <div className={`${styles.kpiValue} ${kpi.color}`}>{kpi.value}</div>
                  </Card>
                ))}
              </div>
              
              <Card className={styles.filtersCard}>
                <div className={styles.filtersContainer}>
                  <span className={styles.filtersLabel}>Filter by ICP:</span>
                  <Select value={selectedIcp} onChange={setSelectedIcp}>
                    <option value="all">All ICPs</option>
                    <option value="Enterprise SaaS Buyers">Enterprise SaaS Buyers</option>
                  </Select>
                </div>
              </Card>

              <div className={styles.contentGrid}>
                <Card className={styles.contentTable}>
                  <div className={styles.tableHeader}>
                    <h3 className={styles.tableTitle}>Content Recommendations</h3>
                  </div>
                  <p className={styles.comingSoon}>Content recommendations coming soon...</p>
                </Card>

                <Card className={styles.themesCard}>
                  <h3 className={styles.themesTitle}>Detected Themes</h3>
                  <div className={styles.themesList}>
                    <Badge className="bg-blue-50 text-blue-700">Scalability concerns</Badge>
                    <Badge className="bg-green-50 text-green-700">Integration needs</Badge>
                    <Badge className="bg-purple-50 text-purple-700">Security compliance</Badge>
                    <Badge className="bg-orange-50 text-orange-700">ROI calculation</Badge>
                    <Badge className="bg-pink-50 text-pink-700">Implementation time</Badge>
                    <Badge className="bg-yellow-50 text-yellow-700">Support quality</Badge>
                  </div>
                  <div className={styles.missedTopics}>
                    <h4 className={styles.missedTitle}>Missed Topics</h4>
                    <ul className={styles.missedList}>
                      <li>• API documentation depth</li>
                      <li>• Migration process clarity</li>
                      <li>• Uptime guarantees</li>
                    </ul>
                  </div>
                </Card>
              </div>
            </TabsContent>
          </Tabs>
        </div>

        <AuditSummaryPanel />
      </div>
    </div>
  );
}