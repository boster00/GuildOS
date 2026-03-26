// ARCHIVED: Original path was base44_generated_code/Pages/Billing.js

import React from "react";
import { base44 } from "@/api/base44Client";
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Avatar, AvatarFallback, AvatarImage } from "@/components/ui/avatar";
import { Badge } from "@/components/ui/badge";
import { Check, Crown, Zap, Rocket, Upload } from "lucide-react";
import { useToast } from "@/components/ui/use-toast";

const plans = [
  {
    id: "free",
    name: "Free",
    icon: Zap,
    price: "$0",
    period: "forever",
    features: [
      "10 prompts per month",
      "1 ICP",
      "Weekly scans",
      "Basic analytics",
    ],
  },
  {
    id: "pro",
    name: "Pro",
    icon: Crown,
    price: "$49",
    period: "/month",
    popular: true,
    features: [
      "100 prompts per month",
      "5 ICPs",
      "Daily scans",
      "Advanced analytics",
      "AI-powered insights",
      "Priority support",
    ],
  },
  {
    id: "growth",
    name: "Growth",
    icon: Rocket,
    price: "$149",
    period: "/month",
    features: [
      "Unlimited prompts",
      "Unlimited ICPs",
      "Real-time scans",
      "Custom analytics",
      "API access",
      "Dedicated support",
      "White-label reports",
    ],
  },
];

