/**
 * Form Block Renderer
 */

import { SectionType } from "../../references/pageTypes/registry";

export function renderFormBlock(sectionType: SectionType, content: any, theme: string = "default"): string {
  const heading = content.heading || content.title || "Get Started";
  const fields = content.fields || [{ name: "email", label: "Email", type: "email", required: true }];
  const submitText = content.submitText || content.cta?.text || "Submit";
  const description = content.description || "";
  const isMinimalist = theme === "minimalist";

  const fieldsHtml = fields.map((field: any) => {
    const name = field.name || "";
    const label = field.label || field.name || "";
    const type = field.type || "text";
    const required = field.required || false;
    const placeholder = field.placeholder || "";

    return `<div class="mb-5">
      <label class="block mb-2 font-semibold">${label}${required ? " *" : ""}</label>
      <input type="${type}" name="${name}" placeholder="${placeholder}" required="${required}" 
        class="w-full p-3 border ${isMinimalist ? 'border-black' : 'border-gray-300 rounded-lg'} text-base">
    </div>`;
  }).join("");

  return `<section class="py-16">
  <div class="max-w-6xl mx-auto px-6">
    <div class="max-w-lg mx-auto">
      ${heading ? `<h2 class="text-3xl font-bold text-center mb-6">${heading}</h2>` : ""}
      ${description ? `<p class="text-center mb-8 text-gray-600">${description}</p>` : ""}
      <form data-action="submitLeadForm" class="${isMinimalist ? 'bg-transparent p-0' : 'bg-white p-8 rounded-lg border border-gray-200'}">
        ${fieldsHtml}
        <button type="submit" class="${isMinimalist ? 'w-full mt-2 px-8 py-4 bg-black text-white font-semibold hover:bg-gray-800 transition-colors' : 'w-full mt-2 px-6 py-3 bg-blue-600 text-white font-semibold rounded-lg hover:bg-blue-700 transition-colors'}">
          ${submitText}
        </button>
      </form>
    </div>
  </div>
</section>`;
}
