// ARCHIVED: Original path was base44_generated_code/Pages/Dashboard.js

import React from "react";
import { base44 } from "@/api/base44Client";
import { useQuery } from "@tanstack/react-query";
import { Activity, FileText, Building2, Calendar } from "lucide-react";
import { format } from "date-fns";

import MetricsCard from "../components/dashboard/MetricsCard";
import VisibilityChart from "../components/dashboard/VisibilityChart";
import OnboardingChecklist from "../components/dashboard/OnboardingChecklist";

export default function Dashboard() {
  const { data: icps = [] } = useQuery({
    queryKey: ["icps"],
    queryFn: () => base44.entities.Icp.list(),
  });

  const { data: prompts = [] } = useQuery({
    queryKey: ["prompts"],
    queryFn: () => base44.entities.Prompt.list(),
  });

  // Mock visibility data for chart
  const mockVisibilityData = [
    { date: "Jan 1", visibility: 45 },
    { date: "Jan 8", visibility: 52 },
    { date: "Jan 15", visibility: 58 },
    { date: "Jan 22", visibility: 63 },
    { date: "Jan 29", visibility: 71 },
    { date: "Feb 5", visibility: 68 },
    { date: "Feb 12", visibility: 75 },
  ];

  const avgVisibility = prompts.length > 0
    ? prompts.reduce((sum, p) => sum + (p.visibility || 0), 0) / prompts.length
    : 0;

  const lastScan = prompts
    .filter((p) => p.lastScanAt)
    .sort((a, b) => new Date(b.lastScanAt) - new Date(a.lastScanAt))[0];

  return (
    <div className="p-6 md:p-8 max-w-7xl mx-auto space-y-8">
      <div>
        <h1 className="text-3xl font-bold text-gray-900">Dashboard</h1>
        <p className="text-gray-600 mt-2">
          Track your prompt visibility and manage your ICPs
        </p>
      </div>

      <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-6">
        <MetricsCard
          title="Avg. Visibility Score"
          value={`${avgVisibility.toFixed(1)}%`}
          icon={Activity}
          trend="+12.5%"
          trendUp={true}
        />
        <MetricsCard
          title="Total Prompts"
          value={prompts.length}
          icon={FileText}
        />
        <MetricsCard
          title="Active ICPs"
          value={icps.length}
          icon={Building2}
        />
        <MetricsCard
          title="Last Scan"
          value={lastScan ? format(new Date(lastScan.lastScanAt), "MMM d") : "—"}
          icon={Calendar}
        />
      </div>

      <div className="grid lg:grid-cols-3 gap-6">
        <div className="lg:col-span-2">
          <VisibilityChart
            data={mockVisibilityData}
            icps={icps}
            prompts={prompts}
          />
        </div>
        <OnboardingChecklist
          hasIcp={icps.length > 0}
          hasPrompt={prompts.length > 0}
        />
      </div>
    </div>
  );
}