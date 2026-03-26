// ARCHIVED: Original path was base44_generated_code/Components/icp/WizardStep2.js

import React from "react";
import { Textarea } from "@/components/ui/textarea";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";

export default function WizardStep2({ formData, onChange }) {
  return (
    <div className="space-y-6">
      <div>
        <Label htmlFor="icpDesc" className="text-base">
          ICP Description <span className="text-red-500">*</span>
        </Label>
        <p className="text-sm text-gray-600 mt-1 mb-2">
          Tell us about this ideal customer profile
        </p>
        <Textarea
          id="icpDesc"
          value={formData.icpDesc || ""}
          onChange={(e) => onChange("icpDesc", e.target.value)}
          placeholder="Describe your ideal customer..."
          rows={4}
          className="mt-2"
        />
      </div>

      <div>
        <Label htmlFor="offerNames" className="text-base">
          Offer Names
        </Label>
        <p className="text-sm text-gray-600 mt-1 mb-2">
          Comma-separated list of products/services
        </p>
        <Input
          id="offerNames"
          value={formData.offerNames || ""}
          onChange={(e) => onChange("offerNames", e.target.value)}
          placeholder="Product A, Service B, Solution C"
          className="mt-2"
        />
      </div>

      <div>
        <Label htmlFor="companyHelp" className="text-base">
          How Your Company Helps <span className="text-red-500">*</span>
        </Label>
        <Textarea
          id="companyHelp"
          value={formData.companyHelp || ""}
          onChange={(e) => onChange("companyHelp", e.target.value)}
          placeholder="Explain how your company solves their problems..."
          rows={4}
          className="mt-2"
        />
      </div>
    </div>
  );
}