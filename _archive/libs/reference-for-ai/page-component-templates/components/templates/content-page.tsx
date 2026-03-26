// ARCHIVED: Original path was libs/reference-for-ai/page-component-templates/components/templates/content-page.tsx

"use client"

import { Button } from "@/components/ui/button"
import { Card, CardContent } from "@/components/ui/card"
import { Badge } from "@/components/ui/badge"
import { Avatar, AvatarFallback, AvatarImage } from "@/components/ui/avatar"
import { Calendar, Clock, ArrowRight, Share2, Bookmark } from "lucide-react"

export function ContentPageTemplate() {
  const tableOfContents = [
    "Introduction",
    "Understanding the Basics",
    "Key Strategies",
    "Implementation Steps",
    "Common Mistakes to Avoid",
    "Conclusion",
  ]

  return (
    <div className="min-h-screen bg-background">
      {/* Article Hero */}
      <section className="border-b border-border px-6 py-12">
        <div className="mx-auto max-w-3xl">
          <Badge>Guide</Badge>
          <h1 className="mt-4 text-3xl font-bold tracking-tight text-foreground sm:text-4xl text-balance">
            The Complete Guide to Workflow Automation in 2024
          </h1>
          <p className="mt-4 text-lg text-muted-foreground text-pretty">
            Learn how to automate your business processes, save time, and scale your operations with our comprehensive guide.
          </p>
          <div className="mt-6 flex flex-wrap items-center gap-4 text-sm text-muted-foreground">
            <div className="flex items-center gap-2">
              <Avatar className="h-8 w-8">
                <AvatarImage src="/placeholder.svg" />
                <AvatarFallback>JD</AvatarFallback>
              </Avatar>
              <span>John Doe</span>
            </div>
            <div className="flex items-center gap-1">
              <Calendar className="h-4 w-4" />
              <span>Jan 15, 2024</span>
            </div>
            <div className="flex items-center gap-1">
              <Clock className="h-4 w-4" />
              <span>12 min read</span>
            </div>
          </div>
          <div className="mt-4 flex gap-2">
            <Button variant="outline" size="sm">
              <Share2 className="mr-1 h-4 w-4" /> Share
            </Button>
            <Button variant="outline" size="sm">
              <Bookmark className="mr-1 h-4 w-4" /> Save
            </Button>
          </div>
        </div>
      </section>

      <div className="mx-auto max-w-5xl px-6 py-12">
        <div className="grid gap-12 lg:grid-cols-[1fr_250px]">
          {/* Main Content */}
          <article className="prose prose-neutral max-w-none">
            {/* Table of Contents (Mobile) */}
            <div className="mb-8 rounded-lg border border-border p-4 lg:hidden">
              <h3 className="mb-3 text-sm font-semibold text-foreground">Table of Contents</h3>
              <nav className="space-y-2">
                {tableOfContents.map((item, i) => (
                  <a key={i} href={`#section-${i}`} className="block text-sm text-muted-foreground hover:text-foreground">
                    {item}
                  </a>
                ))}
              </nav>
            </div>

            {/* Introduction */}
            <section id="section-0">
              <h2 className="text-2xl font-semibold text-foreground">Introduction</h2>
              <p className="text-muted-foreground">
                Workflow automation has become essential for modern businesses. In this comprehensive guide, we'll explore everything you need to know about automating your processes, from basic concepts to advanced implementation strategies.
              </p>
              <p className="text-muted-foreground">
                Whether you're a small business owner or an enterprise leader, this guide will help you understand how automation can transform your operations and drive growth.
              </p>
            </section>

            {/* Section with Image */}
            <section id="section-1" className="mt-12">
              <h2 className="text-2xl font-semibold text-foreground">Understanding the Basics</h2>
              <p className="text-muted-foreground">
                Before diving into implementation, it's crucial to understand what workflow automation actually means and how it differs from simple task automation.
              </p>
              <div className="my-6 aspect-video rounded-lg bg-muted flex items-center justify-center">
                <span className="text-muted-foreground">Diagram: Workflow Automation Overview</span>
              </div>
              <p className="text-muted-foreground">
                Workflow automation involves creating a series of automated actions that complete a business process. Unlike simple automation, workflows handle multiple steps, decisions, and handoffs between systems or people.
              </p>
            </section>

            {/* Key Strategies */}
            <section id="section-2" className="mt-12">
              <h2 className="text-2xl font-semibold text-foreground">Key Strategies</h2>
              <p className="text-muted-foreground">
                Here are the proven strategies that successful organizations use when implementing workflow automation:
              </p>
              <ul className="mt-4 space-y-2">
                <li className="text-muted-foreground"><strong className="text-foreground">Start Small:</strong> Begin with simple, high-impact workflows before tackling complex processes.</li>
                <li className="text-muted-foreground"><strong className="text-foreground">Document First:</strong> Map your current processes thoroughly before automating them.</li>
                <li className="text-muted-foreground"><strong className="text-foreground">Measure Impact:</strong> Define clear metrics to track the success of your automation efforts.</li>
                <li className="text-muted-foreground"><strong className="text-foreground">Iterate Continuously:</strong> Automation is not a one-time project—it requires ongoing optimization.</li>
              </ul>
            </section>

            {/* Implementation Steps */}
            <section id="section-3" className="mt-12">
              <h2 className="text-2xl font-semibold text-foreground">Implementation Steps</h2>
              <div className="space-y-6">
                {[
                  { step: 1, title: "Audit Your Current Processes", desc: "Identify which processes are candidates for automation based on volume, complexity, and error rates." },
                  { step: 2, title: "Prioritize by Impact", desc: "Rank processes by potential time savings and business impact to determine your automation roadmap." },
                  { step: 3, title: "Choose the Right Tools", desc: "Select automation platforms that integrate with your existing tech stack and scale with your needs." },
                  { step: 4, title: "Build and Test", desc: "Create your workflows in a staging environment and thoroughly test before going live." },
                  { step: 5, title: "Deploy and Monitor", desc: "Launch your workflows and set up monitoring to catch issues early." },
                ].map((item) => (
                  <div key={item.step} className="flex gap-4">
                    <div className="flex h-8 w-8 shrink-0 items-center justify-center rounded-full bg-primary text-primary-foreground text-sm font-medium">
                      {item.step}
                    </div>
                    <div>
                      <h4 className="font-medium text-foreground">{item.title}</h4>
                      <p className="mt-1 text-sm text-muted-foreground">{item.desc}</p>
                    </div>
                  </div>
                ))}
              </div>
            </section>

            {/* Common Mistakes */}
            <section id="section-4" className="mt-12">
              <h2 className="text-2xl font-semibold text-foreground">Common Mistakes to Avoid</h2>
              <div className="mt-4 rounded-lg border border-destructive/20 bg-destructive/5 p-4">
                <ul className="space-y-2 text-sm">
                  <li className="text-muted-foreground">❌ Automating broken processes without fixing them first</li>
                  <li className="text-muted-foreground">❌ Ignoring change management and employee training</li>
                  <li className="text-muted-foreground">❌ Over-automating too quickly without proper testing</li>
                  <li className="text-muted-foreground">❌ Failing to maintain and update workflows over time</li>
                </ul>
              </div>
            </section>

            {/* FAQ / PAA Block */}
            <section className="mt-12">
              <h2 className="text-2xl font-semibold text-foreground">Frequently Asked Questions</h2>
              <div className="mt-6 space-y-4">
                {[
                  { q: "How long does it take to implement workflow automation?", a: "Implementation time varies based on complexity. Simple workflows can be live in days, while enterprise-wide automation may take months." },
                  { q: "What's the average ROI of workflow automation?", a: "Organizations typically see 300-500% ROI within the first year, primarily through time savings and error reduction." },
                  { q: "Do I need technical skills to automate workflows?", a: "Modern automation platforms are no-code or low-code, meaning most users can create workflows without programming knowledge." },
                ].map((faq, i) => (
                  <div key={i} className="rounded-lg border border-border p-4">
                    <h4 className="font-medium text-foreground">{faq.q}</h4>
                    <p className="mt-2 text-sm text-muted-foreground">{faq.a}</p>
                  </div>
                ))}
              </div>
            </section>

            {/* Conclusion */}
            <section id="section-5" className="mt-12">
              <h2 className="text-2xl font-semibold text-foreground">Conclusion</h2>
              <p className="text-muted-foreground">
                Workflow automation is no longer optional—it's a competitive necessity. By following the strategies and steps outlined in this guide, you can successfully implement automation that saves time, reduces errors, and scales your operations.
              </p>
            </section>

            {/* Inline CTA */}
            <div className="mt-12 rounded-lg bg-primary/5 border border-primary/20 p-6 text-center">
              <h3 className="font-semibold text-foreground">Ready to automate your workflows?</h3>
              <p className="mt-2 text-sm text-muted-foreground">Start your free trial and see results in minutes.</p>
              <Button className="mt-4">Start Free Trial</Button>
            </div>
          </article>

          {/* Sidebar - Table of Contents */}
          <aside className="hidden lg:block">
            <div className="sticky top-6">
              <h3 className="text-sm font-semibold text-foreground">Table of Contents</h3>
              <nav className="mt-4 space-y-2">
                {tableOfContents.map((item, i) => (
                  <a key={i} href={`#section-${i}`} className="block text-sm text-muted-foreground hover:text-foreground">
                    {item}
                  </a>
                ))}
              </nav>
            </div>
          </aside>
        </div>
      </div>

      {/* Related Content */}
      <section className="border-t border-border bg-muted/50 px-6 py-16">
        <div className="mx-auto max-w-5xl">
          <h2 className="text-xl font-semibold text-foreground">Related Articles</h2>
          <div className="mt-8 grid gap-6 md:grid-cols-3">
            {[
              { title: "10 Workflows Every Business Should Automate", category: "Guide" },
              { title: "Automation vs. AI: What's the Difference?", category: "Explainer" },
              { title: "Case Study: How TechCorp Saved 1000+ Hours", category: "Case Study" },
            ].map((article, i) => (
              <Card key={i} className="cursor-pointer transition-shadow hover:shadow-lg">
                <CardContent className="p-4">
                  <Badge variant="secondary" className="text-xs">{article.category}</Badge>
                  <h3 className="mt-2 font-medium text-foreground hover:text-primary">{article.title}</h3>
                  <Button variant="link" className="mt-2 p-0 h-auto">
                    Read more <ArrowRight className="ml-1 h-3 w-3" />
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
