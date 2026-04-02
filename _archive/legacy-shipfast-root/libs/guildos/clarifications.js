/**
 * Open product questions — do not guess behavior; resolve with product before hard-coding.
 */
export const GUILDOS_CLARIFICATION_QUESTIONS = [
  "Should Tavern and Quest Board remain one module with two surfaces, or separate services?",
  "Are adventurers strictly logical workers (rows only) or tied to external compute (K8s jobs, queue consumers)?",
  "Where should potion secrets live: hosted Postgres Vault, KMS envelope, or third-party secret manager?",
  "Should shields be evaluated only server-side, or also in client UX previews?",
  "What is the canonical quest lifecycle: draft → open → claimed → in_progress → completed, or different states per tenant?",
];
