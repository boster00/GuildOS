
export const toc = {
  readSearch: "Read PubCompare search results via Browserclaw CDP (public site, no auth).",
};
import { ensureCdpChrome, executeSteps } from "@/libs/weapon/browserclaw/cdp";

export async function readSearch({ query } = {}) {
  if (!query) throw new Error('"query" is required');
  await ensureCdpChrome();
  const result = await executeSteps([
    { action: "navigate", url: "https://pubcompare.ai", item: "pubcompare_home" },
    { action: "extract_text", selector: "input[type='search'],input[type='text']", item: "search_input" },
    {
      action: "fill",
      selector: "input[type='search'],input[type='text']",
      value: query,
      item: "fill_query",
    },
    { action: "keyboard", key: "Enter", item: "submit" },
    { action: "extract_text", selector: "body", item: "results" },
  ]);
  return result;
}

export async function checkCredentials() {
  try {
    await ensureCdpChrome();
    const result = await executeSteps([
      { action: "navigate", url: "https://pubcompare.ai", item: "pubcompare_check" },
      { action: "extract_text", selector: "body", item: "body" },
    ]);
    return { ok: true, msg: "PubCompare accessible" };
  } catch (e) {
    return { ok: false, msg: e.message };
  }
}
