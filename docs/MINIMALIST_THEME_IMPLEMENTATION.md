# Minimalist Theme Implementation Plan

## Goal
Implement a "minimalist" rendering mode inspired by the Zhang Dong Architecture example, focusing on clean, professional, decoration-free design.

---

## Phase 1: Core Infrastructure (High Priority)

### 1.1 Add Theme Support to Renderers

**File:** `libs/monkey/tools/renderers/index.ts`

```typescript
export interface RenderOptions {
  theme?: "default" | "minimalist";
}

export function renderSection(
  section: SectionContent, 
  options: RenderOptions = {}
): string {
  const { sectionType, format, content } = section;
  const theme = options.theme || "default";
  
  // Pass theme to all renderers
  switch (format) {
    case "card_grid":
      return renderCardGrid(sectionType, format, content, theme);
    // ... etc
  }
}
```

### 1.2 Create Minimalist CSS Variables

**File:** `libs/monkey/tools/renderers/styles/minimalist.css`

```css
/* Minimalist Theme Variables */
:root[data-theme="minimalist"] {
  /* Colors */
  --color-bg: #ffffff;
  --color-text: #000000;
  --color-text-secondary: #6b7280;
  --color-accent: #000000;
  --color-border: #e5e7eb;
  
  /* Spacing (increased) */
  --section-padding: 100px;
  --container-padding: 24px;
  --element-gap: 48px;
  
  /* Typography */
  --font-size-h1: 52px;
  --font-size-h2: 38px;
  --font-size-body: 18px;
  --line-height-body: 1.7;
  
  /* Effects (none) */
  --shadow: none;
  --border-radius: 0;
  --gradient: none;
}
```

### 1.3 Update Base Styles

**File:** `libs/monkey/tools/renderers/index.ts` (renderFullPage function)

