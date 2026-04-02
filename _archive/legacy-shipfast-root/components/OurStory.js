import Link from "next/link";

/**
 * Our story section for the homepage: origin, why we built CJGEO, who it's for.
 */
const OurStory = () => {
  return (
    <section className="bg-base-200/30 border-y border-base-300" id="our-story">
      <div className="max-w-7xl mx-auto px-8 py-16 md:py-24">
        <h2 className="text-center text-sm font-medium text-primary uppercase tracking-wide mb-6">
          Our story
        </h2>
        <div className="max-w-3xl mx-auto space-y-6 text-lg opacity-90 leading-relaxed">
          <p>
            We kept seeing the same pattern: strategy and ICP are set, and the team knows what they want to rank for—but building a single quality SEO page still takes days. Keyword research in one tab, competitor analysis in another, drafting in a third, SEO checks somewhere else. By the time the page ships, momentum is gone. We built CJGEO so research, drafting, and enrichment live in one workflow instead of five.
          </p>
          <p>
            CJGEO comes from over 10 years of delivering ranking content systems—before AI search was a category—and it&apos;s updated for how discovery works now. We handle the full execution cycle: keyword and competitor research, topic planning, complete page drafts, SEO enrichment, AI targeting, and repurposing for social, ads, and email. You spend less time switching tools and more time publishing pages that rank.
          </p>
          <p>
            We built this for B2B, biotech, and SaaS teams who want a faster path from research to published page. Not &quot;AI content&quot;—<strong>SEO execution</strong>, streamlined.
          </p>
        </div>
        <p className="text-center mt-8">
          <Link href="/about" className="link link-primary font-medium">
            Learn more about us
          </Link>
        </p>
      </div>
    </section>
  );
};

export default OurStory;
