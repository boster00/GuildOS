// ARCHIVED: Original path was libs/reference-for-ai/page-component-templates/components/templates/comparison-page.tsx

"use client"

import { Button } from "@/components/ui/button"
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card"
import { Badge } from "@/components/ui/badge"
import { Check, X, Star, ArrowRight } from "lucide-react"

export function ComparisonPageTemplate() {
  return (
    <div className="min-h-screen bg-background">
      {/* Comparison Hero */}
      <section className="px-6 py-20 text-center">
        <Badge className="mb-4">Comparison</Badge>
        <h1 className="text-3xl font-bold tracking-tight text-foreground sm:text-4xl text-balance">
          OurProduct vs CompetitorX: The Definitive Comparison
        </h1>
        <p className="mt-4 mx-auto max-w-2xl text-lg text-muted-foreground text-pretty">
          See how we stack up against the competition and find out which solution is right for your needs.
        </p>
      </section>

      {/* Side-by-Side Table */}
      <section className="px-6 pb-16">
        <div className="mx-auto max-w-4xl">
          <div className="overflow-x-auto rounded-lg border border-border">
            <table className="w-full">
              <thead>
                <tr className="bg-muted">
                  <th className="p-4 text-left text-sm font-medium text-muted-foreground">Feature</th>
                  <th className="p-4 text-center">
                    <div className="text-sm font-medium text-primary">OurProduct</div>
                  </th>
                  <th className="p-4 text-center">
                    <div className="text-sm font-medium text-muted-foreground">CompetitorX</div>
                  </th>
                </tr>
              </thead>
              <tbody>
                {[
                  { feature: "Pricing (starter)", ours: "$19/mo", theirs: "$29/mo" },
                  { feature: "Free trial", ours: true, theirs: true },
                  { feature: "Unlimited users", ours: true, theirs: false },
                  { feature: "API access", ours: true, theirs: true },
                  { feature: "Custom integrations", ours: true, theirs: false },
                  { feature: "24/7 Support", ours: true, theirs: false },
                  { feature: "Mobile app", ours: true, theirs: true },
                  { feature: "White labeling", ours: true, theirs: false },
                  { feature: "SSO / SAML", ours: true, theirs: true },
                  { feature: "Data export", ours: "Unlimited", theirs: "Limited" },
                  { feature: "Onboarding", ours: "Free", theirs: "$500" },
                ].map((row, i) => (
                  <tr key={i} className="border-t border-border">
                    <td className="p-4 text-sm text-foreground">{row.feature}</td>
                    <td className="p-4 text-center">
                      {typeof row.ours === "boolean" ? (
                        row.ours ? (
                          <Check className="mx-auto h-5 w-5 text-primary" />
                        ) : (
                          <X className="mx-auto h-5 w-5 text-muted-foreground" />
                        )
                      ) : (
                        <span className="text-sm font-medium text-foreground">{row.ours}</span>
                      )}
                    </td>
                    <td className="p-4 text-center">
                      {typeof row.theirs === "boolean" ? (
                        row.theirs ? (
                          <Check className="mx-auto h-5 w-5 text-muted-foreground" />
                        ) : (
                          <X className="mx-auto h-5 w-5 text-muted-foreground" />
                        )
                      ) : (
                        <span className="text-sm text-muted-foreground">{row.theirs}</span>
                      )}
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </div>
      </section>

      {/* Key Differences */}
      <section className="border-t border-border bg-muted/50 px-6 py-16">
        <div className="mx-auto max-w-4xl">
          <h2 className="text-center text-2xl font-semibold text-foreground">Key Differences</h2>
          <div className="mt-12 grid gap-6 md:grid-cols-3">
            {[
              { title: "Pricing", desc: "We offer transparent, lower pricing with no hidden fees or per-seat charges." },
              { title: "Support", desc: "Get 24/7 human support on all plans—not just enterprise." },
              { title: "Flexibility", desc: "Unlimited customization options and integrations at no extra cost." },
            ].map((diff, i) => (
              <Card key={i}>
                <CardHeader>
                  <CardTitle className="text-lg">{diff.title}</CardTitle>
                </CardHeader>
                <CardContent>
                  <p className="text-sm text-muted-foreground">{diff.desc}</p>
                </CardContent>
              </Card>
            ))}
          </div>
        </div>
      </section>

      {/* Pros / Cons Lists */}
      <section className="px-6 py-16">
        <div className="mx-auto max-w-4xl grid gap-8 md:grid-cols-2">
          {/* OurProduct */}
          <div>
            <h3 className="text-lg font-semibold text-foreground flex items-center gap-2">
              <span className="h-3 w-3 rounded-full bg-primary" />
              OurProduct
            </h3>
            <div className="mt-6 space-y-4">
              <div>
                <h4 className="text-sm font-medium text-foreground mb-2">Pros</h4>
                <ul className="space-y-2">
                  {["Lower overall cost", "Better customer support", "More integrations", "Unlimited users", "No hidden fees"].map((pro, i) => (
                    <li key={i} className="flex items-center gap-2 text-sm text-muted-foreground">
                      <Check className="h-4 w-4 text-primary" /> {pro}
                    </li>
                  ))}
                </ul>
              </div>
              <div>
                <h4 className="text-sm font-medium text-foreground mb-2">Cons</h4>
                <ul className="space-y-2">
                  {["Newer in the market", "Smaller brand recognition"].map((con, i) => (
                    <li key={i} className="flex items-center gap-2 text-sm text-muted-foreground">
                      <X className="h-4 w-4 text-muted-foreground" /> {con}
                    </li>
                  ))}
                </ul>
              </div>
            </div>
          </div>

          {/* CompetitorX */}
          <div>
            <h3 className="text-lg font-semibold text-muted-foreground flex items-center gap-2">
              <span className="h-3 w-3 rounded-full bg-muted-foreground" />
              CompetitorX
            </h3>
            <div className="mt-6 space-y-4">
              <div>
                <h4 className="text-sm font-medium text-foreground mb-2">Pros</h4>
                <ul className="space-y-2">
                  {["Established brand", "Large user community", "More documentation"].map((pro, i) => (
                    <li key={i} className="flex items-center gap-2 text-sm text-muted-foreground">
                      <Check className="h-4 w-4 text-muted-foreground" /> {pro}
                    </li>
                  ))}
                </ul>
              </div>
              <div>
                <h4 className="text-sm font-medium text-foreground mb-2">Cons</h4>
                <ul className="space-y-2">
                  {["Higher pricing", "Limited support hours", "Per-seat pricing", "Fewer integrations", "Extra fees for features"].map((con, i) => (
                    <li key={i} className="flex items-center gap-2 text-sm text-muted-foreground">
                      <X className="h-4 w-4 text-destructive" /> {con}
                    </li>
                  ))}
                </ul>
              </div>
            </div>
          </div>
        </div>
      </section>

      {/* Use-Case Guidance */}
      <section className="border-t border-border bg-muted/50 px-6 py-16">
        <div className="mx-auto max-w-3xl">
          <h2 className="text-center text-2xl font-semibold text-foreground">Which Should You Choose?</h2>
          <div className="mt-12 space-y-6">
            <div className="rounded-lg border border-primary bg-primary/5 p-6">
              <h3 className="font-semibold text-foreground">Choose OurProduct if you need:</h3>
              <ul className="mt-3 space-y-2">
                {["Affordable pricing without sacrificing features", "24/7 support for your entire team", "Flexibility to customize and integrate", "A partner, not just a vendor"].map((item, i) => (
                  <li key={i} className="flex items-center gap-2 text-sm text-muted-foreground">
                    <ArrowRight className="h-4 w-4 text-primary" /> {item}
                  </li>
                ))}
              </ul>
            </div>
            <div className="rounded-lg border border-border p-6">
              <h3 className="font-semibold text-muted-foreground">Consider CompetitorX if you need:</h3>
              <ul className="mt-3 space-y-2">
                {["An established brand name for stakeholder buy-in", "Access to their specific community resources", "Legacy integrations they uniquely support"].map((item, i) => (
                  <li key={i} className="flex items-center gap-2 text-sm text-muted-foreground">
                    <ArrowRight className="h-4 w-4 text-muted-foreground" /> {item}
                  </li>
                ))}
              </ul>
            </div>
          </div>
        </div>
      </section>

      {/* Testimonials */}
      <section className="px-6 py-16">
        <div className="mx-auto max-w-4xl">
          <h2 className="text-center text-2xl font-semibold text-foreground">What Switchers Say</h2>
          <div className="mt-12 grid gap-6 md:grid-cols-2">
            {[
              { quote: "We switched from CompetitorX and saved $15,000/year while getting better support.", name: "Sarah Chen", role: "Head of Ops, TechStartup" },
              { quote: "The migration was seamless. I wish we had switched sooner!", name: "Michael Roberts", role: "CTO, GrowthCo" },
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
                  <Badge variant="secondary" className="mt-2">Switched from CompetitorX</Badge>
                </CardContent>
              </Card>
            ))}
          </div>
        </div>
      </section>

      {/* Recommendation CTA */}
      <section className="border-t border-border bg-primary px-6 py-16">
        <div className="mx-auto max-w-xl text-center">
          <h2 className="text-2xl font-semibold text-primary-foreground">Ready to Make the Switch?</h2>
          <p className="mt-2 text-primary-foreground/80">
            Join 5,000+ companies who switched to OurProduct. We'll even help you migrate for free.
          </p>
          <div className="mt-6 flex flex-col items-center gap-4 sm:flex-row sm:justify-center">
            <Button size="lg" variant="secondary">Start Free Trial</Button>
            <Button size="lg" variant="outline" className="border-primary-foreground text-primary-foreground hover:bg-primary-foreground hover:text-primary bg-transparent">
              Talk to Sales
            </Button>
          </div>
        </div>
      </section>
    </div>
  )
}
