"use client";

import React, { useState, useEffect } from "react";
import { useRouter, useSearchParams } from "next/navigation";
import Link from "next/link";
import { ArrowLeft, ArrowRight, Check, Save, Sparkles, Loader2 } from "lucide-react";
import { icp, initICP } from "@/libs/icp/class";
import styles from "./ICPs.module.css";

// Simple Components
function Button({ children, className = "", variant = "default", onClick, disabled = false, ...props }) {
  const baseClasses = "inline-flex items-center justify-center rounded-md font-medium transition-colors focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-offset-2 disabled:pointer-events-none disabled:opacity-50";
  
  const variants = {
    default: "bg-blue-600 text-white hover:bg-blue-700 focus-visible:ring-blue-600",
    outline: "border border-gray-300 bg-white text-gray-700 hover:bg-gray-50 focus-visible:ring-blue-600",
    ghost: "text-gray-700 hover:bg-gray-100 focus-visible:ring-blue-600",
    success: "bg-green-600 text-white hover:bg-green-700 focus-visible:ring-green-600"
  };

  return (
    <button
      className={`${baseClasses} ${variants[variant]} px-4 py-2 gap-2 ${className}`}
      onClick={onClick}
      disabled={disabled}
      {...props}
    >
      {children}
    </button>
  );
}

function Card({ children, className = "" }) {
  return <div className={`${styles.card} ${className}`}>{children}</div>;
}

function Input({ className = "", ...props }) {
  return (
    <input
      className={`flex h-10 w-full rounded-md border border-gray-300 bg-white px-3 py-2 text-sm ring-offset-white file:border-0 file:bg-transparent file:text-sm file:font-medium placeholder:text-gray-500 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-blue-600 focus-visible:ring-offset-2 disabled:cursor-not-allowed disabled:opacity-50 ${className}`}
      {...props}
    />
  );
}

function Textarea({ className = "", ...props }) {
  return (
    <textarea
      className={`flex min-h-[80px] w-full rounded-md border border-gray-300 bg-white px-3 py-2 text-sm ring-offset-white placeholder:text-gray-500 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-blue-600 focus-visible:ring-offset-2 disabled:cursor-not-allowed disabled:opacity-50 ${className}`}
      {...props}
    />
  );
}

function Label({ children, className = "", ...props }) {
  return (
    <label
      className={`text-sm font-medium leading-none peer-disabled:cursor-not-allowed peer-disabled:opacity-70 ${className}`}
      {...props}
    >
      {children}
    </label>
  );
}

// Step Components
function WizardStep1({ formData, onChange }) {
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
        <Label htmlFor="short_desc" className="text-base">
          Short Description
        </Label>
        <Textarea
          id="short_desc"
          value={formData.short_desc || ""}
          onChange={(e) => onChange("short_desc", e.target.value)}
          placeholder="Brief summary of this ICP..."
          rows={3}
          className="mt-2"
        />
      </div>
    </div>
  );
}

