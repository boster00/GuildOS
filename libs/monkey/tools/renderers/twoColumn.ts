/**
 * Two Column Renderer - for side-by-side content
 */

import { SectionType } from "../../references/pageTypes/registry";

export function renderTwoColumn(sectionType: SectionType, content: any, theme: string = "default"): string {
  if (!content || typeof content !== 'object') {
    return `<section class="py-16"><div class="max-w-6xl mx-auto px-6"><p>Error: Invalid content structure for two column</p></div></section>`;
  }

  const heading = content.heading || content.title || "";
  const leftColumn = content.leftColumn || content.left || {};
  const rightColumn = content.rightColumn || content.right || {};

  const renderColumn = (col: any) => {
    const title = col.title || col.heading || "";
    const text = col.text || col.description || "";
    const bullets = col.bullets || [];

    const bulletsHtml = bullets.length > 0
      ? `<ul class="my-4 pl-6 text-gray-700 leading-relaxed">
        ${bullets.map((b: string) => `<li class="mb-2">${b}</li>`).join("")}
      </ul>`
      : "";

    return `<div>
      ${title ? `<h3 class="text-2xl font-semibold mb-4 text-gray-900">${title}</h3>` : ""}
      ${text ? `<p class="mb-4 text-gray-700 leading-relaxed">${text}</p>` : ""}
      ${bulletsHtml}
    </div>`;
  };

  return `<section class="py-16">
  <div class="max-w-6xl mx-auto px-6">
    ${heading ? `<h2 class="text-3xl font-bold text-center mb-12">${heading}</h2>` : ""}
    <div class="grid grid-cols-1 md:grid-cols-2 gap-12 items-start">
      ${renderColumn(leftColumn)}
      ${renderColumn(rightColumn)}
    </div>
  </div>
</section>`;
}
