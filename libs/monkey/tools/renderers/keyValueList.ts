/**
 * Key Value List Renderer - combines labelValue, checklistBlock, and statsStrip
 * Supports variant: "labelValue" | "checklist" | "stats"
 */

import { SectionType } from "../../references/pageTypes/registry";
import { KeyValueListVariant } from "./templates";

export function renderKeyValueList(
  sectionType: SectionType,
  content: any,
  theme: string = "default",
  variant: KeyValueListVariant = "labelValue"
): string {
  if (!content || typeof content !== "object") {
    return `<section class="py-16"><div class="max-w-6xl mx-auto px-6"><p>Error: Invalid content structure for key value list</p></div></section>`;
  }

  const isMinimalist = theme === "minimalist";
  const heading = content.heading || content.title || "";
  const subheading = content.subheading || "";

  if (variant === "checklist") {
    // Checklist variant
    const items = content.items || content.checklist || content.requirements || content.features || [];

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
  } else if (variant === "stats") {
    // Stats variant
    const stats = content.stats || content.items || content.metrics || content.numbers || [];

    const statsHtml = stats.map((stat: any) => {
      const value = stat.value || stat.number || "";
      const label = stat.label || stat.description || "";
      const icon = stat.icon || "";

      return `<div class="text-center p-5">
        ${!isMinimalist && icon ? `<div class="text-3xl mb-3">${icon}</div>` : ""}
        <div class="${isMinimalist ? 'text-5xl' : 'text-5xl'} font-bold ${isMinimalist ? 'text-black' : 'text-blue-500'} mb-2">${value}</div>
        <div class="text-base text-gray-600">${label}</div>
      </div>`;
    }).join("");

    const headingSize = isMinimalist ? "text-4xl" : "text-3xl";
    const headingMargin = isMinimalist ? "mb-16" : "mb-12";
    const sectionBg = isMinimalist ? "bg-white" : "bg-gray-50";

    return `<section class="py-16 ${sectionBg}">
  <div class="max-w-6xl mx-auto px-6">
    ${heading ? `<h2 class="${headingSize} font-bold text-center ${headingMargin}">${heading}</h2>` : ""}
    <div class="grid grid-cols-1 md:grid-cols-${stats.length > 3 ? '4' : stats.length} gap-${isMinimalist ? '10' : '8'}">
      ${statsHtml}
    </div>
  </div>
</section>`;
  } else {
    // LabelValue variant (default)
    const items = content.items || content.rows || content.specs || content.details || [];

    const rowsHtml = items.map((item: any) => {
      const label = item.label || item.name || "";
      const value = item.value || item.description || "";

      return `<tr>
        <td class="p-3 border-b border-gray-200 font-semibold w-2/5">${label}</td>
        <td class="p-3 border-b border-gray-200">${value}</td>
      </tr>`;
    }).join("");

    return `<section class="py-16">
  <div class="max-w-6xl mx-auto px-6">
    ${heading ? `<h2 class="text-3xl font-bold text-center mb-12">${heading}</h2>` : ""}
    <div class="max-w-3xl mx-auto overflow-x-auto">
      <table class="w-full border-collapse">
        <tbody>${rowsHtml}</tbody>
      </table>
    </div>
  </div>
</section>`;
  }
}
