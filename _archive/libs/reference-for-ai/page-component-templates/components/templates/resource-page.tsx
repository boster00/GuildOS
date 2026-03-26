// ARCHIVED: Original path was libs/reference-for-ai/page-component-templates/components/templates/resource-page.tsx

"use client"

import { Button } from "@/components/ui/button"
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card"
import { Input } from "@/components/ui/input"
import { Badge } from "@/components/ui/badge"
import { FileText, Download, CheckCircle, ArrowRight, BookOpen, Video, FileSpreadsheet } from "lucide-react"

export function ResourcePageTemplate() {
  return (
    <div className="min-h-screen bg-background">
      {/* Resource Hero */}
      <section className="px-6 py-20">
        <div className="mx-auto max-w-5xl grid gap-12 md:grid-cols-2 md:items-center">
          <div>
            <Badge className="mb-4">Free Download</Badge>
            <h1 className="text-3xl font-bold tracking-tight text-foreground sm:text-4xl text-balance">
              The Ultimate Workflow Automation Playbook
            </h1>
            <p className="mt-4 text-lg text-muted-foreground text-pretty">
              A comprehensive 50-page guide to implementing automation in your organization. Includes templates, checklists, and real-world examples.
            </p>
            <div className="mt-6 flex flex-wrap gap-2">
              <Badge variant="secondary">PDF Guide</Badge>
              <Badge variant="secondary">50 Pages</Badge>
              <Badge variant="secondary">10+ Templates</Badge>
            </div>
          </div>
          <div className="aspect-[3/4] rounded-lg bg-muted flex items-center justify-center border border-border shadow-lg">
            <FileText className="h-24 w-24 text-muted-foreground" />
          </div>
        </div>
      </section>

      {/* Description / Value */}
      <section className="border-t border-border bg-muted/50 px-6 py-16">
        <div className="mx-auto max-w-4xl">
          <h2 className="text-center text-2xl font-semibold text-foreground">What's Inside</h2>
          <div className="mt-12 grid gap-8 md:grid-cols-2">
            <div className="space-y-4">
              <h3 className="font-semibold text-foreground">You'll Learn:</h3>
              <ul className="space-y-3">
                {[
                  "How to identify automation opportunities in your workflow",
                  "The ROI framework for prioritizing automation projects",
                  "Step-by-step implementation guides for 10 common workflows",
                  "Change management strategies for successful adoption",
                  "Metrics and KPIs to measure automation success",
                ].map((item, i) => (
                  <li key={i} className="flex items-start gap-3 text-muted-foreground">
                    <CheckCircle className="h-5 w-5 shrink-0 text-primary mt-0.5" />
                    {item}
                  </li>
                ))}
              </ul>
            </div>
            <div className="space-y-4">
              <h3 className="font-semibold text-foreground">Bonus Materials:</h3>
              <ul className="space-y-3">
                {[
                  "Process mapping worksheet template",
                  "Automation readiness assessment checklist",
                  "ROI calculator spreadsheet",
                  "Implementation timeline planner",
                  "Stakeholder communication templates",
                ].map((item, i) => (
                  <li key={i} className="flex items-start gap-3 text-muted-foreground">
                    <Download className="h-5 w-5 shrink-0 text-primary mt-0.5" />
                    {item}
                  </li>
                ))}
              </ul>
            </div>
          </div>
        </div>
      </section>

      {/* Preview / Highlights */}
      <section className="px-6 py-16">
        <div className="mx-auto max-w-4xl">
          <h2 className="text-center text-2xl font-semibold text-foreground">Preview</h2>
          <p className="mt-2 text-center text-muted-foreground">A sneak peek at what you'll get</p>
          <div className="mt-12 grid gap-6 md:grid-cols-3">
            {[
              { chapter: "Chapter 1", title: "Automation Fundamentals", preview: "Understanding the landscape of modern workflow automation..." },
              { chapter: "Chapter 3", title: "The ROI Framework", preview: "How to calculate and present the business case for automation..." },
              { chapter: "Chapter 5", title: "Implementation Guide", preview: "Step-by-step instructions for your first 10 workflows..." },
            ].map((chapter, i) => (
              <div key={i} className="rounded-lg border border-border bg-muted/30 p-6">
                <p className="text-xs font-medium text-muted-foreground">{chapter.chapter}</p>
                <h3 className="mt-1 font-semibold text-foreground">{chapter.title}</h3>
                <p className="mt-2 text-sm text-muted-foreground">{chapter.preview}</p>
              </div>
            ))}
          </div>
        </div>
      </section>

      {/* Form */}
      <section className="border-t border-border bg-muted/50 px-6 py-16">
        <div className="mx-auto max-w-md">
          <h2 className="text-center text-2xl font-semibold text-foreground">Get Your Free Copy</h2>
          <p className="mt-2 text-center text-muted-foreground">Enter your email to download instantly</p>
          <form className="mt-8 space-y-4">
            <Input placeholder="Full Name" />
            <Input placeholder="Work Email" type="email" />
            <Input placeholder="Company" />
            <Input placeholder="Job Title" />
            <Button className="w-full" size="lg">
              Download Now
              <Download className="ml-2 h-4 w-4" />
            </Button>
            <p className="text-xs text-center text-muted-foreground">
              By downloading, you agree to receive occasional emails from us. Unsubscribe anytime.
            </p>
          </form>
        </div>
      </section>

      {/* Trust Indicators */}
      <section className="px-6 py-16">
        <div className="mx-auto max-w-4xl">
          <h2 className="text-center text-2xl font-semibold text-foreground">Trusted by Leading Teams</h2>
          <div className="mt-8 flex flex-wrap items-center justify-center gap-8 opacity-60">
            {["Acme Inc", "Globex", "Initech", "Umbrella Co", "Stark Industries", "Wayne Enterprises"].map((company) => (
              <span key={company} className="text-sm font-semibold text-muted-foreground">{company}</span>
            ))}
          </div>
          <div className="mt-12 text-center">
            <p className="text-4xl font-bold text-primary">25,000+</p>
            <p className="mt-2 text-muted-foreground">Downloads and counting</p>
          </div>
        </div>
      </section>

      {/* Related Resources */}
      <section className="border-t border-border bg-muted/50 px-6 py-16">
        <div className="mx-auto max-w-5xl">
          <h2 className="text-center text-2xl font-semibold text-foreground">More Resources</h2>
          <p className="mt-2 text-center text-muted-foreground">Continue your learning journey</p>
          <div className="mt-12 grid gap-6 md:grid-cols-3">
            {[
              { icon: BookOpen, type: "Ebook", title: "Automation for Beginners", desc: "A gentle introduction to workflow automation" },
              { icon: Video, type: "Webinar", title: "Advanced Automation Patterns", desc: "Expert strategies for complex workflows" },
              { icon: FileSpreadsheet, type: "Template", title: "Process Audit Toolkit", desc: "Everything you need to assess your processes" },
            ].map((resource, i) => (
              <Card key={i} className="cursor-pointer transition-shadow hover:shadow-lg">
                <CardHeader>
                  <div className="flex items-center gap-2">
                    <resource.icon className="h-5 w-5 text-primary" />
                    <Badge variant="secondary" className="text-xs">{resource.type}</Badge>
                  </div>
                  <CardTitle className="text-lg">{resource.title}</CardTitle>
                  <CardDescription>{resource.desc}</CardDescription>
                </CardHeader>
                <CardContent>
                  <Button variant="link" className="p-0">
                    Learn more <ArrowRight className="ml-1 h-4 w-4" />
                  </Button>
                </CardContent>
              </Card>
            ))}
          </div>
        </div>
      </section>
    </div>
  )
}
