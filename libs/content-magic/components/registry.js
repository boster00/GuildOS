// Webpage Component Template Registry
// All template components extracted from reference templates
// Each component is a standalone <section> that can be inserted into the editor

export const COMPONENTS = {
  // ===== SINGLE COLUMN TEMPLATES =====
  'hero-centered': {
    id: 'hero-centered',
    name: 'Hero - Centered',
    columnStructure: 'single',
    useCases: ['Homepage', 'Landing Page'],
    category: 'hero',
    pageTypes: ['homepage', 'landing-page'],
    html: `<section class="default-template px-6 py-24">
  <div class="mx-auto max-w-4xl text-center">
    <h1 class="text-4xl font-bold tracking-tight text-foreground sm:text-5xl text-balance">
      The Platform for Modern Business Operations
    </h1>
    <p class="mt-6 text-lg text-muted-foreground text-pretty">
      Streamline your workflow, collaborate seamlessly, and scale your operations with confidence.
    </p>
    <div class="mt-8 flex flex-col items-center gap-4 sm:flex-row sm:justify-center">
      <button class="inline-flex items-center justify-center gap-2 whitespace-nowrap rounded-md text-sm font-medium ring-offset-background transition-colors focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring focus-visible:ring-offset-2 disabled:pointer-events-none disabled:opacity-50 bg-primary text-primary-foreground hover:bg-primary/90 h-11 px-8">
        Explore Products
      </button>
      <button class="inline-flex items-center justify-center gap-2 whitespace-nowrap rounded-md text-sm font-medium ring-offset-background transition-colors focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring focus-visible:ring-offset-2 disabled:pointer-events-none disabled:opacity-50 border border-input bg-background hover:bg-accent hover:text-accent-foreground h-11 px-8">
        Contact Sales
      </button>
    </div>
  </div>
</section>`,
    placeholders: {
      'The Platform for Modern Business Operations': 'main headline',
      'Streamline your workflow, collaborate seamlessly, and scale your operations with confidence.': 'subheadline or value proposition',
      'Explore Products': 'primary CTA text',
      'Contact Sales': 'secondary CTA text'
    }
  },

  // ===== 2-COLUMN TEMPLATES =====
  'hero-product-split': {
    id: 'hero-product-split',
    name: 'Hero - Product Split Layout',
    columnStructure: 'two-column',
    useCases: ['Product Page', 'Use Case Page'],
    category: 'hero',
    pageTypes: ['product-page', 'use-case-page'],
    html: `<section class="default-template px-6 py-20">
  <div class="mx-auto max-w-5xl grid gap-12 md:grid-cols-2 md:items-center">
    <div>
      <span class="inline-flex items-center rounded-full border px-2.5 py-0.5 text-xs font-semibold transition-colors focus:outline-none focus:ring-2 focus:ring-ring focus:ring-offset-2 border-transparent bg-primary text-primary-foreground hover:bg-primary/80">New Release</span>
      <h1 class="text-3xl font-bold tracking-tight text-foreground sm:text-4xl text-balance mt-4">
        Workflow Automation Pro
      </h1>
      <p class="mt-4 text-lg text-muted-foreground text-pretty">
        Automate repetitive tasks, streamline processes, and boost your team's productivity by 10x.
      </p>
      <div class="mt-8 flex gap-4">
        <button class="inline-flex items-center justify-center gap-2 whitespace-nowrap rounded-md text-sm font-medium ring-offset-background transition-colors focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring focus-visible:ring-offset-2 disabled:pointer-events-none disabled:opacity-50 bg-primary text-primary-foreground hover:bg-primary/90 h-11 px-8">Start Free Trial</button>
        <button class="inline-flex items-center justify-center gap-2 whitespace-nowrap rounded-md text-sm font-medium ring-offset-background transition-colors focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring focus-visible:ring-offset-2 disabled:pointer-events-none disabled:opacity-50 border border-input bg-background hover:bg-accent hover:text-accent-foreground h-11 px-8">View Demo</button>
      </div>
    </div>
    <div class="aspect-video rounded-lg bg-muted flex items-center justify-center">
      <span class="text-muted-foreground">Product Demo</span>
    </div>
  </div>
</section>`,
    placeholders: {
      'New Release': 'badge text',
      'Workflow Automation Pro': 'product name',
      'Automate repetitive tasks, streamline processes, and boost your team\'s productivity by 10x.': 'product description',
      'Product Demo': 'image placeholder text'
    }
  },

  'hero-resource-split': {
    id: 'hero-resource-split',
    name: 'Hero - Resource Download Split',
    columnStructure: 'two-column',
    useCases: ['Resource Page'],
    category: 'hero',
    pageTypes: ['resource-page'],
    html: `<section class="default-template px-6 py-20">
  <div class="mx-auto max-w-5xl grid gap-12 md:grid-cols-2 md:items-center">
    <div>
      <span class="inline-flex items-center rounded-full border px-2.5 py-0.5 text-xs font-semibold transition-colors focus:outline-none focus:ring-2 focus:ring-ring focus:ring-offset-2 border-transparent bg-primary text-primary-foreground hover:bg-primary/80 mb-4">Free Download</span>
      <h1 class="text-3xl font-bold tracking-tight text-foreground sm:text-4xl text-balance">
        The Ultimate Workflow Automation Playbook
      </h1>
      <p class="mt-4 text-lg text-muted-foreground text-pretty">
        A comprehensive 50-page guide to implementing automation in your organization. Includes templates, checklists, and real-world examples.
      </p>
      <div class="mt-6 flex flex-wrap gap-2">
        <span class="inline-flex items-center rounded-full border px-2.5 py-0.5 text-xs font-semibold transition-colors focus:outline-none focus:ring-2 focus:ring-ring focus:ring-offset-2 text-foreground">PDF Guide</span>
        <span class="inline-flex items-center rounded-full border px-2.5 py-0.5 text-xs font-semibold transition-colors focus:outline-none focus:ring-2 focus:ring-ring focus:ring-offset-2 text-foreground">50 Pages</span>
        <span class="inline-flex items-center rounded-full border px-2.5 py-0.5 text-xs font-semibold transition-colors focus:outline-none focus:ring-2 focus:ring-ring focus:ring-offset-2 text-foreground">10+ Templates</span>
      </div>
    </div>
    <div class="aspect-[3/4] rounded-lg bg-muted flex items-center justify-center border border-border shadow-lg">
      <span class="text-muted-foreground">Resource Preview</span>
    </div>
  </div>
</section>`,
    placeholders: {
      'The Ultimate Workflow Automation Playbook': 'resource title',
      'A comprehensive 50-page guide to implementing automation in your organization. Includes templates, checklists, and real-world examples.': 'resource description',
      'PDF Guide': 'format badge',
      '50 Pages': 'length badge',
      '10+ Templates': 'bonus content badge'
    }
  },

  'hero-about': {
    id: 'hero-about',
    name: 'Hero - About Page',
    columnStructure: 'single',
    useCases: ['About Page', 'Contact Page', 'Comparison Page'],
    category: 'hero',
    pageTypes: ['about-page', 'contact-page', 'comparison-page'],
    html: `<section class="default-template px-6 py-20 text-center">
  <span class="inline-flex items-center rounded-full border px-2.5 py-0.5 text-xs font-semibold transition-colors focus:outline-none focus:ring-2 focus:ring-ring focus:ring-offset-2 border-transparent bg-primary text-primary-foreground hover:bg-primary/80 mb-4">About Us</span>
  <h1 class="text-3xl font-bold tracking-tight text-foreground sm:text-4xl text-balance">
    Making Work Better for Everyone
  </h1>
  <p class="mt-4 mx-auto max-w-2xl text-lg text-muted-foreground text-pretty">
    We believe that automation should empower people, not replace them. Our mission is to free teams from repetitive work so they can focus on what matters most.
  </p>
</section>`,
    placeholders: {
      'Making Work Better for Everyone': 'mission statement headline',
      'We believe that automation should empower people, not replace them. Our mission is to free teams from repetitive work so they can focus on what matters most.': 'mission statement description'
    }
  },

  'hero-article': {
    id: 'hero-article',
    name: 'Hero - Article/Content Page',
    columnStructure: 'single',
    useCases: ['Content Page'],
    category: 'hero',
    pageTypes: ['content-page'],
    html: `<section class="default-template border-b border-border px-6 py-12">
  <div class="mx-auto max-w-3xl">
    <span class="inline-flex items-center rounded-full border px-2.5 py-0.5 text-xs font-semibold transition-colors focus:outline-none focus:ring-2 focus:ring-ring focus:ring-offset-2 border-transparent bg-primary text-primary-foreground hover:bg-primary/80">Guide</span>
    <h1 class="mt-4 text-3xl font-bold tracking-tight text-foreground sm:text-4xl text-balance">
      The Complete Guide to Workflow Automation in 2024
    </h1>
    <p class="mt-4 text-lg text-muted-foreground text-pretty">
      Learn how to automate your business processes, save time, and scale your operations with our comprehensive guide.
    </p>
    <div class="mt-6 flex flex-wrap items-center gap-4 text-sm text-muted-foreground">
      <span>John Doe</span>
      <span>Jan 15, 2024</span>
      <span>12 min read</span>
    </div>
  </div>
</section>`,
    placeholders: {
      'Guide': 'content type badge',
      'The Complete Guide to Workflow Automation in 2024': 'article title',
      'Learn how to automate your business processes, save time, and scale your operations with our comprehensive guide.': 'article description',
      'John Doe': 'author name',
      'Jan 15, 2024': 'publish date',
      '12 min read': 'reading time'
    }
  },

  // ===== 3+ COLUMN TEMPLATES =====
  'features-grid-3col': {
    id: 'features-grid-3col',
    name: 'Features - 3 Column Grid',
    columnStructure: 'multi-column',
    useCases: ['Homepage', 'Landing Page', 'Product Page', 'About Page'],
    category: 'features',
    pageTypes: ['homepage', 'landing-page', 'product-page', 'about-page'],
    html: `<section class="default-template border-t border-border bg-muted/50 px-6 py-16">
  <div class="mx-auto max-w-5xl">
    <h2 class="text-center text-2xl font-semibold text-foreground">Our Products</h2>
    <div class="mt-12 grid gap-6 md:grid-cols-3">
      <div class="rounded-lg border bg-card text-card-foreground shadow-sm cursor-pointer transition-shadow hover:shadow-lg">
        <div class="flex flex-col space-y-1.5 p-6">
          <svg class="h-8 w-8 text-primary" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M19 21V5a2 2 0 00-2-2H7a2 2 0 00-2 2v16m14 0h2m-2 0h-5m-9 0H3m2 0h5M9 7h1m-1 4h1m4-4h1m-1 4h1m-5 10v-5a1 1 0 011-1h2a1 1 0 011 1v5m-4 0h4"></path></svg>
          <h3 class="text-2xl font-semibold leading-none tracking-tight mt-2">Enterprise Suite</h3>
          <p class="text-sm text-muted-foreground">Full-featured platform for large organizations</p>
        </div>
        <div class="p-6 pt-0">
          <button class="inline-flex items-center justify-center gap-2 whitespace-nowrap text-sm font-medium transition-colors focus-visible:outline-none disabled:pointer-events-none disabled:opacity-50 underline-offset-4 hover:underline text-primary h-10 px-4 py-2 p-0">Learn more</button>
        </div>
      </div>
      <div class="rounded-lg border bg-card text-card-foreground shadow-sm cursor-pointer transition-shadow hover:shadow-lg">
        <div class="flex flex-col space-y-1.5 p-6">
          <svg class="h-8 w-8 text-primary" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M17 20h5v-2a3 3 0 00-5.356-1.857M17 20H7m10 0v-2c0-.656-.126-1.283-.356-1.857M7 20H2v-2a3 3 0 015.356-1.857M7 20v-2c0-.656.126-1.283.356-1.857m0 0a5.002 5.002 0 019.288 0M15 7a3 3 0 11-6 0 3 3 0 016 0zm6 3a2 2 0 11-4 0 2 2 0 014 0zM7 10a2 2 0 11-4 0 2 2 0 014 0z"></path></svg>
          <h3 class="text-2xl font-semibold leading-none tracking-tight mt-2">Team Workspace</h3>
          <p class="text-sm text-muted-foreground">Collaboration tools for growing teams</p>
        </div>
        <div class="p-6 pt-0">
          <button class="inline-flex items-center justify-center gap-2 whitespace-nowrap text-sm font-medium transition-colors focus-visible:outline-none disabled:pointer-events-none disabled:opacity-50 underline-offset-4 hover:underline text-primary h-10 px-4 py-2 p-0">Learn more</button>
        </div>
      </div>
      <div class="rounded-lg border bg-card text-card-foreground shadow-sm cursor-pointer transition-shadow hover:shadow-lg">
        <div class="flex flex-col space-y-1.5 p-6">
          <svg class="h-8 w-8 text-primary" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M21 13.255A23.931 23.931 0 0112 15c-3.183 0-6.22-.62-9-1.745M16 6V4a2 2 0 00-2-2h-4a2 2 0 00-2 2v2m4 6h.01M5 20h14a2 2 0 002-2V8a2 2 0 00-2-2H5a2 2 0 00-2 2v10a2 2 0 002 2z"></path></svg>
          <h3 class="text-2xl font-semibold leading-none tracking-tight mt-2">Professional Tools</h3>
          <p class="text-sm text-muted-foreground">Individual productivity solutions</p>
        </div>
        <div class="p-6 pt-0">
          <button class="inline-flex items-center justify-center gap-2 whitespace-nowrap text-sm font-medium transition-colors focus-visible:outline-none disabled:pointer-events-none disabled:opacity-50 underline-offset-4 hover:underline text-primary h-10 px-4 py-2 p-0">Learn more</button>
        </div>
      </div>
    </div>
  </div>
</section>`,
    placeholders: {
      'Our Products': 'section heading',
      'Enterprise Suite': 'product 1 name',
      'Full-featured platform for large organizations': 'product 1 description',
      'Team Workspace': 'product 2 name',
      'Collaboration tools for growing teams': 'product 2 description',
      'Professional Tools': 'product 3 name',
      'Individual productivity solutions': 'product 3 description'
    }
  },

  'features-grid-4col': {
    id: 'features-grid-4col',
    name: 'Features - 4 Column Grid',
    columnStructure: 'multi-column',
    useCases: ['Product Page'],
    category: 'features',
    pageTypes: ['product-page'],
    html: `<section class="default-template border-t border-border bg-muted/50 px-6 py-16">
  <div class="mx-auto max-w-5xl">
    <h2 class="text-center text-2xl font-semibold text-foreground">Powerful Features</h2>
    <div class="mt-12 grid gap-8 md:grid-cols-2 lg:grid-cols-4">
      <div class="text-center">
        <div class="mx-auto flex h-12 w-12 items-center justify-center rounded-lg bg-primary/10">
          <svg class="h-6 w-6 text-primary" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M13 10V3L4 14h7v7l9-11h-7z"></path></svg>
        </div>
        <h3 class="mt-4 font-semibold text-foreground">Lightning Fast</h3>
        <p class="mt-2 text-sm text-muted-foreground">Execute workflows in milliseconds</p>
      </div>
      <div class="text-center">
        <div class="mx-auto flex h-12 w-12 items-center justify-center rounded-lg bg-primary/10">
          <svg class="h-6 w-6 text-primary" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M9 12l2 2 4-4m5.618-4.016A11.955 11.955 0 0112 2.944a11.955 11.955 0 01-8.618 3.04A12.02 12.02 0 003 9c0 5.591 3.824 10.29 9 11.622 5.176-1.332 9-6.03 9-11.622 0-1.042-.133-2.052-.382-3.016z"></path></svg>
        </div>
        <h3 class="mt-4 font-semibold text-foreground">Secure by Design</h3>
        <p class="mt-2 text-sm text-muted-foreground">Enterprise-grade encryption</p>
      </div>
      <div class="text-center">
        <div class="mx-auto flex h-12 w-12 items-center justify-center rounded-lg bg-primary/10">
          <svg class="h-6 w-6 text-primary" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M12 8v4l3 3m6-3a9 9 0 11-18 0 9 9 0 0118 0z"></path></svg>
        </div>
        <h3 class="mt-4 font-semibold text-foreground">Real-time Sync</h3>
        <p class="mt-2 text-sm text-muted-foreground">Always up-to-date data</p>
      </div>
      <div class="text-center">
        <div class="mx-auto flex h-12 w-12 items-center justify-center rounded-lg bg-primary/10">
          <svg class="h-6 w-6 text-primary" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M17 20h5v-2a3 3 0 00-5.356-1.857M17 20H7m10 0v-2c0-.656-.126-1.283-.356-1.857M7 20H2v-2a3 3 0 015.356-1.857M7 20v-2c0-.656.126-1.283.356-1.857m0 0a5.002 5.002 0 019.288 0M15 7a3 3 0 11-6 0 3 3 0 016 0zm6 3a2 2 0 11-4 0 2 2 0 014 0zM7 10a2 2 0 11-4 0 2 2 0 014 0z"></path></svg>
        </div>
        <h3 class="mt-4 font-semibold text-foreground">Team Collaboration</h3>
        <p class="mt-2 text-sm text-muted-foreground">Built for teams of any size</p>
      </div>
    </div>
  </div>
</section>`,
    placeholders: {
      'Powerful Features': 'section title',
      'Lightning Fast': 'feature 1 name',
      'Execute workflows in milliseconds': 'feature 1 description',
      'Secure by Design': 'feature 2 name',
      'Real-time Sync': 'feature 3 name',
      'Team Collaboration': 'feature 4 name'
    }
  },

  'problem-pain-centered': {
    id: 'problem-pain-centered',
    name: 'Problem/Pain - Centered',
    columnStructure: 'single',
    useCases: ['Landing Page', 'Use Case Page'],
    category: 'problem',
    pageTypes: ['landing-page', 'use-case-page'],
    html: `<section class="default-template border-t border-border bg-muted/50 px-6 py-16">
  <div class="mx-auto max-w-4xl text-center">
    <h2 class="text-2xl font-semibold text-foreground">Still Managing Tasks Manually?</h2>
    <p class="mt-4 text-muted-foreground">
      Teams lose 40% of their time on repetitive tasks that could be automated. That's 2 full days every week—gone.
    </p>
  </div>
</section>`,
    placeholders: {
      'Still Managing Tasks Manually?': 'problem statement headline',
      'Teams lose 40% of their time on repetitive tasks that could be automated. That\'s 2 full days every week—gone.': 'pain point description'
    }
  },

  'problem-pain-2col-grid': {
    id: 'problem-pain-2col-grid',
    name: 'Problem/Pain - 2 Column Grid',
    columnStructure: 'two-column',
    useCases: ['Use Case Page'],
    category: 'problem',
    pageTypes: ['use-case-page'],
    html: `<section class="default-template border-t border-border bg-muted/50 px-6 py-16">
  <div class="mx-auto max-w-4xl">
    <h2 class="text-center text-2xl font-semibold text-foreground">Sound Familiar?</h2>
    <p class="mt-2 text-center text-muted-foreground">Marketing teams face these challenges every day</p>
    <div class="mt-12 grid gap-6 md:grid-cols-2">
      <div class="flex items-start gap-4 rounded-lg border border-border bg-background p-4">
        <svg class="h-6 w-6 shrink-0 text-destructive" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M12 9v2m0 4h.01m-6.938 4h13.856c1.54 0 2.502-1.667 1.732-3L13.732 4c-.77-1.333-2.694-1.333-3.464 0L3.34 16c-.77 1.333.192 3 1.732 3z"></path></svg>
        <p class="text-sm text-muted-foreground">Hours spent manually pulling campaign data from multiple platforms</p>
      </div>
      <div class="flex items-start gap-4 rounded-lg border border-border bg-background p-4">
        <svg class="h-6 w-6 shrink-0 text-destructive" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M12 9v2m0 4h.01m-6.938 4h13.856c1.54 0 2.502-1.667 1.732-3L13.732 4c-.77-1.333-2.694-1.333-3.464 0L3.34 16c-.77 1.333.192 3 1.732 3z"></path></svg>
        <p class="text-sm text-muted-foreground">Leads falling through the cracks due to slow response times</p>
      </div>
      <div class="flex items-start gap-4 rounded-lg border border-border bg-background p-4">
        <svg class="h-6 w-6 shrink-0 text-destructive" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M12 9v2m0 4h.01m-6.938 4h13.856c1.54 0 2.502-1.667 1.732-3L13.732 4c-.77-1.333-2.694-1.333-3.464 0L3.34 16c-.77 1.333.192 3 1.732 3z"></path></svg>
        <p class="text-sm text-muted-foreground">Inconsistent reporting that takes days to compile</p>
      </div>
      <div class="flex items-start gap-4 rounded-lg border border-border bg-background p-4">
        <svg class="h-6 w-6 shrink-0 text-destructive" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M12 9v2m0 4h.01m-6.938 4h13.856c1.54 0 2.502-1.667 1.732-3L13.732 4c-.77-1.333-2.694-1.333-3.464 0L3.34 16c-.77 1.333.192 3 1.732 3z"></path></svg>
        <p class="text-sm text-muted-foreground">Repetitive tasks that drain creative energy</p>
      </div>
    </div>
  </div>
</section>`,
    placeholders: {
      'Sound Familiar?': 'section heading',
      'Marketing teams face these challenges every day': 'section subheading',
      'Hours spent manually pulling campaign data from multiple platforms': 'pain point 1',
      'Leads falling through the cracks due to slow response times': 'pain point 2',
      'Inconsistent reporting that takes days to compile': 'pain point 3',
      'Repetitive tasks that drain creative energy': 'pain point 4'
    }
  },

  'benefits-split-image': {
    id: 'benefits-split-image',
    name: 'Benefits - Split with Image',
    columnStructure: 'two-column',
    useCases: ['Homepage'],
    category: 'benefits',
    pageTypes: ['homepage'],
    html: `<section class="default-template px-6 py-16">
  <div class="mx-auto max-w-5xl">
    <div class="grid gap-12 md:grid-cols-2 md:items-center">
      <div>
        <h2 class="text-2xl font-semibold text-foreground">Why Choose Us?</h2>
        <ul class="mt-6 space-y-4">
          <li class="flex items-center gap-3 text-muted-foreground">
            <div class="h-2 w-2 rounded-full bg-primary"></div>
            Trusted by 50,000+ businesses worldwide
          </li>
          <li class="flex items-center gap-3 text-muted-foreground">
            <div class="h-2 w-2 rounded-full bg-primary"></div>
            99.9% uptime guarantee
          </li>
          <li class="flex items-center gap-3 text-muted-foreground">
            <div class="h-2 w-2 rounded-full bg-primary"></div>
            24/7 dedicated support
          </li>
          <li class="flex items-center gap-3 text-muted-foreground">
            <div class="h-2 w-2 rounded-full bg-primary"></div>
            Enterprise-grade security
          </li>
        </ul>
      </div>
      <div class="aspect-video rounded-lg bg-muted flex items-center justify-center">
        <span class="text-muted-foreground">Product Screenshot</span>
      </div>
    </div>
  </div>
</section>`,
    placeholders: {
      'Why Choose Us?': 'section title',
      'Trusted by 50,000+ businesses worldwide': 'benefit 1',
      '99.9% uptime guarantee': 'benefit 2',
      '24/7 dedicated support': 'benefit 3',
      'Enterprise-grade security': 'benefit 4',
      'Product Screenshot': 'image description'
    }
  },

  'benefits-before-after': {
    id: 'benefits-before-after',
    name: 'Benefits - Before/After Cards',
    columnStructure: 'two-column',
    useCases: ['Product Page'],
    category: 'benefits',
    pageTypes: ['product-page'],
    html: `<section class="default-template px-6 py-16">
  <div class="mx-auto max-w-4xl">
    <h2 class="text-center text-2xl font-semibold text-foreground">What You'll Achieve</h2>
    <div class="mt-12 grid gap-6 md:grid-cols-2">
      <div class="rounded-lg border bg-card text-card-foreground shadow-sm">
        <div class="flex flex-col space-y-1.5 p-6">
          <h3 class="text-2xl font-semibold leading-none tracking-tight">Before</h3>
          <p class="text-sm text-muted-foreground">Without automation</p>
        </div>
        <div class="p-6 pt-0 space-y-3">
          <p class="text-sm text-muted-foreground">• Hours spent on manual data entry</p>
          <p class="text-sm text-muted-foreground">• Inconsistent processes across teams</p>
          <p class="text-sm text-muted-foreground">• Delayed responses to customers</p>
          <p class="text-sm text-muted-foreground">• Error-prone repetitive tasks</p>
        </div>
      </div>
      <div class="rounded-lg border border-primary bg-card text-card-foreground shadow-sm">
        <div class="flex flex-col space-y-1.5 p-6">
          <h3 class="text-2xl font-semibold leading-none tracking-tight">After</h3>
          <p class="text-sm text-muted-foreground">With Workflow Pro</p>
        </div>
        <div class="p-6 pt-0 space-y-3">
          <p class="flex items-center gap-2 text-sm text-foreground">
            <svg class="h-4 w-4 text-primary" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M5 13l4 4L19 7"></path></svg>
            90% reduction in manual work
          </p>
          <p class="flex items-center gap-2 text-sm text-foreground">
            <svg class="h-4 w-4 text-primary" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M5 13l4 4L19 7"></path></svg>
            Standardized workflows company-wide
          </p>
          <p class="flex items-center gap-2 text-sm text-foreground">
            <svg class="h-4 w-4 text-primary" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M5 13l4 4L19 7"></path></svg>
            Instant automated responses
          </p>
          <p class="flex items-center gap-2 text-sm text-foreground">
            <svg class="h-4 w-4 text-primary" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M5 13l4 4L19 7"></path></svg>
            99.9% accuracy on all tasks
          </p>
        </div>
      </div>
    </div>
  </div>
</section>`,
    placeholders: {
      'What You\'ll Achieve': 'section title',
      'Workflow Pro': 'product name',
      'Hours spent on manual data entry': 'before state 1',
      '90% reduction in manual work': 'after state 1'
    }
  },

  'benefits-metrics': {
    id: 'benefits-metrics',
    name: 'Benefits - Metric Stats',
    columnStructure: 'multi-column',
    useCases: ['Use Case Page'],
    category: 'benefits',
    pageTypes: ['use-case-page'],
    html: `<section class="default-template border-t border-border bg-muted/50 px-6 py-16">
  <div class="mx-auto max-w-4xl">
    <h2 class="text-center text-2xl font-semibold text-foreground">The Results You'll See</h2>
    <div class="mt-12 grid gap-8 md:grid-cols-4 text-center">
      <div>
        <div class="text-4xl font-bold text-primary">70%</div>
        <p class="mt-2 text-sm text-muted-foreground">Less time on manual tasks</p>
      </div>
      <div>
        <div class="text-4xl font-bold text-primary">3x</div>
        <p class="mt-2 text-sm text-muted-foreground">Faster lead response</p>
      </div>
      <div>
        <div class="text-4xl font-bold text-primary">50%</div>
        <p class="mt-2 text-sm text-muted-foreground">Reduction in reporting time</p>
      </div>
      <div>
        <div class="text-4xl font-bold text-primary">25%</div>
        <p class="mt-2 text-sm text-muted-foreground">Increase in campaign ROI</p>
      </div>
    </div>
  </div>
</section>`,
    placeholders: {
      'The Results You\'ll See': 'section title',
      '70%': 'metric 1 value',
      'Less time on manual tasks': 'metric 1 label',
      '3x': 'metric 2 value',
      'Faster lead response': 'metric 2 label'
    }
  },

  'how-it-works-3step': {
    id: 'how-it-works-3step',
    name: 'How It Works - 3 Step Grid',
    columnStructure: 'multi-column',
    useCases: ['Landing Page'],
    category: 'how-it-works',
    pageTypes: ['landing-page'],
    html: `<section class="default-template border-t border-border bg-muted/50 px-6 py-16">
  <div class="mx-auto max-w-4xl">
    <h2 class="text-center text-2xl font-semibold text-foreground">How It Works</h2>
    <div class="mt-12 grid gap-6 md:grid-cols-3">
      <div class="text-center">
        <div class="mx-auto flex h-12 w-12 items-center justify-center rounded-full bg-primary text-primary-foreground font-bold">
          1
        </div>
        <h3 class="mt-4 font-semibold text-foreground">Connect</h3>
        <p class="mt-2 text-sm text-muted-foreground">Link your existing tools and apps</p>
      </div>
      <div class="text-center">
        <div class="mx-auto flex h-12 w-12 items-center justify-center rounded-full bg-primary text-primary-foreground font-bold">
          2
        </div>
        <h3 class="mt-4 font-semibold text-foreground">Automate</h3>
        <p class="mt-2 text-sm text-muted-foreground">Build workflows with drag-and-drop</p>
      </div>
      <div class="text-center">
        <div class="mx-auto flex h-12 w-12 items-center justify-center rounded-full bg-primary text-primary-foreground font-bold">
          3
        </div>
        <h3 class="mt-4 font-semibold text-foreground">Scale</h3>
        <p class="mt-2 text-sm text-muted-foreground">Watch your productivity skyrocket</p>
      </div>
    </div>
  </div>
</section>`,
    placeholders: {
      'How It Works': 'section title',
      'Connect': 'step 1 title',
      'Link your existing tools and apps': 'step 1 description',
      'Automate': 'step 2 title',
      'Scale': 'step 3 title'
    }
  },

  'how-it-works-vertical': {
    id: 'how-it-works-vertical',
    name: 'How It Works - Vertical List',
    columnStructure: 'single',
    useCases: ['Product Page'],
    category: 'how-it-works',
    pageTypes: ['product-page'],
    html: `<section class="default-template border-t border-border bg-muted/50 px-6 py-16">
  <div class="mx-auto max-w-4xl">
    <h2 class="text-center text-2xl font-semibold text-foreground">How It Works</h2>
    <div class="mt-12 space-y-8">
      <div class="flex gap-6">
        <div class="flex h-10 w-10 shrink-0 items-center justify-center rounded-full bg-primary text-primary-foreground font-bold">
          1
        </div>
        <div>
          <h3 class="font-semibold text-foreground">Connect Your Apps</h3>
          <p class="mt-1 text-muted-foreground">Integrate with 200+ popular tools and services in just a few clicks.</p>
        </div>
      </div>
      <div class="flex gap-6">
        <div class="flex h-10 w-10 shrink-0 items-center justify-center rounded-full bg-primary text-primary-foreground font-bold">
          2
        </div>
        <div>
          <h3 class="font-semibold text-foreground">Build Your Workflow</h3>
          <p class="mt-1 text-muted-foreground">Use our visual builder to create automation rules—no coding required.</p>
        </div>
      </div>
      <div class="flex gap-6">
        <div class="flex h-10 w-10 shrink-0 items-center justify-center rounded-full bg-primary text-primary-foreground font-bold">
          3
        </div>
        <div>
          <h3 class="font-semibold text-foreground">Activate & Monitor</h3>
          <p class="mt-1 text-muted-foreground">Turn on your workflows and track performance in real-time.</p>
        </div>
      </div>
    </div>
  </div>
</section>`,
    placeholders: {
      'Connect Your Apps': 'step 1 title',
      'Integrate with 200+ popular tools and services in just a few clicks.': 'step 1 description'
    }
  },

  'testimonials-2col': {
    id: 'testimonials-2col',
    name: 'Testimonials - 2 Column Cards',
    columnStructure: 'two-column',
    useCases: ['Homepage', 'Comparison Page'],
    category: 'testimonials',
    pageTypes: ['homepage', 'comparison-page'],
    html: `<section class="default-template px-6 py-16">
  <div class="mx-auto max-w-4xl">
    <h2 class="text-center text-2xl font-semibold text-foreground">What Our Customers Say</h2>
    <div class="mt-12 grid gap-6 md:grid-cols-2">
      <div class="rounded-lg border bg-card text-card-foreground shadow-sm">
        <div class="p-6 pt-6">
          <div class="flex gap-1">
            <svg class="h-4 w-4 fill-primary text-primary" viewBox="0 0 24 24"><path d="M12 .587l3.668 7.568L24 9.423l-6 5.847 1.417 8.145L12 18.897l-7.417 4.518L6 15.27 0 9.423l8.332-1.268z"></path></svg>
            <svg class="h-4 w-4 fill-primary text-primary" viewBox="0 0 24 24"><path d="M12 .587l3.668 7.568L24 9.423l-6 5.847 1.417 8.145L12 18.897l-7.417 4.518L6 15.27 0 9.423l8.332-1.268z"></path></svg>
            <svg class="h-4 w-4 fill-primary text-primary" viewBox="0 0 24 24"><path d="M12 .587l3.668 7.568L24 9.423l-6 5.847 1.417 8.145L12 18.897l-7.417 4.518L6 15.27 0 9.423l8.332-1.268z"></path></svg>
            <svg class="h-4 w-4 fill-primary text-primary" viewBox="0 0 24 24"><path d="M12 .587l3.668 7.568L24 9.423l-6 5.847 1.417 8.145L12 18.897l-7.417 4.518L6 15.27 0 9.423l8.332-1.268z"></path></svg>
            <svg class="h-4 w-4 fill-primary text-primary" viewBox="0 0 24 24"><path d="M12 .587l3.668 7.568L24 9.423l-6 5.847 1.417 8.145L12 18.897l-7.417 4.518L6 15.27 0 9.423l8.332-1.268z"></path></svg>
          </div>
          <p class="mt-4 text-foreground">"Transformed how our team collaborates. Highly recommend!"</p>
          <p class="mt-4 text-sm text-muted-foreground">Alex Johnson, CTO, StartupXYZ</p>
        </div>
      </div>
      <div class="rounded-lg border bg-card text-card-foreground shadow-sm">
        <div class="p-6 pt-6">
          <div class="flex gap-1">
            <svg class="h-4 w-4 fill-primary text-primary" viewBox="0 0 24 24"><path d="M12 .587l3.668 7.568L24 9.423l-6 5.847 1.417 8.145L12 18.897l-7.417 4.518L6 15.27 0 9.423l8.332-1.268z"></path></svg>
            <svg class="h-4 w-4 fill-primary text-primary" viewBox="0 0 24 24"><path d="M12 .587l3.668 7.568L24 9.423l-6 5.847 1.417 8.145L12 18.897l-7.417 4.518L6 15.27 0 9.423l8.332-1.268z"></path></svg>
            <svg class="h-4 w-4 fill-primary text-primary" viewBox="0 0 24 24"><path d="M12 .587l3.668 7.568L24 9.423l-6 5.847 1.417 8.145L12 18.897l-7.417 4.518L6 15.27 0 9.423l8.332-1.268z"></path></svg>
            <svg class="h-4 w-4 fill-primary text-primary" viewBox="0 0 24 24"><path d="M12 .587l3.668 7.568L24 9.423l-6 5.847 1.417 8.145L12 18.897l-7.417 4.518L6 15.27 0 9.423l8.332-1.268z"></path></svg>
            <svg class="h-4 w-4 fill-primary text-primary" viewBox="0 0 24 24"><path d="M12 .587l3.668 7.568L24 9.423l-6 5.847 1.417 8.145L12 18.897l-7.417 4.518L6 15.27 0 9.423l8.332-1.268z"></path></svg>
          </div>
          <p class="mt-4 text-foreground">"The ROI was immediate. We saw results within the first month."</p>
          <p class="mt-4 text-sm text-muted-foreground">Maria Garcia, VP Ops, ScaleCo</p>
        </div>
      </div>
    </div>
  </div>
</section>`,
    placeholders: {
      'What Our Customers Say': 'section title',
      'Transformed how our team collaborates. Highly recommend!': 'testimonial 1 quote',
      'Alex Johnson, CTO, StartupXYZ': 'testimonial 1 attribution',
      'The ROI was immediate. We saw results within the first month.': 'testimonial 2 quote',
      'Maria Garcia, VP Ops, ScaleCo': 'testimonial 2 attribution'
    }
  },

  'testimonial-featured-centered': {
    id: 'testimonial-featured-centered',
    name: 'Testimonial - Featured Quote Centered',
    columnStructure: 'single',
    useCases: ['Landing Page'],
    category: 'testimonials',
    pageTypes: ['landing-page'],
    html: `<section class="default-template px-6 py-16">
  <div class="mx-auto max-w-4xl text-center">
    <div class="flex items-center justify-center gap-1">
      <svg class="h-5 w-5 fill-primary text-primary" viewBox="0 0 24 24"><path d="M12 .587l3.668 7.568L24 9.423l-6 5.847 1.417 8.145L12 18.897l-7.417 4.518L6 15.27 0 9.423l8.332-1.268z"></path></svg>
      <svg class="h-5 w-5 fill-primary text-primary" viewBox="0 0 24 24"><path d="M12 .587l3.668 7.568L24 9.423l-6 5.847 1.417 8.145L12 18.897l-7.417 4.518L6 15.27 0 9.423l8.332-1.268z"></path></svg>
      <svg class="h-5 w-5 fill-primary text-primary" viewBox="0 0 24 24"><path d="M12 .587l3.668 7.568L24 9.423l-6 5.847 1.417 8.145L12 18.897l-7.417 4.518L6 15.27 0 9.423l8.332-1.268z"></path></svg>
      <svg class="h-5 w-5 fill-primary text-primary" viewBox="0 0 24 24"><path d="M12 .587l3.668 7.568L24 9.423l-6 5.847 1.417 8.145L12 18.897l-7.417 4.518L6 15.27 0 9.423l8.332-1.268z"></path></svg>
      <svg class="h-5 w-5 fill-primary text-primary" viewBox="0 0 24 24"><path d="M12 .587l3.668 7.568L24 9.423l-6 5.847 1.417 8.145L12 18.897l-7.417 4.518L6 15.27 0 9.423l8.332-1.268z"></path></svg>
    </div>
    <blockquote class="mt-4 text-lg italic text-foreground">
      "This tool saved our team 20+ hours per week. It's a game-changer."
    </blockquote>
    <p class="mt-2 text-sm text-muted-foreground">— Sarah Chen, Head of Ops at TechCorp</p>
    <div class="mt-8 flex flex-wrap items-center justify-center gap-8 opacity-50">
      <span class="text-sm font-semibold text-muted-foreground">Acme Inc</span>
      <span class="text-sm font-semibold text-muted-foreground">Globex</span>
      <span class="text-sm font-semibold text-muted-foreground">Initech</span>
      <span class="text-sm font-semibold text-muted-foreground">Umbrella Co</span>
    </div>
  </div>
</section>`,
    placeholders: {
      'This tool saved our team 20+ hours per week. It\'s a game-changer.': 'testimonial quote',
      'Sarah Chen, Head of Ops at TechCorp': 'attribution',
      'Acme Inc': 'company logo 1',
      'Globex': 'company logo 2'
    }
  },

  'pricing-header': {
    id: 'pricing-header',
    name: 'Pricing - Header',
    columnStructure: 'single',
    useCases: ['Pricing Page'],
    category: 'pricing',
    pageTypes: ['pricing-page'],
    html: `<section class="default-template px-6 py-20 text-center">
  <h1 class="text-3xl font-bold tracking-tight text-foreground sm:text-4xl">
    Simple, Transparent Pricing
  </h1>
  <p class="mt-4 text-lg text-muted-foreground">
    Choose the plan that's right for you. No hidden fees, cancel anytime.
  </p>
</section>`,
    placeholders: {
      'Simple, Transparent Pricing': 'pricing headline',
      'Choose the plan that\'s right for you. No hidden fees, cancel anytime.': 'pricing subheadline'
    }
  },

  'pricing-tiers-3col': {
    id: 'pricing-tiers-3col',
    name: 'Pricing - 3 Tier Cards',
    columnStructure: 'multi-column',
    useCases: ['Pricing Page'],
    category: 'pricing',
    pageTypes: ['pricing-page'],
    html: `<section class="default-template px-6 pb-16">
  <div class="mx-auto max-w-5xl">
    <div class="grid gap-8 md:grid-cols-3">
      <div class="rounded-lg border bg-card text-card-foreground shadow-sm relative">
        <div class="flex flex-col space-y-1.5 p-6">
          <h3 class="text-2xl font-semibold leading-none tracking-tight">Starter</h3>
          <p class="text-sm text-muted-foreground">Perfect for individuals and small projects</p>
          <div class="mt-4">
            <span class="text-4xl font-bold text-foreground">$19</span>
            <span class="text-muted-foreground">/month</span>
          </div>
        </div>
        <div class="p-6 pt-0 space-y-3">
          <div class="flex items-center gap-3">
            <svg class="h-4 w-4 text-primary" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M5 13l4 4L19 7"></path></svg>
            <span class="text-foreground">Up to 5 projects</span>
          </div>
          <div class="flex items-center gap-3">
            <svg class="h-4 w-4 text-primary" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M5 13l4 4L19 7"></path></svg>
            <span class="text-foreground">Basic analytics</span>
          </div>
          <div class="flex items-center gap-3">
            <svg class="h-4 w-4 text-primary" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M5 13l4 4L19 7"></path></svg>
            <span class="text-foreground">Email support</span>
          </div>
        </div>
        <div class="flex items-center p-6 pt-0">
          <button class="inline-flex items-center justify-center gap-2 whitespace-nowrap rounded-md text-sm font-medium ring-offset-background transition-colors focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring focus-visible:ring-offset-2 disabled:pointer-events-none disabled:opacity-50 border border-input bg-background hover:bg-accent hover:text-accent-foreground h-10 px-4 py-2 w-full">Start Free Trial</button>
        </div>
      </div>
      <div class="rounded-lg border border-primary bg-card text-card-foreground shadow-lg relative">
        <span class="inline-flex items-center rounded-full border px-2.5 py-0.5 text-xs font-semibold transition-colors focus:outline-none focus:ring-2 focus:ring-ring focus:ring-offset-2 border-transparent bg-primary text-primary-foreground hover:bg-primary/80 absolute -top-3 left-1/2 -translate-x-1/2">Most Popular</span>
        <div class="flex flex-col space-y-1.5 p-6">
          <h3 class="text-2xl font-semibold leading-none tracking-tight">Professional</h3>
          <p class="text-sm text-muted-foreground">Best for growing teams and businesses</p>
          <div class="mt-4">
            <span class="text-4xl font-bold text-foreground">$49</span>
            <span class="text-muted-foreground">/month</span>
          </div>
        </div>
        <div class="p-6 pt-0 space-y-3">
          <div class="flex items-center gap-3">
            <svg class="h-4 w-4 text-primary" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M5 13l4 4L19 7"></path></svg>
            <span class="text-foreground">Unlimited projects</span>
          </div>
          <div class="flex items-center gap-3">
            <svg class="h-4 w-4 text-primary" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M5 13l4 4L19 7"></path></svg>
            <span class="text-foreground">Advanced analytics</span>
          </div>
          <div class="flex items-center gap-3">
            <svg class="h-4 w-4 text-primary" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M5 13l4 4L19 7"></path></svg>
            <span class="text-foreground">Priority support</span>
          </div>
        </div>
        <div class="flex items-center p-6 pt-0">
          <button class="inline-flex items-center justify-center gap-2 whitespace-nowrap rounded-md text-sm font-medium ring-offset-background transition-colors focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring focus-visible:ring-2 disabled:pointer-events-none disabled:opacity-50 bg-primary text-primary-foreground hover:bg-primary/90 h-10 px-4 py-2 w-full">Start Free Trial</button>
        </div>
      </div>
      <div class="rounded-lg border bg-card text-card-foreground shadow-sm relative">
        <div class="flex flex-col space-y-1.5 p-6">
          <h3 class="text-2xl font-semibold leading-none tracking-tight">Enterprise</h3>
          <p class="text-sm text-muted-foreground">For large organizations with complex needs</p>
          <div class="mt-4">
            <span class="text-4xl font-bold text-foreground">$149</span>
            <span class="text-muted-foreground">/month</span>
          </div>
        </div>
        <div class="p-6 pt-0 space-y-3">
          <div class="flex items-center gap-3">
            <svg class="h-4 w-4 text-primary" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M5 13l4 4L19 7"></path></svg>
            <span class="text-foreground">Unlimited projects</span>
          </div>
          <div class="flex items-center gap-3">
            <svg class="h-4 w-4 text-primary" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M5 13l4 4L19 7"></path></svg>
            <span class="text-foreground">24/7 phone support</span>
          </div>
          <div class="flex items-center gap-3">
            <svg class="h-4 w-4 text-primary" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M5 13l4 4L19 7"></path></svg>
            <span class="text-foreground">Dedicated account manager</span>
          </div>
        </div>
        <div class="flex items-center p-6 pt-0">
          <button class="inline-flex items-center justify-center gap-2 whitespace-nowrap rounded-md text-sm font-medium ring-offset-background transition-colors focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring focus-visible:ring-offset-2 disabled:pointer-events-none disabled:opacity-50 border border-input bg-background hover:bg-accent hover:text-accent-foreground h-10 px-4 py-2 w-full">Contact Sales</button>
        </div>
      </div>
    </div>
  </div>
</section>`,
    placeholders: {
      'Starter': 'tier 1 name',
      'Perfect for individuals and small projects': 'tier 1 description',
      '$19': 'tier 1 price',
      'Professional': 'tier 2 name',
      '$49': 'tier 2 price',
      'Enterprise': 'tier 3 name',
      '$149': 'tier 3 price'
    }
  },

  'faq-simple': {
    id: 'faq-simple',
    name: 'FAQ - Simple List',
    columnStructure: 'single',
    useCases: ['Landing Page', 'Pricing Page', 'Product Page', 'Contact Page'],
    category: 'faq',
    pageTypes: ['landing-page', 'pricing-page', 'product-page', 'contact-page'],
    html: `<section class="default-template border-t border-border bg-muted/50 px-6 py-16">
  <div class="mx-auto max-w-2xl">
    <h2 class="text-center text-2xl font-semibold text-foreground">Frequently Asked Questions</h2>
    <div class="mt-8 space-y-6">
      <div>
        <h3 class="font-medium text-foreground">Is there a free trial?</h3>
        <p class="mt-1 text-sm text-muted-foreground">Yes! Start with a 14-day free trial, no credit card required.</p>
      </div>
      <div>
        <h3 class="font-medium text-foreground">Can I cancel anytime?</h3>
        <p class="mt-1 text-sm text-muted-foreground">Absolutely. No long-term contracts, cancel whenever you want.</p>
      </div>
      <div>
        <h3 class="font-medium text-foreground">What integrations do you support?</h3>
        <p class="mt-1 text-sm text-muted-foreground">We support 200+ apps including Slack, Google, Salesforce, and more.</p>
      </div>
    </div>
  </div>
</section>`,
    placeholders: {
      'Frequently Asked Questions': 'section title',
      'Is there a free trial?': 'question 1',
      'Yes! Start with a 14-day free trial, no credit card required.': 'answer 1',
      'Can I cancel anytime?': 'question 2',
      'What integrations do you support?': 'question 3'
    }
  },

  'cta-simple-centered': {
    id: 'cta-simple-centered',
    name: 'CTA - Simple Centered',
    columnStructure: 'single',
    useCases: ['Homepage', 'About Page', 'Use Case Page', 'Comparison Page', 'Product Page', 'Pricing Page'],
    category: 'cta',
    pageTypes: ['homepage', 'about-page', 'use-case-page', 'comparison-page', 'product-page', 'pricing-page'],
    html: `<section class="default-template px-6 py-16">
  <div class="mx-auto max-w-xl text-center">
    <h2 class="text-2xl font-semibold text-foreground">Ready to Transform Your Business?</h2>
    <p class="mt-2 text-muted-foreground">Start your free trial today. No credit card required.</p>
    <button class="mt-6 inline-flex items-center justify-center gap-2 whitespace-nowrap rounded-md text-sm font-medium ring-offset-background transition-colors focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring focus-visible:ring-offset-2 disabled:pointer-events-none disabled:opacity-50 bg-primary text-primary-foreground hover:bg-primary/90 h-11 px-8">Get Started Free</button>
  </div>
</section>`,
    placeholders: {
      'Ready to Transform Your Business?': 'CTA headline',
      'Start your free trial today. No credit card required.': 'CTA description',
      'Get Started Free': 'CTA button text'
    }
  },

  'cta-lead-form': {
    id: 'cta-lead-form',
    name: 'CTA - Email Lead Capture',
    columnStructure: 'single',
    useCases: ['Landing Page'],
    category: 'cta',
    pageTypes: ['landing-page'],
    html: `<section class="default-template px-6 py-16">
  <div class="mx-auto max-w-xl text-center">
    <h2 class="text-2xl font-semibold text-foreground">Ready to Get Started?</h2>
    <p class="mt-2 text-muted-foreground">Join 10,000+ teams already automating their work.</p>
    <div class="mt-6 flex gap-2">
      <input type="email" placeholder="Enter your email" class="flex h-10 w-full rounded-md border border-input bg-background px-3 py-2 text-sm ring-offset-background file:border-0 file:bg-transparent file:text-sm file:font-medium placeholder:text-muted-foreground focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring focus-visible:ring-offset-2 disabled:cursor-not-allowed disabled:opacity-50 flex-1" />
      <button class="inline-flex items-center justify-center gap-2 whitespace-nowrap rounded-md text-sm font-medium ring-offset-background transition-colors focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring focus-visible:ring-offset-2 disabled:pointer-events-none disabled:opacity-50 bg-primary text-primary-foreground hover:bg-primary/90 h-10 px-4 py-2">Get Started</button>
    </div>
  </div>
</section>`,
    placeholders: {
      'Ready to Get Started?': 'CTA headline',
      'Join 10,000+ teams already automating their work.': 'social proof text',
      'Enter your email': 'form placeholder',
      'Get Started': 'button text'
    }
  },

  'use-cases-4col': {
    id: 'use-cases-4col',
    name: 'Use Cases - 4 Column Grid',
    columnStructure: 'multi-column',
    useCases: ['Homepage'],
    category: 'use-cases',
    pageTypes: ['homepage'],
    html: `<section class="default-template border-t border-border bg-muted/50 px-6 py-16">
  <div class="mx-auto max-w-5xl">
    <h2 class="text-center text-2xl font-semibold text-foreground">Built for Every Team</h2>
    <div class="mt-12 grid gap-4 sm:grid-cols-2 lg:grid-cols-4">
      <div class="rounded-lg border border-border bg-background p-6 text-center">
        <h3 class="font-medium text-foreground">Marketing</h3>
        <p class="mt-2 text-sm text-muted-foreground">Tailored solutions for marketing teams</p>
      </div>
      <div class="rounded-lg border border-border bg-background p-6 text-center">
        <h3 class="font-medium text-foreground">Engineering</h3>
        <p class="mt-2 text-sm text-muted-foreground">Tailored solutions for engineering teams</p>
      </div>
      <div class="rounded-lg border border-border bg-background p-6 text-center">
        <h3 class="font-medium text-foreground">Sales</h3>
        <p class="mt-2 text-sm text-muted-foreground">Tailored solutions for sales teams</p>
      </div>
      <div class="rounded-lg border border-border bg-background p-6 text-center">
        <h3 class="font-medium text-foreground">Operations</h3>
        <p class="mt-2 text-sm text-muted-foreground">Tailored solutions for operations teams</p>
      </div>
    </div>
  </div>
</section>`,
    placeholders: {
      'Built for Every Team': 'section title',
      'Marketing': 'team type 1',
      'Engineering': 'team type 2',
      'Sales': 'team type 3',
      'Operations': 'team type 4'
    }
  },

  'comparison-table-sidebyside': {
    id: 'comparison-table-sidebyside',
    name: 'Comparison - Side-by-Side Table',
    columnStructure: 'multi-column',
    useCases: ['Comparison Page'],
    category: 'comparison',
    pageTypes: ['comparison-page'],
    html: `<section class="default-template px-6 pb-16">
  <div class="mx-auto max-w-4xl">
    <div class="overflow-x-auto rounded-lg border border-border">
      <table class="w-full">
        <thead>
          <tr class="bg-muted">
            <th class="p-4 text-left text-sm font-medium text-muted-foreground">Feature</th>
            <th class="p-4 text-center">
              <div class="text-sm font-medium text-primary">OurProduct</div>
            </th>
            <th class="p-4 text-center">
              <div class="text-sm font-medium text-muted-foreground">CompetitorX</div>
            </th>
          </tr>
        </thead>
        <tbody>
          <tr class="border-t border-border">
            <td class="p-4 text-sm text-foreground">Pricing (starter)</td>
            <td class="p-4 text-center">
              <span class="text-sm font-medium text-foreground">$19/mo</span>
            </td>
            <td class="p-4 text-center">
              <span class="text-sm text-muted-foreground">$29/mo</span>
            </td>
          </tr>
          <tr class="border-t border-border">
            <td class="p-4 text-sm text-foreground">Free trial</td>
            <td class="p-4 text-center">
              <svg class="mx-auto h-5 w-5 text-primary" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M5 13l4 4L19 7"></path></svg>
            </td>
            <td class="p-4 text-center">
              <svg class="mx-auto h-5 w-5 text-muted-foreground" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M5 13l4 4L19 7"></path></svg>
            </td>
          </tr>
          <tr class="border-t border-border">
            <td class="p-4 text-sm text-foreground">24/7 Support</td>
            <td class="p-4 text-center">
              <svg class="mx-auto h-5 w-5 text-primary" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M5 13l4 4L19 7"></path></svg>
            </td>
            <td class="p-4 text-center">
              <svg class="mx-auto h-5 w-5 text-muted-foreground" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M6 18L18 6M6 6l12 12"></path></svg>
            </td>
          </tr>
        </tbody>
      </table>
    </div>
  </div>
</section>`,
    placeholders: {
      'OurProduct': 'your product name',
      'CompetitorX': 'competitor name',
      'Pricing (starter)': 'feature row 1',
      '$19/mo': 'your price',
      '$29/mo': 'their price'
    }
  },

  'contact-form-detailed': {
    id: 'contact-form-detailed',
    name: 'Contact - Detailed Form with Info',
    columnStructure: 'two-column',
    useCases: ['Contact Page'],
    category: 'forms',
    pageTypes: ['contact-page'],
    html: `<section class="default-template border-t border-border bg-muted/50 px-6 py-16">
  <div class="mx-auto max-w-5xl grid gap-12 lg:grid-cols-2">
    <div>
      <h2 class="text-2xl font-semibold text-foreground">Send Us a Message</h2>
      <p class="mt-2 text-muted-foreground">Fill out the form and we'll get back to you as soon as possible.</p>
      <form class="mt-8 space-y-4">
        <div class="grid gap-4 sm:grid-cols-2">
          <input type="text" placeholder="First Name" class="flex h-10 w-full rounded-md border border-input bg-background px-3 py-2 text-sm ring-offset-background file:border-0 file:bg-transparent file:text-sm file:font-medium placeholder:text-muted-foreground focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring focus-visible:ring-offset-2 disabled:cursor-not-allowed disabled:opacity-50" />
          <input type="text" placeholder="Last Name" class="flex h-10 w-full rounded-md border border-input bg-background px-3 py-2 text-sm ring-offset-background file:border-0 file:bg-transparent file:text-sm file:font-medium placeholder:text-muted-foreground focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring focus-visible:ring-offset-2 disabled:cursor-not-allowed disabled:opacity-50" />
        </div>
        <input type="email" placeholder="Email Address" class="flex h-10 w-full rounded-md border border-input bg-background px-3 py-2 text-sm ring-offset-background file:border-0 file:bg-transparent file:text-sm file:font-medium placeholder:text-muted-foreground focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring focus-visible:ring-offset-2 disabled:cursor-not-allowed disabled:opacity-50" />
        <input type="text" placeholder="Company (Optional)" class="flex h-10 w-full rounded-md border border-input bg-background px-3 py-2 text-sm ring-offset-background file:border-0 file:bg-transparent file:text-sm file:font-medium placeholder:text-muted-foreground focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring focus-visible:ring-offset-2 disabled:cursor-not-allowed disabled:opacity-50" />
        <textarea placeholder="Your Message" rows="5" class="flex min-h-[80px] w-full rounded-md border border-input bg-background px-3 py-2 text-sm ring-offset-background placeholder:text-muted-foreground focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring focus-visible:ring-offset-2 disabled:cursor-not-allowed disabled:opacity-50"></textarea>
        <button class="inline-flex items-center justify-center gap-2 whitespace-nowrap rounded-md text-sm font-medium ring-offset-background transition-colors focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring focus-visible:ring-offset-2 disabled:pointer-events-none disabled:opacity-50 bg-primary text-primary-foreground hover:bg-primary/90 h-11 px-8">Send Message</button>
      </form>
    </div>
    <div class="space-y-8">
      <div>
        <h3 class="font-semibold text-foreground">Contact Information</h3>
        <div class="mt-4 space-y-4">
          <div class="flex items-start gap-3">
            <svg class="h-5 w-5 text-primary mt-0.5" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M3 8l7.89 5.26a2 2 0 002.22 0L21 8M5 19h14a2 2 0 002-2V7a2 2 0 00-2-2H5a2 2 0 00-2 2v10a2 2 0 002 2z"></path></svg>
            <div>
              <p class="font-medium text-foreground">Email</p>
              <p class="text-sm text-muted-foreground">support@company.com</p>
            </div>
          </div>
          <div class="flex items-start gap-3">
            <svg class="h-5 w-5 text-primary mt-0.5" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M3 5a2 2 0 012-2h3.28a1 1 0 01.948.684l1.498 4.493a1 1 0 01-.502 1.21l-2.257 1.13a11.042 11.042 0 005.516 5.516l1.13-2.257a1 1 0 011.21-.502l4.493 1.498a1 1 0 01.684.949V19a2 2 0 01-2 2h-1C9.716 21 3 14.284 3 6V5z"></path></svg>
            <div>
              <p class="font-medium text-foreground">Phone</p>
              <p class="text-sm text-muted-foreground">1-800-123-4567 (Toll-free)</p>
            </div>
          </div>
        </div>
      </div>
    </div>
  </div>
</section>`,
    placeholders: {
      'Send Us a Message': 'form title',
      'support@company.com': 'support email',
      '1-800-123-4567 (Toll-free)': 'phone number'
    }
  },

  'form-resource-download': {
    id: 'form-resource-download',
    name: 'Form - Resource Download',
    columnStructure: 'single',
    useCases: ['Resource Page'],
    category: 'forms',
    pageTypes: ['resource-page'],
    html: `<section class="default-template border-t border-border bg-muted/50 px-6 py-16">
  <div class="mx-auto max-w-md">
    <h2 class="text-center text-2xl font-semibold text-foreground">Get Your Free Copy</h2>
    <p class="mt-2 text-center text-muted-foreground">Enter your email to download instantly</p>
    <form class="mt-8 space-y-4">
      <input type="text" placeholder="Full Name" class="flex h-10 w-full rounded-md border border-input bg-background px-3 py-2 text-sm ring-offset-background file:border-0 file:bg-transparent file:text-sm file:font-medium placeholder:text-muted-foreground focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring focus-visible:ring-offset-2 disabled:cursor-not-allowed disabled:opacity-50" />
      <input type="email" placeholder="Work Email" class="flex h-10 w-full rounded-md border border-input bg-background px-3 py-2 text-sm ring-offset-background file:border-0 file:bg-transparent file:text-sm file:font-medium placeholder:text-muted-foreground focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring focus-visible:ring-offset-2 disabled:cursor-not-allowed disabled:opacity-50" />
      <input type="text" placeholder="Company" class="flex h-10 w-full rounded-md border border-input bg-background px-3 py-2 text-sm ring-offset-background file:border-0 file:bg-transparent file:text-sm file:font-medium placeholder:text-muted-foreground focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring focus-visible:ring-offset-2 disabled:cursor-not-allowed disabled:opacity-50" />
      <button class="inline-flex items-center justify-center gap-2 whitespace-nowrap rounded-md text-sm font-medium ring-offset-background transition-colors focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring focus-visible:ring-offset-2 disabled:pointer-events-none disabled:opacity-50 bg-primary text-primary-foreground hover:bg-primary/90 h-11 px-8 w-full">
        Download Now
      </button>
      <p class="text-xs text-center text-muted-foreground">
        By downloading, you agree to receive occasional emails from us. Unsubscribe anytime.
      </p>
    </form>
  </div>
</section>`,
    placeholders: {
      'Get Your Free Copy': 'form title',
      'Enter your email to download instantly': 'form description',
      'Full Name': 'field 1 placeholder',
      'Work Email': 'field 2 placeholder',
      'Download Now': 'button text'
    }
  },

  'related-content-3col': {
    id: 'related-content-3col',
    name: 'Related Content - 3 Column Cards',
    columnStructure: 'multi-column',
    useCases: ['Content Page', 'Resource Page', 'Homepage'],
    category: 'related-content',
    pageTypes: ['content-page', 'resource-page', 'homepage'],
    html: `<section class="default-template border-t border-border bg-muted/50 px-6 py-16">
  <div class="mx-auto max-w-5xl">
    <h2 class="text-xl font-semibold text-foreground">Related Articles</h2>
    <div class="mt-8 grid gap-6 md:grid-cols-3">
      <div class="rounded-lg border bg-card text-card-foreground shadow-sm cursor-pointer transition-shadow hover:shadow-lg">
        <div class="p-4">
          <span class="inline-flex items-center rounded-full border px-2.5 py-0.5 text-xs font-semibold transition-colors focus:outline-none focus:ring-2 focus:ring-ring focus:ring-offset-2 text-foreground">Guide</span>
          <h3 class="mt-2 font-medium text-foreground hover:text-primary">10 Workflows Every Business Should Automate</h3>
          <button class="mt-2 inline-flex items-center justify-center gap-2 whitespace-nowrap text-sm font-medium transition-colors focus-visible:outline-none disabled:pointer-events-none disabled:opacity-50 underline-offset-4 hover:underline text-primary p-0 h-auto">Read more</button>
        </div>
      </div>
      <div class="rounded-lg border bg-card text-card-foreground shadow-sm cursor-pointer transition-shadow hover:shadow-lg">
        <div class="p-4">
          <span class="inline-flex items-center rounded-full border px-2.5 py-0.5 text-xs font-semibold transition-colors focus:outline-none focus:ring-2 focus:ring-ring focus:ring-offset-2 text-foreground">Explainer</span>
          <h3 class="mt-2 font-medium text-foreground hover:text-primary">Automation vs. AI: What's the Difference?</h3>
          <button class="mt-2 inline-flex items-center justify-center gap-2 whitespace-nowrap text-sm font-medium transition-colors focus-visible:outline-none disabled:pointer-events-none disabled:opacity-50 underline-offset-4 hover:underline text-primary p-0 h-auto">Read more</button>
        </div>
      </div>
      <div class="rounded-lg border bg-card text-card-foreground shadow-sm cursor-pointer transition-shadow hover:shadow-lg">
        <div class="p-4">
          <span class="inline-flex items-center rounded-full border px-2.5 py-0.5 text-xs font-semibold transition-colors focus:outline-none focus:ring-2 focus:ring-ring focus:ring-offset-2 text-foreground">Case Study</span>
          <h3 class="mt-2 font-medium text-foreground hover:text-primary">Case Study: How TechCorp Saved 1000+ Hours</h3>
          <button class="mt-2 inline-flex items-center justify-center gap-2 whitespace-nowrap text-sm font-medium transition-colors focus-visible:outline-none disabled:pointer-events-none disabled:opacity-50 underline-offset-4 hover:underline text-primary p-0 h-auto">Read more</button>
        </div>
      </div>
    </div>
  </div>
</section>`,
    placeholders: {
      'Related Articles': 'section title',
      '10 Workflows Every Business Should Automate': 'article 1 title',
      'Guide': 'article 1 category',
      'Automation vs. AI: What\'s the Difference?': 'article 2 title',
      'Case Study: How TechCorp Saved 1000+ Hours': 'article 3 title'
    }
  },

  'company-story': {
    id: 'company-story',
    name: 'Company - Story/Origin',
    columnStructure: 'single',
    useCases: ['About Page'],
    category: 'about',
    pageTypes: ['about-page'],
    html: `<section class="default-template px-6 py-16">
  <div class="mx-auto max-w-3xl">
    <h2 class="text-center text-2xl font-semibold text-foreground">Our Story</h2>
    <div class="mt-8 space-y-6 text-muted-foreground">
      <p>
        Founded in 2020, our company was born from a simple frustration: why does so much of our work involve repetitive, soul-crushing tasks that machines could easily handle?
      </p>
      <p>
        Our founders—former engineers at Fortune 500 companies—had spent years watching talented colleagues waste hours on data entry, report compilation, and manual processes. They knew there had to be a better way.
      </p>
      <p>
        Today, we serve over 50,000 businesses worldwide, from solo entrepreneurs to Fortune 500 enterprises. But our mission remains the same: to help people reclaim their time and do more meaningful work.
      </p>
    </div>
  </div>
</section>`,
    placeholders: {
      'Our Story': 'section title',
      'Founded in 2020': 'founding year',
      '50,000 businesses': 'customer count'
    }
  },

  'company-stats': {
    id: 'company-stats',
    name: 'Company - Stats Grid',
    columnStructure: 'multi-column',
    useCases: ['About Page'],
    category: 'about',
    pageTypes: ['about-page'],
    html: `<section class="default-template px-6 py-16">
  <div class="mx-auto max-w-4xl">
    <div class="grid gap-8 text-center md:grid-cols-4">
      <div>
        <div class="text-3xl font-bold text-primary">50,000+</div>
        <p class="mt-1 text-sm text-muted-foreground">Businesses served</p>
      </div>
      <div>
        <div class="text-3xl font-bold text-primary">120+</div>
        <p class="mt-1 text-sm text-muted-foreground">Countries</p>
      </div>
      <div>
        <div class="text-3xl font-bold text-primary">99.99%</div>
        <p class="mt-1 text-sm text-muted-foreground">Uptime</p>
      </div>
      <div>
        <div class="text-3xl font-bold text-primary">4.9/5</div>
        <p class="mt-1 text-sm text-muted-foreground">Customer rating</p>
      </div>
    </div>
  </div>
</section>`,
    placeholders: {
      '50,000+': 'stat 1 value',
      'Businesses served': 'stat 1 label',
      '120+': 'stat 2 value',
      '99.99%': 'stat 3 value',
      '4.9/5': 'stat 4 value'
    }
  },

};

