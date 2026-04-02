"use client";

import { useState, useCallback } from "react";
import { Play, ChevronLeft, ChevronRight } from "lucide-react";
import { getTutorialVideos, DEFAULT_TUTORIAL_INDEX } from "@/libs/content-magic/references/tutorialRegistry";
import styles from "./TutorialVideos.module.css";

const ALL_VIDEOS = getTutorialVideos();
const DEFAULT_INDEX = Math.min(DEFAULT_TUTORIAL_INDEX, Math.max(0, ALL_VIDEOS.length - 1));

const getLoomId = (shareUrl) => {
  const match = shareUrl.match(/loom\.com\/share\/([a-f0-9]+)/i);
  return match ? match[1] : null;
};

const embedUrl = (shareUrl, autoplay = false) => {
  const id = getLoomId(shareUrl);
  const base = id ? `https://www.loom.com/embed/${id}` : shareUrl;
  return autoplay ? `${base}?autoplay=1` : base;
};

const thumbnailUrl = (shareUrl) => {
  const id = getLoomId(shareUrl);
  return id ? `https://cdn.loom.com/sessions/thumbnails/${id}-with-play.gif` : null;
};

export default function TutorialVideos() {
  const [currentIndex, setCurrentIndex] = useState(DEFAULT_INDEX);
  const current = ALL_VIDEOS[currentIndex];

  const goPrev = useCallback(() => {
    setCurrentIndex((i) => (i - 1 + ALL_VIDEOS.length) % ALL_VIDEOS.length);
  }, []);

  const goNext = useCallback(() => {
    setCurrentIndex((i) => (i + 1) % ALL_VIDEOS.length);
  }, []);

  const selectVideo = useCallback((index) => {
    setCurrentIndex(index);
  }, []);

  return (
    <div className={styles.container}>
      <header className={styles.pageHeader}>
        <h1 className={styles.pageTitle}>Tutorial Videos</h1>
        <p className={styles.pageSubtitle}>
          Learn how to get the most out of CJGEO with step-by-step guides.
        </p>
      </header>

      <section className={styles.heroSection} aria-labelledby="featured-title">
        <div className={styles.heroWrapper}>
          <iframe
            key={currentIndex}
            className={styles.heroIframe}
            src={embedUrl(current.shareUrl, false)}
            title={current.title}
            allow="accelerometer; autoplay; encrypted-media; gyroscope; picture-in-picture"
            allowFullScreen
          />
        </div>
        <h2 id="featured-title" className={styles.heroTitle}>
          {current.title}
        </h2>
        <p className={styles.heroCounter} aria-live="polite">
          Tutorial {currentIndex + 1} of {ALL_VIDEOS.length}
        </p>

        <nav className={styles.playerNav} aria-label="Previous and next video">
          <button
            type="button"
            onClick={goPrev}
            className={styles.navButton}
            aria-label="Previous video"
          >
            <ChevronLeft className={styles.navIcon} aria-hidden />
            Previous video
          </button>
          <button
            type="button"
            onClick={goNext}
            className={styles.navButton}
            aria-label="Next video"
          >
            Next video
            <ChevronRight className={styles.navIcon} aria-hidden />
          </button>
        </nav>
      </section>

      <section aria-labelledby="more-tutorials" className={styles.moreSection}>
        <h2 id="more-tutorials" className={styles.sectionTitle}>
          More tutorials
        </h2>
        <div className={styles.grid}>
          {ALL_VIDEOS.map((video, index) => {
            const isActive = currentIndex === index;
            const thumbSrc = thumbnailUrl(video.shareUrl);
            return (
              <article
                key={index}
                className={`${styles.card} ${isActive ? styles.cardActive : ""}`}
              >
                <button
                  type="button"
                  onClick={() => selectVideo(index)}
                  className={styles.cardButton}
                >
                  <div className={styles.thumbnail}>
                    {thumbSrc ? (
                      <img
                        src={thumbSrc}
                        alt=""
                        className={styles.thumbnailImg}
                      />
                    ) : null}
                    <span className={styles.badge} aria-hidden>
                      {index + 1}
                    </span>
                    <Play className={styles.thumbnailIcon} aria-hidden />
                  </div>
                  <div className={styles.cardBody}>
                    <h3 className={styles.cardTitle}>{video.title}</h3>
                  </div>
                </button>
              </article>
            );
          })}
        </div>
      </section>
    </div>
  );
}
