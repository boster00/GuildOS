
export const toc = {
  searchProfiles: "Search LinkedIn profiles via Browserclaw CDP (requires authenticated profile).",
  readProfile: "Read a single LinkedIn profile by URL.",
};
import { ensureCdpChrome, executeSteps } from "@/libs/weapon/browserclaw/cdp";

export async function searchProfiles({ query, limit = 10 } = {}) {
  if (!query) throw new Error('"query" is required');
  await ensureCdpChrome();
  const url = `https://www.linkedin.com/search/results/people/?keywords=${encodeURIComponent(query)}`;
  const result = await executeSteps([
    { action: "navigate", url, item: "linkedin_search" },
    {
      action: "extract_text",
      selector: ".entity-result__item",
      limit,
      item: "profiles",
      fields: {
        name: ".entity-result__title-text",
        title: ".entity-result__primary-subtitle",
        url: { attr: "href", selector: ".app-aware-link" },
      },
    },
  ]);
  return result;
}

export async function readProfile({ url } = {}) {
  if (!url) throw new Error('"url" is required');
  await ensureCdpChrome();
  const result = await executeSteps([
    { action: "navigate", url, item: "linkedin_profile" },
    {
      action: "extract_text",
      item: "profile",
      fields: {
        name: "h1",
        title: ".text-body-medium",
        company: ".pv-text-details__right-panel",
        about: "#about ~ .display-flex .pv-shared-text-with-see-more span[aria-hidden='true']",
      },
    },
  ]);
  return result;
}

export async function checkCredentials() {
  try {
    await ensureCdpChrome();
    const result = await executeSteps([
      { action: "navigate", url: "https://www.linkedin.com/feed", item: "feed_check" },
      { action: "extract_text", selector: "body", item: "page_body" },
    ]);
    const body = result?.page_body ?? "";
    const redirectedToLogin =
      typeof body === "string" && body.includes("Sign in") && body.includes("www.linkedin.com/login");
    if (redirectedToLogin) {
      return { ok: false, msg: "Not logged in to LinkedIn — run auth-capture.mjs to log in via CDP profile" };
    }
    return { ok: true, msg: "LinkedIn session active" };
  } catch (e) {
    return { ok: false, msg: e.message };
  }
}
