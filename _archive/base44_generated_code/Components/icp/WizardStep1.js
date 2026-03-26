// ARCHIVED: Original path was base44_generated_code/Components/icp/WizardStep1.js

import React from "react";
import { Input } from "@/components/ui/input";
import { Textarea } from "@/components/ui/textarea";
import { Label } from "@/components/ui/label";

export default function WizardStep1({ formData, onChange }) {
  return (
    <div className="space-y-6">
      <div>
        <Label htmlFor="name" className="text-base">
          ICP Name <span className="text-red-500">*</span>
        </Label>
        <Input
          id="name"
          value={formData.name || ""}
          onChange={(e) => onChange("name", e.target.value)}
          placeholder="e.g., Enterprise SaaS Decision Makers"
          className="mt-2"
        />
      </div>

      <div>
        <Label htmlFor="shortDesc" className="text-base">
          Short Description
        </Label>
        <Textarea
          id="shortDesc"
          value={formData.shortDesc || ""}
          onChange={(e) => onChange("shortDesc", e.target.value)}
          placeholder="Brief summary of this ICP..."
          rows={3}
          className="mt-2"
        />
      </div>
    </div>
  );
}