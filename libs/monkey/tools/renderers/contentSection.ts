/**
 * Content Section Renderer - combines textBlock and twoColumn
 * Supports single or twoColumn layout variants
 */

import { SectionType } from "../../references/pageTypes/registry";
import { ContentSectionLayout } from "./templates";

export function renderContentSection(
  sectionType: SectionType,
  content: any,
  theme: string = "default",
  layout: ContentSectionLayout = "single"
): string {
  if (!content || typeof content !== "object") {
    return `<section class="py-16"><div class="max-w-6xl mx-auto px-6"><p>Error: Invalid content structure for content section</p></div></section>`;
  }

  const isMinimalist = theme === "minimalist";
  const heading = content.heading || content.title || "";
  const subheading = content.subheading || "";

  if (layout === "twoColumn") {
    // Two column layout
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
  } else {
    // Single layout (default)
    const paragraphs = content.paragraphs || content.text || content.body || content.content || [];
    const bullets = content.bullets || content.points || [];

    const paragraphsHtml = Array.isArray(paragraphs)
      ? paragraphs.map(p => `<p class="mb-5 text-gray-700 ${isMinimalist ? 'leading-relaxed' : 'leading-loose'} text-lg">${p}</p>`).join("")
      : (paragraphs ? `<p class="mb-5 text-gray-700 ${isMinimalist ? 'leading-relaxed' : 'leading-loose'} text-lg">${paragraphs}</p>` : "");

    const bulletsHtml = bullets.length > 0
      ? `<ul class="my-6 pl-6 text-gray-700 ${isMinimalist ? 'leading-relaxed' : 'leading-loose'}">
        ${bullets.map((b: string) => `<li class="mb-3">${b}</li>`).join("")}
      </ul>`
      : "";

    const headingSize = isMinimalist ? "text-4xl" : "text-3xl";

    return `<section class="py-16">
  <div class="max-w-3xl mx-auto px-6">
    ${heading ? `<h2 class="${headingSize} font-bold mb-4 text-gray-900">${heading}</h2>` : ""}
    ${subheading ? `<p class="text-xl text-gray-600 mb-8">${subheading}</p>` : ""}
    ${paragraphsHtml}
    ${bulletsHtml}
  </div>
</section>`;
  }
}
