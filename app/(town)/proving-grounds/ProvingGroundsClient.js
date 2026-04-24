"use client";

import { useState } from "react";
import {
  AdventurerSprite,
  ADVENTURER_STATES,
} from "@/libs/adventurer/animation";

const DEMO_CAST = [
  { id: "idle", state: "idle", label: "Idle standing", left: "12%", top: "55%" },
  { id: "working", state: "working", label: "Working", left: "34%", top: "58%" },
  { id: "attention", state: "attention", label: "Raising hand", left: "56%", top: "56%" },
  { id: "walking", state: "walking", label: "Walking", left: "76%", top: "60%" },
];

export default function ProvingGroundsClient() {
  const [focus, setFocus] = useState(null);

  return (
    <div className="min-h-screen bg-base-200">
      <div className="mx-auto max-w-6xl p-6">
        <header className="mb-4">
          <h1 className="text-3xl font-bold">Proving Grounds</h1>
          <p className="text-sm opacity-70">
            Demo stage for the adventurer sprite-sheet animation pipeline.
            Each character takes a state name and plays the matching animation
            loop via <code>libs/adventurer/animation.js</code>.
          </p>
        </header>

        <div
          className="relative w-full overflow-hidden rounded-xl shadow-xl"
          style={{
            aspectRatio: "16 / 9",
            backgroundImage: "url(/images/guildos/bg-proving-grounds.png)",
            backgroundSize: "cover",
            backgroundPosition: "center",
          }}
        >
          {DEMO_CAST.map((c) => (
            <div
              key={c.id}
              className="absolute flex flex-col items-center"
              style={{
                left: c.left,
                top: c.top,
                transform: "translate(-50%, -50%)",
                filter: "drop-shadow(0 4px 6px rgba(0,0,0,0.35))",
              }}
              onMouseEnter={() => setFocus(c.id)}
              onMouseLeave={() => setFocus(null)}
            >
              <AdventurerSprite state={c.state} scale={1.1} />
              <div
                className={`mt-1 rounded-full bg-base-100/80 px-2 py-0.5 text-xs font-medium backdrop-blur transition-opacity ${
                  focus === c.id ? "opacity-100" : "opacity-80"
                }`}
              >
                {c.label}
              </div>
            </div>
          ))}
        </div>

        <section className="mt-8 grid grid-cols-1 gap-4 sm:grid-cols-2 lg:grid-cols-4">
          {Object.entries(ADVENTURER_STATES).map(([key, cfg]) => (
            <div
              key={key}
              className="card bg-base-100 shadow"
            >
              <div className="card-body items-center text-center">
                <AdventurerSprite state={key} scale={1} />
                <h3 className="card-title text-base">{cfg.label}</h3>
                <p className="text-xs opacity-60">
                  state: <code>{key}</code> · {cfg.frames.length} frames ·{" "}
                  {cfg.fps} fps
                </p>
              </div>
            </div>
          ))}
        </section>
      </div>
    </div>
  );
}
