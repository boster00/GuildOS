/**
 * HTML Templates for Format Conversion
 * These templates are used in Step 4 to fit markdown content into HTML structure
 */

// Variant types for formats that support variants
export type ContentSectionLayout = "single" | "twoColumn";
export type KeyValueListVariant = "labelValue" | "checklist" | "stats";
export type ConversionBlockType = "form" | "cta";
export type HeroVariant = "default" | "fullWidth" | "twoColumnWithForm";

// Canonical format IDs (includes legacy IDs for backward compatibility)
export type FormatId = 
  | "hero"
  | "contentSection"  // replaces textBlock + twoColumn
  | "cardGrid"
  | "table"
  | "stepsTimeline"
  | "faqAccordion"
  | "conversionBlock"  // replaces formBlock + ctaBanner
  | "keyValueList"     // replaces labelValue + checklistBlock + statsStrip
  | "quoteBlock"
  // Legacy format IDs (mapped to canonical in getTemplate)
  | "twoColumn"
  | "textBlock"
  | "formBlock"
  | "ctaBanner"
  | "labelValue"
  | "checklistBlock"
  | "statsStrip";

// Template guidance for format selection
export const TEMPLATE_GUIDANCE: Record<FormatId, string> = {
  hero: "Use once at the very top to establish relevance and primary CTA fast. Keep concise, outcome-led, and scannable. ONLY ONE per page. Variants: 'default' (two-column with image), 'fullWidth' (centered single column), 'twoColumnWithForm' (form on right instead of image).",
  contentSection: "Use for narrative/explanatory sections. Layout: 'single' for standard paragraphs, 'twoColumn' for side-by-side comparison or paired narrative (benefit + details, key claims vs proof).",
  cardGrid: "Use for 3-6 discrete benefits, features, or highlights that should be equally scannable.",
  table: "Use for structured data (pricing, specs, comparisons) that must align in rows/columns.",
  stepsTimeline: "Use for processes, how-it-works, onboarding, or workflow steps (3-6 steps).",
  faqAccordion: "Use for objections, clarifications, and edge-case questions later in the page.",
  conversionBlock: "Use for data capture (form) or CTA emphasis (cta). Form: capture lead/input with minimal fields. CTA: restate CTA after value established, keep concise.",
  keyValueList: "Use for structured lists. Variant: 'labelValue' for concise facts/specs in pairs, 'checklist' for requirements/readiness checks, 'stats' for 3-4 key metrics (ONLY if real numbers exist).",
  quoteBlock: "Use for testimonials, proof snippets, or endorsements. ONLY if real quotes exist - auto-disqualify if no real quotes.",
  twoColumn: "Legacy: same as contentSection with twoColumn layout.",
  textBlock: "Legacy: same as contentSection single layout.",
  formBlock: "Legacy: same as conversionBlock form.",
  ctaBanner: "Legacy: same as conversionBlock cta.",
  labelValue: "Legacy: same as keyValueList labelValue variant.",
  checklistBlock: "Legacy: same as keyValueList checklist variant.",
  statsStrip: "Legacy: same as keyValueList stats variant.",
};

/**
 * Get HTML template for a given format
 * Templates contain placeholder text that AI will replace with actual content
 * @param formatId - Canonical format ID
 * @param theme - Theme (defaults to minimalist)
 * @param variant - Optional variant for formats that support variants (hero, contentSection, keyValueList, conversionBlock)
 */
