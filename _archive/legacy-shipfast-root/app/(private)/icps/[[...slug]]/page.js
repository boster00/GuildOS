"use client";

import { useParams } from "next/navigation";
import ICPEditDetails from "../components/ICPEditDetails";
import ICPList from "../components/ICPList";
import ICPPlayground from "../components/ICPPlayground";

export default function ICPDynamicPage() {
  const params = useParams();
  const slug = params.slug || [];

  // Handle different URL patterns
  if (slug.length === 0) {
    // URL: /icps - Main listing
    return <ICPList />;
  }

  if (slug.length === 1) {
    const [firstParam] = slug;
    
    if (firstParam === "new") {
      // URL: /icps/new - Create new ICP
      return <ICPEditDetails />;
    } else if (firstParam === "playground") {
      // URL: /icps/playground
      return <ICPPlayground />;
    } else {
      // URL: /icps/[icp_id] - Edit/details (redirect to edit)
      const icpId = firstParam;
      return <ICPEditDetails icpId={icpId} />;
    }
  }

  if (slug.length === 2) {
    const [icpId, action] = slug;
    
    if (action === "edit") {
      // URL: /icps/[icp_id]/edit - Edit/details
      return <ICPEditDetails icpId={icpId} />;
    }
  }

  // 404 for unknown routes
  return (
    <div className="max-w-2xl mx-auto p-8 text-center">
      <h1 className="text-2xl font-bold text-gray-900 mb-4">Page Not Found</h1>
      <p className="text-gray-600">The requested ICP page could not be found.</p>
    </div>
  );
}