function WizardStep2({ formData, onChange }) {
  return (
    <div className="space-y-6">
      <div>
        <Label htmlFor="icp_desc" className="text-base">
          ICP Description <span className="text-red-500">*</span>
        </Label>
        <p className="text-sm text-gray-600 mt-1 mb-2">
          Tell us about this ideal customer profile. If the ICP is local, include location details.
        </p>
        <Textarea
          id="icp_desc"
          value={formData.icp_desc || ""}
          onChange={(e) => onChange("icp_desc", e.target.value)}
          placeholder="Describe your ideal customer..."
          rows={4}
          className="mt-2"
        />
      </div>
      <div>
        <Label htmlFor="brand_name" className="text-base">
          Brand Name <span className="text-red-500">*</span>
        </Label>
        <p className="text-sm text-gray-600 mt-1 mb-2">
          What brand name would you like to check?
        </p>
        <Input
          id="brand_name"
          value={formData.brand_name || ""}
          onChange={(e) => onChange("brand_name", e.target.value)}
          placeholder="Enter your brand name"
          className="mt-2"
        />
      </div>
      <div>
        <Label htmlFor="offer_names" className="text-base">
          Offer Names
        </Label>
        <p className="text-sm text-gray-600 mt-1 mb-2">
          Comma-separated list of products/services
        </p>
        <Input
          id="offer_names"
          value={formData.offer_names || ""}
          onChange={(e) => onChange("offer_names", e.target.value)}
          placeholder="Product A, Service B, Solution C"
          className="mt-2"
        />
      </div>

      <div>
        <Label htmlFor="company_help" className="text-base">
          How Your Company Helps <span className="text-red-500">*</span>
        </Label>
        <p className="text-sm text-gray-600 mt-1 mb-2">
          Explain how your company solves their problems. Try to include your company's unique selling points (USPs) or unique advantages here.
        </p>
        <Textarea
          id="company_help"
          value={formData.company_help || ""}
          onChange={(e) => onChange("company_help", e.target.value)}
          placeholder="Explain how your company solves their problems..."
          rows={4}
          className="mt-2"
        />
      </div>
    </div>
  );
}

