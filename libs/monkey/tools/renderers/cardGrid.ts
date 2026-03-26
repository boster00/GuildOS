/**
 * Card Grid Renderer
 */

import { SectionType } from "../../references/pageTypes/registry";

export function renderCardGrid(
  sectionType: SectionType,
  format: string,
  content: any,
  theme: string = "default"
): string {
  const heading = content.heading || content.title || "";
  // Handle various property names for items
  const items = content.items || content.cards || content.badges || content.icons || content.benefits || content.features || [];
  const columns = content.columns || 3;
  const isMinimalist = theme === "minimalist";

  const itemsHtml = items.map((item: any) => {
    const title = item.title || item.heading || item.name || "";
    const description = item.description || item.text || "";
    const icon = item.icon || (format.includes("icon") ? (isMinimalist ? "→" : "✓") : "");
    const number = item.number || "";

    if (isMinimalist) {
      return `<div class="bg-transparent border-0 p-6 text-center">
        ${icon ? `<div class="text-3xl mb-3 text-black">${icon}</div>` : ""}
        ${number ? `<div class="text-xl font-semibold text-black mb-2">${number}</div>` : ""}
        ${title ? `<h3 class="text-xl font-semibold mb-3 text-black">${title}</h3>` : ""}
        ${description ? `<p class="m-0 text-gray-600 leading-relaxed">${description}</p>` : ""}
      </div>`;
    }

    return `<div class="bg-white border border-gray-200 rounded-lg shadow-md p-6">
      ${icon ? `<div class="text-3xl mb-3">${icon}</div>` : ""}
      ${number ? `<div class="text-2xl font-bold text-blue-500 mb-3">${number}</div>` : ""}
      ${title ? `<h3 class="text-xl font-semibold mb-3">${title}</h3>` : ""}
      ${description ? `<p class="m-0 text-gray-600 leading-relaxed">${description}</p>` : ""}
    </div>`;
  }).join("");

  const sectionPadding = isMinimalist ? "py-24" : "py-16";
  const headingSize = isMinimalist ? "text-4xl" : "text-3xl";
  const headingMargin = isMinimalist ? "mb-16" : "mb-12";
  const gridGap = isMinimalist ? (format.includes("badge_row") ? "gap-8" : "gap-12") : "gap-6";

  return `<section class="${sectionPadding}">
  <div class="max-w-6xl mx-auto px-6">
    ${heading ? `<h2 class="${headingSize} font-bold text-center ${headingMargin}">${heading}</h2>` : ""}
    <div class="grid grid-cols-1 md:grid-cols-${columns} ${gridGap}">
      ${itemsHtml}
    </div>
  </div>
</section>`;
}
