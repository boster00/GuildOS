/**
 * Hero Section Renderer
 */

import { SectionType } from "../../references/pageTypes/registry";

export function renderHero(
  sectionType: SectionType,
  content: any,
  theme: string = "default"
): string {
  const heading = content.heading || content.h1 || "Welcome";
  const subheading = content.subheading || content.subhead || "";
  const bullets = content.bullets || content.iconList || [];
  const cta = content.cta || content.primaryCTA || { text: "Get Started", url: "#" };
  const imagePrompt = content.imagePrompt || "";
  const trustIndicator = content.trustIndicator || "";
  const secondaryTrust = content.secondaryTrust || "";
  const isMinimalist = theme === "minimalist";

  const bulletsHtml = bullets.length > 0
    ? `<ul class="list-none p-0 my-6 space-y-3">
        ${bullets.map((bullet: any) => {
          const text = typeof bullet === "string" ? bullet : bullet.text || bullet.label || "";
          const icon = isMinimalist ? "✓" : (bullet.icon ? bullet.icon : "✓");
          return `<li class="flex items-center gap-3">
            <span class="${isMinimalist ? 'text-black' : 'text-blue-500'}">${icon}</span>
            <span>${text}</span>
          </li>`;
        }).join("")}
      </ul>`
    : "";

  if (isMinimalist) {
    return `<section class="py-28 bg-white">
  <div class="max-w-6xl mx-auto px-6">
    <div class="text-center max-w-3xl mx-auto">
      <h1 class="text-5xl font-bold mb-6 leading-tight text-black">${heading}</h1>
      ${subheading ? `<p class="text-xl mb-8 text-gray-600 leading-relaxed">${subheading}</p>` : ""}
      ${bulletsHtml}
      <div class="mt-10">
        <a href="${cta.url || "#"}" class="inline-block px-8 py-4 bg-black text-white font-semibold text-lg hover:bg-gray-800 transition-colors">
          ${cta.text || "Get Started"}
        </a>
      </div>
      ${trustIndicator ? `<p class="text-sm text-gray-600 mt-6">${trustIndicator}</p>` : ""}
      ${secondaryTrust ? `<p class="text-sm text-gray-400 mt-2">${secondaryTrust}</p>` : ""}
    </div>
  </div>
</section>`;
  }

  const imagePlaceholder = imagePrompt
    ? `<div class="bg-gray-100 border-2 border-dashed border-gray-300 rounded-lg p-10 text-center text-gray-600">
        <p class="font-semibold">Image Placeholder</p>
        <p class="text-sm mt-2">${imagePrompt}</p>
      </div>`
    : "";

  return `<section class="py-20 bg-gradient-to-br from-indigo-500 to-purple-600 text-white">
  <div class="max-w-6xl mx-auto px-6">
    <div class="grid grid-cols-1 md:grid-cols-2 gap-12 items-center">
      <div>
        <h1 class="text-5xl font-bold mb-6 leading-tight">${heading}</h1>
        ${subheading ? `<p class="text-xl mb-6 opacity-90">${subheading}</p>` : ""}
        ${bulletsHtml}
        <div class="mt-8">
          <a href="${cta.url || "#"}" class="inline-block px-6 py-3 bg-white text-indigo-600 font-semibold rounded-lg hover:bg-gray-100 transition-colors">
            ${cta.text || "Get Started"}
          </a>
        </div>
      </div>
      <div>
        ${imagePlaceholder || '<div class="bg-white bg-opacity-10 rounded-lg h-96"></div>'}
      </div>
    </div>
  </div>
</section>`;
}
