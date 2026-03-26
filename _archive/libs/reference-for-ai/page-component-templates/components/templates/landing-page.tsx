// ARCHIVED: Original path was libs/reference-for-ai/page-component-templates/components/templates/landing-page.tsx

"use client"

import { Button } from "@/components/ui/button"
import { Card, CardContent } from "@/components/ui/card"
import { Input } from "@/components/ui/input"
import { CheckCircle, Zap, Shield, ArrowRight, Star } from "lucide-react"

export function LandingPageTemplate() {
  return (
    <div className="min-h-screen bg-background">
      {/* Hero */}
      <section className="px-6 py-24 text-center">
        <div className="mx-auto max-w-3xl">
          <h1 className="text-4xl font-bold tracking-tight text-foreground sm:text-5xl text-balance">
            Transform Your Workflow with AI-Powered Automation
          </h1>
          <p className="mt-6 text-lg text-muted-foreground text-pretty">
            Stop wasting hours on repetitive tasks. Our platform automates your busywork so you can focus on what matters.
          </p>
          <div className="mt-8 flex flex-col items-center gap-4 sm:flex-row sm:justify-center">
            <Button size="lg">
              Start Free Trial
              <ArrowRight className="ml-2 h-4 w-4" />
            </Button>
            <Button variant="outline" size="lg">Watch Demo</Button>
          </div>
        </div>
      </section>

      {/* Problem/Pain */}
      <section className="border-t border-border bg-muted/50 px-6 py-16">
        <div className="mx-auto max-w-4xl text-center">
          <h2 className="text-2xl font-semibold text-foreground">Still Managing Tasks Manually?</h2>
          <p className="mt-4 text-muted-foreground">
            Teams lose 40% of their time on repetitive tasks that could be automated. That's 2 full days every week—gone.
          </p>
        </div>
      </section>

      {/* Solution Overview */}
      <section className="px-6 py-16">
        <div className="mx-auto max-w-5xl">
          <h2 className="text-center text-2xl font-semibold text-foreground">One Platform, Endless Automation</h2>
          <div className="mt-12 grid gap-8 md:grid-cols-3">
            {[
              { icon: Zap, title: "Instant Setup", desc: "Connect your tools in minutes, not days." },
              { icon: Shield, title: "Enterprise Security", desc: "SOC 2 compliant with end-to-end encryption." },
              { icon: CheckCircle, title: "No-Code Builder", desc: "Create workflows without writing a single line of code." },
            ].map((item, i) => (
              <Card key={i} className="text-center">
                <CardContent className="pt-6">
                  <item.icon className="mx-auto h-10 w-10 text-primary" />
                  <h3 className="mt-4 font-semibold text-foreground">{item.title}</h3>
                  <p className="mt-2 text-sm text-muted-foreground">{item.desc}</p>
                </CardContent>
              </Card>
            ))}
          </div>
        </div>
      </section>

      {/* How It Works */}
      <section className="border-t border-border bg-muted/50 px-6 py-16">
        <div className="mx-auto max-w-4xl">
          <h2 className="text-center text-2xl font-semibold text-foreground">How It Works</h2>
          <div className="mt-12 grid gap-6 md:grid-cols-3">
            {[
              { step: "1", title: "Connect", desc: "Link your existing tools and apps" },
              { step: "2", title: "Automate", desc: "Build workflows with drag-and-drop" },
              { step: "3", title: "Scale", desc: "Watch your productivity skyrocket" },
            ].map((item, i) => (
              <div key={i} className="text-center">
                <div className="mx-auto flex h-12 w-12 items-center justify-center rounded-full bg-primary text-primary-foreground font-bold">
                  {item.step}
                </div>
                <h3 className="mt-4 font-semibold text-foreground">{item.title}</h3>
                <p className="mt-2 text-sm text-muted-foreground">{item.desc}</p>
              </div>
            ))}
          </div>
        </div>
      </section>

      {/* Social Proof */}
      <section className="px-6 py-16">
        <div className="mx-auto max-w-4xl text-center">
          <div className="flex items-center justify-center gap-1">
            {[...Array(5)].map((_, i) => (
              <Star key={i} className="h-5 w-5 fill-primary text-primary" />
            ))}
          </div>
          <blockquote className="mt-4 text-lg italic text-foreground">
            "This tool saved our team 20+ hours per week. It's a game-changer."
          </blockquote>
          <p className="mt-2 text-sm text-muted-foreground">— Sarah Chen, Head of Ops at TechCorp</p>
          <div className="mt-8 flex flex-wrap items-center justify-center gap-8 opacity-50">
            {["Acme Inc", "Globex", "Initech", "Umbrella Co"].map((name) => (
              <span key={name} className="text-sm font-semibold text-muted-foreground">{name}</span>
            ))}
          </div>
        </div>
      </section>

      {/* FAQ */}
      <section className="border-t border-border bg-muted/50 px-6 py-16">
        <div className="mx-auto max-w-2xl">
          <h2 className="text-center text-2xl font-semibold text-foreground">Frequently Asked Questions</h2>
          <div className="mt-8 space-y-6">
            {[
              { q: "Is there a free trial?", a: "Yes! Start with a 14-day free trial, no credit card required." },
              { q: "Can I cancel anytime?", a: "Absolutely. No long-term contracts, cancel whenever you want." },
              { q: "What integrations do you support?", a: "We support 200+ apps including Slack, Google, Salesforce, and more." },
            ].map((faq, i) => (
              <div key={i}>
                <h3 className="font-medium text-foreground">{faq.q}</h3>
                <p className="mt-1 text-sm text-muted-foreground">{faq.a}</p>
              </div>
            ))}
          </div>
        </div>
      </section>

      {/* CTA Banner + Lead Form */}
      <section className="px-6 py-16">
        <div className="mx-auto max-w-xl text-center">
          <h2 className="text-2xl font-semibold text-foreground">Ready to Get Started?</h2>
          <p className="mt-2 text-muted-foreground">Join 10,000+ teams already automating their work.</p>
          <div className="mt-6 flex gap-2">
            <Input placeholder="Enter your email" className="flex-1" />
            <Button>Get Started</Button>
          </div>
        </div>
      </section>
    </div>
  )
}
