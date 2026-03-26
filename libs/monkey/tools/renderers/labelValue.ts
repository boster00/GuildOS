/**
 * Label-Value Table Renderer
 */

import { SectionType } from "../../references/pageTypes/registry";

export function renderLabelValue(sectionType: SectionType, content: any, theme: string = "default"): string {
  const heading = content.heading || content.title || "";
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
