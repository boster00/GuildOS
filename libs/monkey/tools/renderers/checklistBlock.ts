/**
 * Checklist Block Renderer - for requirements, features, or process steps
 */

import { SectionType } from "../../references/pageTypes/registry";

export function renderChecklistBlock(sectionType: SectionType, content: any, theme: string = "default"): string {
  if (!content || typeof content !== 'object') {
    return `<section class="py-16"><div class="max-w-6xl mx-auto px-6"><p>Error: Invalid content structure for checklist</p></div></section>`;
  }

  const heading = content.heading || content.title || "";
  const subheading = content.subheading || "";
  const items = content.items || content.checklist || content.requirements || content.features || [];
  const isMinimalist = theme === "minimalist";

  const itemsHtml = items.map((item: any) => {
    const text = typeof item === "string" ? item : (item.text || item.label || "");
    const checked = typeof item === "object" ? (item.checked !== false) : true;
    const icon = checked ? "✓" : "○";

    return `<div class="flex items-start mb-4">
      <div class="flex-shrink-0 w-8 h-8 rounded-full ${isMinimalist ? 'border-2 border-black text-black' : 'bg-blue-100 text-blue-500'} flex items-center justify-center font-bold mr-4">
        ${icon}
      </div>
      <div class="flex-1 pt-1 text-gray-700 leading-relaxed">
        ${text}
      </div>
    </div>`;
  }).join("");

  return `<section class="py-16">
  <div class="max-w-3xl mx-auto px-6">
    ${heading ? `<h2 class="text-3xl font-bold mb-4 text-gray-900">${heading}</h2>` : ""}
    ${subheading ? `<p class="text-lg text-gray-600 mb-8">${subheading}</p>` : ""}
    <div class="${isMinimalist ? 'bg-transparent p-0' : 'bg-gray-50 rounded-xl p-8'}">
      ${itemsHtml}
    </div>
  </div>
</section>`;
}
