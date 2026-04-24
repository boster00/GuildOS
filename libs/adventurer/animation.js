"use client";

import { useEffect, useState } from "react";

/**
 * Sprite sheet frame atlas for adventurer avatars.
 * Coordinates match the template: { x, y, w, h } in sheet pixels.
 * States map to a frame sequence + fps for driving the animation.
 */
export const ADVENTURER_SHEET = {
  src: "/images/guildos/sprites/adventurer-sheet.png",
  frameW: 128,
  frameH: 128,
};

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

/**
 * Script-driven sprite animation. Takes a state name, renders a div
 * with background-image cropped to the current frame; advances frames
 * on a fps timer.
 */
export function AdventurerSprite({
  state = "idle",
  scale = 1,
  sheet = ADVENTURER_SHEET,
  states = ADVENTURER_STATES,
  className = "",
  style = {},
}) {
  const cfg = states[state] || states.idle;
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
        width: sheet.frameW * scale,
        height: sheet.frameH * scale,
        overflow: "hidden",
        ...style,
      }}
      aria-label={`adventurer ${state}`}
    >
      <div
        style={{
          width: sheet.frameW,
          height: sheet.frameH,
          backgroundImage: `url(${sheet.src})`,
          backgroundPosition: `-${frame.x}px -${frame.y}px`,
          backgroundRepeat: "no-repeat",
          transform: `scale(${scale})`,
          transformOrigin: "top left",
        }}
      />
    </div>
  );
}
