# V0 Server-Side Rendering (SSR) Implementation Plan

## Current Problem
Browser scraping of v0 demo pages is unreliable:
- Extracts wrong divs (React hydration markers)
- Depends on client-side rendering completing
- Subject to v0's demo site changes
- Includes unnecessary scripts and metadata

## Proposed Solution: Server-Side Rendering

Instead of scraping the demo page, render v0's React components server-side to static HTML.

### Architecture Overview

```
v0 Files → Template Project → SSR Build → Static HTML → Editor
```

### Implementation Phases

## Phase 1: Template Project Setup

Create a minimal Next.js/React template that can accept v0 files:

**Location:** `libs/v0-renderer/template/`

**Structure:**
```
template/
├── package.json (minimal deps: react, react-dom, next)
├── next.config.js (output: 'export', static generation)
├── app/
│   ├── layout.tsx (wrapper with Tailwind)
│   ├── page.tsx (placeholder, will be replaced)
│   └── globals.css (Tailwind imports)
└── public/
```

**Key Config:**
- Static export mode (`output: 'export'`)
- Allowlisted imports only
- No external API calls
- Tailwind CSS included

## Phase 2: File Injection System

**API Endpoint:** `/api/v0/render-ssr`

**Process:**
1. Receive v0 files from outline generation
2. Create temp directory for build
3. Copy template to temp dir
4. Inject v0 files into appropriate locations:
   - `page.tsx` → main component
   - `components/*.tsx` → component files
   - Any custom CSS → globals.css

**Code Structure:**
```javascript
async function injectFiles(templateDir, v0Files) {
  // Parse files and determine structure
  const pageComponent = findMainComponent(v0Files);
  const subComponents = findSubComponents(v0Files);
  
  // Write to template
  await fs.writeFile(`${templateDir}/app/page.tsx`, pageComponent);
  
  // Handle imports/dependencies
  await resolveImports(pageComponent, subComponents);
}
```

## Phase 3: Build & Render

**Two Approaches:**

### Option A: ReactDOMServer (Faster)
```javascript
import { renderToString } from 'react-dom/server';

// Load component dynamically
const Component = require(tempDir + '/app/page.tsx');

// Render to HTML
const html = renderToString(<Component />);
```

**Pros:** Fast, lightweight
**Cons:** Doesn't handle Next.js-specific features

### Option B: Next.js Build (More Complete)
```javascript
// Run Next.js build
execSync('npm run build', { cwd: tempDir });

// Extract static HTML from .next/server/
const html = fs.readFileSync(`${tempDir}/.next/server/app/page.html`);
```

**Pros:** Full Next.js support, handles all features
**Cons:** Slower, more complex

## Phase 4: HTML Extraction & Sanitization

```javascript
function extractAndSanitize(html) {
  // Parse HTML
  const $ = cheerio.load(html);
  
  // Remove scripts
  $('script').remove();
  
  // Remove Next.js metadata
  $('#__next-build-watcher').remove();
  
  // Extract main content
  const content = $('#__next').html() || $('body').html();
  
  // Inline Tailwind classes (keep as-is)
  return content;
}
```

## Phase 5: Security & Validation

### Import Allowlist
```javascript
const ALLOWED_IMPORTS = [
  'react',
  'react-dom',
  'lucide-react', // icons
  // Add as needed
];

function validateImports(fileContent) {
  const imports = extractImports(fileContent);
  const forbidden = imports.filter(i => !ALLOWED_IMPORTS.includes(i));
  
  if (forbidden.length > 0) {
    throw new Error(`Forbidden imports: ${forbidden.join(', ')}`);
  }
}
```

### Runtime Constraints
- No `fetch()` calls
- No `useEffect()` with external deps
- No dynamic imports
- No client-only hooks

## Phase 6: Error Handling

```javascript
try {
  const html = await renderSSR(v0Files);
  return { success: true, html };
} catch (error) {
  // Auto-regenerate with constraints
  if (error.type === 'FORBIDDEN_IMPORT') {
    return {
      success: false,
      error: 'Contains unsupported imports',
      suggestion: 'Regenerate without external libraries'
    };
  }
  
  // Fallback to browser rendering
  return await renderWithBrowser(demoUrl);
}
```

## Implementation Steps

### Step 1: Create Template (1-2 hours)
- [ ] Set up minimal Next.js project in `libs/v0-renderer/template/`
- [ ] Configure for static export
- [ ] Add Tailwind CSS
- [ ] Test manual build

### Step 2: File Injection (2-3 hours)
- [ ] Parse v0 file structure
- [ ] Identify main component vs sub-components
- [ ] Write injection logic
- [ ] Handle imports and dependencies

### Step 3: Build Runner (1-2 hours)
- [ ] Create temp directory management
- [ ] Run Next.js build in isolation
- [ ] Extract generated HTML
- [ ] Clean up temp files

### Step 4: Sanitization (1 hour)
- [ ] Parse HTML with cheerio
- [ ] Remove scripts and metadata
- [ ] Extract main content
- [ ] Validate output

### Step 5: API Integration (1 hour)
- [ ] Create `/api/v0/render-ssr` endpoint
- [ ] Integrate with existing flow
- [ ] Add to UI as primary option
- [ ] Keep browser render as fallback

### Step 6: Testing & Validation (2-3 hours)
- [ ] Test with various v0 outputs
- [ ] Validate HTML quality
- [ ] Performance testing
- [ ] Error handling scenarios

## Total Estimated Time: 8-12 hours

## Quick Win Alternative

If full SSR is too complex initially, improve browser rendering:
1. ✅ Select correct div (last visible div with content)
2. Wait for specific v0 markers (data attributes)
3. Extract inline styles separately
4. Post-process to remove scripts

## Decision Point

**Browser Rendering (Current):**
- ✅ Simple, already implemented
- ✅ Works for most cases
- ❌ Fragile, depends on v0 demo site
- ❌ Includes unnecessary markup

**SSR Rendering (Proposed):**
- ✅ Deterministic, reliable
- ✅ Clean HTML output
- ✅ Full control over build process
- ❌ Complex setup
- ❌ Requires build toolchain
- ❌ 8-12 hours implementation time

## Recommendation

1. **Immediate:** Fix browser rendering to select correct div (✅ Done above)
2. **Test:** Try fixed browser rendering with real v0 outputs
3. **Decide:** If browser rendering works well enough, defer SSR
4. **If needed:** Implement SSR as Phase 2 improvement

The browser rendering fix should work for most cases. Only implement SSR if:
- Browser rendering continues to fail
- Need better reliability for production
- Want cleaner HTML output
- Have time for proper implementation
