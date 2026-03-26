// ARCHIVED: Original path was libs/reference-for-ai/page-component-templates/components/templates/homepage.tsx

"use client"

import { Button } from "@/components/ui/button"
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card"
import { ArrowRight, Building, Users, Briefcase, BookOpen, Star } from "lucide-react"

export function HomepageTemplate() {
  return (
    <div className="min-h-screen bg-background">
      {/* Navigation */}
      <header className="border-b border-border">
        <div className="mx-auto flex h-16 max-w-6xl items-center justify-between px-6">
          <div className="font-bold text-xl text-foreground">BrandName</div>
          <nav className="hidden gap-6 md:flex">
            <a href="#" className="text-sm text-muted-foreground hover:text-foreground">Products</a>
            <a href="#" className="text-sm text-muted-foreground hover:text-foreground">Solutions</a>
            <a href="#" className="text-sm text-muted-foreground hover:text-foreground">Resources</a>
            <a href="#" className="text-sm text-muted-foreground hover:text-foreground">Pricing</a>
          </nav>
          <Button>Get Started</Button>
        </div>
      </header>

      {/* Hero */}
      <section className="px-6 py-24">
        <div className="mx-auto max-w-4xl text-center">
          <h1 className="text-4xl font-bold tracking-tight text-foreground sm:text-5xl text-balance">
            The Platform for Modern Business Operations
          </h1>
          <p className="mt-6 text-lg text-muted-foreground text-pretty">
            Streamline your workflow, collaborate seamlessly, and scale your operations with confidence.
          </p>
          <div className="mt-8 flex flex-col items-center gap-4 sm:flex-row sm:justify-center">
            <Button size="lg">
              Explore Products
              <ArrowRight className="ml-2 h-4 w-4" />
            </Button>
            <Button variant="outline" size="lg">Contact Sales</Button>
          </div>
        </div>
      </section>

      {/* Product/Service Overview Cards */}
      <section className="border-t border-border bg-muted/50 px-6 py-16">
        <div className="mx-auto max-w-5xl">
          <h2 className="text-center text-2xl font-semibold text-foreground">Our Products</h2>
          <div className="mt-12 grid gap-6 md:grid-cols-3">
            {[
              { icon: Building, title: "Enterprise Suite", desc: "Full-featured platform for large organizations" },
              { icon: Users, title: "Team Workspace", desc: "Collaboration tools for growing teams" },
              { icon: Briefcase, title: "Professional Tools", desc: "Individual productivity solutions" },
            ].map((product, i) => (
              <Card key={i} className="cursor-pointer transition-shadow hover:shadow-lg">
                <CardHeader>
                  <product.icon className="h-8 w-8 text-primary" />
                  <CardTitle className="mt-2">{product.title}</CardTitle>
                  <CardDescription>{product.desc}</CardDescription>
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

      {/* Key Value Propositions */}
      <section className="px-6 py-16">
        <div className="mx-auto max-w-5xl">
          <div className="grid gap-12 md:grid-cols-2 md:items-center">
            <div>
              <h2 className="text-2xl font-semibold text-foreground">Why Choose Us?</h2>
              <ul className="mt-6 space-y-4">
                {[
                  "Trusted by 50,000+ businesses worldwide",
                  "99.9% uptime guarantee",
                  "24/7 dedicated support",
                  "Enterprise-grade security",
                ].map((item, i) => (
                  <li key={i} className="flex items-center gap-3 text-muted-foreground">
                    <div className="h-2 w-2 rounded-full bg-primary" />
                    {item}
                  </li>
                ))}
              </ul>
            </div>
            <div className="aspect-video rounded-lg bg-muted flex items-center justify-center">
              <span className="text-muted-foreground">Product Screenshot</span>
            </div>
          </div>
        </div>
      </section>

      {/* Use Cases / Audiences */}
      <section className="border-t border-border bg-muted/50 px-6 py-16">
        <div className="mx-auto max-w-5xl">
          <h2 className="text-center text-2xl font-semibold text-foreground">Built for Every Team</h2>
          <div className="mt-12 grid gap-4 sm:grid-cols-2 lg:grid-cols-4">
            {["Marketing", "Engineering", "Sales", "Operations"].map((team) => (
              <div key={team} className="rounded-lg border border-border bg-background p-6 text-center">
                <h3 className="font-medium text-foreground">{team}</h3>
                <p className="mt-2 text-sm text-muted-foreground">Tailored solutions for {team.toLowerCase()} teams</p>
              </div>
            ))}
          </div>
        </div>
      </section>

      {/* Testimonials */}
      <section className="px-6 py-16">
        <div className="mx-auto max-w-4xl">
          <h2 className="text-center text-2xl font-semibold text-foreground">What Our Customers Say</h2>
          <div className="mt-12 grid gap-6 md:grid-cols-2">
            {[
              { quote: "Transformed how our team collaborates. Highly recommend!", name: "Alex Johnson", role: "CTO, StartupXYZ" },
              { quote: "The ROI was immediate. We saw results within the first month.", name: "Maria Garcia", role: "VP Ops, ScaleCo" },
            ].map((testimonial, i) => (
              <Card key={i}>
                <CardContent className="pt-6">
                  <div className="flex gap-1">
                    {[...Array(5)].map((_, j) => (
                      <Star key={j} className="h-4 w-4 fill-primary text-primary" />
                    ))}
                  </div>
                  <p className="mt-4 text-foreground">"{testimonial.quote}"</p>
                  <p className="mt-4 text-sm text-muted-foreground">{testimonial.name}, {testimonial.role}</p>
                </CardContent>
              </Card>
            ))}
          </div>
        </div>
      </section>

      {/* Featured Resources */}
      <section className="border-t border-border bg-muted/50 px-6 py-16">
        <div className="mx-auto max-w-5xl">
          <h2 className="text-center text-2xl font-semibold text-foreground">Resources</h2>
          <div className="mt-12 grid gap-6 md:grid-cols-3">
            {[
              { title: "Getting Started Guide", type: "Documentation" },
              { title: "2024 Industry Report", type: "Report" },
              { title: "Best Practices Webinar", type: "Video" },
            ].map((resource, i) => (
              <div key={i} className="group cursor-pointer">
                <div className="aspect-video rounded-lg bg-muted flex items-center justify-center">
                  <BookOpen className="h-8 w-8 text-muted-foreground" />
                </div>
                <p className="mt-3 text-xs text-muted-foreground">{resource.type}</p>
                <h3 className="mt-1 font-medium text-foreground group-hover:text-primary">{resource.title}</h3>
              </div>
            ))}
          </div>
        </div>
      </section>

      {/* CTA */}
      <section className="px-6 py-16">
        <div className="mx-auto max-w-xl text-center">
          <h2 className="text-2xl font-semibold text-foreground">Ready to Transform Your Business?</h2>
          <p className="mt-2 text-muted-foreground">Start your free trial today. No credit card required.</p>
          <Button size="lg" className="mt-6">Get Started Free</Button>
        </div>
      </section>

      {/* Footer */}
      <footer className="border-t border-border bg-muted/50 px-6 py-12">
        <div className="mx-auto max-w-5xl grid gap-8 md:grid-cols-4">
          <div>
            <div className="font-bold text-foreground">BrandName</div>
            <p className="mt-2 text-sm text-muted-foreground">Making work better since 2020.</p>
          </div>
          {[
            { title: "Product", links: ["Features", "Pricing", "Integrations"] },
            { title: "Company", links: ["About", "Careers", "Press"] },
            { title: "Support", links: ["Help Center", "Contact", "Status"] },
          ].map((section) => (
            <div key={section.title}>
              <h4 className="font-medium text-foreground">{section.title}</h4>
              <ul className="mt-3 space-y-2">
                {section.links.map((link) => (
                  <li key={link}>
                    <a href="#" className="text-sm text-muted-foreground hover:text-foreground">{link}</a>
                  </li>
                ))}
              </ul>
            </div>
          ))}
        </div>
      </footer>
    </div>
  )
}
