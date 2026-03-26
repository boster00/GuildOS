// ARCHIVED: Original path was libs/reference-for-ai/page-component-templates/components/templates/about-page.tsx

"use client"

import { Button } from "@/components/ui/button"
import { Card, CardContent } from "@/components/ui/card"
import { Avatar, AvatarFallback, AvatarImage } from "@/components/ui/avatar"
import { Badge } from "@/components/ui/badge"
import { Award, Users, Target, Heart, ArrowRight, Linkedin, Twitter } from "lucide-react"

export function AboutPageTemplate() {
  return (
    <div className="min-h-screen bg-background">
      {/* Mission / Vision Hero */}
      <section className="px-6 py-20 text-center">
        <Badge className="mb-4">About Us</Badge>
        <h1 className="text-3xl font-bold tracking-tight text-foreground sm:text-4xl text-balance">
          Making Work Better for Everyone
        </h1>
        <p className="mt-4 mx-auto max-w-2xl text-lg text-muted-foreground text-pretty">
          We believe that automation should empower people, not replace them. Our mission is to free teams from repetitive work so they can focus on what matters most.
        </p>
      </section>

      {/* Vision Statement */}
      <section className="border-t border-border bg-muted/50 px-6 py-16">
        <div className="mx-auto max-w-4xl grid gap-12 md:grid-cols-2">
          <div>
            <Target className="h-10 w-10 text-primary" />
            <h2 className="mt-4 text-xl font-semibold text-foreground">Our Mission</h2>
            <p className="mt-2 text-muted-foreground">
              To democratize automation, making it accessible to every team regardless of technical expertise or budget.
            </p>
          </div>
          <div>
            <Heart className="h-10 w-10 text-primary" />
            <h2 className="mt-4 text-xl font-semibold text-foreground">Our Vision</h2>
            <p className="mt-2 text-muted-foreground">
              A world where technology amplifies human potential instead of creating busywork.
            </p>
          </div>
        </div>
      </section>

      {/* Company Story */}
      <section className="px-6 py-16">
        <div className="mx-auto max-w-3xl">
          <h2 className="text-center text-2xl font-semibold text-foreground">Our Story</h2>
          <div className="mt-8 space-y-6 text-muted-foreground">
            <p>
              Founded in 2020, our company was born from a simple frustration: why does so much of our work involve repetitive, soul-crushing tasks that machines could easily handle?
            </p>
            <p>
              Our founders—former engineers at Fortune 500 companies—had spent years watching talented colleagues waste hours on data entry, report compilation, and manual processes. They knew there had to be a better way.
            </p>
            <p>
              Starting from a small apartment in San Francisco, we built the first version of our platform in just three months. What began as a tool for our own use quickly gained traction with other teams facing the same challenges.
            </p>
            <p>
              Today, we serve over 50,000 businesses worldwide, from solo entrepreneurs to Fortune 500 enterprises. But our mission remains the same: to help people reclaim their time and do more meaningful work.
            </p>
          </div>
        </div>
      </section>

      {/* Team Section */}
      <section className="border-t border-border bg-muted/50 px-6 py-16">
        <div className="mx-auto max-w-5xl">
          <h2 className="text-center text-2xl font-semibold text-foreground">Meet Our Team</h2>
          <p className="mt-2 text-center text-muted-foreground">The people building the future of work</p>
          <div className="mt-12 grid gap-8 sm:grid-cols-2 lg:grid-cols-4">
            {[
              { name: "Sarah Chen", role: "CEO & Co-founder", initials: "SC" },
              { name: "Michael Roberts", role: "CTO & Co-founder", initials: "MR" },
              { name: "Emily Zhang", role: "VP Engineering", initials: "EZ" },
              { name: "David Kim", role: "VP Product", initials: "DK" },
              { name: "Lisa Thompson", role: "VP Sales", initials: "LT" },
              { name: "James Wilson", role: "VP Marketing", initials: "JW" },
              { name: "Rachel Moore", role: "VP Customer Success", initials: "RM" },
              { name: "Alex Johnson", role: "VP People", initials: "AJ" },
            ].map((member, i) => (
              <div key={i} className="text-center">
                <Avatar className="mx-auto h-24 w-24">
                  <AvatarImage src="/placeholder.svg" />
                  <AvatarFallback className="text-lg">{member.initials}</AvatarFallback>
                </Avatar>
                <h3 className="mt-4 font-semibold text-foreground">{member.name}</h3>
                <p className="text-sm text-muted-foreground">{member.role}</p>
                <div className="mt-2 flex justify-center gap-2">
                  <Button variant="ghost" size="icon" className="h-8 w-8">
                    <Linkedin className="h-4 w-4" />
                  </Button>
                  <Button variant="ghost" size="icon" className="h-8 w-8">
                    <Twitter className="h-4 w-4" />
                  </Button>
                </div>
              </div>
            ))}
          </div>
        </div>
      </section>

      {/* Timeline / Milestones */}
      <section className="px-6 py-16">
        <div className="mx-auto max-w-3xl">
          <h2 className="text-center text-2xl font-semibold text-foreground">Our Journey</h2>
          <div className="mt-12 space-y-8">
            {[
              { year: "2020", title: "Company Founded", desc: "Started in a San Francisco apartment with 3 founders" },
              { year: "2021", title: "Seed Funding", desc: "Raised $5M to accelerate product development" },
              { year: "2021", title: "1,000 Customers", desc: "Reached our first major customer milestone" },
              { year: "2022", title: "Series A", desc: "Raised $25M led by top-tier investors" },
              { year: "2022", title: "100 Employees", desc: "Expanded team across 3 continents" },
              { year: "2023", title: "50,000 Customers", desc: "Serving businesses in 120+ countries" },
              { year: "2024", title: "Series B", desc: "Raised $75M to expand into new markets" },
            ].map((milestone, i) => (
              <div key={i} className="flex gap-6">
                <div className="flex flex-col items-center">
                  <div className="flex h-10 w-10 items-center justify-center rounded-full bg-primary text-primary-foreground text-xs font-bold">
                    {milestone.year.slice(2)}
                  </div>
                  {i < 6 && <div className="w-px flex-1 bg-border" />}
                </div>
                <div className="pb-8">
                  <p className="text-xs text-muted-foreground">{milestone.year}</p>
                  <h3 className="font-semibold text-foreground">{milestone.title}</h3>
                  <p className="mt-1 text-sm text-muted-foreground">{milestone.desc}</p>
                </div>
              </div>
            ))}
          </div>
        </div>
      </section>

      {/* Certifications / Compliance */}
      <section className="border-t border-border bg-muted/50 px-6 py-16">
        <div className="mx-auto max-w-4xl">
          <h2 className="text-center text-2xl font-semibold text-foreground">Trust & Compliance</h2>
          <p className="mt-2 text-center text-muted-foreground">Enterprise-grade security and compliance you can rely on</p>
          <div className="mt-12 grid gap-6 sm:grid-cols-2 lg:grid-cols-4">
            {[
              { title: "SOC 2 Type II", desc: "Independently audited security controls" },
              { title: "GDPR", desc: "Full compliance with EU data protection" },
              { title: "HIPAA", desc: "Healthcare data security compliant" },
              { title: "ISO 27001", desc: "Information security management certified" },
            ].map((cert, i) => (
              <Card key={i}>
                <CardContent className="pt-6 text-center">
                  <Award className="mx-auto h-8 w-8 text-primary" />
                  <h3 className="mt-4 font-semibold text-foreground">{cert.title}</h3>
                  <p className="mt-1 text-sm text-muted-foreground">{cert.desc}</p>
                </CardContent>
              </Card>
            ))}
          </div>
        </div>
      </section>

      {/* Social Proof / Stats */}
      <section className="px-6 py-16">
        <div className="mx-auto max-w-4xl">
          <div className="grid gap-8 text-center md:grid-cols-4">
            {[
              { stat: "50,000+", label: "Businesses served" },
              { stat: "120+", label: "Countries" },
              { stat: "99.99%", label: "Uptime" },
              { stat: "4.9/5", label: "Customer rating" },
            ].map((item, i) => (
              <div key={i}>
                <div className="text-3xl font-bold text-primary">{item.stat}</div>
                <p className="mt-1 text-sm text-muted-foreground">{item.label}</p>
              </div>
            ))}
          </div>
        </div>
      </section>

      {/* Values */}
      <section className="border-t border-border bg-muted/50 px-6 py-16">
        <div className="mx-auto max-w-4xl">
          <h2 className="text-center text-2xl font-semibold text-foreground">Our Values</h2>
          <div className="mt-12 grid gap-6 md:grid-cols-3">
            {[
              { title: "Customer Obsession", desc: "Every decision starts with what's best for our customers." },
              { title: "Radical Transparency", desc: "We share openly, communicate honestly, and build trust." },
              { title: "Continuous Improvement", desc: "We're never done learning, growing, and getting better." },
            ].map((value, i) => (
              <div key={i} className="text-center">
                <Users className="mx-auto h-8 w-8 text-primary" />
                <h3 className="mt-4 font-semibold text-foreground">{value.title}</h3>
                <p className="mt-2 text-sm text-muted-foreground">{value.desc}</p>
              </div>
            ))}
          </div>
        </div>
      </section>

      {/* CTA */}
      <section className="px-6 py-16">
        <div className="mx-auto max-w-xl text-center">
          <h2 className="text-2xl font-semibold text-foreground">Join Our Journey</h2>
          <p className="mt-2 text-muted-foreground">
            Whether as a customer, partner, or team member—we'd love to have you.
          </p>
          <div className="mt-6 flex flex-col items-center gap-4 sm:flex-row sm:justify-center">
            <Button size="lg">
              Start Free Trial
              <ArrowRight className="ml-2 h-4 w-4" />
            </Button>
            <Button variant="outline" size="lg">View Open Roles</Button>
          </div>
        </div>
      </section>
    </div>
  )
}
