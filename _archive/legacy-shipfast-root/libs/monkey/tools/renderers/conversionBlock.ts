/**
 * Conversion Block Renderer - combines formBlock and ctaBanner
 * Supports type: "form" | "cta"
 */

import { SectionType } from "../../references/pageTypes/registry";
import { ConversionBlockType } from "./templates";

export function renderConversionBlock(
  sectionType: SectionType,
  content: any,
  theme: string = "default",
  type: ConversionBlockType = "cta"
): string {
  if (!content || typeof content !== "object") {
    return `<section class="py-16"><div class="max-w-6xl mx-auto px-6"><p>Error: Invalid content structure for conversion block</p></div></section>`;
  }

  const isMinimalist = theme === "minimalist";

  if (type === "form") {
    // Form type
    const heading = content.heading || content.title || "Get Started";
    const fields = content.fields || [{ name: "email", label: "Email", type: "email", required: true }];
    const submitText = content.submitText || content.cta?.text || "Submit";
    const description = content.description || "";

    const fieldsHtml = fields.map((field: any) => {
      const name = field.name || "";
      const label = field.label || field.name || "";
      const fieldType = field.type || "text";
      const required = field.required || false;
      const placeholder = field.placeholder || "";

      return `<div class="mb-5">
        <label class="block mb-2 font-semibold">${label}${required ? " *" : ""}</label>
        <input type="${fieldType}" name="${name}" placeholder="${placeholder}" required="${required}" 
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
  } else {
    // CTA type
    const heading = content.heading || content.title || "";
    const text = content.text || content.description || "";
    const primaryCTA = content.cta || content.primaryCTA || { text: "Get Started", url: "#" };
    const secondaryCTA = content.secondaryCTA || null;
    const bullets = content.bullets || content.recap || [];

    const bulletsHtml = bullets.length > 0
      ? `<ul class="list-none p-0 my-6">
          ${bullets.map((bullet: any) => {
            const bulletText = typeof bullet === "string" ? bullet : bullet.text || "";
            return `<li class="flex items-center gap-3 mb-3 justify-center">
              <span class="${isMinimalist ? 'text-black' : 'text-blue-500'}">✓</span>
              <span>${bulletText}</span>
            </li>`;
          }).join("")}
        </ul>`
      : "";

    const ctaButtons = secondaryCTA
      ? `<div class="flex gap-4 justify-center flex-wrap">
          <a href="${primaryCTA.url || "#"}" class="${isMinimalist ? 'inline-block px-8 py-4 bg-black text-white font-semibold hover:bg-gray-800 transition-colors' : 'inline-block px-6 py-3 bg-blue-600 text-white font-semibold rounded-lg hover:bg-blue-700 transition-colors'}">
            ${primaryCTA.text || "Get Started"}
          </a>
          <a href="${secondaryCTA.url || "#"}" class="${isMinimalist ? 'inline-block px-8 py-4 bg-transparent border-2 border-black text-black font-semibold hover:bg-gray-50 transition-colors' : 'inline-block px-6 py-3 bg-transparent border-2 border-blue-600 text-blue-600 font-semibold rounded-lg hover:bg-blue-50 transition-colors'}">
            ${secondaryCTA.text || "Learn More"}
          </a>
        </div>`
      : `<a href="${primaryCTA.url || "#"}" class="${isMinimalist ? 'inline-block px-8 py-4 bg-black text-white font-semibold text-lg hover:bg-gray-800 transition-colors' : 'inline-block px-6 py-3 bg-blue-600 text-white font-semibold rounded-lg text-lg hover:bg-blue-700 transition-colors'}">
          ${primaryCTA.text || "Get Started"}
        </a>`;

    const bgColor = isMinimalist ? "bg-white" : "bg-gray-50";
    const sectionPadding = isMinimalist ? "py-24" : "py-20";
    const headingSize = isMinimalist ? "text-4xl" : "text-3xl";

    return `<section class="${sectionPadding} ${bgColor}">
  <div class="max-w-6xl mx-auto px-6">
    <div class="text-center max-w-3xl mx-auto">
      ${heading ? `<h2 class="${headingSize} font-bold mb-6">${heading}</h2>` : ""}
      ${text ? `<p class="text-xl mb-6 text-gray-600">${text}</p>` : ""}
      ${bulletsHtml}
      <div class="mt-8">
        ${ctaButtons}
      </div>
    </div>
  </div>
</section>`;
  }
}
