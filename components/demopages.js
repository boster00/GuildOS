import westernBlotAnalysis from "@/components/demopages/westernBlotAnalysis";
import cellProliferationAssay from "@/components/demopages/cellProliferationAssay";
import multispecificAntibodyDevelopment from "@/components/demopages/multispecificAntibodyDevelopment";

const demoPages = [
  westernBlotAnalysis,
  cellProliferationAssay,
  multispecificAntibodyDevelopment,
];

export const getDemoPageBySlug = (slug) =>
  demoPages.find((page) => page.slug === slug) || null;

export default demoPages;
