export default function WorldMapPage() {
  const zones = [
    { name: "Pigeon Post", desc: "Async messaging and job dispatch between agents. Coming in a future update." },
    { name: "Outposts", desc: "Remote agent sessions and cloud infrastructure management. Coming in a future update." },
    { name: "Northern Keep", desc: "Undiscovered" },
    { name: "Eastern Port", desc: "Undiscovered" },
    { name: "Moonlight Library", desc: "Undiscovered" },
  ];

  return (
    <main className="guild-bg-world-map min-h-dvh p-8">
      <section className="mx-auto max-w-5xl rounded-3xl border border-base-300 bg-base-100/85 p-6 shadow-xl backdrop-blur">
        <h1 className="text-3xl font-bold">World Map</h1>
        <p className="text-sm text-base-content/70">
          Territories and modules across the guild&apos;s reach.
        </p>
        <div className="mt-6 grid gap-4 md:grid-cols-3">
          {zones.map((zone) => (
            <div
              key={zone.name}
              className="rounded-2xl border-2 border-dashed border-base-300 bg-base-200/60 p-6 text-center opacity-80"
            >
              <p className="font-semibold">{zone.name}</p>
              <p className="mt-1 text-xs text-base-content/70">{zone.desc}</p>
            </div>
          ))}
        </div>
      </section>
    </main>
  );
}
