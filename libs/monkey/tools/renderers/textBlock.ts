/**
 * Text Block Renderer - for narrative/prose content
 */

import { SectionType } from "../../references/pageTypes/registry";

export function renderTextBlock(
  sectionType: SectionType,
  content: any,
  theme: string = "default"
): string {
  if (!content || typeof content !== "object") {
    return `<section class="cj-section"><div class="cj-container"><p>Error: Invalid content structure for text block</p></div></section>`;
  }

  const heading = content.heading || content.title || "";
  const subheading = content.subheading || "";
  const paragraphs = content.paragraphs || content.text || content.body || content.content || [];
  const bullets = content.bullets || content.points || [];
  const isMinimalist = theme === "minimalist";

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
