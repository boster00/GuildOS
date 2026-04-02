const Problem = () => {
  return (
    <section className="bg-neutral text-neutral-content">
      <div className="max-w-7xl mx-auto px-8 py-16 md:py-32">
        <h2 className="text-center font-extrabold text-4xl md:text-5xl tracking-tight mb-10 md:mb-12">
          The old way vs. the new way
        </h2>

        <div className="grid grid-cols-1 lg:grid-cols-2 gap-8 lg:gap-12 text-left">
          {/* Left column — The old way */}
          <div className="rounded-lg border border-neutral-content/20 bg-neutral-content/5 p-6 md:p-8 flex flex-col">
            <h3 className="text-lg font-bold opacity-95 mb-4">
              The old way
            </h3>
            <p className="text-base opacity-90 leading-relaxed mb-4">
              Creating a webpage took days even weeks--.
            </p>
            <ul className="text-base opacity-90 leading-relaxed mb-4 list-disc list-inside space-y-2 flex-1">
              <li>keyword tools--SEMRush, Ahrefs, etc.</li>
              <li>competitor tabs</li>
              <li>deep research + excel + word</li>
              <li>pasting in and out of ChatGPT/Gemini/Claude etc.</li>
              <li>Tracking that never works (enjoying GA4, anyone?)</li>
              <li>Reformatting again for email, ads, and social</li>
            </ul>
            <p className="text-base opacity-90 leading-relaxed mb-4">
              Every tool handles one piece. An acrobatic dance between tools.
            </p>
            <p className="text-lg font-bold opacity-95 mt-auto">
              Result: Pages that don&apos;t get published. Traffic that doesn&apos;t grow. Opportunities that go to competitors with bigger budgets.
            </p>
          </div>

          {/* Right column — CJGEO */}
          <div className="rounded-lg border-2 border-primary/40 bg-primary/10 p-6 md:p-8 flex flex-col">
            <h3 className="text-lg font-bold opacity-95 mb-4">
              CJGEO
            </h3>
            <p className="text-base opacity-90 leading-relaxed mb-4">
              One workflow from research to publish-ready page.
            </p>
            <ul className="text-base opacity-90 leading-relaxed mb-4 list-disc list-inside space-y-2 flex-1">
              <li>Keyword + competitor research in one place; topic planning built in</li>
              <li>Full page draft, mostly publish-ready</li>
              <li>SEO enrichment + AI targeting (vector alignment) included</li>
              <li>Repurpose for social, ads, and email from the same content</li>
            </ul>
            <p className="text-base opacity-90 leading-relaxed mb-4">
              One workflow instead of five tools. Minutes, not days.
            </p>
            <p className="text-lg font-bold opacity-95 mt-auto">
              Result: Better pages. Grow traffic. Capture opportunities.
            </p>
          </div>
        </div>
      </div>
    </section>
  );
};

export default Problem;
