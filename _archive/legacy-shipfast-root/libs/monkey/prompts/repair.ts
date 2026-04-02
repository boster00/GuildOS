/**
 * Generic JSON repair prompt
 */

export function getRepairPrompt(schema: any, errors: string, badOutput: string): string {
  return `You fix JSON to match the schema. Output JSON only.

SCHEMA:
${JSON.stringify(schema, null, 2)}

VALIDATION ERRORS:
${errors}

BAD OUTPUT:
${badOutput.substring(0, 2000)}

TASK:
Return corrected JSON matching the schema. Output valid JSON only (no markdown, no code blocks, just JSON).`;
}

