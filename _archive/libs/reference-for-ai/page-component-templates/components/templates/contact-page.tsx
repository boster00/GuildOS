// ARCHIVED: Original path was libs/reference-for-ai/page-component-templates/components/templates/contact-page.tsx

"use client"

import { Button } from "@/components/ui/button"
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card"
import { Input } from "@/components/ui/input"
import { Textarea } from "@/components/ui/textarea"
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select"
import { Badge } from "@/components/ui/badge"
import { Mail, Phone, MapPin, Clock, MessageSquare, Headphones, Building } from "lucide-react"

export function ContactPageTemplate() {
  return (
    <div className="min-h-screen bg-background">
      {/* Contact Hero */}
      <section className="px-6 py-20 text-center">
        <Badge className="mb-4">Contact Us</Badge>
        <h1 className="text-3xl font-bold tracking-tight text-foreground sm:text-4xl text-balance">
          We'd Love to Hear From You
        </h1>
        <p className="mt-4 mx-auto max-w-2xl text-lg text-muted-foreground text-pretty">
          Have a question, feedback, or need help? Our team is here to assist you. Choose the best way to reach us below.
        </p>
      </section>

      {/* Contact Options */}
      <section className="px-6 pb-16">
        <div className="mx-auto max-w-5xl">
          <div className="grid gap-6 md:grid-cols-3">
            {[
              { icon: MessageSquare, title: "Chat with Us", desc: "Get instant answers via live chat", action: "Start Chat", available: "Available 24/7" },
              { icon: Headphones, title: "Call Us", desc: "Speak directly with our team", action: "1-800-123-4567", available: "Mon-Fri, 9am-6pm ET" },
              { icon: Mail, title: "Email Us", desc: "Send us a detailed message", action: "support@company.com", available: "Response within 24hrs" },
            ].map((option, i) => (
              <Card key={i} className="text-center">
                <CardHeader>
                  <div className="mx-auto flex h-12 w-12 items-center justify-center rounded-full bg-primary/10">
                    <option.icon className="h-6 w-6 text-primary" />
                  </div>
                  <CardTitle>{option.title}</CardTitle>
                  <CardDescription>{option.desc}</CardDescription>
                </CardHeader>
                <CardContent>
                  <Button variant="outline" className="w-full bg-transparent">{option.action}</Button>
                  <p className="mt-3 text-xs text-muted-foreground">{option.available}</p>
                </CardContent>
              </Card>
            ))}
          </div>
        </div>
      </section>

      {/* Contact Form */}
      <section className="border-t border-border bg-muted/50 px-6 py-16">
        <div className="mx-auto max-w-5xl grid gap-12 lg:grid-cols-2">
          <div>
            <h2 className="text-2xl font-semibold text-foreground">Send Us a Message</h2>
            <p className="mt-2 text-muted-foreground">Fill out the form and we'll get back to you as soon as possible.</p>
            <form className="mt-8 space-y-4">
              <div className="grid gap-4 sm:grid-cols-2">
                <Input placeholder="First Name" />
                <Input placeholder="Last Name" />
              </div>
              <Input placeholder="Email Address" type="email" />
              <Input placeholder="Company (Optional)" />
              <Select>
                <SelectTrigger>
                  <SelectValue placeholder="What can we help you with?" />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="sales">Sales Inquiry</SelectItem>
                  <SelectItem value="support">Technical Support</SelectItem>
                  <SelectItem value="billing">Billing Question</SelectItem>
                  <SelectItem value="partnership">Partnership Opportunity</SelectItem>
                  <SelectItem value="feedback">General Feedback</SelectItem>
                  <SelectItem value="other">Other</SelectItem>
                </SelectContent>
              </Select>
              <Textarea placeholder="Your Message" rows={5} />
              <Button size="lg">Send Message</Button>
            </form>
          </div>

          {/* Contact Details */}
          <div className="space-y-8">
            <div>
              <h3 className="font-semibold text-foreground">Contact Information</h3>
              <div className="mt-4 space-y-4">
                <div className="flex items-start gap-3">
                  <Mail className="h-5 w-5 text-primary mt-0.5" />
                  <div>
                    <p className="font-medium text-foreground">Email</p>
                    <p className="text-sm text-muted-foreground">support@company.com</p>
                    <p className="text-sm text-muted-foreground">sales@company.com</p>
                  </div>
                </div>
                <div className="flex items-start gap-3">
                  <Phone className="h-5 w-5 text-primary mt-0.5" />
                  <div>
                    <p className="font-medium text-foreground">Phone</p>
                    <p className="text-sm text-muted-foreground">1-800-123-4567 (Toll-free)</p>
                    <p className="text-sm text-muted-foreground">+1 (555) 123-4567 (International)</p>
                  </div>
                </div>
                <div className="flex items-start gap-3">
                  <Clock className="h-5 w-5 text-primary mt-0.5" />
                  <div>
                    <p className="font-medium text-foreground">Business Hours</p>
                    <p className="text-sm text-muted-foreground">Monday - Friday: 9am - 6pm ET</p>
                    <p className="text-sm text-muted-foreground">Saturday - Sunday: Closed</p>
                  </div>
                </div>
              </div>
            </div>

            {/* Social Links */}
            <div>
              <h3 className="font-semibold text-foreground">Follow Us</h3>
              <div className="mt-4 flex gap-3">
                {["Twitter", "LinkedIn", "GitHub", "YouTube"].map((social) => (
                  <Button key={social} variant="outline" size="sm">{social}</Button>
                ))}
              </div>
            </div>
          </div>
        </div>
      </section>

      {/* Office Locations */}
      <section className="px-6 py-16">
        <div className="mx-auto max-w-5xl">
          <h2 className="text-center text-2xl font-semibold text-foreground">Our Offices</h2>
          <p className="mt-2 text-center text-muted-foreground">Visit us at one of our global locations</p>
          <div className="mt-12 grid gap-6 md:grid-cols-3">
            {[
              { city: "San Francisco", address: "123 Market Street, Suite 400", country: "United States", type: "Headquarters" },
              { city: "London", address: "45 Old Broad Street", country: "United Kingdom", type: "EMEA Office" },
              { city: "Singapore", address: "1 Raffles Place, Tower 1", country: "Singapore", type: "APAC Office" },
            ].map((office, i) => (
              <Card key={i}>
                <CardHeader>
                  <div className="flex items-center gap-2">
                    <Building className="h-5 w-5 text-primary" />
                    {office.type === "Headquarters" && <Badge>HQ</Badge>}
                  </div>
                  <CardTitle>{office.city}</CardTitle>
                </CardHeader>
                <CardContent>
                  <div className="flex items-start gap-2 text-sm text-muted-foreground">
                    <MapPin className="h-4 w-4 shrink-0 mt-0.5" />
                    <div>
                      <p>{office.address}</p>
                      <p>{office.country}</p>
                    </div>
                  </div>
                  <Button variant="link" className="mt-2 p-0">Get Directions</Button>
                </CardContent>
              </Card>
            ))}
          </div>
        </div>
      </section>

      {/* FAQ */}
      <section className="border-t border-border bg-muted/50 px-6 py-16">
        <div className="mx-auto max-w-2xl">
          <h2 className="text-center text-2xl font-semibold text-foreground">Common Questions</h2>
          <div className="mt-8 space-y-6">
            {[
              { q: "How quickly will I hear back?", a: "We typically respond to all inquiries within 24 hours during business days." },
              { q: "Can I schedule a demo?", a: "Yes! Select 'Sales Inquiry' in the form above or email sales@company.com to book a personalized demo." },
              { q: "Do you offer phone support?", a: "Phone support is available for Pro and Enterprise plans. All customers have access to email and chat support." },
              { q: "Where can I find documentation?", a: "Visit our Help Center at help.company.com for guides, tutorials, and API documentation." },
            ].map((faq, i) => (
              <div key={i}>
                <h3 className="font-medium text-foreground">{faq.q}</h3>
                <p className="mt-1 text-sm text-muted-foreground">{faq.a}</p>
              </div>
            ))}
          </div>
        </div>
      </section>

      {/* CTA Confirmation Style */}
      <section className="px-6 py-16">
        <div className="mx-auto max-w-xl text-center">
          <h2 className="text-2xl font-semibold text-foreground">Still Have Questions?</h2>
          <p className="mt-2 text-muted-foreground">
            Can't find what you're looking for? Our support team is always happy to help.
          </p>
          <div className="mt-6 flex flex-col items-center gap-4 sm:flex-row sm:justify-center">
            <Button size="lg">Visit Help Center</Button>
            <Button variant="outline" size="lg">Start Live Chat</Button>
          </div>
        </div>
      </section>
    </div>
  )
}
