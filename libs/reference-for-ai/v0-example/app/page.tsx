import Link from 'next/link'
import { Button } from '@/components/ui/button'
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card'
import { Badge } from '@/components/ui/badge'
import { ArrowRight, CheckCircle2, Beaker, FlaskConical, Sparkles, Shield, Clock, Award } from 'lucide-react'

export default function Home() {
  return (
    <div className="flex min-h-screen flex-col">
      {/* Header */}
      <header className="sticky top-0 z-50 w-full border-b border-border/40 bg-background/95 backdrop-blur supports-[backdrop-filter]:bg-background/60">
        <div className="container flex h-16 items-center justify-between px-4 md:px-6">
          <Link href="/" className="flex items-center space-x-2">
            <Beaker className="h-6 w-6" />
            <span className="text-xl font-semibold">PeptideLab</span>
          </Link>
          <nav className="hidden items-center space-x-6 text-sm font-medium md:flex">
            <Link href="#services" className="transition-colors hover:text-foreground/80 text-foreground/60">
              Services
            </Link>
            <Link href="#specifications" className="transition-colors hover:text-foreground/80 text-foreground/60">
              Specifications
            </Link>
            <Link href="#modifications" className="transition-colors hover:text-foreground/80 text-foreground/60">
              Modifications
            </Link>
            <Link href="#about" className="transition-colors hover:text-foreground/80 text-foreground/60">
              About
            </Link>
          </nav>
          <Button>Request Quote</Button>
        </div>
      </header>

      {/* Hero Section */}
      <section className="w-full py-12 md:py-24 lg:py-32 xl:py-40 bg-background">
        <div className="container px-4 md:px-6">
          <div className="flex flex-col items-center space-y-8 text-center">
            <Badge variant="secondary" className="px-4 py-1.5">
              <span className="mr-1.5 inline-block h-1.5 w-1.5 rounded-full bg-accent"></span>
              30+ Years of Excellence in Peptide Synthesis
            </Badge>
            <div className="space-y-4 max-w-4xl">
              <h1 className="text-4xl font-bold tracking-tighter sm:text-5xl md:text-6xl lg:text-7xl text-balance">
                Custom Peptide Synthesis Excellence
              </h1>
              <p className="mx-auto max-w-[700px] text-muted-foreground text-lg md:text-xl text-balance leading-relaxed">
                Optimize your research with expert peptide synthesis services. From simple unmodified to highly modified and hydrophobic peptides, we deliver precision at scale.
              </p>
            </div>
            <div className="flex flex-col sm:flex-row gap-4">
              <Button size="lg" className="text-base">
                Request a Quote
                <ArrowRight className="ml-2 h-4 w-4" />
              </Button>
              <Button size="lg" variant="outline" className="text-base bg-transparent">
                View Specifications
              </Button>
            </div>
          </div>
        </div>
      </section>

      {/* Stats Section */}
      <section className="w-full py-12 bg-muted/30 border-y">
        <div className="container px-4 md:px-6">
          <div className="grid grid-cols-2 gap-8 md:grid-cols-4 text-center">
            <div className="space-y-2">
              <div className="text-3xl md:text-4xl font-bold">30+</div>
              <div className="text-sm text-muted-foreground">Years Experience</div>
            </div>
            <div className="space-y-2">
              <div className="text-3xl md:text-4xl font-bold">60</div>
              <div className="text-sm text-muted-foreground">Max Amino Acids</div>
            </div>
            <div className="space-y-2">
              <div className="text-3xl md:text-4xl font-bold">98%</div>
              <div className="text-sm text-muted-foreground">Purity Available</div>
            </div>
            <div className="space-y-2">
              <div className="text-3xl md:text-4xl font-bold">3-5</div>
              <div className="text-sm text-muted-foreground">Week Turnaround</div>
            </div>
          </div>
        </div>
      </section>

      {/* Specifications Section */}
      <section id="specifications" className="w-full py-16 md:py-24 bg-background">
        <div className="container px-4 md:px-6">
          <div className="space-y-12">
            <div className="text-center space-y-4">
              <Badge variant="outline">Technical Details</Badge>
              <h2 className="text-3xl font-bold tracking-tighter sm:text-4xl md:text-5xl">
                Custom Peptide Specifications
              </h2>
              <p className="mx-auto max-w-[700px] text-muted-foreground text-lg">
                Industry-leading capabilities with rigorous quality control standards
              </p>
            </div>

            <div className="grid gap-6 md:grid-cols-2">
              <Card>
                <CardHeader>
                  <CardTitle className="flex items-center gap-2">
                    <FlaskConical className="h-5 w-5" />
                    General Specifications
                  </CardTitle>
                </CardHeader>
                <CardContent className="space-y-4">
                  <div className="grid grid-cols-[120px_1fr] gap-y-3 text-sm">
                    <div className="font-medium">Length</div>
                    <div className="text-muted-foreground">Up to 60 amino acids</div>
                    
                    <div className="font-medium">Purity</div>
                    <div className="text-muted-foreground">70%, 85%, 90%, 95% (98% for GMP)</div>
                    
                    <div className="font-medium">Quantity</div>
                    <div className="text-muted-foreground">1 mg to hundreds of grams</div>
                    
                    <div className="font-medium">Counter-Ion</div>
                    <div className="text-muted-foreground">TFA (default), Acetate, Chloride, Ammonium</div>
                  </div>
                </CardContent>
              </Card>

              <Card>
                <CardHeader>
                  <CardTitle className="flex items-center gap-2">
                    <CheckCircle2 className="h-5 w-5" />
                    Quality Control Testing
                  </CardTitle>
                </CardHeader>
                <CardContent className="space-y-4">
                  <div className="space-y-3">
                    <div className="flex items-start gap-2">
                      <CheckCircle2 className="h-4 w-4 mt-0.5 text-accent flex-shrink-0" />
                      <div className="text-sm">
                        <div className="font-medium">Mass Spec Analysis</div>
                        <div className="text-muted-foreground">Complete identity verification</div>
                      </div>
                    </div>
                    <div className="flex items-start gap-2">
                      <CheckCircle2 className="h-4 w-4 mt-0.5 text-accent flex-shrink-0" />
                      <div className="text-sm">
                        <div className="font-medium">HPLC Analysis</div>
                        <div className="text-muted-foreground">Purity determination</div>
                      </div>
                    </div>
                    <div className="flex items-start gap-2">
                      <CheckCircle2 className="h-4 w-4 mt-0.5 text-accent flex-shrink-0" />
                      <div className="text-sm">
                        <div className="font-medium">Additional Testing Available</div>
                        <div className="text-muted-foreground">CHN, Solubility, Endotoxin, Bioburden</div>
                      </div>
                    </div>
                  </div>
                </CardContent>
              </Card>
            </div>
          </div>
        </div>
      </section>

      {/* Modifications Section */}
      <section id="modifications" className="w-full py-16 md:py-24 bg-muted/30">
        <div className="container px-4 md:px-6">
          <div className="space-y-12">
            <div className="text-center space-y-4">
              <Badge variant="outline">Expertise</Badge>
              <h2 className="text-3xl font-bold tracking-tighter sm:text-4xl md:text-5xl">
                Peptide Modification Experts
              </h2>
              <p className="mx-auto max-w-[700px] text-muted-foreground text-lg text-balance">
                We incorporate single or multiple modifications at N-terminus, C-terminus, or internally to meet your research needs
              </p>
            </div>

            <div className="grid gap-6 md:grid-cols-2 lg:grid-cols-3">
              <Card className="hover:shadow-lg transition-shadow">
                <CardHeader>
                  <Sparkles className="h-8 w-8 mb-2 text-accent" />
                  <CardTitle>Fluorescent Dye Labeled</CardTitle>
                  <CardDescription>
                    Premium fluorescent dyes spanning visible and near-infrared spectrum
                  </CardDescription>
                </CardHeader>
              </Card>

              <Card className="hover:shadow-lg transition-shadow">
                <CardHeader>
                  <FlaskConical className="h-8 w-8 mb-2 text-accent" />
                  <CardTitle>FRET Peptides</CardTitle>
                  <CardDescription>
                    Full range of dye-quencher FRET pairs for your applications
                  </CardDescription>
                </CardHeader>
              </Card>

              <Card className="hover:shadow-lg transition-shadow">
                <CardHeader>
                  <Sparkles className="h-8 w-8 mb-2 text-accent" />
                  <CardTitle>TR-FRET Peptides</CardTitle>
                  <CardDescription>
                    Lanthanide metal-labeled peptides for time-resolved applications
                  </CardDescription>
                </CardHeader>
              </Card>

              <Card className="hover:shadow-lg transition-shadow">
                <CardHeader>
                  <FlaskConical className="h-8 w-8 mb-2 text-accent" />
                  <CardTitle>Stapled Peptides</CardTitle>
                  <CardDescription>
                    Adaptable platform for versatile biological applications
                  </CardDescription>
                </CardHeader>
              </Card>

              <Card className="hover:shadow-lg transition-shadow">
                <CardHeader>
                  <Sparkles className="h-8 w-8 mb-2 text-accent" />
                  <CardTitle>Cyclic Peptides</CardTitle>
                  <CardDescription>
                    Lactam ring and disulfide-bridged peptide synthesis
                  </CardDescription>
                </CardHeader>
              </Card>

              <Card className="hover:shadow-lg transition-shadow">
                <CardHeader>
                  <FlaskConical className="h-8 w-8 mb-2 text-accent" />
                  <CardTitle>Glycosylated Peptides</CardTitle>
                  <CardDescription>
                    Sugar moieties at single or multiple locations
                  </CardDescription>
                </CardHeader>
              </Card>

              <Card className="hover:shadow-lg transition-shadow">
                <CardHeader>
                  <Sparkles className="h-8 w-8 mb-2 text-accent" />
                  <CardTitle>Lipopeptides</CardTitle>
                  <CardDescription>
                    Novel methods for hydrophobic peptide modifications
                  </CardDescription>
                </CardHeader>
              </Card>

              <Card className="hover:shadow-lg transition-shadow">
                <CardHeader>
                  <FlaskConical className="h-8 w-8 mb-2 text-accent" />
                  <CardTitle>Phosphorylated Peptides</CardTitle>
                  <CardDescription>
                    Single or multiple phosphoserine, tyrosine, or threonine residues
                  </CardDescription>
                </CardHeader>
              </Card>

              <Card className="hover:shadow-lg transition-shadow">
                <CardHeader>
                  <Sparkles className="h-8 w-8 mb-2 text-accent" />
                  <CardTitle>Isotope-Labeled Peptides</CardTitle>
                  <CardDescription>
                    Dedicated for quantitative mass spectrometry and NMR
                  </CardDescription>
                </CardHeader>
              </Card>
            </div>
          </div>
        </div>
      </section>

      {/* R&D to GMP Section */}
      <section className="w-full py-16 md:py-24 bg-background">
        <div className="container px-4 md:px-6">
          <div className="grid gap-12 lg:grid-cols-2 lg:gap-16 items-center">
            <div className="space-y-6">
              <Badge variant="outline">Development Lifecycle</Badge>
              <h2 className="text-3xl font-bold tracking-tighter sm:text-4xl md:text-5xl">
                R&D to GMP Manufacturing
              </h2>
              <p className="text-muted-foreground text-lg leading-relaxed">
                Ensure consistent quality and compliance throughout your peptide drug development lifecycle. We offer both R&D and GMP grade peptide manufacturing services.
              </p>
              <div className="space-y-4">
                <div className="flex items-start gap-3">
                  <Shield className="h-5 w-5 mt-0.5 text-accent flex-shrink-0" />
                  <div>
                    <div className="font-medium">Consistent Quality</div>
                    <div className="text-sm text-muted-foreground">Same high standards from research to production</div>
                  </div>
                </div>
                <div className="flex items-start gap-3">
                  <CheckCircle2 className="h-5 w-5 mt-0.5 text-accent flex-shrink-0" />
                  <div>
                    <div className="font-medium">Full Compliance</div>
                    <div className="text-sm text-muted-foreground">GMP-certified facilities and documentation</div>
                  </div>
                </div>
                <div className="flex items-start gap-3">
                  <Clock className="h-5 w-5 mt-0.5 text-accent flex-shrink-0" />
                  <div>
                    <div className="font-medium">Right Timing</div>
                    <div className="text-sm text-muted-foreground">Scalable production matching your timeline</div>
                  </div>
                </div>
              </div>
              <Button size="lg">Learn More About GMP Services</Button>
            </div>
            <div className="grid gap-4">
              <Card>
                <CardHeader>
                  <CardTitle>Research Grade</CardTitle>
                  <CardDescription>For discovery and early development</CardDescription>
                </CardHeader>
                <CardContent>
                  <ul className="space-y-2 text-sm">
                    <li className="flex items-center gap-2">
                      <CheckCircle2 className="h-4 w-4 text-accent" />
                      Flexible quantities (1 mg - 100g)
                    </li>
                    <li className="flex items-center gap-2">
                      <CheckCircle2 className="h-4 w-4 text-accent" />
                      Multiple purity grades
                    </li>
                    <li className="flex items-center gap-2">
                      <CheckCircle2 className="h-4 w-4 text-accent" />
                      Fast turnaround (3-5 weeks)
                    </li>
                  </ul>
                </CardContent>
              </Card>
              <Card>
                <CardHeader>
                  <CardTitle>GMP Grade</CardTitle>
                  <CardDescription>For clinical and commercial applications</CardDescription>
                </CardHeader>
                <CardContent>
                  <ul className="space-y-2 text-sm">
                    <li className="flex items-center gap-2">
                      <CheckCircle2 className="h-4 w-4 text-accent" />
                      Up to 98% purity
                    </li>
                    <li className="flex items-center gap-2">
                      <CheckCircle2 className="h-4 w-4 text-accent" />
                      Complete documentation
                    </li>
                    <li className="flex items-center gap-2">
                      <CheckCircle2 className="h-4 w-4 text-accent" />
                      Regulatory compliance
                    </li>
                  </ul>
                </CardContent>
              </Card>
            </div>
          </div>
        </div>
      </section>

      {/* Additional Services Section */}
      <section id="services" className="w-full py-16 md:py-24 bg-muted/30">
        <div className="container px-4 md:px-6">
          <div className="space-y-12">
            <div className="text-center space-y-4">
              <Badge variant="outline">Complete Solutions</Badge>
              <h2 className="text-3xl font-bold tracking-tighter sm:text-4xl md:text-5xl">
                Additional Services
              </h2>
            </div>

            <div className="grid gap-6 md:grid-cols-3">
              <Card>
                <CardHeader>
                  <CardTitle>Peptide Library Synthesis</CardTitle>
                  <CardDescription>
                    Custom peptide libraries for screening including overlapping peptides, alanine scanning, and positional scanning
                  </CardDescription>
                </CardHeader>
              </Card>

              <Card>
                <CardHeader>
                  <CardTitle>Peptide Conjugation</CardTitle>
                  <CardDescription>
                    Professional conjugation to KLH, BSA, or OVA via maleimide or succinimidyl ester for antibody development
                  </CardDescription>
                </CardHeader>
              </Card>

              <Card>
                <CardHeader>
                  <CardTitle>Peptide-Oligo Conjugates</CardTitle>
                  <CardDescription>
                    Produce up to 20 mg POCs in our specialized facilities for advanced applications
                  </CardDescription>
                </CardHeader>
              </Card>
            </div>
          </div>
        </div>
      </section>

      {/* Documentation Section */}
      <section className="w-full py-16 md:py-24 bg-background">
        <div className="container px-4 md:px-6">
          <div className="grid gap-8 md:grid-cols-3">
            <div className="space-y-3">
              <h3 className="text-xl font-semibold">Documentation</h3>
              <ul className="space-y-2 text-sm text-muted-foreground">
                <li className="flex items-start gap-2">
                  <CheckCircle2 className="h-4 w-4 mt-0.5 text-accent flex-shrink-0" />
                  HPLC & Mass Spec chromatograms
                </li>
                <li className="flex items-start gap-2">
                  <CheckCircle2 className="h-4 w-4 mt-0.5 text-accent flex-shrink-0" />
                  Technical data sheet (TDS)
                </li>
                <li className="flex items-start gap-2">
                  <CheckCircle2 className="h-4 w-4 mt-0.5 text-accent flex-shrink-0" />
                  Certificate of Analysis (CoA)
                </li>
              </ul>
            </div>
            <div className="space-y-3">
              <h3 className="text-xl font-semibold">Format & Delivery</h3>
              <ul className="space-y-2 text-sm text-muted-foreground">
                <li className="flex items-start gap-2">
                  <CheckCircle2 className="h-4 w-4 mt-0.5 text-accent flex-shrink-0" />
                  Lyophilized powder (standard)
                </li>
                <li className="flex items-start gap-2">
                  <CheckCircle2 className="h-4 w-4 mt-0.5 text-accent flex-shrink-0" />
                  Peptide in solution available
                </li>
                <li className="flex items-start gap-2">
                  <CheckCircle2 className="h-4 w-4 mt-0.5 text-accent flex-shrink-0" />
                  Ambient temperature shipping
                </li>
              </ul>
            </div>
            <div className="space-y-3">
              <h3 className="text-xl font-semibold">Lead Times</h3>
              <ul className="space-y-2 text-sm text-muted-foreground">
                <li className="flex items-start gap-2">
                  <Clock className="h-4 w-4 mt-0.5 text-accent flex-shrink-0" />
                  Standard: 3-5 weeks
                </li>
                <li className="flex items-start gap-2">
                  <Clock className="h-4 w-4 mt-0.5 text-accent flex-shrink-0" />
                  Modified peptides may require longer
                </li>
                <li className="flex items-start gap-2">
                  <Clock className="h-4 w-4 mt-0.5 text-accent flex-shrink-0" />
                  Rush services available on request
                </li>
              </ul>
            </div>
          </div>
        </div>
      </section>

      {/* CTA Section */}
      <section id="about" className="w-full py-16 md:py-24 bg-primary text-primary-foreground">
        <div className="container px-4 md:px-6">
          <div className="flex flex-col items-center space-y-6 text-center">
            <Award className="h-16 w-16" />
            <h2 className="text-3xl font-bold tracking-tighter sm:text-4xl md:text-5xl text-balance">
              Your Trusted Peptide Synthesis Partner
            </h2>
            <p className="mx-auto max-w-[700px] text-primary-foreground/90 text-lg text-balance">
              Benefit from over 30 years of experience in custom peptide synthesis. Let's start your peptide production today.
            </p>
            <div className="flex flex-col sm:flex-row gap-4">
              <Button size="lg" variant="secondary" className="text-base">
                Request a Quote
                <ArrowRight className="ml-2 h-4 w-4" />
              </Button>
              <Button size="lg" variant="outline" className="text-base bg-transparent border-primary-foreground text-primary-foreground hover:bg-primary-foreground hover:text-primary">
                Download Modification Guide
              </Button>
            </div>
          </div>
        </div>
      </section>

      {/* Footer */}
      <footer className="w-full border-t bg-muted/30 py-12">
        <div className="container px-4 md:px-6">
          <div className="grid gap-8 md:grid-cols-2 lg:grid-cols-4">
            <div className="space-y-3">
              <div className="flex items-center space-x-2">
                <Beaker className="h-5 w-5" />
                <span className="font-semibold">PeptideLab</span>
              </div>
              <p className="text-sm text-muted-foreground">
                Expert custom peptide synthesis for research and pharmaceutical applications.
              </p>
            </div>
            <div className="space-y-3">
              <h4 className="text-sm font-semibold">Services</h4>
              <ul className="space-y-2 text-sm text-muted-foreground">
                <li><Link href="#" className="hover:text-foreground transition-colors">Custom Synthesis</Link></li>
                <li><Link href="#" className="hover:text-foreground transition-colors">Modifications</Link></li>
                <li><Link href="#" className="hover:text-foreground transition-colors">GMP Manufacturing</Link></li>
                <li><Link href="#" className="hover:text-foreground transition-colors">Peptide Libraries</Link></li>
              </ul>
            </div>
            <div className="space-y-3">
              <h4 className="text-sm font-semibold">Resources</h4>
              <ul className="space-y-2 text-sm text-muted-foreground">
                <li><Link href="#" className="hover:text-foreground transition-colors">Technical Guides</Link></li>
                <li><Link href="#" className="hover:text-foreground transition-colors">Quality Standards</Link></li>
                <li><Link href="#" className="hover:text-foreground transition-colors">Case Studies</Link></li>
                <li><Link href="#" className="hover:text-foreground transition-colors">FAQs</Link></li>
              </ul>
            </div>
            <div className="space-y-3">
              <h4 className="text-sm font-semibold">Company</h4>
              <ul className="space-y-2 text-sm text-muted-foreground">
                <li><Link href="#" className="hover:text-foreground transition-colors">About Us</Link></li>
                <li><Link href="#" className="hover:text-foreground transition-colors">Contact</Link></li>
                <li><Link href="#" className="hover:text-foreground transition-colors">Certifications</Link></li>
                <li><Link href="#" className="hover:text-foreground transition-colors">Privacy Policy</Link></li>
              </ul>
            </div>
          </div>
          <div className="mt-12 border-t pt-8 text-center text-sm text-muted-foreground">
            <p>&copy; 2026 PeptideLab. All rights reserved. Custom peptide synthesis services.</p>
          </div>
        </div>
      </footer>
    </div>
  )
}
