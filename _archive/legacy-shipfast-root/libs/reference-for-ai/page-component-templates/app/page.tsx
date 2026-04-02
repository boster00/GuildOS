"use client"

import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs"
import { LandingPageTemplate } from "@/components/templates/landing-page"
import { HomepageTemplate } from "@/components/templates/homepage"
import { ProductPageTemplate } from "@/components/templates/product-page"
import { PricingPageTemplate } from "@/components/templates/pricing-page"
import { ContentPageTemplate } from "@/components/templates/content-page"
import { ComparisonPageTemplate } from "@/components/templates/comparison-page"
import { UseCasePageTemplate } from "@/components/templates/use-case-page"
import { AboutPageTemplate } from "@/components/templates/about-page"
import { ResourcePageTemplate } from "@/components/templates/resource-page"
import { ContactPageTemplate } from "@/components/templates/contact-page"

const templates = [
  { id: "landing", label: "Landing", component: LandingPageTemplate },
  { id: "homepage", label: "Homepage", component: HomepageTemplate },
  { id: "product", label: "Product", component: ProductPageTemplate },
  { id: "pricing", label: "Pricing", component: PricingPageTemplate },
  { id: "content", label: "Content/SEO", component: ContentPageTemplate },
  { id: "comparison", label: "Comparison", component: ComparisonPageTemplate },
  { id: "usecase", label: "Use Case", component: UseCasePageTemplate },
  { id: "about", label: "About", component: AboutPageTemplate },
  { id: "resource", label: "Resource", component: ResourcePageTemplate },
  { id: "contact", label: "Contact", component: ContactPageTemplate },
]

export default function TemplateShowcase() {
  return (
    <Tabs defaultValue="landing" className="min-h-screen bg-background">
      {/* Header */}
      <header className="sticky top-0 z-50 border-b border-border bg-background/95 backdrop-blur supports-[backdrop-filter]:bg-background/60">
        <div className="px-4 py-3">
          <h1 className="text-center text-lg font-semibold text-foreground">Page Templates Showcase</h1>
          <p className="text-center text-sm text-muted-foreground">Click a tab to view different page type templates</p>
        </div>
        <div className="overflow-x-auto px-4 pb-3">
          <TabsList className="mx-auto flex w-max gap-1">
            {templates.map((template) => (
              <TabsTrigger
                key={template.id}
                value={template.id}
                className="px-3 py-1.5 text-sm"
              >
                {template.label}
              </TabsTrigger>
            ))}
          </TabsList>
        </div>
      </header>
      
      {/* Template Content */}
      <main>
        {templates.map((template) => (
          <TabsContent key={template.id} value={template.id} className="mt-0 focus-visible:ring-0 focus-visible:ring-offset-0">
            <template.component />
          </TabsContent>
        ))}
      </main>
    </Tabs>
  )
}