// Page type definitions
export const PAGE_TYPES = {
  'homepage': {
    id: 'homepage',
    name: 'Homepage',
    description: 'Company homepage with overview',
    defaultComponents: [
      'hero-centered',
      'features-grid-3col',
      'benefits-split-image',
      'use-cases-4col',
      'testimonials-2col',
      'related-content-3col',
      'cta-simple-centered'
    ]
  },
  'landing-page': {
    id: 'landing-page',
    name: 'Landing Page',
    description: 'Conversion-focused landing page',
    defaultComponents: [
      'hero-centered',
      'problem-pain-centered',
      'features-grid-3col',
      'how-it-works-3step',
      'testimonial-featured-centered',
      'faq-simple',
      'cta-lead-form'
    ]
  },
  'product-page': {
    id: 'product-page',
    name: 'Product Page',
    description: 'Detailed product information',
    defaultComponents: [
      'hero-product-split',
      'features-grid-4col',
      'benefits-before-after',
      'how-it-works-vertical',
      'faq-simple',
      'cta-simple-centered'
    ]
  },
  'pricing-page': {
    id: 'pricing-page',
    name: 'Pricing Page',
    description: 'Pricing tiers and plans',
    defaultComponents: [
      'pricing-header',
      'pricing-tiers-3col',
      'faq-simple',
      'cta-simple-centered'
    ]
  },
  'about-page': {
    id: 'about-page',
    name: 'About Page',
    description: 'Company information and team',
    defaultComponents: [
      'hero-about',
      'company-story',
      'company-stats',
      'features-grid-3col',
      'cta-simple-centered'
    ]
  },
  'contact-page': {
    id: 'contact-page',
    name: 'Contact Page',
    description: 'Contact information and forms',
    defaultComponents: [
      'hero-about',
      'contact-form-detailed',
      'faq-simple',
      'cta-simple-centered'
    ]
  },
  'content-page': {
    id: 'content-page',
    name: 'Content/Article Page',
    description: 'Blog post or article format',
    defaultComponents: [
      'hero-article',
      'related-content-3col'
    ]
  },
  'comparison-page': {
    id: 'comparison-page',
    name: 'Comparison Page',
    description: 'Product comparison',
    defaultComponents: [
      'hero-about',
      'comparison-table-sidebyside',
      'testimonials-2col',
      'cta-simple-centered'
    ]
  },
  'use-case-page': {
    id: 'use-case-page',
    name: 'Use Case Page',
    description: 'Industry or audience-specific',
    defaultComponents: [
      'hero-product-split',
      'problem-pain-2col-grid',
      'features-grid-3col',
      'benefits-metrics',
      'cta-simple-centered'
    ]
  },
  'resource-page': {
    id: 'resource-page',
    name: 'Resource/Download Page',
    description: 'Gated content page',
    defaultComponents: [
      'hero-resource-split',
      'form-resource-download',
      'related-content-3col'
    ]
  }
};

// Category definitions for organizing components by column structure
export const COMPONENT_CATEGORIES = {
  'single': { name: 'Single Column', icon: 'AlignCenter' },
  'two-column': { name: '2-Column', icon: 'Columns' },
  'multi-column': { name: '3+ Columns', icon: 'Grid3x3' }
};
