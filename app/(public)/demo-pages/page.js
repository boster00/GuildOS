"use client";

import { useState } from "react";
import Image from "next/image";
import demoPages from "@/components/demopages";

function getLoomEmbedId(videoUrl) {
  if (!videoUrl || typeof videoUrl !== "string") return null;
  const match = videoUrl.match(/loom\.com\/share\/([a-f0-9]+)/i);
  return match ? match[1] : null;
}

function getLoomEmbedUrl(videoUrl) {
  const id = getLoomEmbedId(videoUrl);
  return id ? `https://www.loom.com/embed/${id}` : null;
}

function isLoomVideo(videoUrl) {
  return Boolean(getLoomEmbedId(videoUrl));
}

export default function DemoPagesGallery() {
  const [selectedSlug, setSelectedSlug] = useState(demoPages[0]?.slug || "");
  const selectedPage =
    demoPages.find((page) => page.slug === selectedSlug) || demoPages[0];

  const loomEmbedSrc = getLoomEmbedUrl(selectedPage?.videoUrl);
  const showEmbeddedVideo = Boolean(loomEmbedSrc);

  return (
    <main className="max-w-7xl mx-auto px-8 py-10 lg:py-14">
      <header className="mb-8">
        <h1 className="text-3xl lg:text-4xl font-extrabold tracking-tight">
          Demo Pages Portfolio
        </h1>
        <p className="text-base lg:text-lg text-base-content/80 mt-3 max-w-3xl">
          Click any thumbnail to inspect the page details and watch the process
          video, similar to a Google Images browse-and-preview flow.
        </p>
      </header>

      <section className="mb-8 rounded-2xl border border-base-300 bg-base-100 p-5 lg:p-7">
        <div className="grid lg:grid-cols-2 gap-6 lg:gap-8">
          <div className="relative w-full overflow-hidden rounded-xl bg-base-200">
            {showEmbeddedVideo ? (
              <div className="aspect-video w-full">
                <iframe
                  src={loomEmbedSrc}
                  title={`${selectedPage.name} – build video`}
                  allow="accelerometer; autoplay; encrypted-media; gyroscope; picture-in-picture"
                  allowFullScreen
                  className="absolute inset-0 h-full w-full rounded-xl"
                />
              </div>
            ) : (
              <div className="relative h-64 w-full lg:h-80">
                <Image
                  src={selectedPage.thumbnailSrc}
                  alt={`${selectedPage.name} preview`}
                  fill
                  className="object-cover"
                />
              </div>
            )}
          </div>

          <div>
            <h2 className="text-2xl font-bold">{selectedPage.name}</h2>
            {selectedPage.pageType ? (
              <p className="text-sm text-base-content/60 mt-1 capitalize">
                {selectedPage.pageType.replace(/_/g, " ")}
              </p>
            ) : null}
            <p className="text-base-content/80 mt-3">{selectedPage.description}</p>
            <div className="flex flex-wrap gap-2 mt-4">
              {selectedPage.tags?.map((tag) => (
                <span key={tag} className="badge badge-outline">
                  {tag}
                </span>
              ))}
            </div>
            <div className="mt-5 flex flex-wrap gap-3">
              {!showEmbeddedVideo && selectedPage.videoUrl ? (
                <a
                  href={selectedPage.videoUrl}
                  target="_blank"
                  rel="noreferrer"
                  className="btn btn-primary"
                >
                  Watch Build Video
                </a>
              ) : null}
              {/* Launch: hide live URLs
              {selectedPage.liveUrl ? (
                <a
                  href={selectedPage.liveUrl}
                  target="_blank"
                  rel="noreferrer"
                  className="btn btn-outline"
                >
                  View Live Page
                </a>
              ) : null}
              */}
            </div>
          </div>
        </div>
      </section>

      <section>
        <div className="grid grid-cols-2 md:grid-cols-3 lg:grid-cols-4 gap-4">
          {demoPages.map((page) => {
            const isSelected = selectedSlug === page.slug;
            return (
              <button
                key={page.slug}
                type="button"
                onClick={() => setSelectedSlug(page.slug)}
                className={`text-left rounded-xl overflow-hidden border transition ${
                  isSelected
                    ? "border-primary ring-2 ring-primary/30"
                    : "border-base-300 hover:border-primary/50"
                }`}
              >
                <div className="relative h-36 w-full bg-base-200">
                  <Image
                    src={page.thumbnailSrc}
                    alt={`${page.name} thumbnail`}
                    fill
                    className="object-cover"
                  />
                </div>
                <div className="p-3">
                  <p className="font-semibold text-sm">{page.name}</p>
                </div>
              </button>
            );
          })}
        </div>
      </section>
    </main>
  );
}