```typescript
export function renderFullPage(
  sections: SectionContent[], 
  options: RenderOptions = {}
): string {
  const theme = options.theme || "default";
  
  const styles = theme === "minimalist" ? `
    .cj-container { max-width: 1200px; margin: 0 auto; padding: 0 24px; }
    .cj-section { padding: 100px 0; } /* Increased from 60px */
    .cj-grid { display: grid; grid-template-columns: repeat(auto-fit, minmax(280px, 1fr)); gap: 48px; }
    
    /* Minimalist cards - no borders, no shadows */
    .cj-card { background: transparent; border: none; padding: 24px; text-align: center; }
    
    /* Minimalist buttons */
    .cj-btn { 
      display: inline-block; 
      padding: 16px 32px; 
      background: #000; 
      color: white; 
      text-decoration: none; 
      border: none;
      font-size: 16px;
      font-weight: 600;
      cursor: pointer;
      transition: background 0.2s;
    }
    .cj-btn:hover { background: #1f2937; }
    
    .cj-btn-secondary {
      background: transparent;
      color: #000;
      border: 2px solid #000;
    }
    .cj-btn-secondary:hover { background: #f9fafb; }
    
    /* Typography */
    body { 
      font-family: -apple-system, BlinkMacSystemFont, 'Segoe UI', sans-serif;
      line-height: 1.7;
      color: #000;
    }
    h1 { font-size: 52px; font-weight: 700; line-height: 1.2; }
    h2 { font-size: 38px; font-weight: 700; line-height: 1.3; }
    h3 { font-size: 22px; font-weight: 600; line-height: 1.4; }
    p { font-size: 18px; color: #374151; line-height: 1.7; }
  ` : `
    /* Default theme styles (current) */
    .cj-container { max-width: 1200px; margin: 0 auto; padding: 0 20px; }
    .cj-section { padding: 60px 0; }
    .cj-grid { display: grid; grid-template-columns: repeat(auto-fit, minmax(280px, 1fr)); gap: 24px; }
    .cj-card { background: #fff; border: 1px solid #e5e7eb; border-radius: 8px; padding: 24px; }
    .cj-btn { 
      display: inline-block; 
      padding: 12px 24px; 
      background: #3b82f6; 
      color: white; 
      text-decoration: none; 
      border-radius: 6px; 
    }
    .cj-btn:hover { background: #2563eb; }
  `;
  
  return `<!DOCTYPE html>
<html lang="en" data-theme="${theme}">
<head>
  <meta charset="UTF-8">
  <meta name="viewport" content="width=device-width, initial-scale=1.0">
  <title>Landing Page</title>
  <style>${styles}</style>
</head>
<body>
${htmlSections.join("\n\n")}
</body>
</html>`;
}
```

---

## Phase 2: Update Individual Renderers

### 2.1 Card Grid Renderer

**File:** `libs/monkey/tools/renderers/cardGrid.ts`

```typescript
export function renderCardGrid(
  sectionType: SectionType, 
  format: string, 
  content: any,
  theme: string = "default"
): string {
  const heading = content.heading || content.title || "";
  const items = content.items || content.cards || content.badges || [];
  
  const isMinimalist = theme === "minimalist";
  
  const itemsHtml = items.map((item: any) => {
    const title = item.title || item.heading || item.name || "";
    const description = item.description || item.text || "";
    const icon = item.icon || "";
    
    if (isMinimalist) {
      // Minimalist: outlined icons, no borders, centered
      return `<div class="cj-card">
        ${icon ? `<div style="font-size: 40px; margin-bottom: 16px; color: #000;">${icon}</div>` : ""}
        ${title ? `<h3 style="font-size: 22px; font-weight: 600; margin: 0 0 12px 0; color: #000;">${title}</h3>` : ""}
        ${description ? `<p style="margin: 0; color: #6b7280; line-height: 1.7; font-size: 16px;">${description}</p>` : ""}
      </div>`;
    } else {
      // Default: filled icons, borders, shadows
      return `<div class="cj-card">
        ${icon ? `<div style="font-size: 32px; margin-bottom: 12px;">${icon}</div>` : ""}
        ${title ? `<h3 style="font-size: 20px; font-weight: 600; margin: 0 0 12px 0;">${title}</h3>` : ""}
        ${description ? `<p style="margin: 0; color: #6b7280; line-height: 1.6;">${description}</p>` : ""}
      </div>`;
    }
  }).join("");
  
  const sectionPadding = isMinimalist ? "100px 0" : "60px 0";
  const headingSize = isMinimalist ? "38px" : "36px";
  
  return `<section class="cj-section" style="padding: ${sectionPadding};">
  <div class="cj-container">
    ${heading ? `<h2 style="font-size: ${headingSize}; font-weight: bold; text-align: center; margin: 0 0 ${isMinimalist ? '60px' : '48px'} 0;">${heading}</h2>` : ""}
    <div class="cj-grid">
      ${itemsHtml}
    </div>
  </div>
</section>`;
}
```

### 2.2 CTA Banner Renderer (Add Dual CTA)

**File:** `libs/monkey/tools/renderers/ctaBanner.ts`

```typescript
export function renderCtaBanner(
  sectionType: SectionType, 
  format: string, 
  content: any,
  theme: string = "default"
): string {
  const heading = content.heading || content.title || "";
  const text = content.text || content.description || "";
  const primaryCTA = content.cta || content.primaryCTA || { text: "Get Started", url: "#" };
  const secondaryCTA = content.secondaryCTA || null;
  const bullets = content.bullets || content.recap || [];
  
  const isMinimalist = theme === "minimalist";
  
  const bulletsHtml = bullets.length > 0
    ? `<ul style="list-style: none; padding: 0; margin: 24px 0;">
        ${bullets.map((bullet: any) => {
          const text = typeof bullet === "string" ? bullet : bullet.text || "";
          return `<li style="display: flex; align-items: center; gap: 12px; margin-bottom: 12px; justify-content: center;">
            <span style="color: ${isMinimalist ? '#000' : '#3b82f6'};">✓</span>
            <span>${text}</span>
          </li>`;
        }).join("")}
      </ul>`
    : "";
  
  const ctaButtons = secondaryCTA 
    ? `<div style="display: flex; gap: 16px; justify-content: center; flex-wrap: wrap;">
        <a href="${primaryCTA.url || "#"}" class="cj-btn">
          ${primaryCTA.text || "Get Started"}
        </a>
        <a href="${secondaryCTA.url || "#"}" class="cj-btn cj-btn-secondary">
          ${secondaryCTA.text || "Learn More"}
        </a>
      </div>`
    : `<a href="${primaryCTA.url || "#"}" class="cj-btn" style="font-size: 18px; padding: 16px 32px;">
        ${primaryCTA.text || "Get Started"}
      </a>`;
  
  const bgColor = isMinimalist ? "#ffffff" : "#f9fafb";
  const sectionPadding = isMinimalist ? "100px 0" : "80px 0";
  
  return `<section class="cj-section" style="background: ${bgColor}; padding: ${sectionPadding};">
  <div class="cj-container">
    <div style="text-align: center; max-width: 800px; margin: 0 auto;">
      ${heading ? `<h2 style="font-size: ${isMinimalist ? '38px' : '36px'}; font-weight: bold; margin: 0 0 24px 0;">${heading}</h2>` : ""}
      ${text ? `<p style="font-size: 20px; margin: 0 0 24px 0; color: #6b7280;">${text}</p>` : ""}
      ${bulletsHtml}
      <div style="margin-top: 32px;">
        ${ctaButtons}
      </div>
    </div>
  </div>
</section>`;
}
```

### 2.3 Hero Renderer (Text-Only Option)

**File:** `libs/monkey/tools/renderers/hero.ts`

```typescript
export function renderHero(
  sectionType: SectionType, 
  content: any,
  theme: string = "default"
): string {
  const heading = content.heading || content.h1 || "Welcome";
  const subheading = content.subheading || content.subhead || "";
  const bullets = content.bullets || content.iconList || [];
  const cta = content.cta || content.primaryCTA || { text: "Get Started", url: "#" };
  const trustIndicator = content.trustIndicator || "";
  const secondaryTrust = content.secondaryTrust || "";
  
  const isMinimalist = theme === "minimalist";
  
  const bulletsHtml = bullets.length > 0
    ? `<ul style="list-style: none; padding: 0; margin: 24px 0;">
        ${bullets.map((bullet: any) => {
          const text = typeof bullet === "string" ? bullet : bullet.text || bullet.label || "";
          const icon = isMinimalist ? "✓" : (bullet.icon || "✓");
          return `<li style="display: flex; align-items: center; gap: 12px; margin-bottom: 12px;">
            <span style="color: ${isMinimalist ? '#000' : '#3b82f6'};">${icon}</span>
            <span>${text}</span>
          </li>`;
        }).join("")}
      </ul>`
    : "";
  
  if (isMinimalist) {
    // Minimalist: Text-only, centered, no background
    return `<section class="cj-section" style="padding: 120px 0; background: #ffffff;">
  <div class="cj-container">
    <div style="text-align: center; max-width: 800px; margin: 0 auto;">
      <h1 style="font-size: 52px; font-weight: bold; margin: 0 0 24px 0; line-height: 1.2; color: #000;">${heading}</h1>
      ${subheading ? `<p style="font-size: 20px; margin: 0 0 32px 0; color: #6b7280; line-height: 1.6;">${subheading}</p>` : ""}
      ${bulletsHtml}
      <div style="margin-top: 40px;">
        <a href="${cta.url || "#"}" class="cj-btn" style="font-size: 18px; padding: 16px 40px;">
          ${cta.text || "Get Started"}
        </a>
      </div>
      ${trustIndicator ? `<p style="font-size: 14px; color: #6b7280; margin-top: 24px;">${trustIndicator}</p>` : ""}
      ${secondaryTrust ? `<p style="font-size: 14px; color: #9ca3af; margin-top: 8px;">${secondaryTrust}</p>` : ""}
    </div>
  </div>
</section>`;
  } else {
    // Default: Two-column with gradient background
    return `<section class="cj-section cj-hero" style="background: linear-gradient(135deg, #667eea 0%, #764ba2 100%); color: white; padding: 80px 0;">
  <div class="cj-container">
    <div style="display: grid; grid-template-columns: 1fr 1fr; gap: 48px; align-items: center;">
      <div>
        <h1 style="font-size: 48px; font-weight: bold; margin: 0 0 24px 0; line-height: 1.2;">${heading}</h1>
        ${subheading ? `<p style="font-size: 20px; margin: 0 0 24px 0; opacity: 0.9;">${subheading}</p>` : ""}
        ${bulletsHtml}
        <div style="margin-top: 32px;">
          <a href="${cta.url || "#"}" class="cj-btn" style="background: white; color: #667eea; font-weight: 600;">
            ${cta.text || "Get Started"}
          </a>
        </div>
      </div>
      <div>
        <div style="background: rgba(255,255,255,0.1); border-radius: 8px; height: 400px;"></div>
      </div>
    </div>
  </div>
</section>`;
  }
}
```

---

## Phase 3: API Integration

### 3.1 Update write-article API

**File:** `app/api/monkey/landing-page/write-article/route.ts`

```typescript
export async function POST(request: Request) {
  const body = await request.json();
  const { 
    model = "agent", 
    step1Output,
    clarificationAnswers = {},
    pageType = "BASE_UNIVERSAL",
    theme = "default", // NEW: Add theme parameter
    useAgentMode = false,
  } = body;
  
  // ... existing code ...
  
  // Render with theme
  const fullPageHtml = renderFullPage(writtenSections, { theme });
  
  return NextResponse.json({
    success: true,
    article: {
      html: fullPageHtml,
      theme, // Include theme in response
      // ... rest
    }
  });
}
```

### 3.2 Update Frontend (Agent Playground)

**File:** `app/(private)/agent-playground/page.js`

```javascript
const [theme, setTheme] = useState("default");

// Add theme selector
<div className="form-control">
  <label className="label">
    <span className="label-text">Design Theme</span>
  </label>
  <select 
    className="select select-bordered"
    value={theme}
    onChange={(e) => setTheme(e.target.value)}
  >
    <option value="default">Default (Colorful)</option>
    <option value="minimalist">Minimalist (Clean & Professional)</option>
  </select>
</div>

// Pass theme to API
const handleWriteArticle = async () => {
  const response = await fetch("/api/monkey/landing-page/write-article", {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({
      model: "agent",
      step1Output,
      clarificationAnswers,
      theme, // Pass theme
    }),
  });
  // ...
};
```

---

## Phase 4: AI Prompt Updates

### 4.1 Update writeSection Prompts

**File:** `libs/monkey/actions/writeSection.ts`

Add theme-aware instructions:

```typescript
const themeGuidance = theme === "minimalist" 
  ? `
DESIGN THEME: MINIMALIST
- Use simple, outlined icons (→, ✓, •) instead of emojis
- Focus on clarity and professionalism
- Avoid decorative language
- Use concrete, specific descriptions
- Keep it clean and direct
`
  : `
DESIGN THEME: DEFAULT
- Use expressive emojis and icons
- Be engaging and dynamic
- Use varied, colorful language
`;

const systemPrompt = `You are writing a landing page section for a ${input.offerType} offer.

${themeGuidance}

Section Type: ${input.sectionType}
Format: ${input.format}
// ... rest of prompt
`;
```

---

## Testing Checklist

- [ ] Test minimalist theme on all section types
- [ ] Test default theme still works
- [ ] Test theme switching in UI
- [ ] Test dual CTA rendering
- [ ] Test text-only hero
- [ ] Test borderless cards
- [ ] Test increased spacing
- [ ] Test on mobile (responsive)
- [ ] Test button hover states
- [ ] Test accessibility (contrast ratios)

---

## Rollout Plan

1. **Week 1**: Implement core infrastructure (Phase 1)
2. **Week 2**: Update 5 most-used renderers (Phase 2)
3. **Week 3**: API integration and frontend (Phase 3)
4. **Week 4**: AI prompt updates and testing (Phase 4)
5. **Week 5**: User testing and refinements

---

## Success Metrics

- [ ] Users can switch between themes seamlessly
- [ ] Minimalist theme matches benchmark quality
- [ ] No regression in default theme
- [ ] Page load time unchanged
- [ ] Positive user feedback on clean design
