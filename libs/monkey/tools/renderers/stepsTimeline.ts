/**
 * Steps Timeline Renderer
 */

import { SectionType } from "../../references/pageTypes/registry";

export function renderStepsTimeline(
  sectionType: SectionType,
  content: any,
  theme: string = "default"
): string {
  const heading = content.heading || content.title || "";
  const steps = content.steps || content.items || [];
  const isMinimalist = theme === "minimalist";

  const stepsHtml = steps.map((step: any, index: number) => {
    const title = step.title || step.heading || step.name || `Step ${index + 1}`;
    const description = step.description || step.text || "";
    const icon = step.icon || `${index + 1}`;

    return `<div class="flex gap-6 mb-8 relative">
      <div class="flex-shrink-0 w-12 h-12 rounded-full ${isMinimalist ? 'bg-black' : 'bg-blue-500'} text-white flex items-center justify-center font-bold text-xl">
        ${icon}
      </div>
      <div class="flex-1">
        <h3 class="text-xl font-semibold mb-2 ${isMinimalist ? 'text-black' : 'text-gray-900'}">${title}</h3>
        ${description ? `<p class="m-0 text-gray-600 leading-relaxed">${description}</p>` : ""}
      </div>
    </div>`;
  }).join("");

  const headingSize = isMinimalist ? "text-4xl" : "text-3xl";
  const headingMargin = isMinimalist ? "mb-16" : "mb-12";

  return `<section class="py-16">
  <div class="max-w-6xl mx-auto px-6">
    ${heading ? `<h2 class="${headingSize} font-bold text-center ${headingMargin}">${heading}</h2>` : ""}
    <div class="max-w-3xl mx-auto">
      ${stepsHtml}
    </div>
  </div>
</section>`;
}
