/**
 * Western Blot Analysis – informational wiki-style page.
 * Video: Loom embed (play inline). Thumbnail: public/demopages/thumbnails/western-blot-analysis.png
 */
const LOOM_SHARE_ID = "ae457ca2486346d8ba06999d935390ca";

const westernBlotAnalysis = {
  slug: "western-blot-analysis",
  name: "Western Blot Analysis",
  description:
    "An informational wiki page explaining how to analyze and interpret western blot data, including qualitative vs quantitative analysis, band identification, normalization with loading controls, and software reporting—built for education and reference.",
  videoUrl: `https://www.loom.com/share/${LOOM_SHARE_ID}`,
  thumbnailSrc: "/demopages/thumbnails/western-blot-analysis.png",
  liveUrl: "https://westernblot.wiki/western-blot-analysis",
  pageType: "informational",
  tags: ["informational", "science", "wiki", "education", "life sciences"],
  builtInMinutes: 10,
};

export default westernBlotAnalysis;
