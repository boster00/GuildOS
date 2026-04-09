import Link from "next/link";
import { getCurrentUser } from "@/libs/council/auth/server";
import CccTestClient from "./CccTestClient.js";

export const metadata = {
  title: "CCC Test · Proving grounds · GuildOS",
};

export default async function CccTestPage() {
  const user = await getCurrentUser();

  return (
    <main className="guild-bg-town-square min-h-dvh p-4 md:p-8">
      <section className="mx-auto max-w-4xl rounded-3xl border border-base-300 bg-base-100/88 p-6 shadow-xl backdrop-blur">
        <nav className="text-sm text-base-content/60">
          <Link href="/town" className="link link-hover">
            Town map
          </Link>
          <span className="mx-2">/</span>
          <Link href="/town/proving-grounds" className="link link-hover">
            Proving grounds
          </Link>
          <span className="mx-2">/</span>
          <span className="text-base-content">CCC Test</span>
        </nav>

        <div className="mt-4 flex flex-wrap items-start gap-4">
          <img
            src="/images/guildos/chibis/sage.svg"
            alt=""
            className="h-16 w-16 rounded-xl border border-base-300 bg-base-200/50 p-2"
          />
          <div className="min-w-0 flex-1">
            <h1 className="text-3xl font-bold">CCC Test — Make 24 Demo</h1>
            <p className="mt-1 text-sm text-base-content/70">
              A live Claude Code Cloud session builds a Make&nbsp;24 solver, tests it across four cases, and — in the full run — generates a narrated video and annotated PowerPoint report.
            </p>
          </div>
        </div>

        {!user ? (
          <div className="mt-8 rounded-2xl border border-base-300 bg-base-200/50 p-8 text-center">
            <p className="text-base-content/80">Sign in to run the CCC test session.</p>
            <Link
              href="/signin?next=/town/proving-grounds/ccc-test"
              className="btn btn-primary mt-4"
            >
              Sign in
            </Link>
          </div>
        ) : (
          <div className="mt-8">
            <CccTestClient />
          </div>
        )}
      </section>
    </main>
  );
}
