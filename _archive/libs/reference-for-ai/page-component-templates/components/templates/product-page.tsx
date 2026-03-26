// ARCHIVED: Original path was libs/reference-for-ai/page-component-templates/components/templates/product-page.tsx

"use client"

import { Button } from "@/components/ui/button"
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card"
import { Badge } from "@/components/ui/badge"
import { Input } from "@/components/ui/input"
import { Textarea } from "@/components/ui/textarea"
import { Check, Zap, Shield, Clock, Users, ArrowRight } from "lucide-react"

export function ProductPageTemplate() {
  return (
    <div className="min-h-screen bg-background">
      {/* Hero */}
      <section className="px-6 py-20">
        <div className="mx-auto max-w-5xl grid gap-12 md:grid-cols-2 md:items-center">
          <div>
            <Badge className="mb-4">New Release</Badge>
            <h1 className="text-3xl font-bold tracking-tight text-foreground sm:text-4xl text-balance">
              Workflow Automation Pro
            </h1>
            <p className="mt-4 text-lg text-muted-foreground text-pretty">
              Automate repetitive tasks, streamline processes, and boost your team's productivity by 10x.
            </p>
            <div className="mt-8 flex gap-4">
              <Button size="lg">Start Free Trial</Button>
              <Button variant="outline" size="lg">View Demo</Button>
            </div>
          </div>
          <div className="aspect-video rounded-lg bg-muted flex items-center justify-center">
            <span className="text-muted-foreground">Product Demo</span>
          </div>
        </div>
      </section>

      {/* Feature Highlights */}
      <section className="border-t border-border bg-muted/50 px-6 py-16">
        <div className="mx-auto max-w-5xl">
          <h2 className="text-center text-2xl font-semibold text-foreground">Powerful Features</h2>
          <div className="mt-12 grid gap-8 md:grid-cols-2 lg:grid-cols-4">
            {[
              { icon: Zap, title: "Lightning Fast", desc: "Execute workflows in milliseconds" },
              { icon: Shield, title: "Secure by Design", desc: "Enterprise-grade encryption" },
              { icon: Clock, title: "Real-time Sync", desc: "Always up-to-date data" },
              { icon: Users, title: "Team Collaboration", desc: "Built for teams of any size" },
            ].map((feature, i) => (
              <div key={i} className="text-center">
                <div className="mx-auto flex h-12 w-12 items-center justify-center rounded-lg bg-primary/10">
                  <feature.icon className="h-6 w-6 text-primary" />
                </div>
                <h3 className="mt-4 font-semibold text-foreground">{feature.title}</h3>
                <p className="mt-2 text-sm text-muted-foreground">{feature.desc}</p>
              </div>
            ))}
          </div>
        </div>
      </section>

      {/* Benefits vs Outcomes */}
      <section className="px-6 py-16">
        <div className="mx-auto max-w-4xl">
          <h2 className="text-center text-2xl font-semibold text-foreground">What You'll Achieve</h2>
          <div className="mt-12 grid gap-6 md:grid-cols-2">
            <Card>
              <CardHeader>
                <CardTitle>Before</CardTitle>
                <CardDescription>Without automation</CardDescription>
              </CardHeader>
              <CardContent className="space-y-3">
                {["Hours spent on manual data entry", "Inconsistent processes across teams", "Delayed responses to customers", "Error-prone repetitive tasks"].map((item, i) => (
                  <p key={i} className="text-sm text-muted-foreground">• {item}</p>
                ))}
              </CardContent>
            </Card>
            <Card className="border-primary">
              <CardHeader>
                <CardTitle>After</CardTitle>
                <CardDescription>With Workflow Pro</CardDescription>
              </CardHeader>
              <CardContent className="space-y-3">
                {["90% reduction in manual work", "Standardized workflows company-wide", "Instant automated responses", "99.9% accuracy on all tasks"].map((item, i) => (
                  <p key={i} className="flex items-center gap-2 text-sm text-foreground">
                    <Check className="h-4 w-4 text-primary" /> {item}
                  </p>
                ))}
              </CardContent>
            </Card>
          </div>
        </div>
      </section>

      {/* How It Works */}
      <section className="border-t border-border bg-muted/50 px-6 py-16">
        <div className="mx-auto max-w-4xl">
          <h2 className="text-center text-2xl font-semibold text-foreground">How It Works</h2>
          <div className="mt-12 space-y-8">
            {[
              { step: "1", title: "Connect Your Apps", desc: "Integrate with 200+ popular tools and services in just a few clicks." },
              { step: "2", title: "Build Your Workflow", desc: "Use our visual builder to create automation rules—no coding required." },
              { step: "3", title: "Activate & Monitor", desc: "Turn on your workflows and track performance in real-time." },
            ].map((item, i) => (
              <div key={i} className="flex gap-6">
                <div className="flex h-10 w-10 shrink-0 items-center justify-center rounded-full bg-primary text-primary-foreground font-bold">
                  {item.step}
                </div>
                <div>
                  <h3 className="font-semibold text-foreground">{item.title}</h3>
                  <p className="mt-1 text-muted-foreground">{item.desc}</p>
                </div>
              </div>
            ))}
          </div>
        </div>
      </section>

      {/* Technical Specs */}
      <section className="px-6 py-16">
        <div className="mx-auto max-w-4xl">
          <h2 className="text-center text-2xl font-semibold text-foreground">Technical Specifications</h2>
          <div className="mt-12 grid gap-4 md:grid-cols-2">
            {[
              { label: "API Rate Limit", value: "10,000 requests/min" },
              { label: "Data Retention", value: "Unlimited" },
              { label: "Uptime SLA", value: "99.99%" },
              { label: "Encryption", value: "AES-256 at rest, TLS 1.3 in transit" },
              { label: "Compliance", value: "SOC 2, GDPR, HIPAA" },
              { label: "Support", value: "24/7 with < 1hr response" },
            ].map((spec, i) => (
              <div key={i} className="flex justify-between border-b border-border py-3">
                <span className="text-muted-foreground">{spec.label}</span>
                <span className="font-medium text-foreground">{spec.value}</span>
              </div>
            ))}
          </div>
        </div>
      </section>

      {/* Use Cases */}
      <section className="border-t border-border bg-muted/50 px-6 py-16">
        <div className="mx-auto max-w-5xl">
          <h2 className="text-center text-2xl font-semibold text-foreground">Popular Use Cases</h2>
          <div className="mt-12 grid gap-6 md:grid-cols-3">
            {[
              { title: "Lead Management", desc: "Automatically route and score incoming leads" },
              { title: "Customer Onboarding", desc: "Streamline welcome sequences and setup tasks" },
              { title: "Report Generation", desc: "Schedule and distribute reports automatically" },
            ].map((useCase, i) => (
              <Card key={i}>
                <CardHeader>
                  <CardTitle className="text-lg">{useCase.title}</CardTitle>
                  <CardDescription>{useCase.desc}</CardDescription>
                </CardHeader>
                <CardContent>
                  <Button variant="link" className="p-0">
                    See template <ArrowRight className="ml-1 h-4 w-4" />
                  </Button>
                </CardContent>
              </Card>
            ))}
          </div>
        </div>
      </section>

      {/* Comparison Table */}
      <section className="px-6 py-16">
        <div className="mx-auto max-w-3xl">
          <h2 className="text-center text-2xl font-semibold text-foreground">Plan Comparison</h2>
          <div className="mt-12 overflow-x-auto">
            <table className="w-full">
              <thead>
                <tr className="border-b border-border">
                  <th className="py-3 text-left text-sm font-medium text-muted-foreground">Feature</th>
                  <th className="py-3 text-center text-sm font-medium text-muted-foreground">Starter</th>
                  <th className="py-3 text-center text-sm font-medium text-muted-foreground">Pro</th>
                  <th className="py-3 text-center text-sm font-medium text-muted-foreground">Enterprise</th>
                </tr>
              </thead>
              <tbody>
                {[
                  { feature: "Workflows", starter: "5", pro: "50", enterprise: "Unlimited" },
                  { feature: "Team Members", starter: "2", pro: "10", enterprise: "Unlimited" },
                  { feature: "Integrations", starter: "10", pro: "100", enterprise: "200+" },
                  { feature: "Support", starter: "Email", pro: "Priority", enterprise: "Dedicated" },
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

      {/* FAQ */}
      <section className="border-t border-border bg-muted/50 px-6 py-16">
        <div className="mx-auto max-w-2xl">
          <h2 className="text-center text-2xl font-semibold text-foreground">Frequently Asked Questions</h2>
          <div className="mt-8 space-y-6">
            {[
              { q: "How long does setup take?", a: "Most teams are up and running within 30 minutes." },
              { q: "Do I need technical skills?", a: "No! Our visual builder is designed for non-technical users." },
              { q: "Can I migrate from other tools?", a: "Yes, we offer free migration assistance for all plans." },
            ].map((faq, i) => (
              <div key={i}>
                <h3 className="font-medium text-foreground">{faq.q}</h3>
                <p className="mt-1 text-sm text-muted-foreground">{faq.a}</p>
              </div>
            ))}
          </div>
        </div>
      </section>

      {/* CTA / Inquiry Form */}
      <section className="px-6 py-16">
        <div className="mx-auto max-w-md">
          <h2 className="text-center text-2xl font-semibold text-foreground">Request a Demo</h2>
          <p className="mt-2 text-center text-muted-foreground">See Workflow Pro in action</p>
          <form className="mt-8 space-y-4">
            <Input placeholder="Full Name" />
            <Input placeholder="Work Email" type="email" />
            <Input placeholder="Company" />
            <Textarea placeholder="What would you like to automate?" />
            <Button className="w-full">Request Demo</Button>
          </form>
        </div>
      </section>
    </div>
  )
}
