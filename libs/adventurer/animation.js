"use client";

import { useEffect, useState } from "react";

/**
 * Per-character sprite sheets. All sheets share the same frame layout.
 * Add a new character by dropping `<name>-sheet.png` in public/images/guildos/sprites/.
 */
export const CHARACTER_SHEETS = {
  pig: "/images/guildos/sprites/pig-sheet.png",
  cat: "/images/guildos/sprites/cat-sheet.png",
  monkey: "/images/guildos/sprites/monkey-sheet.png",
  rabbit: "/images/guildos/sprites/rabbit-sheet.png",
  bunny: "/images/guildos/sprites/rabbit-sheet.png",
  // falls back to pig when character unknown
};

export const FRAME_W = 128;
export const FRAME_H = 128;

export const ADVENTURER_STATES = {
  idle: {
    label: "Idle",
    fps: 4,
    frames: [
      { x: 16, y: 24 },
      { x: 176, y: 24 },
      { x: 336, y: 24 },
      { x: 496, y: 24 },
    ],
  },
  working: {
    label: "Working",
    fps: 10,
    frames: [
      { x: 16, y: 204 },
      { x: 176, y: 204 },
      { x: 336, y: 204 },
      { x: 496, y: 204 },
      { x: 656, y: 204 },
      { x: 816, y: 204 },
      { x: 976, y: 204 },
      { x: 1136, y: 204 },
    ],
  },
  attention: {
    label: "Attention",
    fps: 6,
    frames: [
      { x: 16, y: 384 },
      { x: 176, y: 384 },
      { x: 336, y: 384 },
      { x: 496, y: 384 },
      { x: 656, y: 384 },
      { x: 816, y: 384 },
    ],
  },
  walking: {
    label: "Walking",
    fps: 10,
    frames: [
      { x: 16, y: 564 },
      { x: 176, y: 564 },
      { x: 336, y: 564 },
      { x: 496, y: 564 },
      { x: 656, y: 564 },
      { x: 816, y: 564 },
      { x: 976, y: 564 },
      { x: 1136, y: 564 },
    ],
  },
};

export function resolveSheetSrc(character) {
  return CHARACTER_SHEETS[character] || CHARACTER_SHEETS.pig;
}

/**
 * Script-driven sprite animation. Pass `character` ("pig", "cat", ...) and `state`.
 * Advances frames on a setInterval matching the state's fps.
 */
export function AdventurerSprite({
  character = "pig",
  state = "idle",
  scale = 1,
  states = ADVENTURER_STATES,
  className = "",
  style = {},
}) {
  const cfg = states[state] || states.idle;
  const src = resolveSheetSrc(character);
  const [i, setI] = useState(0);

  useEffect(() => {
    setI(0);
    if (!cfg.frames?.length) return;
    const interval = 1000 / Math.max(1, cfg.fps || 8);
    const id = setInterval(() => {
      setI((prev) => (prev + 1) % cfg.frames.length);
    }, interval);
    return () => clearInterval(id);
  }, [state, cfg.frames, cfg.fps]);

  const frame = cfg.frames[i] || cfg.frames[0];

  return (
    <div
      className={className}
      style={{
        width: FRAME_W * scale,
        height: FRAME_H * scale,
        overflow: "hidden",
        ...style,
      }}
      aria-label={`${character} ${state}`}
    >
      <div
        style={{
          width: FRAME_W,
          height: FRAME_H,
          backgroundImage: `url(${src})`,
          backgroundPosition: `-${frame.x}px -${frame.y}px`,
          backgroundRepeat: "no-repeat",
          transform: `scale(${scale})`,
          transformOrigin: "top left",
        }}
      />
    </div>
  );
}
