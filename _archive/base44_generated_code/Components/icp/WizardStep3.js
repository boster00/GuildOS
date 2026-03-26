// ARCHIVED: Original path was base44_generated_code/Components/icp/WizardStep3.js

import React from "react";
import { Textarea } from "@/components/ui/textarea";
import { Label } from "@/components/ui/label";
import { Button } from "@/components/ui/button";
import { Sparkles, Loader2 } from "lucide-react";
import { Card } from "@/components/ui/card";

const fields = [
  { key: "whoTheyAre", label: "Who They Are", placeholder: "Demographics, roles, company size..." },
  { key: "whatTheyWant", label: "What They Want", placeholder: "Goals and desired outcomes..." },
  { key: "whatGetsInWay", label: "What Gets in the Way", placeholder: "Pain points and obstacles..." },
  { key: "howSolutionHelps", label: "How Solution Helps", placeholder: "Value proposition..." },
  { key: "uniqueSellingPts", label: "Unique Selling Points", placeholder: "What makes you different..." },
  { key: "alternatives", label: "Alternatives", placeholder: "Other solutions they consider..." },
  { key: "decisionCriteria", label: "Decision Criteria", placeholder: "How they evaluate options..." },
  { key: "searchTriggers", label: "Search Triggers", placeholder: "What prompts them to look..." },
  { key: "infoChannels", label: "Information Channels", placeholder: "Where they research..." },
  { key: "competitors", label: "Competitors", placeholder: "Direct and indirect competition..." },
  { key: "whyChooseYou", label: "Why Choose You", placeholder: "Competitive advantages..." },
  { key: "hesitations", label: "Hesitations", placeholder: "Concerns or objections..." },
];

export default function WizardStep3({ formData, onChange, onGenerate, isGenerating }) {
  return (
    <div className="space-y-6">
      <Card className="p-4 bg-gradient-to-r from-blue-50 to-indigo-50 border-blue-200">
        <div className="flex items-start gap-3">
          <Sparkles className="w-5 h-5 text-blue-600 mt-0.5" />
          <div className="flex-1">
            <p className="text-sm font-medium text-gray-900 mb-2">
              AI-Powered ICP Analysis
            </p>
            <p className="text-sm text-gray-700 mb-3">
              Let AI generate detailed insights based on your ICP description
            </p>
            <Button
              onClick={onGenerate}
              disabled={isGenerating || !formData.icpDesc || !formData.companyHelp}
              variant="outline"
              size="sm"
              className="gap-2 bg-white hover:bg-gray-50"
            >
              {isGenerating ? (
                <>
                  <Loader2 className="w-4 h-4 animate-spin" />
                  Generating...
                </>
              ) : (
                <>
                  <Sparkles className="w-4 h-4" />
                  Generate ICP Details
                </>
              )}
            </Button>
          </div>
        </div>
      </Card>

      <div className="grid md:grid-cols-2 gap-6">
        {fields.map((field) => (
          <div key={field.key}>
            <Label htmlFor={field.key} className="text-sm font-medium">
              {field.label}
            </Label>
            <Textarea
              id={field.key}
              value={formData[field.key] || ""}
              onChange={(e) => onChange(field.key, e.target.value)}
              placeholder={field.placeholder}
              rows={3}
              className="mt-2 text-sm"
            />
          </div>
        ))}
      </div>
    </div>
  );
}