export function getTemplate(
  formatId: FormatId, 
  theme: string = "default",
  variant?: HeroVariant | ContentSectionLayout | KeyValueListVariant | ConversionBlockType
): string {
  // Default to minimalist, neutral styling
  const isMinimalist = true;
  
  switch (formatId) {
    case "hero":
      const heroVariant = (variant as HeroVariant) || "default";
      
      if (heroVariant === "fullWidth") {
        // Full width centered variant
        return `<section class="py-24 bg-white">
  <div class="max-w-4xl mx-auto px-6">
    <div class="text-center">
      <h1 class="text-5xl font-bold mb-6 leading-tight text-gray-900">Your Main Heading</h1>
      <p class="text-xl mb-6 text-gray-700 leading-relaxed">Your subheading text</p>
      <ul class="list-none p-0 my-6 space-y-3 max-w-2xl mx-auto">
        <li class="flex items-center gap-3 justify-center">
          <span class="text-gray-900">✓</span>
          <span>Bullet point</span>
        </li>
      </ul>
      <div class="mt-8 flex flex-wrap gap-3 justify-center">
        <a href="#" class="inline-block px-6 py-3 bg-gray-900 text-white font-semibold rounded-lg hover:bg-gray-800 transition-colors">Get Started</a>
      </div>
      <p class="text-sm text-gray-600 mt-6">Trust indicator text</p>
    </div>
  </div>
</section>`;
      } else if (heroVariant === "twoColumnWithForm") {
        // Two column with form on right instead of image
        return `<section class="py-24 bg-white">
  <div class="max-w-6xl mx-auto px-6">
    <div class="grid grid-cols-1 md:grid-cols-2 gap-12 items-center">
      <div>
        <h1 class="text-5xl font-bold mb-6 leading-tight text-gray-900">Your Main Heading</h1>
        <p class="text-xl mb-6 text-gray-700 leading-relaxed">Your subheading text</p>
        <ul class="list-none p-0 my-6 space-y-3">
          <li class="flex items-center gap-3">
            <span class="text-gray-900">✓</span>
            <span>Bullet point</span>
          </li>
        </ul>
        <p class="text-sm text-gray-600 mt-6">Trust indicator text</p>
      </div>
      <div>
        <div class="bg-gray-50 border border-gray-200 rounded-lg p-6">
          <h3 class="text-lg font-semibold mb-4 text-gray-900">Get Started</h3>
          <form data-action="submitLeadForm" class="space-y-4">
            <div>
              <label class="block mb-2 text-sm font-medium text-gray-700">Name *</label>
              <input type="text" name="name" placeholder="Your name" required="true" class="w-full p-3 border border-gray-300 rounded-lg text-base">
            </div>
            <div>
              <label class="block mb-2 text-sm font-medium text-gray-700">Email *</label>
              <input type="email" name="email" placeholder="your@email.com" required="true" class="w-full p-3 border border-gray-300 rounded-lg text-base">
            </div>
            <button type="submit" class="w-full mt-2 px-6 py-3 bg-gray-900 text-white font-semibold rounded-lg hover:bg-gray-800 transition-colors">Submit</button>
          </form>
        </div>
      </div>
    </div>
  </div>
</section>`;
      } else {
        // Default variant (two-column with image)
        return `<section class="py-24 bg-white">
  <div class="max-w-6xl mx-auto px-6">
    <div class="grid grid-cols-1 md:grid-cols-2 gap-12 items-center">
      <div>
        <h1 class="text-5xl font-bold mb-6 leading-tight text-gray-900">Your Main Heading</h1>
        <p class="text-xl mb-6 text-gray-700 leading-relaxed">Your subheading text</p>
        <ul class="list-none p-0 my-6 space-y-3">
          <li class="flex items-center gap-3">
            <span class="text-gray-900">✓</span>
            <span>Bullet point</span>
          </li>
        </ul>
        <div class="mt-8 flex flex-wrap gap-3">
          <a href="#" class="inline-block px-6 py-3 bg-gray-900 text-white font-semibold rounded-lg hover:bg-gray-800 transition-colors">Get Started</a>
        </div>
        <p class="text-sm text-gray-600 mt-6">Trust indicator text</p>
      </div>
      <div>
        <div class="bg-gray-100 border border-dashed border-gray-300 rounded-lg h-80 flex items-center justify-center text-gray-500 text-sm">
          Image / visual placeholder
        </div>
      </div>
    </div>
  </div>
</section>`;
      }

    case "cardGrid":
      const sectionPadding = isMinimalist ? "py-24" : "py-16";
      return `<section class="${sectionPadding}">
  <div class="max-w-6xl mx-auto px-6">
    <h2 class="text-3xl font-bold text-center mb-12">Section Heading</h2>
    <div class="grid grid-cols-1 md:grid-cols-3 gap-6">
      <div class="bg-white border border-gray-200 rounded-lg shadow-md p-6">
        <h3 class="text-xl font-semibold mb-3">Card Title</h3>
        <p class="m-0 text-gray-600 leading-relaxed">Card description</p>
      </div>
    </div>
  </div>
</section>`;

    case "faqAccordion":
      const headingSize = isMinimalist ? "text-4xl" : "text-3xl";
      const headingMargin = isMinimalist ? "mb-16" : "mb-12";
      return `<section class="py-16">
  <div class="max-w-6xl mx-auto px-6">
    <h2 class="${headingSize} font-bold text-center ${headingMargin}">Frequently Asked Questions</h2>
    <div class="max-w-3xl mx-auto">
      <div class="bg-white border border-gray-200 rounded-lg shadow-md p-6 mb-4">
        <h3 class="text-lg font-semibold mb-3">Question text?</h3>
        <p class="m-0 text-gray-600 leading-relaxed">Answer text</p>
      </div>
    </div>
  </div>
</section>`;

    case "stepsTimeline":
      return `<section class="py-16">
  <div class="max-w-6xl mx-auto px-6">
    <h2 class="text-3xl font-bold text-center mb-12">Section Heading</h2>
    <div class="max-w-3xl mx-auto">
      <div class="flex gap-6 mb-8 relative">
        <div class="flex-shrink-0 w-12 h-12 rounded-full bg-blue-500 text-white flex items-center justify-center font-bold text-xl">1</div>
        <div class="flex-1">
          <h3 class="text-xl font-semibold mb-2 text-gray-900">Step Title</h3>
          <p class="m-0 text-gray-600 leading-relaxed">Step description</p>
        </div>
      </div>
    </div>
  </div>
</section>`;

    case "table":
      return `<section class="py-16">
  <div class="max-w-6xl mx-auto px-6">
    <h2 class="text-3xl font-bold text-center mb-12">Section Heading</h2>
    <div class="overflow-x-auto">
      <table class="w-full border-collapse">
        <thead>
          <tr>
            <th class="p-3 text-left border-b-2 border-gray-200">Column 1</th>
            <th class="p-3 text-left border-b-2 border-gray-200">Column 2</th>
          </tr>
        </thead>
        <tbody>
          <tr>
            <td class="p-3 border-b border-gray-200">Cell data</td>
            <td class="p-3 border-b border-gray-200">Cell data</td>
          </tr>
        </tbody>
      </table>
    </div>
  </div>
</section>`;

    case "contentSection":
      const layout = (variant as ContentSectionLayout) || "single";
      if (layout === "twoColumn") {
        // Two column layout
        return `<section class="py-16">
  <div class="max-w-6xl mx-auto px-6">
    <h2 class="text-3xl font-bold text-center mb-12">Section Heading</h2>
    <div class="grid grid-cols-1 md:grid-cols-2 gap-12 items-start">
      <div>
        <h3 class="text-2xl font-semibold mb-4 text-gray-900">Left Column Title</h3>
        <p class="mb-4 text-gray-700 leading-relaxed">Left column paragraph text</p>
        <ul class="my-4 pl-6 text-gray-700 leading-relaxed">
          <li class="mb-2">Bullet point</li>
        </ul>
      </div>
      <div>
        <h3 class="text-2xl font-semibold mb-4 text-gray-900">Right Column Title</h3>
        <p class="mb-4 text-gray-700 leading-relaxed">Right column paragraph text</p>
        <ul class="my-4 pl-6 text-gray-700 leading-relaxed">
          <li class="mb-2">Bullet point</li>
        </ul>
      </div>
    </div>
  </div>
</section>`;
      } else {
        // Single layout (default)
        return `<section class="py-16">
  <div class="max-w-3xl mx-auto px-6">
    <h2 class="text-3xl font-bold mb-4 text-gray-900">Section Heading</h2>
    <p class="text-xl text-gray-600 mb-8">Subheading text</p>
    <p class="mb-5 text-gray-700 leading-loose text-lg">Paragraph text</p>
    <ul class="my-6 pl-6 text-gray-700 leading-loose">
      <li class="mb-3">Bullet point</li>
    </ul>
  </div>
</section>`;
      }

    case "conversionBlock":
      const conversionType = (variant as ConversionBlockType) || "cta";
      if (conversionType === "form") {
        // Form type
        return `<section class="py-16">
  <div class="max-w-6xl mx-auto px-6">
    <div class="max-w-lg mx-auto">
      <h2 class="text-3xl font-bold text-center mb-6">Get Started</h2>
      <p class="text-center mb-8 text-gray-600">Form description text</p>
      <form data-action="submitLeadForm" class="bg-white p-8 rounded-lg border border-gray-200">
        <div class="mb-5">
          <label class="block mb-2 font-semibold">Field Label *</label>
          <input type="text" name="fieldname" placeholder="Placeholder" required="true" class="w-full p-3 border border-gray-300 rounded-lg text-base">
        </div>
        <button type="submit" class="w-full mt-2 px-6 py-3 bg-blue-600 text-white font-semibold rounded-lg hover:bg-blue-700 transition-colors">Submit</button>
      </form>
    </div>
  </div>
</section>`;
      } else {
        // CTA type
        return `<section class="py-20 bg-gray-50">
  <div class="max-w-6xl mx-auto px-6">
    <div class="text-center max-w-3xl mx-auto">
      <h2 class="text-3xl font-bold mb-6">Your Heading</h2>
      <p class="text-xl mb-6 text-gray-600">Your description text</p>
      <ul class="list-none p-0 my-6">
        <li class="flex items-center gap-3 mb-3 justify-center">
          <span class="text-blue-500">✓</span>
          <span>Bullet point text</span>
        </li>
      </ul>
      <div class="mt-8">
        <a href="#" class="inline-block px-6 py-3 bg-blue-600 text-white font-semibold rounded-lg text-lg hover:bg-blue-700 transition-colors">Button Text</a>
      </div>
    </div>
  </div>
</section>`;
      }

    case "keyValueList":
      const listVariant = (variant as KeyValueListVariant) || "labelValue";
      if (listVariant === "checklist") {
        // Checklist variant
        return `<section class="py-16">
  <div class="max-w-3xl mx-auto px-6">
    <h2 class="text-3xl font-bold mb-4 text-gray-900">Section Heading</h2>
    <p class="text-lg text-gray-600 mb-8">Subheading text</p>
    <div class="bg-gray-50 rounded-xl p-8">
      <div class="flex items-start mb-4">
        <div class="flex-shrink-0 w-8 h-8 rounded-full bg-blue-100 text-blue-500 flex items-center justify-center font-bold mr-4">✓</div>
        <div class="flex-1 pt-1 text-gray-700 leading-relaxed">Checklist item text</div>
      </div>
    </div>
  </div>
</section>`;
      } else if (listVariant === "stats") {
        // Stats variant
        return `<section class="py-16 bg-gray-50">
  <div class="max-w-6xl mx-auto px-6">
    <h2 class="text-3xl font-bold text-center mb-12">Section Heading</h2>
    <div class="grid grid-cols-1 md:grid-cols-3 gap-8">
      <div class="text-center p-5">
        <div class="text-5xl font-bold text-blue-500 mb-2">100</div>
        <div class="text-base text-gray-600">Stat label</div>
      </div>
    </div>
  </div>
</section>`;
      } else {
        // LabelValue variant (default)
        return `<section class="py-16">
  <div class="max-w-6xl mx-auto px-6">
    <h2 class="text-3xl font-bold text-center mb-12">Section Heading</h2>
    <div class="max-w-3xl mx-auto overflow-x-auto">
      <table class="w-full border-collapse">
        <tbody>
          <tr>
            <td class="p-3 border-b border-gray-200 font-semibold w-2/5">Label</td>
            <td class="p-3 border-b border-gray-200">Value</td>
          </tr>
        </tbody>
      </table>
    </div>
  </div>
</section>`;
      }

    // Legacy format mappings (for backward compatibility)
    case "twoColumn":
      return getTemplate("contentSection", theme, "twoColumn");
    case "textBlock":
      return getTemplate("contentSection", theme, "single");
    case "formBlock":
      return getTemplate("conversionBlock", theme, "form");
    case "ctaBanner":
      return getTemplate("conversionBlock", theme, "cta");
    case "labelValue":
      return getTemplate("keyValueList", theme, "labelValue");
    case "checklistBlock":
      return getTemplate("keyValueList", theme, "checklist");
    case "statsStrip":
      return getTemplate("keyValueList", theme, "stats");

    case "quoteBlock":
      return `<section class="py-16">
  <div class="max-w-4xl mx-auto px-6">
    <h2 class="text-3xl font-bold text-center mb-12">Section Heading</h2>
    <div class="bg-gray-50 border-l-4 border-blue-500 p-8 mb-6 rounded-lg">
      <blockquote class="m-0 text-xl leading-relaxed text-gray-900 italic">"Quote text"</blockquote>
      <div class="mt-5 text-gray-600">
        <div class="font-semibold text-gray-900">Author Name</div>
        <div class="text-sm">Role at Company</div>
      </div>
    </div>
  </div>
</section>`;

    default:
      // Fallback to contentSection single layout
      return getTemplate("contentSection", theme, "single");
  }
}
