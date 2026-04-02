/**
 * Client-safe Cat API — only `planQuest` (no skill_book / server-only deps).
 * Use `"use client"` components: `import { cat } from "@/libs/cat/client"`.
 */
import { planQuest } from "./planQuest.js";

export const cat = { planQuest };
