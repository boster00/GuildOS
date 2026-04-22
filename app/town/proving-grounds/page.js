import Link from "next/link";

export const metadata = {
  title: "Proving grounds · GuildOS",
};

export default function ProvingGroundsPage() {
  return (
    <main className="guild-bg-proving-grounds min-h-dvh p-4 md:p-8">
      <section className="mx-auto max-w-3xl rounded-3xl border border-base-300 bg-base-100/88 p-6 shadow-xl backdrop-blur">
        <nav className="text-sm text-base-content/60">
          <Link href="/town" className="link link-hover">
            Town map
          </Link>
          <span className="mx-2">/</span>
          <span className="text-base-content">Proving grounds</span>
        </nav>

        <div className="mt-8 text-center text-base-content/70">
          <p>Currently no testing being conducted.</p>
        </div>
      </section>
    </main>
  );
}
