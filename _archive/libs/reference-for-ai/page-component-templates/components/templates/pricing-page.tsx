// ARCHIVED: Original path was libs/reference-for-ai/page-component-templates/components/templates/pricing-page.tsx

"use client"

import { Button } from "@/components/ui/button"
import { Card, CardContent, CardDescription, CardFooter, CardHeader, CardTitle } from "@/components/ui/card"
import { Badge } from "@/components/ui/badge"
import { Check, X, Shield } from "lucide-react"

export function PricingPageTemplate() {
  const plans = [
    {
      name: "Starter",
      price: "$19",
      period: "/month",
      description: "Perfect for individuals and small projects",
      features: [
        { name: "Up to 5 projects", included: true },
        { name: "Basic analytics", included: true },
        { name: "Email support", included: true },
        { name: "API access", included: false },
        { name: "Custom integrations", included: false },
        { name: "Dedicated account manager", included: false },
      ],
      cta: "Start Free Trial",
      popular: false,
    },
    {
      name: "Professional",
      price: "$49",
      period: "/month",
      description: "Best for growing teams and businesses",
      features: [
        { name: "Unlimited projects", included: true },
        { name: "Advanced analytics", included: true },
        { name: "Priority support", included: true },
        { name: "API access", included: true },
        { name: "Custom integrations", included: true },
        { name: "Dedicated account manager", included: false },
      ],
      cta: "Start Free Trial",
      popular: true,
    },
    {
      name: "Enterprise",
      price: "$149",
      period: "/month",
      description: "For large organizations with complex needs",
      features: [
        { name: "Unlimited projects", included: true },
        { name: "Advanced analytics", included: true },
        { name: "24/7 phone support", included: true },
        { name: "API access", included: true },
        { name: "Custom integrations", included: true },
        { name: "Dedicated account manager", included: true },
      ],
      cta: "Contact Sales",
      popular: false,
    },
  ]

  return (
    <div className="min-h-screen bg-background">
      {/* Header */}
      <section className="px-6 py-20 text-center">
        <h1 className="text-3xl font-bold tracking-tight text-foreground sm:text-4xl">
          Simple, Transparent Pricing
        </h1>
        <p className="mt-4 text-lg text-muted-foreground">
          Choose the plan that's right for you. No hidden fees, cancel anytime.
        </p>
      </section>

      {/* Pricing Tiers */}
      <section className="px-6 pb-16">
        <div className="mx-auto max-w-5xl">
          <div className="grid gap-8 md:grid-cols-3">
            {plans.map((plan) => (
              <Card key={plan.name} className={plan.popular ? "border-primary shadow-lg relative" : "relative"}>
                {plan.popular && (
                  <Badge className="absolute -top-3 left-1/2 -translate-x-1/2">Most Popular</Badge>
                )}
                <CardHeader>
                  <CardTitle>{plan.name}</CardTitle>
                  <CardDescription>{plan.description}</CardDescription>
                  <div className="mt-4">
                    <span className="text-4xl font-bold text-foreground">{plan.price}</span>
                    <span className="text-muted-foreground">{plan.period}</span>
                  </div>
                </CardHeader>
                <CardContent className="space-y-3">
                  {plan.features.map((feature, i) => (
                    <div key={i} className="flex items-center gap-3">
                      {feature.included ? (
                        <Check className="h-4 w-4 text-primary" />
                      ) : (
                        <X className="h-4 w-4 text-muted-foreground" />
                      )}
                      <span className={feature.included ? "text-foreground" : "text-muted-foreground"}>
                        {feature.name}
                      </span>
                    </div>
                  ))}
                </CardContent>
                <CardFooter>
                  <Button className="w-full" variant={plan.popular ? "default" : "outline"}>
                    {plan.cta}
                  </Button>
                </CardFooter>
              </Card>
            ))}
          </div>
        </div>
      </section>

      {/* Feature Comparison Table */}
      <section className="border-t border-border bg-muted/50 px-6 py-16">
        <div className="mx-auto max-w-4xl">
          <h2 className="text-center text-2xl font-semibold text-foreground">Feature Comparison</h2>
          <div className="mt-12 overflow-x-auto">
            <table className="w-full">
              <thead>
                <tr className="border-b border-border">
                  <th className="py-3 text-left text-sm font-medium text-muted-foreground">Feature</th>
                  <th className="py-3 text-center text-sm font-medium text-muted-foreground">Starter</th>
                  <th className="py-3 text-center text-sm font-medium text-primary">Professional</th>
                  <th className="py-3 text-center text-sm font-medium text-muted-foreground">Enterprise</th>
                </tr>
              </thead>
              <tbody>
                {[
                  { feature: "Projects", starter: "5", pro: "Unlimited", enterprise: "Unlimited" },
                  { feature: "Storage", starter: "5 GB", pro: "50 GB", enterprise: "500 GB" },
                  { feature: "Team members", starter: "1", pro: "10", enterprise: "Unlimited" },
                  { feature: "API calls/month", starter: "10,000", pro: "100,000", enterprise: "Unlimited" },
                  { feature: "Data retention", starter: "30 days", pro: "1 year", enterprise: "Unlimited" },
                  { feature: "SSO", starter: "—", pro: "—", enterprise: "✓" },
                  { feature: "Custom domain", starter: "—", pro: "✓", enterprise: "✓" },
                  { feature: "White label", starter: "—", pro: "—", enterprise: "✓" },
                ].map((row, i) => (
                  <tr key={i} className="border-b border-border">
                    <td className="py-3 text-sm text-foreground">{row.feature}</td>
                    <td className="py-3 text-center text-sm text-muted-foreground">{row.starter}</td>
                    <td className="py-3 text-center text-sm text-foreground font-medium">{row.pro}</td>
                    <td className="py-3 text-center text-sm text-muted-foreground">{row.enterprise}</td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </div>
      </section>

      {/* Usage Limits */}
      <section className="px-6 py-16">
        <div className="mx-auto max-w-3xl">
          <h2 className="text-center text-2xl font-semibold text-foreground">Usage-Based Add-ons</h2>
          <p className="mt-2 text-center text-muted-foreground">Need more? Add capacity to any plan.</p>
          <div className="mt-12 grid gap-4 md:grid-cols-3">
            {[
              { name: "Extra Storage", price: "$5/10GB" },
              { name: "Additional Seats", price: "$10/user" },
              { name: "API Calls", price: "$20/100K" },
            ].map((addon) => (
              <div key={addon.name} className="rounded-lg border border-border p-4 text-center">
                <h3 className="font-medium text-foreground">{addon.name}</h3>
                <p className="mt-1 text-lg font-semibold text-primary">{addon.price}</p>
              </div>
            ))}
          </div>
        </div>
      </section>

      {/* FAQ */}
      <section className="border-t border-border bg-muted/50 px-6 py-16">
        <div className="mx-auto max-w-2xl">
          <h2 className="text-center text-2xl font-semibold text-foreground">Billing FAQs</h2>
          <div className="mt-8 space-y-6">
            {[
              { q: "Can I change plans at any time?", a: "Yes! Upgrade or downgrade your plan at any time. Changes take effect immediately." },
              { q: "What payment methods do you accept?", a: "We accept all major credit cards, PayPal, and wire transfers for Enterprise plans." },
              { q: "Is there a setup fee?", a: "No setup fees for any plan. You only pay your monthly or annual subscription." },
              { q: "What happens if I cancel?", a: "You can cancel anytime. You'll retain access until the end of your billing period." },
              { q: "Do you offer refunds?", a: "Yes, we offer a 30-day money-back guarantee for all new subscriptions." },
            ].map((faq, i) => (
              <div key={i}>
                <h3 className="font-medium text-foreground">{faq.q}</h3>
                <p className="mt-1 text-sm text-muted-foreground">{faq.a}</p>
              </div>
            ))}
          </div>
        </div>
      </section>

      {/* Guarantee */}
      <section className="px-6 py-16">
        <div className="mx-auto max-w-xl text-center">
          <Shield className="mx-auto h-12 w-12 text-primary" />
          <h2 className="mt-4 text-2xl font-semibold text-foreground">30-Day Money-Back Guarantee</h2>
          <p className="mt-2 text-muted-foreground">
            Try any plan risk-free. If you're not completely satisfied within 30 days, we'll refund your payment—no questions asked.
          </p>
        </div>
      </section>

      {/* CTA */}
      <section className="border-t border-border bg-muted/50 px-6 py-16">
        <div className="mx-auto max-w-xl text-center">
          <h2 className="text-2xl font-semibold text-foreground">Ready to Get Started?</h2>
          <p className="mt-2 text-muted-foreground">Start your 14-day free trial. No credit card required.</p>
          <div className="mt-6 flex flex-col items-center gap-4 sm:flex-row sm:justify-center">
            <Button size="lg">Start Free Trial</Button>
            <Button variant="outline" size="lg">Contact Sales</Button>
          </div>
        </div>
      </section>
    </div>
  )
}
