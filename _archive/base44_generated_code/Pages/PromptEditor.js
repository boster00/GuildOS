// ARCHIVED: Original path was base44_generated_code/Pages/PromptEditor.js

import React from "react";
import { base44 } from "@/api/base44Client";
import { useNavigate } from "react-router-dom";
import { createPageUrl } from "@/utils";
import { useQuery } from "@tanstack/react-query";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Textarea } from "@/components/ui/textarea";
import { Label } from "@/components/ui/label";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { ArrowLeft, Save, Sparkles, Loader2 } from "lucide-react";
import { useToast } from "@/components/ui/use-toast";
import { Badge } from "@/components/ui/badge";

export default function PromptEditor() {
  const navigate = useNavigate();
  const { toast } = useToast();
  const [formData, setFormData] = React.useState({ text: "", icpId: "" });
  const [isSaving, setIsSaving] = React.useState(false);
  const [isGenerating, setIsGenerating] = React.useState(false);
  const [suggestions, setSuggestions] = React.useState([]);

  const urlParams = new URLSearchParams(window.location.search);
  const editId = urlParams.get("id");

  const { data: icps = [] } = useQuery({
    queryKey: ["icps"],
    queryFn: () => base44.entities.Icp.list(),
  });

  React.useEffect(() => {
    if (editId) {
      base44.entities.Prompt.filter({ id: editId })
        .then((prompts) => {
          if (prompts[0]) setFormData(prompts[0]);
        })
        .catch(() => {});
    }
  }, [editId]);

  const selectedIcp = icps.find((i) => i.id === formData.icpId);

  const handleSuggest = async () => {
    if (!formData.icpId) {
      toast({
        title: "Select an ICP first",
        description: "Choose an ICP to generate relevant prompts",
        variant: "destructive",
      });
      return;
    }

    setIsGenerating(true);
    try {
      const result = await base44.integrations.Core.InvokeLLM({
        prompt: `Based on this ICP profile, suggest 5 specific search prompts that this target customer would use when looking for solutions.

ICP: ${selectedIcp.name}
Description: ${selectedIcp.icpDesc}
What they want: ${selectedIcp.whatTheyWant || "Not specified"}
Pain points: ${selectedIcp.whatGetsInWay || "Not specified"}

Generate prompts that:
1. Reflect their actual language and search behavior
2. Cover different stages of their buying journey
3. Are specific and actionable
4. Would reveal high-intent prospects

Return as a JSON array of strings.`,
        response_json_schema: {
          type: "object",
          properties: {
            prompts: {
              type: "array",
              items: { type: "string" },
            },
          },
        },
      });

      setSuggestions(result.prompts || []);
      toast({ title: "Suggestions generated!" });
    } catch (error) {
      toast({
        title: "Generation failed",
        description: "Please try again",
        variant: "destructive",
      });
    }
    setIsGenerating(false);
  };

  const handleSave = async () => {
    if (!formData.text || formData.text.length < 10) {
      toast({
        title: "Prompt too short",
        description: "Please enter at least 10 characters",
        variant: "destructive",
      });
      return;
    }

    setIsSaving(true);
    try {
      if (editId) {
        await base44.entities.Prompt.update(editId, formData);
        toast({ title: "Prompt updated successfully!" });
      } else {
        await base44.entities.Prompt.create(formData);
        toast({ title: "Prompt created successfully!" });
      }
      navigate(createPageUrl("PromptList"));
    } catch (error) {
      toast({
        title: "Save failed",
        variant: "destructive",
      });
    }
    setIsSaving(false);
  };

  return (
    <div className="p-6 md:p-8 max-w-4xl mx-auto space-y-6">
      <div className="flex items-center gap-4">
        <Button
          variant="ghost"
          size="icon"
          onClick={() => navigate(createPageUrl("PromptList"))}
        >
          <ArrowLeft className="w-5 h-5" />
        </Button>
        <div className="flex-1">
          <h1 className="text-3xl font-bold text-gray-900">
            {editId ? "Edit" : "New"} Prompt
          </h1>
          <p className="text-gray-600 mt-1">
            Track visibility for search terms your customers use
          </p>
        </div>
      </div>

      <div className="grid lg:grid-cols-3 gap-6">
        <div className="lg:col-span-2 space-y-6">
          <Card>
            <CardHeader>
              <CardTitle>Prompt Details</CardTitle>
            </CardHeader>
            <CardContent className="space-y-6">
              <div>
                <Label htmlFor="icp">Associated ICP</Label>
                <Select
                  value={formData.icpId || "none"}
                  onValueChange={(value) =>
                    setFormData({ ...formData, icpId: value === "none" ? "" : value })
                  }
                >
                  <SelectTrigger className="mt-2">
                    <SelectValue placeholder="Select ICP (optional)" />
                  </SelectTrigger>
                  <SelectContent>
                    <SelectItem value="none">No ICP</SelectItem>
                    {icps.map((icp) => (
                      <SelectItem key={icp.id} value={icp.id}>
                        {icp.name}
                      </SelectItem>
                    ))}
                  </SelectContent>
                </Select>
              </div>

              <div>
                <Label htmlFor="text">
                  Prompt Text <span className="text-red-500">*</span>
                </Label>
                <Textarea
                  id="text"
                  value={formData.text}
                  onChange={(e) => setFormData({ ...formData, text: e.target.value })}
                  placeholder="Enter the search term or phrase to track..."
                  rows={4}
                  className="mt-2"
                />
                <p className="text-xs text-gray-500 mt-2">
                  Minimum 10 characters
                </p>
              </div>
            </CardContent>
          </Card>

          <div className="flex justify-end gap-3">
            <Button
              variant="outline"
              onClick={() => navigate(createPageUrl("PromptList"))}
            >
              Cancel
            </Button>
            <Button
              onClick={handleSave}
              disabled={isSaving || formData.text.length < 10}
              className="bg-blue-600 hover:bg-blue-700 gap-2"
            >
              <Save className="w-4 h-4" />
              {isSaving ? "Saving..." : "Save Prompt"}
            </Button>
          </div>
        </div>

        <Card className="lg:col-span-1">
          <CardHeader>
            <CardTitle className="text-base flex items-center gap-2">
              <Sparkles className="w-4 h-4 text-blue-600" />
              AI Suggestions
            </CardTitle>
          </CardHeader>
          <CardContent className="space-y-4">
            <p className="text-sm text-gray-600">
              Get AI-powered prompt suggestions based on your selected ICP
            </p>
            <Button
              onClick={handleSuggest}
              disabled={isGenerating || !formData.icpId}
              variant="outline"
              className="w-full gap-2"
            >
              {isGenerating ? (
                <>
                  <Loader2 className="w-4 h-4 animate-spin" />
                  Generating...
                </>
              ) : (
                <>
                  <Sparkles className="w-4 h-4" />
                  Suggest Prompts
                </>
              )}
            </Button>

            {suggestions.length > 0 && (
              <div className="space-y-2 pt-4 border-t">
                <p className="text-sm font-medium text-gray-900">Suggestions:</p>
                {suggestions.map((suggestion, index) => (
                  <Badge
                    key={index}
                    variant="secondary"
                    className="cursor-pointer hover:bg-blue-100 text-xs p-2 w-full justify-start"
                    onClick={() => setFormData({ ...formData, text: suggestion })}
                  >
                    {suggestion}
                  </Badge>
                ))}
              </div>
            )}
          </CardContent>
        </Card>
      </div>
    </div>
  );
}