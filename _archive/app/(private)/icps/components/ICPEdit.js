// ARCHIVED: Original path was app/(private)/icps/components/ICPEdit.js

"use client";

import { useState, useEffect } from "react";
import { useRouter } from "next/navigation";
import ICPForm from "./ICPForm";

export default function ICPEdit({ icpId }) {
  const router = useRouter();
  const [isLoading, setIsLoading] = useState(true);
  const [initialData, setInitialData] = useState(null);

  useEffect(() => {
    const fetchICP = async () => {
      try {
        // Mock API call - replace with your actual API
        const mockData = {
          id: icpId,
          name: "Enterprise SaaS Buyers",
          description: "Decision makers at mid to large companies evaluating SaaS solutions",
          icpDesc: `Mid to large companies (150-5000 employees) evaluating enterprise SaaS solutions. These are typically CTOs, IT Directors, and business unit leaders who are responsible for technology decisions.

Key characteristics:
• Budget authority or significant influence over purchasing decisions
• Focus on scalability, security, and integration capabilities
• Often require ROI justification and implementation support
• Value proven track records and case studies
• Prefer comprehensive solutions over point tools`,
          status: "active"
        };

        // Simulate API delay
        await new Promise(resolve => setTimeout(resolve, 300));
        
        setInitialData({
          name: mockData.name || "",
          description: mockData.description || "",
          icpDesc: mockData.icpDesc || "",
          status: mockData.status || "active"
        });
      } catch (error) {
        console.error("Fetch ICP error:", error);
        alert("Failed to load ICP");
        router.push("/icps");
      } finally {
        setIsLoading(false);
      }
    };

    if (icpId) {
      fetchICP();
    }
  }, [icpId, router]);

  const handleSubmit = async (formData) => {
    // Mock API call - replace with your actual API
    console.log("Updating ICP:", { icpId, ...formData });
    
    // Simulate API delay
    await new Promise(resolve => setTimeout(resolve, 1000));
    
    alert("ICP updated successfully!");
    router.push(`/icps/${icpId}`);
  };

  return (
    <ICPForm
      mode="edit"
      icpId={icpId}
      initialData={initialData}
      onSubmit={handleSubmit}
      isLoading={isLoading}
    />
  );
}