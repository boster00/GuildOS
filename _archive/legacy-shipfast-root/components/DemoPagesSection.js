import Image from "next/image";
import Link from "next/link";
import demoPages from "@/components/demopages";

const DemoPagesSection = () => {
  return (
    <section id="demo-pages" className="bg-base-200/40 border-y border-base-300">
      <div className="max-w-7xl mx-auto px-8 py-12 lg:py-14">
        <div className="text-center mb-8">
          <h2 className="text-3xl lg:text-4xl font-extrabold tracking-tight">
            Pages Built with CJGEO
          </h2>
          <p className="max-w-2xl mx-auto text-base lg:text-lg opacity-80 mt-3">
            See examples of pages generated through the CJGEO workflow. Click
            any page to explore details and watch the build process.
          </p>
        </div>

        <div className="flex gap-5 overflow-x-auto pb-3 snap-x snap-mandatory">
          {demoPages.map((page) => (
            <Link
              key={page.slug}
              href="/demo-pages"
              className="snap-start shrink-0 w-72 rounded-xl border border-base-300 bg-base-100 shadow-sm hover:shadow-md transition"
            >
              <div className="relative h-44 w-full overflow-hidden rounded-t-xl">
                <Image
                  src={page.thumbnailSrc}
                  alt={`${page.name} thumbnail`}
                  fill
                  className="object-cover"
                />
              </div>
              <div className="p-4">
                <h3 className="text-lg font-bold">{page.name}</h3>
                <p className="text-sm text-base-content/75 mt-1">
                  {page.description}
                </p>
                <div className="flex flex-wrap gap-2 mt-3">
                  {page.tags?.map((tag) => (
                    <span key={tag} className="badge badge-outline badge-sm">
                      {tag}
                    </span>
                  ))}
                </div>
              </div>
            </Link>
          ))}
        </div>

        <div className="text-center mt-8">
          <Link href="/demo-pages" className="btn btn-outline btn-wide">
            Browse All Demo Pages
          </Link>
        </div>
      </div>
    </section>
  );
};

export default DemoPagesSection;
