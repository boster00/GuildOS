// ARCHIVED: Original path was base44_generated_code/Pages/IcpWizard.js

import React from "react";
import { base44 } from "@/api/base44Client";
import { useNavigate } from "react-router-dom";
import { createPageUrl } from "@/utils";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { ArrowLeft, ArrowRight, Check, Save } from "lucide-react";
import { useToast } from "@/components/ui/use-toast";

import WizardStep1 from "../components/icp/WizardStep1";
import WizardStep2 from "../components/icp/WizardStep2";
import WizardStep3 from "../components/icp/WizardStep3";

const steps = [
  { title: "Basic Info", component: WizardStep1 },
  { title: "Company & Offers", component: WizardStep2 },
  { title: "ICP Analysis", component: WizardStep3 },
];

export default function IcpWizard() {
  const navigate = useNavigate();
  const { toast } = useToast();
  const [currentStep, setCurrentStep] = React.useState(0);
  const [formData, setFormData] = React.useState({});
  const [isSaving, setIsSaving] = React.useState(false);
  const [isGenerating, setIsGenerating] = React.useState(false);

  const urlParams = new URLSearchParams(window.location.search);
  const editId = urlParams.get("id");

  React.useEffect(() => {
    if (editId) {
      base44.entities.Icp.filter({ id: editId })
        .then((icps) => {
          if (icps[0]) setFormData(icps[0]);
        })
        .catch(() => {});
    }
  }, [editId]);

  const handleChange = (field, value) => {
    setFormData((prev) => ({ ...prev, [field]: value }));
  };

  const handleGenerate = async () => {
    setIsGenerating(true);
    try {
      const result = await base44.integrations.Core.InvokeLLM({
        prompt: `You are an expert marketing strategist. Based on the following ICP information, generate detailed analysis for each category.

ICP Description: ${formData.icpDesc}
How Company Helps: ${formData.companyHelp}
${formData.offerNames ? `Offers: ${formData.offerNames}` : ""}

Generate comprehensive content for:
1. Who They Are (demographics, roles, company characteristics)
2. What They Want (goals, desired outcomes)
3. What Gets in the Way (pain points, obstacles)
4. How Solution Helps (value proposition)
5. Unique Selling Points (differentiators)
6. Alternatives (competing solutions)
7. Decision Criteria (evaluation factors)
8. Search Triggers (what prompts search)
9. Information Channels (research sources)
10. Competitors (direct/indirect)
11. Why Choose You (advantages)
12. Hesitations (concerns, objections)

Be specific, actionable, and customer-focused.`,
        response_json_schema: {
          type: "object",
          properties: {
            whoTheyAre: { type: "string" },
            whatTheyWant: { type: "string" },
            whatGetsInWay: { type: "string" },
            howSolutionHelps: { type: "string" },
            uniqueSellingPts: { type: "string" },
            alternatives: { type: "string" },
            decisionCriteria: { type: "string" },
            searchTriggers: { type: "string" },
            infoChannels: { type: "string" },
            competitors: { type: "string" },
            whyChooseYou: { type: "string" },
            hesitations: { type: "string" },
          },
        },
      });

      setFormData((prev) => ({ ...prev, ...result }));
      toast({ title: "ICP details generated successfully!" });
    } catch (error) {
      toast({
        title: "Generation failed",
        description: "Please try again",
        variant: "destructive",
      });
    }
    setIsGenerating(false);
  };

  const canProceed = () => {
    if (currentStep === 0) return formData.name?.length >= 2;
    if (currentStep === 1)
      return formData.icpDesc?.length >= 10 && formData.companyHelp?.length >= 10;
    return true;
  };

  const handleSave = async () => {
    setIsSaving(true);
    try {
      if (editId) {
        await base44.entities.Icp.update(editId, formData);
        toast({ title: "ICP updated successfully!" });
      } else {
        await base44.entities.Icp.create(formData);
        toast({ title: "ICP created successfully!" });
      }
      navigate(createPageUrl("IcpList"));
    } catch (error) {
      toast({
        title: "Save failed",
        description: "Please check your inputs",
        variant: "destructive",
      });
    }
    setIsSaving(false);
  };

  const StepComponent = steps[currentStep].component;

  return (
    <div className="p-6 md:p-8 max-w-5xl mx-auto space-y-6">
      <div className="flex items-center gap-4">
        <Button
          variant="ghost"
          size="icon"
          onClick={() => navigate(createPageUrl("IcpList"))}
        >
          <ArrowLeft className="w-5 h-5" />
        </Button>
        <div className="flex-1">
          <h1 className="text-3xl font-bold text-gray-900">
            {editId ? "Edit" : "Create"} ICP
          </h1>
          <p className="text-gray-600 mt-1">
            Step {currentStep + 1} of {steps.length}
          </p>
        </div>
        <Button variant="outline" onClick={handleSave} disabled={isSaving} className="gap-2">
          <Save className="w-4 h-4" />
          Save Draft
        </Button>
      </div>

      <div className="flex items-center justify-center gap-2 mb-8">
        {steps.map((step, index) => (
          <React.Fragment key={index}>
            <div className="flex items-center gap-2">
              <div
                className={`w-8 h-8 rounded-full flex items-center justify-center font-medium transition-colors ${
                  index < currentStep
                    ? "bg-green-600 text-white"
                    : index === currentStep
                    ? "bg-blue-600 text-white"
                    : "bg-gray-200 text-gray-600"
                }`}
              >
                {index < currentStep ? <Check className="w-4 h-4" /> : index + 1}
              </div>
              <span
                className={`text-sm font-medium hidden md:inline ${
                  index <= currentStep ? "text-gray-900" : "text-gray-500"
                }`}
              >
                {step.title}
              </span>
            </div>
            {index < steps.length - 1 && (
              <div
                className={`h-px w-12 md:w-20 ${
                  index < currentStep ? "bg-green-600" : "bg-gray-300"
                }`}
              />
            )}
          </React.Fragment>
        ))}
      </div>

      <Card>
        <CardHeader>
          <CardTitle>{steps[currentStep].title}</CardTitle>
        </CardHeader>
        <CardContent className="min-h-96">
          <StepComponent
            formData={formData}
            onChange={handleChange}
            onGenerate={handleGenerate}
            isGenerating={isGenerating}
          />
        </CardContent>
      </Card>

      <div className="flex items-center justify-between">
        <Button
          variant="outline"
          onClick={() => setCurrentStep((s) => s - 1)}
          disabled={currentStep === 0}
          className="gap-2"
        >
          <ArrowLeft className="w-4 h-4" />
          Back
        </Button>

        {currentStep < steps.length - 1 ? (
          <Button
            onClick={() => setCurrentStep((s) => s + 1)}
            disabled={!canProceed()}
            className="gap-2 bg-blue-600 hover:bg-blue-700"
          >
            Next
            <ArrowRight className="w-4 h-4" />
          </Button>
        ) : (
          <Button
            onClick={handleSave}
            disabled={isSaving || !canProceed()}
            className="gap-2 bg-green-600 hover:bg-green-700"
          >
            <Check className="w-4 h-4" />
            {isSaving ? "Saving..." : "Finish"}
          </Button>
        )}
      </div>
    </div>
  );
}