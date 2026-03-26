/**
 * Trust strip for the hero: "Trusted by" line for B2B / biotech / SaaS.
 */
const TestimonialsAvatars = ({ priority = false }) => {
  return (
    <div className="w-full text-center lg:text-left">
      <p className="text-base text-base-content/80 font-medium">
        Trusted by teams who treat content like growth infrastructure.
      </p>
      <p className="text-xs text-base-content/60 mt-1">
        Biotech, SaaS, and B2B marketing teams.
      </p>
    </div>
  );
};

export default TestimonialsAvatars;
