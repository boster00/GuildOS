/**
 * Stats Strip Renderer - for highlighting key metrics
 */

import { SectionType } from "../../references/pageTypes/registry";

export function renderStatsStrip(
  sectionType: SectionType,
  content: any,
  theme: string = "default"
): string {
  if (!content || typeof content !== "object") {
    return `<section class="cj-section"><div class="cj-container"><p>Error: Invalid content structure for stats strip</p></div></section>`;
  }

  const heading = content.heading || content.title || "";
  const stats = content.stats || content.items || content.metrics || content.numbers || [];
  const isMinimalist = theme === "minimalist";

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
}