function WizardStep3({ formData, onChange, onGenerate, isGenerating, icpInstance }) {
  const fields = icpInstance?.fields || [];

  return (
    <div className="space-y-6">
      <Card className="p-4 bg-yellow-50 border-yellow-200 mb-4">
        <h3 className="font-semibold text-yellow-900 mb-2">Instructions</h3>
        <ol className="list-decimal list-inside text-sm text-yellow-800 space-y-1">
          <li>
            <span className="font-medium">Optional:</span> Use the AI to generate baseline answers for all questions below. This can help you quickly get started and spark ideas.
          </li>
          <li>
            <span className="font-medium">Enrich each answer:</span> Review and improve every response with your own unique insights and expertise. The more thoughtful and specific your answers, the more powerful this ICP will be for creating highly effective content later.
          </li>
        </ol>
      </Card>
      <Card className="p-4 bg-gradient-to-r from-blue-50 to-indigo-50 border-blue-200">
        <div className="flex items-start gap-3">
          <Sparkles className="w-5 h-5 text-blue-600 mt-0.5" />
          <div className="flex-1">
            <p className="text-sm font-medium text-gray-900 mb-2">
              AI-Powered ICP Analysis
            </p>
            <p className="text-sm text-gray-700 mb-3">
              Generate all fields at once or use AI assistance for individual fields
            </p>
            <Button
              onClick={onGenerate}
              disabled={isGenerating || !formData.icp_desc || !formData.company_help}
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
                  Generate All ICP Details
                </>
              )}
            </Button>
          </div>
        </div>
      </Card>

      <div className="grid md:grid-cols-2 gap-6">
        {fields.map((field) => (
          <div key={field.key}>
            <div className="flex items-center justify-between">
              <Label htmlFor={field.key} className="text-sm font-medium">
                {field.label}
              </Label>
              <Button
                variant="ghost"
                size="sm"
                className="text-xs text-blue-600 hover:text-blue-800 h-auto p-1"
                onClick={() => onGenerate(field.key)}
                disabled={isGenerating}
              >
                <Sparkles className="w-3 h-3 mr-1" />
                AI Generate
              </Button>
            </div>
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

const steps = [
  { title: "Basic Info", component: WizardStep1 },
  { title: "Company & Offers", component: WizardStep2 },
  { title: "ICP Analysis", component: WizardStep3 },
];

export default function ICPForm({ icpId = null }) {
  const router = useRouter();
  const searchParams = useSearchParams();
  
  // const [currentStep, setCurrentStep] = useState(initialStep);
  const [currentStep, setCurrentStep] = useState(icpId ? 1 : 0);
  const [formData, setFormData] = useState({
    status: 'draft' // Default status
  });
  const [isSaving, setIsSaving] = useState(false);
  const [isGenerating, setIsGenerating] = useState(false);
  const [icpInstance, setIcpInstance] = useState(null);
  const [currentIcpId, setCurrentIcpId] = useState(icpId);
  const [isLoading, setIsLoading] = useState(false);

  // Initialize ICP instance
  useEffect(() => {
    initializeICP();
  }, []);

  // Load existing ICP data if editing
  useEffect(() => {
    if (currentIcpId && icpInstance) {
      loadICPData();
    }
  }, [currentIcpId, icpInstance]);

  const initializeICP = async () => {
    try {
      // const icp = await initICP();
      setIcpInstance(icp);
    } catch (error) {
    }
  };

  const loadICPData = async () => {
    if (!icpInstance || !currentIcpId) return;
    
    try {
      setIsLoading(true);
      const data = await icpInstance.get(currentIcpId);
      if (data) {
        setFormData(data);
      }
    } catch (error) {
    } finally {
      setIsLoading(false);
    }
  };

  const handleChange = (field, value) => {
    setFormData((prev) => ({ ...prev, [field]: value }));
  };

  const handleGenerate = async (specificField = null) => {
    if (!icpInstance) return;
    const target = specificField?.target;
    const buttonText = target.innerText;
    setIsGenerating(true);
    try {
      let prompt;
      
      if (buttonText.includes("AI Generate") && specificField) {
        // Defensive: ensure specificField is a string
        const fieldKey = typeof specificField === "string" ? specificField : String(specificField);
        const fieldLabel = typeof fieldKey.replace === "function"
          ? fieldKey.replace(/_/g, ' ')
          : fieldKey;
        prompt = `Based on this ICP information, generate content for "${fieldLabel}":\n\nICP Description: ${formData.icp_desc}\nHow Company Helps: ${formData.company_help}\n\nGenerate specific, actionable content for this field only. 30-50 words. This is only for one field and contents belonging to other fields are addressed separately and should not be included--if included it will result in user confusion.`;

        const result = await icpInstance.AI(prompt, {
          vendor: "ChatGPT",
          model: "gpt-4o"
        });

        setFormData((prev) => ({ ...prev, [fieldKey]: result }));
      } else {
        prompt = `You are an expert marketing strategist. Based on the following ICP information, generate detailed analysis for each category.

    ICP Description: ${formData.icp_desc}
    How Company Helps: ${formData.company_help}
    // IMPORTANT: The response must be a JSON object matching the formData structure.
    // Example fields to include in the JSON response:
    ${JSON.stringify(icp.fieldKeys)}
    format: {key: value, ...}
    
    // Your response must be valid JSON and include all relevant fields.


    Generate comprehensive content for all ICP analysis fields. Be specific, actionable, and customer-focused. Each answer keep 30 - 50 words.`;
      }

      const result = await icpInstance.AI(prompt, {
        vendor: "ChatGPT",
        model: "gpt-4o"
      });
      let isJson = false;
      let parsed = {};
      if (typeof result === "string") {
        try {
          parsed = JSON.parse(result);
          if (parsed && typeof parsed === "object") {
            isJson = true;
          }
        } catch (e) {
          isJson = false;
        }
      }
      if (!isJson && specificField) {
        // Handle single field generation
        setFormData((prev) => ({ ...prev, [specificField]: result }));
      } else {
        // Handle multiple field generation - parse the AI response
        // For now, just show success message
        // let parsedResult;
        try {
          // parsedResult = JSON.parse(result);
            Object.keys(parsed).forEach((key) => {
            if (formData[key]) {
              delete parsed[key];
            }
            });
          setFormData((prev) => ({ ...prev, ...parsed }));
        } catch (e) {
        }
      }

    } catch (error) {
    }
    setIsGenerating(false);
  };

  const canProceed = () => {
    if (currentStep === 0) return formData.name?.length >= 2;
    if (currentStep === 1) return formData.icp_desc?.length >= 10 && formData.company_help?.length >= 10;
    return true;
  };

  const handleSave = async (isAutoSave = false) => {
    if (!icpInstance) return false;
    
    setIsSaving(true);
    try {
      if (currentIcpId) {
        // Update existing ICP
        await icpInstance.update(currentIcpId, formData);
      } else {
        // Create new ICP
        const newIcp = await icpInstance.create(formData);
        if (newIcp?.id) {
          setCurrentIcpId(newIcp.id);
          // Update URL to edit page
          router.replace(`/icps/${newIcp.id}/edit`);
        }
      }
      return true;
    } catch (error) {
      return false;
    } finally {
      setIsSaving(false);
    }
  };

  const handleNext = async () => {
    if (!canProceed()) return;
    
    // Auto-save before proceeding
    const saved = await handleSave(true);
    if (saved && currentStep < steps.length - 1) {
      setCurrentStep(currentStep + 1);
    }
  };

  const handleBack = () => {
    if (currentStep > 0) {
      setCurrentStep(currentStep - 1);
    }
  };

  const handleFinish = async () => {
    const saved = await handleSave();
    if (saved) {
      router.push('/icps');
    }
  };

  const StepComponent = steps[currentStep].component;

  if (isLoading) {
    return (
      <div className={styles.pageContainer}>
        <div className={styles.loadingState}>
          <div className={styles.spinner}></div>
          <p>Loading ICP...</p>
        </div>
      </div>
    );
  }

  return (
    <div className="p-6 md:p-8 max-w-5xl mx-auto space-y-6">
      {/* Header */}
      <div className="flex items-center gap-4">
        <Link href="/icps">
          <Button variant="ghost" size="icon">
            <ArrowLeft className="w-5 h-5" />
          </Button>
        </Link>
        <div className="flex-1">
          <h1 className="text-3xl font-bold text-gray-900">
            {currentIcpId ? "Edit" : "Create"} ICP
          </h1>
          <p className="text-gray-600 mt-1">
            Step {currentStep + 1} of {steps.length}
          </p>
        </div>
        <Button 
          variant="outline" 
          onClick={() => handleSave()} 
          disabled={isSaving} 
          className="gap-2"
        >
          <Save className="w-4 h-4" />
          {isSaving ? 'Saving...' : 'Save Draft'}
        </Button>
      </div>

      {/* Progress Steps */}
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

      {/* Step Content */}
      <Card>
        <div className="p-6">
          <h2 className="text-xl font-semibold mb-6">{steps[currentStep].title}</h2>
          <div className="min-h-96">
            <StepComponent
              formData={formData}
              onChange={handleChange}
              onGenerate={handleGenerate}
              isGenerating={isGenerating}
              icpInstance={icpInstance}
            />
          </div>
        </div>
      </Card>

      {/* Navigation */}
      <div className="flex items-center justify-between">
        <Button
          variant="outline"
          onClick={handleBack}
          disabled={currentStep === 0}
          className="gap-2"
        >
          <ArrowLeft className="w-4 h-4" />
          Back
        </Button>

        {currentStep < steps.length - 1 ? (
          <Button
            onClick={handleNext}
            disabled={!canProceed() || isSaving}
            className="gap-2 bg-blue-600 hover:bg-blue-700"
          >
            Next
            <ArrowRight className="w-4 h-4" />
          </Button>
        ) : (
          <Button
            onClick={handleFinish}
            disabled={isSaving || !canProceed()}
            variant="success"
            className="gap-2"
          >
            <Check className="w-4 h-4" />
            {isSaving ? "Saving..." : "Finish"}
          </Button>
        )}
      </div>

      {/* Debug info in development */}
      {process.env.NODE_ENV === 'development' && (
        <Card className="mt-8 p-4 bg-gray-50">
          <h4 className="font-semibold mb-2">Debug Info:</h4>
          <pre className="text-xs text-gray-600">
            {JSON.stringify({
              currentStep,
              currentIcpId,
              hasFormData: Object.keys(formData).length > 0,
              canProceed: canProceed(),
              isSaving
            }, null, 2)}
          </pre>
        </Card>
      )}
    </div>
  );
}