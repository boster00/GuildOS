// ARCHIVED: Original path was app/(private)/icps/components/ICPNew.js

"use client";

import { useRouter } from "next/navigation";
import ICPForm from "./ICPForm";

export default function ICPNew() {
  const router = useRouter();

  const handleSubmit = async (formData) => {
    // Mock API call - replace with your actual API
    const newIcp = {
      id: Date.now().toString(), // Mock ID
      ...formData,
      createdDate: new Date().toISOString()
    };

    console.log("Creating ICP:", newIcp);
    
    // Simulate API delay
    await new Promise(resolve => setTimeout(resolve, 1000));
    
    alert("ICP created successfully!");
    router.push(`/icps/${newIcp.id}`);
  };

  return (
    <ICPForm
      mode="new"
      onSubmit={handleSubmit}
    />
  );
}