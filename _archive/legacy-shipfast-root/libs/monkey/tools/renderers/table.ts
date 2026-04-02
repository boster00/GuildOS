/**
 * Table Renderer (comparison, pricing, etc.)
 */

import { SectionType } from "../../references/pageTypes/registry";

export function renderTable(
  sectionType: SectionType,
  format: string,
  content: any,
  theme: string = "default"
): string {
  const heading = content.heading || content.title || "";
  const rows = content.rows || content.items || [];
  const columns = content.columns || [];
  const isMinimalist = theme === "minimalist";

  if (format.includes("pricing")) {
    return renderPricingTable(heading, content, theme);
  }

  if (format.includes("comparison")) {
    return renderComparisonTable(heading, content, theme);
  }

  // Generic table
  const headerRow = columns.length > 0
    ? `<tr>${columns.map((col: string) => `<th class="p-3 text-left border-b-2 border-gray-200">${col}</th>`).join("")}</tr>`
    : "";

  const bodyRows = rows.map((row: any) => {
    if (Array.isArray(row)) {
      return `<tr>${row.map((cell: any) => `<td class="p-3 border-b border-gray-200">${cell}</td>`).join("")}</tr>`;
    }
    return `<tr>${Object.values(row).map((cell: any) => `<td class="p-3 border-b border-gray-200">${cell}</td>`).join("")}</tr>`;
  }).join("");

  const headingSize = isMinimalist ? "text-4xl" : "text-3xl";
  const headingMargin = isMinimalist ? "mb-16" : "mb-12";

  return `<section class="py-16">
  <div class="max-w-6xl mx-auto px-6">
    ${heading ? `<h2 class="${headingSize} font-bold text-center ${headingMargin}">${heading}</h2>` : ""}
    <div class="overflow-x-auto">
      <table class="w-full border-collapse">
        <thead>${headerRow}</thead>
        <tbody>${bodyRows}</tbody>
      </table>
    </div>
  </div>
</section>`;
}

function renderPricingTable(heading: string, content: any, theme: string = "default"): string {
  const tiers = content.tiers || content.items || [];
  const isMinimalist = theme === "minimalist";

  const tiersHtml = tiers.map((tier: any) => {
    const name = tier.name || tier.tier || "";
    const price = tier.price || "";
    const features = tier.features || [];
    const cta = tier.cta || { text: "Choose Plan", url: "#" };

    return `<div class="${isMinimalist ? 'bg-transparent border-0 p-6 text-center' : 'bg-white border border-gray-200 rounded-lg shadow-md p-6 text-center'}">
      <h3 class="text-2xl mb-3">${name}</h3>
      <div class="text-5xl font-bold my-6">${price}</div>
      <ul class="list-none p-0 my-6 text-left">
        ${features.map((feature: string) => `<li class="py-2 border-b border-gray-200">✓ ${feature}</li>`).join("")}
      </ul>
      <a href="${cta.url || "#"}" class="${isMinimalist ? 'inline-block px-8 py-4 bg-black text-white font-semibold hover:bg-gray-800 transition-colors w-full text-center' : 'inline-block px-6 py-3 bg-blue-600 text-white font-semibold rounded-lg hover:bg-blue-700 transition-colors w-full text-center'}">${cta.text}</a>
    </div>`;
  }).join("");

  return `<section class="py-16">
  <div class="max-w-6xl mx-auto px-6">
    ${heading ? `<h2 class="text-3xl font-bold text-center mb-12">${heading}</h2>` : ""}
    <div class="grid grid-cols-1 md:grid-cols-${tiers.length} gap-6">
      ${tiersHtml}
    </div>
  </div>
</section>`;
}

function renderComparisonTable(heading: string, content: any, theme: string = "default"): string {
  const criteria = content.criteria || [];
  const rows = content.rows || [];

  const headerRow = `<tr>
    <th class="p-3 text-left border-b-2 border-gray-200">Criteria</th>
    <th class="p-3 text-center border-b-2 border-gray-200">Typical Approach</th>
    <th class="p-3 text-center border-b-2 border-gray-200">Our Approach</th>
  </tr>`;

  const bodyRows = criteria.map((criterion: any) => {
    const name = criterion.name || criterion.criteria || "";
    const typical = criterion.typical || "";
    const our = criterion.our || criterion.ours || "";

    return `<tr>
      <td class="p-3 border-b border-gray-200 font-semibold">${name}</td>
      <td class="p-3 border-b border-gray-200">${typical}</td>
      <td class="p-3 border-b border-gray-200 bg-blue-50">${our}</td>
    </tr>`;
  }).join("");

  return `<section class="py-16">
  <div class="max-w-6xl mx-auto px-6">
    ${heading ? `<h2 class="text-3xl font-bold text-center mb-12">${heading}</h2>` : ""}
    <div class="overflow-x-auto">
      <table class="w-full border-collapse">
        <thead>${headerRow}</thead>
        <tbody>${bodyRows}</tbody>
      </table>
    </div>
  </div>
</section>`;
}
