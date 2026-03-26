/**
 * Results — representative metrics for pages built with the CJGEO workflow.
 */
const ResultsProof = () => {
  const stats = [
    { label: "Pages ranking Top 10", value: "72%", sub: "across tracked campaigns" },
    { label: "Median time to first ranking", value: "4–6 weeks", sub: "to first Top 10" },
    { label: "Pages published", value: "500+", sub: "system-built and published" },
    { label: "Organic traffic attributed to system-built content", value: "50K+", sub: "monthly visits" },
  ];

  return (
    <section className="bg-base-200/50 border-y border-base-300">
      <div className="max-w-7xl mx-auto px-8 py-10 lg:py-14">
        <h2 className="text-center text-sm font-medium text-primary uppercase tracking-wide mb-6">
          Results
        </h2>
        <p className="max-w-2xl mx-auto text-center text-lg opacity-90 leading-relaxed mb-10">
          Pages built with this workflow have driven <strong>rankings, qualified traffic, and pipeline</strong> across biotech, SaaS, and B2B. 
        </p>
        <div className="grid grid-cols-2 lg:grid-cols-4 gap-6 lg:gap-8">
          {stats.map((s, i) => (
            <div key={i} className="text-center">
              <div className="text-2xl lg:text-3xl font-bold text-primary">{s.value}</div>
              <div className="text-sm font-medium text-base-content/90 mt-1">{s.label}</div>
              <div className="text-xs text-base-content/60 mt-0.5">{s.sub}</div>
            </div>
          ))}
        </div>
        <p className="max-w-2xl mx-auto text-center text-md opacity-90 leading-relaxed mb-10">To clarify these numbers are from our past experience as an agency using the same workflow CJGEO is built on. These numbers are based on results from before AI search was a category.</p>
      </div>
    </section>
  );
};

export default ResultsProof;
