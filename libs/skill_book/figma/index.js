import {
  readFile as wReadFile,
  readNodes as wReadNodes,
  readExport as wReadExport,
  checkCredentials as wCheckCredentials,
} from "@/libs/weapon/figma";
import { skillActionOk, skillActionErr } from "@/libs/skill_book/actionResult.js";

/**
 * Primary design file — Boster Design Master File.
 * Update this constant if the master file changes.
 * URL: https://www.figma.com/design/NMfOvoGgMVFPYM4nLtN8zD/Boster-Design-Master-File
 */
const PRIMARY_FILE_KEY = "NMfOvoGgMVFPYM4nLtN8zD";

export const skillBook = {
  id: "figma",
  title: "Figma",
  description:
    "Read design pages, frames, and assets from Figma via REST API. " +
    "Primary file: Boster-Design-Master-File (NMfOvoGgMVFPYM4nLtN8zD). " +
    "Requires FIGMA_ACCESS_TOKEN.",
  steps: [],
  toc: {
    readPages: {
      description:
        "List all pages in the primary Figma file (or a given fileKey). " +
        "Returns each page's id, name, and top-level child count.",
      input: { fileKey: "string, optional — defaults to Boster Design Master File" },
      output: { pages: "array of { id, name, childCount }" },
    },
    readPage: {
      description:
        "Get the full node tree for a single named page. Useful for understanding " +
        "layout structure before exporting specific frames.",
      input: {
        pageName: "string — page name, e.g. 'Home' or 'Components'",
        fileKey: "string, optional — defaults to primary file",
        depth: "int, optional — tree depth limit (default 3)",
      },
      output: { page: "Figma node object with children", fileKey: "string" },
    },
    exportFrames: {
      description:
        "Export one or more frames/components as image URLs (PNG by default). " +
        "Pass nodeIds as an array of Figma node IDs (e.g. '1234:5678').",
      input: {
        nodeIds: "array of string — Figma node IDs to export",
        fileKey: "string, optional — defaults to primary file",
        format: "string, optional — 'png' | 'jpg' | 'svg' | 'pdf' (default 'png')",
        scale: "number, optional — render scale (default 2)",
      },
      output: { images: "object — map of nodeId → image URL" },
    },
    readComponents: {
      description:
        "List all top-level frames and components across all pages of a file. " +
        "Useful for discovering what's available before a targeted readPage or exportFrames.",
      input: { fileKey: "string, optional — defaults to primary file" },
      output: { components: "array of { id, name, page, type }" },
    },
  },
};

export async function readPages(a, b) {
  const [userId, input] = typeof a === "string" ? [a, b ?? {}] : [undefined, a ?? {}];
  const fileKey = input?.fileKey || PRIMARY_FILE_KEY;
  try {
    const data = await wReadFile({ fileKey, depth: 1 }, userId);
    const pages = (data?.document?.children || []).map((p) => ({
      id: p.id,
      name: p.name,
      childCount: p.children?.length ?? 0,
    }));
    return skillActionOk({ pages, fileKey });
  } catch (e) {
    return skillActionErr(e.message);
  }
}

export async function readPage(a, b) {
  const [userId, input] = typeof a === "string" ? [a, b ?? {}] : [undefined, a ?? {}];
  if (!input?.pageName) return skillActionErr("pageName required");
  const fileKey = input?.fileKey || PRIMARY_FILE_KEY;
  const depth = input?.depth ?? 3;
  try {
    // Fetch file at shallow depth to find the page node ID
    const meta = await wReadFile({ fileKey, depth: 1 }, userId);
    const pages = meta?.document?.children || [];
    const page = pages.find(
      (p) => p.name.toLowerCase() === input.pageName.toLowerCase()
    );
    if (!page) {
      const names = pages.map((p) => p.name).join(", ");
      return skillActionErr(`Page "${input.pageName}" not found. Available: ${names}`);
    }
    // Fetch the full node tree for that page
    const nodes = await wReadNodes({ fileKey, nodeIds: [page.id] }, userId);
    const pageNode = nodes?.nodes?.[page.id]?.document ?? page;
    return skillActionOk({ page: pageNode, fileKey });
  } catch (e) {
    return skillActionErr(e.message);
  }
}

export async function exportFrames(a, b) {
  const [userId, input] = typeof a === "string" ? [a, b ?? {}] : [undefined, a ?? {}];
  if (!Array.isArray(input?.nodeIds) || input.nodeIds.length === 0)
    return skillActionErr("nodeIds (array) required");
  const fileKey = input?.fileKey || PRIMARY_FILE_KEY;
  try {
    const data = await wReadExport(
      { fileKey, nodeIds: input.nodeIds, format: input.format ?? "png", scale: input.scale ?? 2 },
      userId
    );
    return skillActionOk({ images: data?.images ?? {}, fileKey });
  } catch (e) {
    return skillActionErr(e.message);
  }
}

export async function readComponents(a, b) {
  const [userId, input] = typeof a === "string" ? [a, b ?? {}] : [undefined, a ?? {}];
  const fileKey = input?.fileKey || PRIMARY_FILE_KEY;
  try {
    const data = await wReadFile({ fileKey, depth: 2 }, userId);
    const components = [];
    for (const page of data?.document?.children || []) {
      for (const node of page.children || []) {
        components.push({
          id: node.id,
          name: node.name,
          page: page.name,
          type: node.type,
        });
      }
    }
    return skillActionOk({ components, fileKey });
  } catch (e) {
    return skillActionErr(e.message);
  }
}
