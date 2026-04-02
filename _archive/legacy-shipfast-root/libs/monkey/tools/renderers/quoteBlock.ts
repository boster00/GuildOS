/**
 * Quote Block Renderer - for testimonials, case studies, or emphasis
 */

import { SectionType } from "../../references/pageTypes/registry";

export function renderQuoteBlock(
  sectionType: SectionType,
  format: string,
  content: any,
  theme: string = "default"
): string {
  if (!content || typeof content !== "object") {
    return `<section class="cj-section"><div class="cj-container"><p>Error: Invalid content structure for quote block</p></div></section>`;
  }

  const heading = content.heading || content.title || "";
  const quotes = content.quotes || content.items || content.testimonials || content.cases || [];
  const isMinimalist = theme === "minimalist";

  const quotesHtml = quotes.map((quote: any) => {
    const text = quote.text || quote.quote || "";
    const author = quote.author || "";
    const role = quote.role || quote.title || "";
    const company = quote.company || "";

    if (isMinimalist) {
      return `<div class="border-l-4 border-black pl-6 mb-6">
      <blockquote class="m-0 text-xl leading-relaxed text-gray-900 italic">
        "${text}"
      </blockquote>
      ${author ? `<div class="mt-4 text-gray-600">
        <div class="font-semibold text-gray-900">${author}</div>
        ${role ? `<div class="text-sm">${role}${company ? ` at ${company}` : ""}</div>` : ""}
      </div>` : ""}
    </div>`;
    }

    return `<div class="bg-gray-50 border-l-4 border-blue-500 p-8 mb-6 rounded-lg">
      <blockquote class="m-0 text-xl leading-relaxed text-gray-900 italic">
        "${text}"
      </blockquote>
      ${author ? `<div class="mt-5 text-gray-600">
        <div class="font-semibold text-gray-900">${author}</div>
        ${role ? `<div class="text-sm">${role}${company ? ` at ${company}` : ""}</div>` : ""}
      </div>` : ""}
    </div>`;
  }).join("");

  const headingSize = isMinimalist ? "text-4xl" : "text-3xl";
  const headingMargin = isMinimalist ? "mb-16" : "mb-12";

  return `<section class="py-16">
  <div class="max-w-4xl mx-auto px-6">
    ${heading ? `<h2 class="${headingSize} font-bold text-center ${headingMargin}">${heading}</h2>` : ""}
    ${quotesHtml}
  </div>
</section>`;
}
