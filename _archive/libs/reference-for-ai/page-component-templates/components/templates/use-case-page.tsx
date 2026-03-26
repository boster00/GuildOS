// ARCHIVED: Original path was libs/reference-for-ai/page-component-templates/components/templates/use-case-page.tsx

"use client"

import { Button } from "@/components/ui/button"
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card"
import { Badge } from "@/components/ui/badge"
import { Check, ArrowRight, Users, Target, Lightbulb, TrendingUp } from "lucide-react"

export function UseCasePageTemplate() {
  return (
    <div className="min-h-screen bg-background">
      {/* Audience-Specific Hero */}
      <section className="px-6 py-20">
        <div className="mx-auto max-w-5xl grid gap-12 md:grid-cols-2 md:items-center">
          <div>
            <Badge className="mb-4">For Marketing Teams</Badge>
            <h1 className="text-3xl font-bold tracking-tight text-foreground sm:text-4xl text-balance">
              Automate Your Marketing Operations
            </h1>
            <p className="mt-4 text-lg text-muted-foreground text-pretty">
              Spend less time on manual tasks and more time on strategy. Our platform helps marketing teams automate campaigns, reporting, and lead management.
            </p>
            <div className="mt-8 flex gap-4">
              <Button size="lg">
                Start Free Trial
                <ArrowRight className="ml-2 h-4 w-4" />
              </Button>
              <Button variant="outline" size="lg">See Demo</Button>
            </div>
          </div>
          <div className="aspect-video rounded-lg bg-muted flex items-center justify-center">
            <Users className="h-16 w-16 text-muted-foreground" />
          </div>
        </div>
      </section>

      {/* Pain Points */}
      <section className="border-t border-border bg-muted/50 px-6 py-16">
        <div className="mx-auto max-w-4xl">
          <h2 className="text-center text-2xl font-semibold text-foreground">Sound Familiar?</h2>
          <p className="mt-2 text-center text-muted-foreground">Marketing teams face these challenges every day</p>
          <div className="mt-12 grid gap-6 md:grid-cols-2">
            {[
              { icon: Target, pain: "Hours spent manually pulling campaign data from multiple platforms" },
              { icon: Users, pain: "Leads falling through the cracks due to slow response times" },
              { icon: TrendingUp, pain: "Inconsistent reporting that takes days to compile" },
              { icon: Lightbulb, pain: "Repetitive tasks that drain creative energy" },
            ].map((item, i) => (
              <div key={i} className="flex items-start gap-4 rounded-lg border border-border bg-background p-4">
                <item.icon className="h-6 w-6 shrink-0 text-destructive" />
                <p className="text-sm text-muted-foreground">{item.pain}</p>
              </div>
            ))}
          </div>
        </div>
      </section>

      {/* Tailored Solution */}
      <section className="px-6 py-16">
        <div className="mx-auto max-w-5xl">
          <h2 className="text-center text-2xl font-semibold text-foreground">Built for Marketing Teams</h2>
          <p className="mt-2 text-center text-muted-foreground">Purpose-built features that solve your specific challenges</p>
          <div className="mt-12 grid gap-8 md:grid-cols-3">
            {[
              {
                title: "Campaign Automation",
                desc: "Automatically launch, pause, and optimize campaigns based on performance thresholds.",
                features: ["Multi-channel orchestration", "A/B test automation", "Budget pacing"],
              },
              {
                title: "Lead Management",
                desc: "Capture, score, and route leads instantly—no manual intervention required.",
                features: ["Real-time lead scoring", "Auto-assignment rules", "Instant notifications"],
              },
              {
                title: "Reporting & Analytics",
                desc: "Get unified reports from all your tools delivered automatically.",
                features: ["Cross-platform data", "Scheduled reports", "Custom dashboards"],
              },
            ].map((solution, i) => (
              <Card key={i}>
                <CardHeader>
                  <CardTitle>{solution.title}</CardTitle>
                  <CardDescription>{solution.desc}</CardDescription>
                </CardHeader>
                <CardContent>
                  <ul className="space-y-2">
                    {solution.features.map((feature, j) => (
                      <li key={j} className="flex items-center gap-2 text-sm text-muted-foreground">
                        <Check className="h-4 w-4 text-primary" /> {feature}
                      </li>
                    ))}
                  </ul>
                </CardContent>
              </Card>
            ))}
          </div>
        </div>
      </section>

      {/* Benefits */}
      <section className="border-t border-border bg-muted/50 px-6 py-16">
        <div className="mx-auto max-w-4xl">
          <h2 className="text-center text-2xl font-semibold text-foreground">The Results You'll See</h2>
          <div className="mt-12 grid gap-8 md:grid-cols-4 text-center">
            {[
              { metric: "70%", label: "Less time on manual tasks" },
              { metric: "3x", label: "Faster lead response" },
              { metric: "50%", label: "Reduction in reporting time" },
              { metric: "25%", label: "Increase in campaign ROI" },
            ].map((benefit, i) => (
              <div key={i}>
                <div className="text-4xl font-bold text-primary">{benefit.metric}</div>
                <p className="mt-2 text-sm text-muted-foreground">{benefit.label}</p>
              </div>
            ))}
          </div>
        </div>
      </section>

      {/* Workflow / Examples */}
      <section className="px-6 py-16">
        <div className="mx-auto max-w-4xl">
          <h2 className="text-center text-2xl font-semibold text-foreground">Popular Marketing Workflows</h2>
          <p className="mt-2 text-center text-muted-foreground">Get started instantly with pre-built templates</p>
          <div className="mt-12 space-y-4">
            {[
              { title: "Lead Capture to CRM", trigger: "New form submission", actions: ["Enrich lead data", "Score lead", "Add to CRM", "Notify sales rep"] },
              { title: "Weekly Performance Report", trigger: "Every Monday at 9am", actions: ["Pull data from ads platforms", "Combine with CRM data", "Generate report", "Email to stakeholders"] },
              { title: "Campaign Pause on Overspend", trigger: "Budget threshold reached", actions: ["Pause campaign", "Alert team in Slack", "Log to spreadsheet"] },
            ].map((workflow, i) => (
              <div key={i} className="rounded-lg border border-border p-6">
                <h3 className="font-semibold text-foreground">{workflow.title}</h3>
                <div className="mt-4 flex flex-wrap items-center gap-2">
                  <Badge variant="secondary">{workflow.trigger}</Badge>
                  <ArrowRight className="h-4 w-4 text-muted-foreground" />
                  {workflow.actions.map((action, j) => (
                    <Badge key={j} variant="outline">{action}</Badge>
                  ))}
                </div>
              </div>
            ))}
          </div>
        </div>
      </section>

      {/* Case Study */}
      <section className="border-t border-border bg-muted/50 px-6 py-16">
        <div className="mx-auto max-w-4xl">
          <Badge className="mx-auto block w-fit">Case Study</Badge>
          <h2 className="mt-4 text-center text-2xl font-semibold text-foreground">
            How GrowthCo's Marketing Team Saved 30 Hours/Week
          </h2>
          <div className="mt-12 grid gap-8 md:grid-cols-2 md:items-center">
            <div className="aspect-video rounded-lg bg-muted flex items-center justify-center">
              <span className="text-muted-foreground">Customer Logo</span>
            </div>
            <div>
              <p className="text-muted-foreground">
                GrowthCo's 5-person marketing team was drowning in manual work—pulling reports from 8 different platforms, manually routing leads, and constantly fighting fires.
              </p>
              <p className="mt-4 text-muted-foreground">
                After implementing our platform, they automated 80% of their repetitive tasks and reclaimed 30+ hours per week to focus on strategy and creative work.
              </p>
              <blockquote className="mt-4 border-l-2 border-primary pl-4 italic text-foreground">
                "It's like having an extra team member who never sleeps and never makes mistakes."
              </blockquote>
              <p className="mt-2 text-sm text-muted-foreground">— Jamie Lee, Marketing Director at GrowthCo</p>
              <Button className="mt-6 bg-transparent" variant="outline">
                Read Full Case Study <ArrowRight className="ml-1 h-4 w-4" />
              </Button>
            </div>
          </div>
        </div>
      </section>

      {/* CTA */}
      <section className="px-6 py-16">
        <div className="mx-auto max-w-xl text-center">
          <h2 className="text-2xl font-semibold text-foreground">Ready to Transform Your Marketing Operations?</h2>
          <p className="mt-2 text-muted-foreground">
            Join 2,000+ marketing teams already automating with us.
          </p>
          <div className="mt-6 flex flex-col items-center gap-4 sm:flex-row sm:justify-center">
            <Button size="lg">Start Free Trial</Button>
            <Button variant="outline" size="lg">Talk to a Marketing Expert</Button>
          </div>
          <p className="mt-4 text-xs text-muted-foreground">No credit card required • Free migration assistance</p>
        </div>
      </section>
    </div>
  )
}
