import Link from "next/link";

export default function OpeningPage() {
  return (
    <main className="guild-bg-opening flex min-h-dvh items-center justify-center p-8">
      <section className="w-full max-w-4xl rounded-3xl border border-base-300 bg-base-100/85 p-8 text-center shadow-2xl backdrop-blur">
        <h1 className="text-5xl font-bold tracking-wide">GuildOS</h1>
        <p className="mt-2 text-base-content/70">
          Fantasy-themed control panel for quests, actions, and integrations.
        </p>
        <img
          src="/images/guildos/cover.png"
          alt="GuildOS mascot party"
          className="mx-auto mt-6 w-full max-w-3xl rounded-2xl border border-base-300"
        />
        <div className="mt-8">
          <Link href="/" className="btn btn-primary btn-lg">
            Enter Town Map
          </Link>
        </div>
      </section>
    </main>
  );
}
