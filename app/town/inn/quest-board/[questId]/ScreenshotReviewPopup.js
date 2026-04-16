"use client";

import { useState } from "react";

const imgExtensions = /\.(png|jpg|jpeg|gif|webp|svg|bmp|avif)(\?.*)?$/i;
const supabaseStorage = /storage\/v1\/object\/public\//i;

function extractImages(inventory) {
  if (!inventory || typeof inventory !== "object") return [];
  const images = [];

  for (const [key, value] of Object.entries(inventory)) {
    if (key === "pigeon_letters") continue;

    if (typeof value === "string" && (imgExtensions.test(value) || supabaseStorage.test(value))) {
      images.push({ key, url: value, description: key, review: null });
      continue;
    }

    if (value && typeof value === "object" && !Array.isArray(value)) {
      const url = value.url || value.src || value.image || (value.payload && (value.payload.url || value.payload.src));
      if (typeof url === "string" && (imgExtensions.test(url) || supabaseStorage.test(url))) {
        images.push({ key, url, description: value.description || value.item_key || key, review: value.review || null });
      }
    }

    if (Array.isArray(value)) {
      for (let i = 0; i < value.length; i++) {
        const item = value[i];
        if (typeof item === "string" && (imgExtensions.test(item) || supabaseStorage.test(item))) {
          images.push({ key: `${key}[${i}]`, url: item, description: `${key} #${i + 1}`, review: null });
        } else if (item && typeof item === "object") {
          const url = item.url || item.src || item.image || (item.payload && (item.payload.url || item.payload.src));
          const desc = item.description || item.item_key || (item.payload && item.payload.description) || `${key} #${i + 1}`;
          if (typeof url === "string" && (imgExtensions.test(url) || supabaseStorage.test(url))) {
            images.push({ key: item.item_key || `${key}[${i}]`, url, description: desc, review: item.review || null });
          }
        }
      }
    }
  }
  return images;
}

export default function ScreenshotReviewPopup({ inventory }) {
  const [open, setOpen] = useState(false);
  const [current, setCurrent] = useState(0);

  const images = extractImages(inventory);
  if (images.length === 0) return null;

  const img = images[current];

  return (
    <>
      <button
        type="button"
        className="btn btn-outline btn-sm"
        onClick={() => { setOpen(true); setCurrent(0); }}
      >
        Review Screenshots ({images.length})
      </button>

      {open && (
        <dialog className="modal modal-open">
          <div className="modal-box max-w-5xl max-h-[90vh] flex flex-col">
            <div className="flex items-center justify-between mb-3">
              <h3 className="text-lg font-bold">Screenshots — {current + 1} / {images.length}</h3>
              <button type="button" className="btn btn-sm btn-ghost" onClick={() => setOpen(false)}>Close</button>
            </div>

            {/* Main image */}
            <div className="relative flex-1 overflow-auto rounded-xl border border-base-300 bg-black/5" style={{ maxHeight: 500 }}>
              <img src={img.url} alt={img.description} className="block" style={{ maxWidth: 1200 }} loading="lazy" />
              {images.length > 1 && (
                <>
                  <button
                    type="button"
                    className="btn btn-circle btn-sm absolute top-1/2 left-2 -translate-y-1/2 bg-base-100/90 shadow"
                    onClick={() => setCurrent((c) => (c - 1 + images.length) % images.length)}
                  >&#8249;</button>
                  <button
                    type="button"
                    className="btn btn-circle btn-sm absolute top-1/2 right-2 -translate-y-1/2 bg-base-100/90 shadow"
                    onClick={() => setCurrent((c) => (c + 1) % images.length)}
                  >&#8250;</button>
                </>
              )}
            </div>

            {/* Caption + review */}
            <div className="mt-2 px-1">
              <div className="flex items-center justify-between">
                <p className="truncate text-xs text-base-content/60">{img.description}</p>
                <span className="shrink-0 text-xs text-base-content/40">{current + 1} / {images.length}</span>
              </div>
              {img.review && (
                <div className={`mt-1 rounded-lg px-2 py-1 text-xs ${img.review.passed ? "bg-success/10 text-success" : "bg-error/10 text-error"}`}>
                  <span className="font-semibold">{img.review.passed ? "Pass" : "Fail"}</span>
                  {img.review.note && <span className="ml-2 text-base-content/70">{img.review.note}</span>}
                </div>
              )}
            </div>

            {/* Thumbnails */}
            {images.length > 1 && (
              <div className="mt-2 flex gap-1.5 overflow-x-auto pb-1">
                {images.map((im, i) => (
                  <button
                    key={im.key}
                    type="button"
                    className={`h-12 w-16 shrink-0 overflow-hidden rounded border-2 transition-all ${
                      i === current ? "border-primary" : "border-transparent opacity-60 hover:opacity-90"
                    }`}
                    onClick={() => setCurrent(i)}
                  >
                    <img src={im.url} alt="" className="h-full w-full object-cover" loading="lazy" />
                  </button>
                ))}
              </div>
            )}
          </div>
          <form method="dialog" className="modal-backdrop">
            <button type="button" onClick={() => setOpen(false)}>close</button>
          </form>
        </dialog>
      )}
    </>
  );
}