export default function Billing() {
  const { toast } = useToast();
  const [user, setUser] = React.useState(null);
  const [isSaving, setIsSaving] = React.useState(false);

  React.useEffect(() => {
    base44.auth.me().then(setUser).catch(() => {});
  }, []);

  const handleProfileUpdate = async (e) => {
    e.preventDefault();
    setIsSaving(true);
    try {
      const formData = new FormData(e.target);
      await base44.auth.updateMe({
        full_name: formData.get("name"),
      });
      toast({ title: "Profile updated successfully!" });
      const updated = await base44.auth.me();
      setUser(updated);
    } catch (error) {
      toast({ title: "Update failed", variant: "destructive" });
    }
    setIsSaving(false);
  };

  const handleAvatarUpload = async (e) => {
    const file = e.target.files?.[0];
    if (!file) return;

    try {
      const { file_url } = await base44.integrations.Core.UploadFile({ file });
      await base44.auth.updateMe({ avatar: file_url });
      toast({ title: "Avatar updated!" });
      const updated = await base44.auth.me();
      setUser(updated);
    } catch (error) {
      toast({ title: "Upload failed", variant: "destructive" });
    }
  };

  const currentPlan = user?.plan || "free";
  const initials = user?.full_name
    ?.split(" ")
    .map((n) => n[0])
    .join("")
    .toUpperCase() || "U";

  return (
    <div className="p-6 md:p-8 max-w-6xl mx-auto space-y-8">
      <div>
        <h1 className="text-3xl font-bold text-gray-900">Billing & Profile</h1>
        <p className="text-gray-600 mt-2">
          Manage your account and subscription
        </p>
      </div>

      <div className="grid lg:grid-cols-2 gap-6">
        <Card>
          <CardHeader>
            <CardTitle>Profile</CardTitle>
            <CardDescription>Update your personal information</CardDescription>
          </CardHeader>
          <CardContent>
            <form onSubmit={handleProfileUpdate} className="space-y-6">
              <div className="flex items-center gap-6">
                <div className="relative">
                  <Avatar className="w-20 h-20 border-4 border-gray-100">
                    <AvatarImage src={user?.avatar} />
                    <AvatarFallback className="bg-gradient-to-br from-blue-500 to-blue-600 text-white text-2xl">
                      {initials}
                    </AvatarFallback>
                  </Avatar>
                  <label className="absolute bottom-0 right-0 w-8 h-8 bg-blue-600 rounded-full flex items-center justify-center cursor-pointer hover:bg-blue-700 transition-colors shadow-lg">
                    <Upload className="w-4 h-4 text-white" />
                    <input
                      type="file"
                      accept="image/*"
                      className="hidden"
                      onChange={handleAvatarUpload}
                    />
                  </label>
                </div>
                <div className="flex-1">
                  <p className="font-medium text-gray-900">Profile Picture</p>
                  <p className="text-sm text-gray-500">
                    PNG, JPG up to 5MB
                  </p>
                </div>
              </div>

              <div>
                <Label htmlFor="name">Full Name</Label>
                <Input
                  id="name"
                  name="name"
                  defaultValue={user?.full_name}
                  className="mt-2"
                />
              </div>

              <div>
                <Label htmlFor="email">Email</Label>
                <Input
                  id="email"
                  type="email"
                  value={user?.email}
                  disabled
                  className="mt-2 bg-gray-50"
                />
                <p className="text-xs text-gray-500 mt-1">
                  Email cannot be changed
                </p>
              </div>

              <Button
                type="submit"
                disabled={isSaving}
                className="w-full bg-blue-600 hover:bg-blue-700"
              >
                {isSaving ? "Saving..." : "Save Changes"}
              </Button>
            </form>
          </CardContent>
        </Card>

        <Card>
          <CardHeader>
            <CardTitle>Current Plan</CardTitle>
            <CardDescription>
              You're on the <strong className="text-gray-900">{currentPlan}</strong> plan
            </CardDescription>
          </CardHeader>
          <CardContent className="space-y-4">
            <div className="flex items-center justify-between p-4 bg-blue-50 rounded-lg border border-blue-200">
              <div>
                <p className="font-medium text-gray-900">Status</p>
                <p className="text-sm text-gray-600 mt-1">
                  {user?.planStatus || "active"}
                </p>
              </div>
              <Badge
                className={
                  user?.planStatus === "active"
                    ? "bg-green-100 text-green-800"
                    : "bg-orange-100 text-orange-800"
                }
              >
                {user?.planStatus || "active"}
              </Badge>
            </div>

            <div className="flex items-center justify-between p-4 bg-gray-50 rounded-lg">
              <div>
                <p className="font-medium text-gray-900">Prompts Used</p>
                <p className="text-sm text-gray-600 mt-1">This month</p>
              </div>
              <p className="text-2xl font-bold text-gray-900">
                {user?.promptsUsedThisMonth || 0}
                <span className="text-base text-gray-500 font-normal">
                  /{user?.promptsQuota || 10}
                </span>
              </p>
            </div>

            <Button
              variant="outline"
              className="w-full"
              onClick={() =>
                toast({
                  title: "Coming Soon",
                  description: "Customer portal will be available soon",
                })
              }
            >
              Manage Subscription
            </Button>
          </CardContent>
        </Card>
      </div>

      <div>
        <h2 className="text-2xl font-bold text-gray-900 mb-6">Choose Your Plan</h2>
        <div className="grid md:grid-cols-3 gap-6">
          {plans.map((plan) => {
            const Icon = plan.icon;
            const isCurrent = plan.id === currentPlan;
            return (
              <Card
                key={plan.id}
                className={`relative ${
                  plan.popular
                    ? "border-2 border-blue-500 shadow-lg"
                    : isCurrent
                    ? "border-2 border-green-500"
                    : ""
                }`}
              >
                {plan.popular && (
                  <div className="absolute -top-3 left-1/2 -translate-x-1/2">
                    <Badge className="bg-blue-600 text-white">Most Popular</Badge>
                  </div>
                )}
                {isCurrent && (
                  <div className="absolute -top-3 left-1/2 -translate-x-1/2">
                    <Badge className="bg-green-600 text-white">Current Plan</Badge>
                  </div>
                )}
                <CardHeader>
                  <div className="flex items-center gap-3 mb-2">
                    <div className="w-10 h-10 rounded-xl bg-blue-50 flex items-center justify-center">
                      <Icon className="w-5 h-5 text-blue-600" />
                    </div>
                    <CardTitle>{plan.name}</CardTitle>
                  </div>
                  <div className="flex items-baseline gap-1">
                    <span className="text-4xl font-bold text-gray-900">
                      {plan.price}
                    </span>
                    <span className="text-gray-600">{plan.period}</span>
                  </div>
                </CardHeader>
                <CardContent className="space-y-4">
                  <ul className="space-y-3">
                    {plan.features.map((feature, index) => (
                      <li key={index} className="flex items-start gap-2">
                        <Check className="w-5 h-5 text-green-600 mt-0.5 flex-shrink-0" />
                        <span className="text-sm text-gray-700">{feature}</span>
                      </li>
                    ))}
                  </ul>
                  <Button
                    className={`w-full ${
                      isCurrent
                        ? "bg-gray-100 text-gray-600 cursor-default"
                        : plan.popular
                        ? "bg-blue-600 hover:bg-blue-700"
                        : ""
                    }`}
                    variant={isCurrent ? "outline" : plan.popular ? "default" : "outline"}
                    disabled={isCurrent}
                    onClick={() =>
                      toast({
                        title: "Coming Soon",
                        description: "Upgrade functionality will be available soon",
                      })
                    }
                  >
                    {isCurrent ? "Current Plan" : "Upgrade"}
                  </Button>
                </CardContent>
              </Card>
            );
          })}
        </div>
      </div>
    </div>
  );
}