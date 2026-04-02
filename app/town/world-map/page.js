export default function WorldMapPage() {
  return (
    <main className="guild-bg-world-map min-h-dvh p-8">
      <section className="mx-auto max-w-5xl rounded-3xl border border-base-300 bg-base-100/85 p-6 shadow-xl backdrop-blur">
        <h1 className="text-3xl font-bold">World Map</h1>
        <p className="text-sm text-base-content/70">
          Future territories and modules will appear here as the guild expands.
        </p>
        <div className="mt-6 grid gap-4 md:grid-cols-3">
          {["Northern Keep", "Eastern Port", "Moonlight Library"].map((zone) => (
            <div
              key={zone}
              className="rounded-2xl border-2 border-dashed border-base-300 bg-base-200/60 p-6 text-center opacity-80"
            >
              <p className="font-semibold">{zone}</p>
              <p className="text-xs text-base-content/70">Undiscovered</p>
            </div>
          ))}
        </div>
      </section>
    </main>
  );
}
