"use client";

import { useEffect, useRef, useState } from "react";
import toast from "react-hot-toast";
import { absoluteUrlForReferenceFetch } from "./portraitPresets.js";

/**
 * Modal: generate one 2×2 sprite sheet (four poses) from a reference portrait; optional custom prompt; small output size.
 */
export default function AvatarWorkshopModal({
  open,
  onClose,
  referenceUrl,
  onGenerated,
}) {
  const dialogRef = useRef(null);
  const [customPrompt, setCustomPrompt] = useState("");
  const [pixelSize, setPixelSize] = useState(256);
  const [generating, setGenerating] = useState(false);

  useEffect(() => {
    const el = dialogRef.current;
    if (!el) return;
    if (open) {
      el.showModal();
    } else {
      el.close();
    }
  }, [open]);

  const handleGenerate = async () => {
    const ref = absoluteUrlForReferenceFetch(String(referenceUrl || "").trim());
    if (!ref || generating) return;
    setGenerating(true);
    try {
      const res = await fetch("/api/adventurer/avatar?action=generateAvatarSheet", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          referenceUrl: ref,
          customPrompt: customPrompt.trim() || undefined,
          pixelSize,
        }),
      });
      const json = await res.json().catch(() => ({}));
      if (!res.ok) {
        toast.error(json.error || "Generation failed");
        return;
      }
      if (json.url) {
        onGenerated(json.url);
        toast.success("Sprite sheet saved.");
        dialogRef.current?.close();
      }
    } finally {
      setGenerating(false);
    }
  };

  return (
    <dialog
      ref={dialogRef}
      className="modal"
      onClick={(e) => {
        if (e.target === dialogRef.current) dialogRef.current?.close();
      }}
      onClose={() => onClose()}
    >
      <div className="modal-box max-w-lg" onClick={(e) => e.stopPropagation()}>
        <h3 className="text-lg font-bold">Avatar workshop</h3>
        <p className="mt-0.5 text-sm text-base-content/70">
          Builds <strong>one</strong> PNG containing <strong>four poses</strong> in a 2×2 grid: full body neutral, happy,
          jumping, busy with map. Output size is kept small to save storage.
        </p>

        <label className="form-control mt-3">
          <span className="label-text text-xs">Image description (optional)</span>
          <textarea
            className="textarea textarea-bordered textarea-sm min-h-[88px] w-full text-sm"
            placeholder="Extra style or mood (e.g. “pixel-art style”, “wearing a blue cloak”)…"
            value={customPrompt}
            onChange={(e) => setCustomPrompt(e.target.value)}
            disabled={generating}
          />
          <span className="label-text-alt text-[10px] text-base-content/45">
            Appended to the locked template; does not replace safety rules.
          </span>
        </label>

        <label className="form-control mt-2">
          <span className="label-text text-xs">Output size (smaller = smaller file)</span>
          <select
            className="select select-bordered select-sm w-full"
            value={pixelSize}
            onChange={(e) => setPixelSize(Number(e.target.value))}
            disabled={generating}
          >
            <option value={256}>256×256 (smallest)</option>
            <option value={512}>512×512</option>
            <option value={1024}>1024×1024</option>
          </select>
        </label>

        <div className="modal-action">
          <button
            type="button"
            className="btn btn-ghost btn-sm"
            disabled={generating}
            onClick={() => dialogRef.current?.close()}
          >
            Cancel
          </button>
          <button
            type="button"
            className="btn btn-primary btn-sm"
            disabled={generating || !String(referenceUrl || "").trim()}
            onClick={handleGenerate}
          >
            {generating ? "Generating…" : "Generate 4-pose sheet"}
          </button>
        </div>
      </div>
    </dialog>
  );
}
