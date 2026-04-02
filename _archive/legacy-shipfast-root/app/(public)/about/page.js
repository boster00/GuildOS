import Link from "next/link";
import { getSEOTags } from "@/libs/seo";
import config from "@/config";

export const metadata = getSEOTags({
  title: `About us | ${config.appName}`,
  canonicalUrlRelative: "/about",
});

const AboutPage = () => {
  return (
    <main className="max-w-2xl mx-auto">
      <div className="p-6 md:p-8">
        <Link href="/" className="btn btn-ghost btn-sm gap-1">
          <svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 20 20" fill="currentColor" className="w-5 h-5">
            <path fillRule="evenodd" d="M15 10a.75.75 0 01-.75.75H7.612l2.158 1.96a.75.75 0 11-1.04 1.08l-3.5-3.25a.75.75 0 010-1.08l3.5-3.25a.75.75 0 111.04 1.08L7.612 9.25h6.638A.75.75 0 0115 10z" clipRule="evenodd" />
          </svg>
          Back
        </Link>
        <h1 className="text-3xl font-extrabold mt-4 mb-6">
          About us
        </h1>

        <div className="prose prose-sm max-w-none text-base-content/90 space-y-6">
          <p>
            {config.appName} is the SEO execution system that takes you from research to a publish-ready page in minutes—not days. We built it because we kept seeing the same bottleneck: teams know what they want to rank for, but building a single quality SEO page still means bouncing between keyword tools, competitor tabs, drafting docs, and SEO checklists. The page either takes forever or doesn&apos;t get built at all.
          </p>
          <p>
            We come from over 10 years of running ranking content systems—before &quot;AI search&quot; was a category—and we updated that experience for how discovery works now. Most SEO tools give you keywords and volume; they don&apos;t actually build the page. So we built one workflow that handles the whole execution cycle: <strong>keyword research → competitor research → topic planning → full page draft → SEO enrichment + AI targeting → repurpose for social, ads, and email.</strong>
          </p>
          <p>
            This isn&apos;t generic &quot;AI content.&quot; It&apos;s <strong>SEO execution</strong>, streamlined: stronger structure, keyword and AI prompt coverage built in, ready for both traditional search and AI-generated answers. You still make the editorial calls—we just remove the hours of setup work between having a target and having a publishable page.
          </p>
          <p>
            We built {config.appName} for B2B, biotech, and SaaS teams who treat content like growth infrastructure and want a faster, more consistent path from research to published pages.
          </p>
        </div>

        <p className="mt-8">
          <Link href="/#how-it-works" className="link link-primary font-medium">
            See how it works
          </Link>
        </p>
      </div>
    </main>
  );
};

export default AboutPage;
