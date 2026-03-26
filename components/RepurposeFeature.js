/**
 * RepurposeFeature — One article, repurposed for every channel.
 * MVP formats: social posts, search ads, email/newsletter, nurture sequence.
 */
import Image from "next/image";

const RepurposeFeature = () => {
  const formats = [
    { icon: "📱", name: "Social posts", description: "LinkedIn, X, Facebook" },
    { icon: "🔍", name: "Search ads copy", description: "Google / Bing" },
    { icon: "📧", name: "Cold email / newsletter", description: "Send-ready drafts" },
    { icon: "💌", name: "Nurture sequence", description: "Multi-email series" },
  ];

  return (
    <section className="bg-gradient-to-b from-gray-50 to-white">
      <div className="max-w-7xl mx-auto px-8 py-16 md:py-32">
        <div className="text-center mb-12 md:mb-16">
          <h2 className="font-extrabold text-4xl md:text-5xl tracking-tight mb-6">
            One article, every channel
          </h2>
          <p className="max-w-3xl mx-auto text-lg opacity-80 leading-relaxed">
            Once the page is done, repurpose it for social, ads, and email—without rewriting from scratch.
          </p>
        </div>

        <div className="mb-12 md:mb-16">
          <div className="rounded-lg shadow-2xl border-4 border-gray-200 overflow-hidden bg-white">
            <Image
              src="/repurpose-feature.png"
              alt="Repurpose for Every Channel - Transform your article into social posts, search ads, and email campaigns"
              width={1400}
              height={800}
              className="w-full"
              priority={false}
            />
          </div>
          <p className="text-center text-sm text-gray-500 mt-4">
            One article. Multiple channels. Less rework.
          </p>
        </div>

        <div className="grid grid-cols-2 md:grid-cols-4 gap-4 md:gap-6 max-w-3xl mx-auto">
          {formats.map((format, index) => (
            <div
              key={index}
              className="bg-white rounded-lg border-2 border-gray-200 p-4 hover:border-purple-400 hover:shadow-lg transition-all duration-300 text-center"
            >
              <div className="text-3xl mb-2">{format.icon}</div>
              <h4 className="font-semibold text-sm mb-1 text-gray-900">{format.name}</h4>
              <p className="text-xs text-gray-600">{format.description}</p>
            </div>
          ))}
        </div>

        <div className="text-center mt-12 md:mt-16">
          <p className="text-xl text-gray-700 mb-6">
            Create once. Publish everywhere.
          </p>
          <a
            href="/campaigns/new"
            className="btn btn-primary"
          >
            See It In Action
          </a>
        </div>
      </div>
    </section>
  );
};

export default RepurposeFeature;
