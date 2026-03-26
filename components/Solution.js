const steps = [
  {
    number: "01",
    icon: "🔍",
    title: "Keyword + competitor research",
    description:
      "Pull keyword targets and scan competitor pages in one pass. Surface what they cover, what they missed, and where you have an opening—without switching between tools.",
  },
  {
    number: "02",
    icon: "📋",
    title: "Topic planning",
    description:
      "Structure the page before you write it. Map headings, key questions, and intent so the draft starts with a solid skeleton instead of a blank doc.",
  },
  {
    number: "03",
    icon: "✍️",
    title: "Write a complete, publish-ready page",
    description:
      "Generate a full webpage draft—intro, body, subheadings, CTA—built to the spec you set. Most pages are ready to publish after a light review. Minutes, not days.",
  },
  {
    number: "04",
    icon: "🎯",
    title: "SEO enrichment + AI targeting",
    description:
      "Enrich the draft with semantic SEO and vector search alignment so the page is positioned for both traditional search results and AI-generated answers.",
  },
  {
    number: "05",
    icon: "📣",
    title: "Repurpose for every channel",
    description:
      "Turn the finished page into social posts, search ad copy, email campaigns, and nurture sequences—without rewriting from scratch.",
  },
];

const Solution = () => {
  return (
    <section className="bg-base-100" id="how-it-works">
      <div className="max-w-7xl mx-auto px-8 py-16 md:py-32">
        <div className="text-center mb-12 md:mb-16">
          <h2 className="font-extrabold text-4xl md:text-5xl tracking-tight mb-6">
            How it works
          </h2>
          <p className="max-w-3xl mx-auto text-lg opacity-80 leading-relaxed">
            One workflow. Research to publish-ready page in minutes—not days.
          </p>
        </div>

        <div className="space-y-4 mb-12">
          {steps.map((step) => (
            <div
              key={step.number}
              className="flex gap-6 items-start bg-white rounded-lg border border-gray-200 shadow-sm p-6 md:p-8"
            >
              <div className="shrink-0 w-10 h-10 rounded-full bg-primary/10 text-primary font-bold text-sm flex items-center justify-center">
                {step.number}
              </div>
              <div className="flex-1">
                <div className="flex items-center gap-2 mb-2">
                  <span className="text-2xl">{step.icon}</span>
                  <h3 className="text-xl font-bold">{step.title}</h3>
                </div>
                <p className="text-gray-700 leading-relaxed">{step.description}</p>
              </div>
            </div>
          ))}
        </div>

        <div className="bg-gradient-to-r from-purple-600 to-blue-600 rounded-lg shadow-xl p-8 md:p-12 text-center text-white">
          <div className="text-5xl mb-4">⚡</div>
          <h3 className="text-2xl md:text-3xl font-bold mb-4">
            Built for execution
          </h3>
          <p className="max-w-3xl mx-auto text-lg opacity-95 leading-relaxed mb-4">
            CJGEO is built from <strong>10+ years of delivering ranking content systems</strong>—before AI search was a category—and updated for how discovery works now.
          </p>
          <p className="max-w-3xl mx-auto text-lg opacity-95 leading-relaxed">
            This isn&apos;t &quot;AI content.&quot; It&apos;s <strong>SEO execution</strong>, streamlined:
          </p>
          <ul className="max-w-xl mx-auto mt-4 text-left list-disc list-inside space-y-1 opacity-95">
            <li>stronger page structure out of the box</li>
            <li>keyword + AI prompt coverage in every draft</li>
            <li>ready for Search + AI answers</li>
            <li>one workflow instead of five tools</li>
          </ul>
        </div>
      </div>
    </section>
  );
};

export default Solution;
