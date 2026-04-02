import Link from "next/link";
import TestimonialsAvatars from "./TestimonialsAvatars";

const Hero = () => {
  return (
    <section className="max-w-7xl mx-auto bg-base-100 flex flex-col items-center justify-center px-8 py-8 lg:py-12">
      <div className="flex flex-col gap-6 lg:gap-7 items-center text-center max-w-3xl">
        <h1 className="font-extrabold text-4xl lg:text-6xl tracking-tight md:-mb-4">
          Content that ranks. Traffic that converts. Leads that close.
        </h1>
        <p className="text-xl opacity-90 leading-relaxed font-medium">
          Stop running SEO content like a scavenger hunt across tools, spreadsheets, and prompts. CJGEO is the <strong>SEO execution system</strong> that turns research + prioritization + drafting into a single workflow built to win <strong>Search + AI answers</strong>.
        </p>
        <div className="flex flex-col sm:flex-row gap-3 w-full sm:w-auto justify-center">
          <Link href="/campaigns/new" className="btn btn-primary btn-wide">
            Start Your Campaign
          </Link>
          <Link href="/demo-pages" className="btn btn-outline btn-wide">
            See Pages We Built
          </Link>
        </div>
        <p className="text-sm text-base-content/70">
          Built from 10+ years of ranking content systems—now streamlined with AI.
        </p>

        <TestimonialsAvatars priority={true} />
      </div>
    </section>
  );
};

export default Hero;
