"use client";

import { useState } from "react";

const REVIEW_TASKS = [
  // ── Main queue tasks ──
  {
    gid: "1213141878759687",
    name: "Implement LLM.txt",
    section: "Ready to Execute",
    action: "Posted 12-step implementation guide (3 phases) from BizGenius whitepaper",
    status: "done",
    url: "https://app.asana.com/0/1205080218355354/1213141878759687",
  },
  {
    gid: "1212832083931979",
    name: "Opensend set up in BosterNexus",
    section: "Ready to Execute",
    action: "Zoho CRM queried: 200+ contacts in 30 days, but ZERO from Opensend. SDK not integrated.",
    status: "done",
    url: "https://app.asana.com/0/1205080218355354/1212832083931979",
  },
  {
    gid: "1212813700546289",
    name: "Multiplex IF offer design",
    section: "Ready to Execute",
    action: "5 antibody-centered solution ideas posted to task description (market research + competitive analysis)",
    status: "done",
    url: "https://app.asana.com/0/1205080218355354/1212813700546289",
  },
  {
    gid: "1212463733337486",
    name: "Zebrafish antibody cold email / Smartleads",
    section: "Ready to Execute",
    action: "No API key or CDP access. Reported 3 options for user to choose.",
    status: "done",
    url: "https://app.asana.com/0/1205080218355354/1212463733337486",
  },
  {
    gid: "1214025303063053",
    name: "Develop website on cloud cursor",
    section: "Ready to Execute",
    action: "Agent FINISHED. PR #3: 30 files, homepage + 8 pages. Needs Figma exports for fidelity check.",
    status: "done",
    url: "https://app.asana.com/0/1205080218355354/1214025303063053",
  },
  // ── CJGEO campaign tasks ──
  {
    gid: "1213581243561068",
    name: "Fix CJGEO style tag issues",
    section: "CJGEO campaigns",
    action: "Posted analysis + fix approach. Needs CJGEO template access.",
    status: "done",
    url: "https://app.asana.com/0/1205080218355354/1213581243561068",
  },
  {
    gid: "1213503063566335",
    name: "Auto publish pipeline",
    section: "CJGEO campaigns",
    action: "Asked for clarification — no description provided.",
    status: "done",
    url: "https://app.asana.com/0/1205080218355354/1213503063566335",
  },
  {
    gid: "1211477818115768",
    name: "Blog posts for AI workflow test",
    section: "CJGEO campaigns",
    action: "Needs Google Docs access. Asked for export or alternative.",
    status: "done",
    url: "https://app.asana.com/0/1205080218355354/1211477818115768",
  },
  {
    gid: "1208471401165971",
    name: "LinkedIn outreach",
    section: "CJGEO campaigns",
    action: "Asked for clarification — no description.",
    status: "done",
    url: "https://app.asana.com/0/1205080218355354/1208471401165971",
  },
  {
    gid: "1212434998908021",
    name: "OneNote ideas triage",
    section: "CJGEO campaigns",
    action: "Prioritized 7 ideas into High/Medium/Low. Recommended starting with About Us + top antibodies.",
    status: "done",
    url: "https://app.asana.com/0/1205080218355354/1212434998908021",
  },
  {
    gid: "1205115332735694",
    name: "Sanyou capabilities onboard",
    section: "CJGEO campaigns",
    action: "Researched Sanyou services, proposed 3-step onboarding plan. Asked clarification questions.",
    status: "done",
    url: "https://app.asana.com/0/1205080218355354/1205115332735694",
  },
  {
    gid: "1205080432539033",
    name: "Service Offering Ideas",
    section: "CJGEO campaigns",
    action: "Asked for the service list — not visible in description.",
    status: "done",
    url: "https://app.asana.com/0/1205080218355354/1205080432539033",
  },
  {
    gid: "1212245866798618",
    name: "VexisBio CRO onboarding",
    section: "CJGEO campaigns",
    action: "Asked for clarification — no description.",
    status: "done",
    url: "https://app.asana.com/0/1205080218355354/1212245866798618",
  },
  {
    gid: "1211187781681056",
    name: "Break AI tasks into individual ones",
    section: "CJGEO campaigns",
    action: "Cannot view image attachment. Asked for text version.",
    status: "done",
    url: "https://app.asana.com/0/1205080218355354/1211187781681056",
  },
  {
    gid: "1210931143121791",
    name: "AI enrichment pipeline for geneinfo",
    section: "CJGEO campaigns",
    action: "Asked for clarification — no description.",
    status: "done",
    url: "https://app.asana.com/0/1205080218355354/1210931143121791",
  },
  {
    gid: "1206766948204867",
    name: "Profound features research + replicate",
    section: "CJGEO campaigns",
    action: "Posted implementation roadmap: MVP (4 items) + Phase 2 (3 items) with tech stack.",
    status: "done",
    url: "https://app.asana.com/0/1205080218355354/1206766948204867",
  },
  {
    gid: "1210978620000655",
    name: "Kyinno content pipeline",
    section: "CJGEO campaigns",
    action: "Posted content pipeline: 8 blog topics, 5 email angles, 4 landing pages, SEO keywords, social media ideas.",
    status: "done",
    url: "https://app.asana.com/0/1205080218355354/1210978620000655",
  },
  {
    gid: "1211255603520973",
    name: "Gene landing page LLM targeting",
    section: "CJGEO campaigns",
    action: "Posted AEO/GEO strategy with 4-step implementation plan.",
    status: "done",
    url: "https://app.asana.com/0/1205080218355354/1211255603520973",
  },
  {
    gid: "1211761792179185",
    name: "Multiplex staining campaign",
    section: "CJGEO campaigns",
    action: "Posted campaign strategy: 4 passive placements + 4 push campaign angles + target audiences.",
    status: "done",
    url: "https://app.asana.com/0/1205080218355354/1211761792179185",
  },
];

const STATUS_BADGE = {
  done: "badge-success",
  pending: "badge-warning",
  failed: "badge-error",
  reviewing: "badge-info",
};

export default function AsanaReviewClient() {
  const [tasks] = useState(REVIEW_TASKS);

  return (
    <div className="space-y-3">
      <p className="text-xs text-base-content/50">
        Session: {new Date().toLocaleDateString()} — auto-populated by Claude Code
      </p>

      <div className="overflow-x-auto">
        <table className="table table-sm">
          <thead>
            <tr>
              <th>Task</th>
              <th>Section</th>
              <th>Action Taken</th>
              <th>Status</th>
              <th></th>
            </tr>
          </thead>
          <tbody>
            {tasks.map((t) => (
              <tr key={t.gid} className="hover">
                <td className="font-medium max-w-xs truncate">{t.name}</td>
                <td className="text-xs text-base-content/60">{t.section}</td>
                <td className="text-sm max-w-sm">{t.action}</td>
                <td>
                  <span className={`badge badge-sm ${STATUS_BADGE[t.status] || "badge-ghost"}`}>
                    {t.status}
                  </span>
                </td>
                <td>
                  <a
                    href={t.url}
                    target="_blank"
                    rel="noopener noreferrer"
                    className="btn btn-ghost btn-xs"
                  >
                    Open
                  </a>
                </td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>
    </div>
  );
}
