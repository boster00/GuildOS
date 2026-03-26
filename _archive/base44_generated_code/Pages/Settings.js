// ARCHIVED: Original path was base44_generated_code/Pages/Settings.js

import React from "react";
import { base44 } from "@/api/base44Client";
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from "@/components/ui/card";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Button } from "@/components/ui/button";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { useToast } from "@/components/ui/use-toast";
import { Save, Eye, EyeOff } from "lucide-react";

const providers = [
  { id: "openai", name: "OpenAI", icon: "🤖" },
  { id: "gemini", name: "Google Gemini", icon: "✨" },
  { id: "perplexity", name: "Perplexity", icon: "🔍" },
  { id: "claude", name: "Anthropic Claude", icon: "🧠" },
];

function ProviderTab({ provider, settings, onSave, isSaving }) {
  const [formData, setFormData] = React.useState({
    apiKey: "",
    monthlyCap: 100,
    queryFrequency: "daily",
    ...settings,
  });
  const [showKey, setShowKey] = React.useState(false);

  React.useEffect(() => {
    if (settings) {
      setFormData({ ...formData, ...settings });
    }
  }, [settings]);

  const handleSubmit = (e) => {
    e.preventDefault();
    onSave({ ...formData, provider: provider.id });
  };

  return (
    <Card>
      <CardHeader>
        <CardTitle className="flex items-center gap-2">
          <span className="text-2xl">{provider.icon}</span>
          {provider.name}
        </CardTitle>
        <CardDescription>
          Configure your {provider.name} integration settings
        </CardDescription>
      </CardHeader>
      <CardContent>
        <form onSubmit={handleSubmit} className="space-y-6">
          <div>
            <Label htmlFor={`${provider.id}-key`}>API Key</Label>
            <div className="flex gap-2 mt-2">
              <Input
                id={`${provider.id}-key`}
                type={showKey ? "text" : "password"}
                value={formData.apiKey}
                onChange={(e) => setFormData({ ...formData, apiKey: e.target.value })}
                placeholder="sk-..."
                className="flex-1"
              />
              <Button
                type="button"
                variant="outline"
                size="icon"
                onClick={() => setShowKey(!showKey)}
              >
                {showKey ? <EyeOff className="w-4 h-4" /> : <Eye className="w-4 h-4" />}
              </Button>
            </div>
          </div>

          <div>
            <Label htmlFor={`${provider.id}-cap`}>Monthly Cap ($)</Label>
            <Input
              id={`${provider.id}-cap`}
              type="number"
              value={formData.monthlyCap}
              onChange={(e) =>
                setFormData({ ...formData, monthlyCap: parseInt(e.target.value) })
              }
              min="0"
              className="mt-2"
            />
          </div>

          <div>
            <Label htmlFor={`${provider.id}-freq`}>Query Frequency</Label>
            <Select
              value={formData.queryFrequency}
              onValueChange={(value) =>
                setFormData({ ...formData, queryFrequency: value })
              }
            >
              <SelectTrigger className="mt-2">
                <SelectValue />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="daily">Daily</SelectItem>
                <SelectItem value="weekly">Weekly</SelectItem>
                <SelectItem value="custom">Custom</SelectItem>
              </SelectContent>
            </Select>
          </div>

          <Button
            type="submit"
            disabled={isSaving}
            className="w-full bg-blue-600 hover:bg-blue-700 gap-2"
          >
            <Save className="w-4 h-4" />
            {isSaving ? "Saving..." : "Save Settings"}
          </Button>
        </form>
      </CardContent>
    </Card>
  );
}

export default function Settings() {
  const { toast } = useToast();
  const queryClient = useQueryClient();

  const { data: allSettings = [] } = useQuery({
    queryKey: ["provider-settings"],
    queryFn: () => base44.entities.ProviderSettings.list(),
  });

  const saveMutation = useMutation({
    mutationFn: async (data) => {
      const existing = allSettings.find((s) => s.provider === data.provider);
      if (existing) {
        return base44.entities.ProviderSettings.update(existing.id, data);
      }
      return base44.entities.ProviderSettings.create(data);
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["provider-settings"] });
      toast({ title: "Settings saved successfully!" });
    },
    onError: () => {
      toast({
        title: "Save failed",
        variant: "destructive",
      });
    },
  });

  const getSettings = (providerId) => {
    return allSettings.find((s) => s.provider === providerId);
  };

  return (
    <div className="p-6 md:p-8 max-w-5xl mx-auto space-y-6">
      <div>
        <h1 className="text-3xl font-bold text-gray-900">Settings</h1>
        <p className="text-gray-600 mt-2">
          Configure your AI provider integrations
        </p>
      </div>

      <Tabs defaultValue="openai" className="space-y-6">
        <TabsList className="grid grid-cols-2 lg:grid-cols-4 w-full">
          {providers.map((provider) => (
            <TabsTrigger key={provider.id} value={provider.id}>
              <span className="mr-2">{provider.icon}</span>
              {provider.name}
            </TabsTrigger>
          ))}
        </TabsList>

        {providers.map((provider) => (
          <TabsContent key={provider.id} value={provider.id}>
            <ProviderTab
              provider={provider}
              settings={getSettings(provider.id)}
              onSave={(data) => saveMutation.mutate(data)}
              isSaving={saveMutation.isPending}
            />
          </TabsContent>
        ))}
      </Tabs>
    </div>
  );
}