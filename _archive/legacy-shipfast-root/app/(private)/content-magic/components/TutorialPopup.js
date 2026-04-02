"use client";
import React, { useEffect, useRef, useCallback } from "react";
import { X } from "lucide-react";

const STORAGE_KEY_PREFIX = "loom_tutorial_t_";
const POLL_INTERVAL_MS = 5000;

function getVideoId(shareUrl) {
  const match = String(shareUrl || "").match(/loom\.com\/share\/([a-f0-9]+)/i);
  return match ? match[1] : null;
}

function buildEmbedUrl(videoId, startSeconds = 0) {
  const base = `https://www.loom.com/embed/${videoId}`;
  const params = new URLSearchParams();
  params.set("autoplay", "1");
  if (startSeconds > 0) {
    params.set("t", `${Math.floor(startSeconds)}s`);
  }
  return `${base}?${params.toString()}`;
}

function getStoredTime(videoId) {
  if (typeof sessionStorage === "undefined" || !videoId) return 0;
  try {
    const s = sessionStorage.getItem(`${STORAGE_KEY_PREFIX}${videoId}`);
    const n = parseInt(s, 10);
    return isNaN(n) || n < 0 ? 0 : n;
  } catch {
    return 0;
  }
}

function setStoredTime(videoId, seconds) {
  if (typeof sessionStorage === "undefined" || !videoId || seconds < 0) return;
  try {
    sessionStorage.setItem(`${STORAGE_KEY_PREFIX}${videoId}`, String(Math.floor(seconds)));
  } catch (_) {}
}

export default function TutorialPopup({ isOpen, onClose, shareUrl, title }) {
  const iframeRef = useRef(null);
  const lastTimeRef = useRef(0);
  const pollTimerRef = useRef(null);

  const videoId = getVideoId(shareUrl);
  const startSeconds = videoId ? getStoredTime(videoId) : 0;
  const embedSrc = videoId ? buildEmbedUrl(videoId, startSeconds) : null;

  const requestCurrentTime = useCallback(() => {
    const iframe = iframeRef.current;
    if (!iframe?.contentWindow || !videoId) return;
    try {
      iframe.contentWindow.postMessage(
        { method: "getCurrentTime", context: "player.js" },
        "*"
      );
    } catch (_) {}
  }, [videoId]);

  const saveTimeAndClose = useCallback(() => {
    requestCurrentTime();
    // Store last known time (from periodic poll or ref)
    if (videoId && lastTimeRef.current >= 0) {
      setStoredTime(videoId, lastTimeRef.current);
    }
    pollTimerRef.current && clearInterval(pollTimerRef.current);
    pollTimerRef.current = null;
    onClose();
  }, [videoId, onClose, requestCurrentTime]);

  useEffect(() => {
    if (!isOpen || !videoId) return;

    const handleMessage = (event) => {
      const data = event?.data;
      if (!data || typeof data !== "object") return;
      // Loom player.js responds with { context: 'player.js', value: seconds } for getCurrentTime
      if (data.context !== "player.js") return;
      const time = data.value ?? data.currentTime ?? data.time;
      if (typeof time === "number" && time >= 0) {
        lastTimeRef.current = time;
      }
    };

    window.addEventListener("message", handleMessage);

    pollTimerRef.current = setInterval(requestCurrentTime, POLL_INTERVAL_MS);
    requestCurrentTime();

    return () => {
      window.removeEventListener("message", handleMessage);
      if (pollTimerRef.current) {
        clearInterval(pollTimerRef.current);
        pollTimerRef.current = null;
      }
    };
  }, [isOpen, videoId, requestCurrentTime]);

  if (!isOpen || !embedSrc) return null;

  return (
    <div
      className="fixed inset-0 z-[70] flex items-center justify-center p-4 bg-black/60"
      role="dialog"
      aria-modal="true"
      aria-labelledby="tutorial-popup-title"
    >
      <button
        type="button"
        onClick={saveTimeAndClose}
        className="absolute inset-0"
        aria-label="Close overlay"
      />
      <div
        className="relative w-full max-w-4xl aspect-video bg-black rounded-lg shadow-2xl overflow-hidden"
        onClick={(e) => e.stopPropagation()}
      >
        <button
          type="button"
          onClick={saveTimeAndClose}
          className="absolute top-2 right-2 z-10 p-2 rounded-full bg-black/50 text-white hover:bg-black/70 transition-colors"
          aria-label="Close tutorial"
        >
          <X className="w-5 h-5" />
        </button>
        <h2 id="tutorial-popup-title" className="sr-only">{title || "Tutorial video"}</h2>
        <iframe
          ref={iframeRef}
          src={embedSrc}
          title={title || "Tutorial video"}
          allow="accelerometer; autoplay; encrypted-media; gyroscope; picture-in-picture"
          allowFullScreen
          className="absolute inset-0 w-full h-full"
        />
      </div>
    </div>
  );
}
