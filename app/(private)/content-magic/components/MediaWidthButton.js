"use client";
import { useEffect, useRef, useState } from "react";
import { Monitor } from "lucide-react";

const PRESETS = [
  { label: "Full Width", px: null },
  { label: "Mobile", px: 375 },
  { label: "Tablet", px: 768 },
  { label: "Laptop", px: 1024 },
  { label: "Desktop", px: 1280 },
  { label: "Wide", px: 1440 },
  { label: "Custom", px: "custom" },
];

function applyWidth(host, px) {
  if (!host) return;
  if (px === null) {
    host.removeAttribute("data-media-width");
  } else {
    host.setAttribute("data-media-width", String(px));
  }
}

export default function MediaWidthButton({ shadowHostRef }) {
  const [open, setOpen] = useState(false);
  const [selected, setSelected] = useState("Full Width");
  const [customValue, setCustomValue] = useState("800");
  const containerRef = useRef(null);

  // Sync label from host on mount
  useEffect(() => {
    const host = shadowHostRef?.current;
    if (!host) return;
    const stored = host.getAttribute("data-media-width");
    if (!stored) return;
    const px = parseInt(stored, 10);
    const match = PRESETS.find((p) => p.px === px);
    if (match) {
      setSelected(match.label);
    } else {
      setSelected("Custom");
      setCustomValue(String(px));
    }
  }, []);

  // Close dropdown on outside click
  useEffect(() => {
    if (!open) return;
    const handler = (e) => {
      if (containerRef.current && !containerRef.current.contains(e.target)) {
        setOpen(false);
      }
    };
    document.addEventListener("mousedown", handler);
    return () => document.removeEventListener("mousedown", handler);
  }, [open]);

  const handleSelect = (preset) => {
    if (preset.px === "custom") {
      setSelected("Custom");
      // Don't close — let user type in the custom field
      return;
    }
    setSelected(preset.label);
    setOpen(false);
    applyWidth(shadowHostRef?.current, preset.px);
  };

  const commitCustom = () => {
    const raw = parseInt(customValue, 10);
    const clamped = Math.min(1920, Math.max(320, isNaN(raw) ? 800 : raw));
    setCustomValue(String(clamped));
    setSelected("Custom");
    setOpen(false);
    applyWidth(shadowHostRef?.current, clamped);
  };

  const buttonLabel =
    selected === "Full Width"
      ? "Width: Full"
      : selected === "Custom"
      ? `Width: ${customValue} px`
      : `Width: ${PRESETS.find((p) => p.label === selected)?.px} px`;

  return (
    <div ref={containerRef} className="relative">
      <button
        onClick={() => setOpen((v) => !v)}
        title="Media Width"
        className={`flex items-center gap-1 px-2 py-1 border rounded text-sm font-medium transition-colors whitespace-nowrap ${
          selected !== "Full Width"
            ? "bg-blue-500 text-white border-blue-500 hover:bg-blue-600"
            : "bg-white hover:bg-gray-100"
        }`}
      >
        <Monitor className="w-3.5 h-3.5 shrink-0" />
        {buttonLabel}
      </button>

      {open && (
        <div className="absolute left-0 top-full mt-1 bg-white border border-gray-200 rounded shadow-lg z-50 min-w-[160px] py-1">
          {PRESETS.map((preset) => {
            const isActive =
              preset.px === "custom"
                ? selected === "Custom"
                : selected === preset.label;
            return (
              <div key={preset.label}>
                <button
                  onMouseDown={(e) => {
                    e.preventDefault();
                    handleSelect(preset);
                  }}
                  className={`w-full text-left px-3 py-1.5 text-sm transition-colors ${
                    isActive
                      ? "bg-blue-500 text-white"
                      : "hover:bg-gray-100 text-gray-700"
                  }`}
                >
                  {preset.px === null
                    ? "Full Width"
                    : preset.px === "custom"
                    ? "Custom…"
                    : `${preset.label} — ${preset.px} px`}
                </button>

                {preset.px === "custom" && selected === "Custom" && (
                  <div className="px-3 pb-2 pt-1 flex gap-1">
                    <input
                      type="number"
                      min={320}
                      max={1920}
                      value={customValue}
                      onChange={(e) => setCustomValue(e.target.value)}
                      onKeyDown={(e) => {
                        if (e.key === "Enter") commitCustom();
                        if (e.key === "Escape") setOpen(false);
                      }}
                      onBlur={commitCustom}
                      autoFocus
                      className="w-20 px-2 py-1 border rounded text-sm text-gray-800"
                    />
                    <span className="text-xs text-gray-500 self-center">px</span>
                  </div>
                )}
              </div>
            );
          })}
        </div>
      )}
    </div>
  );
}
