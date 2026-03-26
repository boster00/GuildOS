/**
 * FAQ Accordion Renderer
 */

import { SectionType } from "../../references/pageTypes/registry";

export function renderFaqAccordion(
  sectionType: SectionType,
  content: any,
  theme: string = "default"
): string {
  const heading = content.heading || content.title || "Frequently Asked Questions";
  const items = content.items || content.faqs || [];
  const isMinimalist = theme === "minimalist";

  const itemsHtml = items.map((item: any) => {
    const question = item.question || item.q || "";
    const answer = item.answer || item.a || "";

    if (isMinimalist) {
      return `<div class="mb-4 p-0">
        <h3 class="text-lg font-semibold mb-2 text-black">${question}</h3>
        <p class="m-0 text-gray-600 leading-relaxed">${answer}</p>
      </div>`;
    }

    return `<div class="bg-white border border-gray-200 rounded-lg shadow-md p-6 mb-4">
      <h3 class="text-lg font-semibold mb-3">${question}</h3>
      <p class="m-0 text-gray-600 leading-relaxed">${answer}</p>
    </div>`;
  }).join("");

  const headingSize = isMinimalist ? "text-4xl" : "text-3xl";
  const headingMargin = isMinimalist ? "mb-16" : "mb-12";

  return `<section class="py-16">
  <div class="max-w-6xl mx-auto px-6">
    ${heading ? `<h2 class="${headingSize} font-bold text-center ${headingMargin}">${heading}</h2>` : ""}
    <div class="max-w-3xl mx-auto">
      ${itemsHtml}
    </div>
  </div>
</section>`;
}
