"use client";

import { useState } from "react";
import { createPortal } from "react-dom";

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
  const [zoomed, setZoomed] = useState(false);
  const [hovered, setHovered] = useState(false);

  const images = extractImages(inventory);
  if (images.length === 0) return null;

  const img = images[current];

  function handleImgClick(e) {
    e.stopPropagation();
    setZoomed((z) => !z);
  }

  function handleNav(delta, e) {
    e.stopPropagation();
    setCurrent((c) => (c + delta + images.length) % images.length);
    setZoomed(false);
  }

  return (
    <>
      <button
        type="button"
        className="btn btn-outline btn-sm"
        onClick={() => { setOpen(true); setCurrent(0); setZoomed(false); }}
      >
        Review Screenshots ({images.length})
      </button>

      {open && createPortal(
        <div className="fixed inset-0 z-50 flex items-center justify-center">
          {/* Backdrop */}
          <div className="absolute inset-0 bg-black/70" onClick={() => setOpen(false)} />

          {/* Modal box */}
          <div className="relative z-10 flex w-screen h-screen flex-col bg-base-100">
            <div className="flex items-center justify-between p-3 pb-2 shrink-0">
              <h3 className="text-lg font-bold">
                Screenshots — {current + 1} / {images.length}
                <span className="ml-2 text-xs font-normal text-base-content/40">{zoomed ? "100% — click to fit" : "fit — click to zoom"}</span>
              </h3>
              <button type="button" className="btn btn-sm btn-ghost" onClick={() => setOpen(false)}>Close</button>
            </div>

            {/* Main image */}
            <div
              className="relative flex-1 bg-black/5"
              style={{ minHeight: 0, overflow: zoomed ? "auto" : "hidden" }}
            >
              <div
                className="relative"
                style={zoomed ? {} : { width: "100%", height: "100%" }}
                onMouseEnter={() => setHovered(true)}
                onMouseLeave={() => setHovered(false)}
                onClick={handleImgClick}
              >
                <img
                  src={img.url}
                  alt={img.description}
                  loading="lazy"
                  style={zoomed
                    ? { display: "block", width: "100%", maxWidth: "none" }
                    : { display: "block", width: "100%", height: "100%", objectFit: "contain", cursor: "zoom-in" }
                  }
                />
                {/* Magnifying glass overlay in fit mode */}
                {!zoomed && hovered && (
                  <div className="pointer-events-none absolute inset-0 flex items-center justify-center">
                    <div className="rounded-full bg-black/40 p-3 text-white shadow-lg">
                      <svg xmlns="http://www.w3.org/2000/svg" className="h-8 w-8" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
                        <circle cx="11" cy="11" r="7" />
                        <line x1="16.5" y1="16.5" x2="22" y2="22" />
                        <line x1="11" y1="8" x2="11" y2="14" />
                        <line x1="8" y1="11" x2="14" y2="11" />
                      </svg>
                    </div>
                  </div>
                )}
                {/* Zoom-out icon in zoomed mode */}
                {zoomed && hovered && (
                  <div className="pointer-events-none fixed top-16 right-6 z-20 rounded-full bg-black/40 p-3 text-white shadow-lg">
                    <svg xmlns="http://www.w3.org/2000/svg" className="h-6 w-6" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
                      <circle cx="11" cy="11" r="7" />
                      <line x1="16.5" y1="16.5" x2="22" y2="22" />
                      <line x1="8" y1="11" x2="14" y2="11" />
                    </svg>
                  </div>
                )}
              </div>
              {images.length > 1 && (
                <>
                  <button
                    type="button"
                    className="btn btn-circle btn-sm absolute top-1/2 left-2 -translate-y-1/2 bg-base-100/90 shadow z-10"
                    onClick={(e) => handleNav(-1, e)}
                  >&#8249;</button>
                  <button
                    type="button"
                    className="btn btn-circle btn-sm absolute top-1/2 right-2 -translate-y-1/2 bg-base-100/90 shadow z-10"
                    onClick={(e) => handleNav(1, e)}
                  >&#8250;</button>
                </>
              )}
            </div>

            {/* Caption + review */}
            <div className="shrink-0 px-4 py-1">
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
              <div className="shrink-0 flex gap-1.5 overflow-x-auto px-4 py-2">
                {images.map((im, i) => (
                  <button
                    key={im.key}
                    type="button"
                    className={`h-12 w-16 shrink-0 overflow-hidden rounded border-2 transition-all ${
                      i === current ? "border-primary" : "border-transparent opacity-60 hover:opacity-90"
                    }`}
                    onClick={() => { setCurrent(i); setZoomed(false); }}
                  >
                    <img src={im.url} alt="" className="h-full w-full object-cover" loading="lazy" />
                  </button>
                ))}
              </div>
            )}
          </div>
        </div>,
        document.body
      )}
    </>
  );
}
