import Link from "next/link";
import { getCurrentUser } from "@/libs/council/auth/server";
import BrowserclawTestClient from "./BrowserclawTestClient.js";
import ProvinGroundsNav from "../ProvinGroundsNav.js";

export const metadata = {
  title: "Browserclaw transport tests · Proving grounds · GuildOS",
};

export default async function BrowserclawTestPage() {
  const user = await getCurrentUser();

  return (
    <main className="guild-bg-proving-grounds min-h-dvh p-4 md:p-8">
      <section className="mx-auto max-w-5xl rounded-3xl border border-base-300 bg-base-100/88 p-6 shadow-xl backdrop-blur">
        <nav className="text-sm text-base-content/60">
          <Link href="/town" className="link link-hover">
            Town map
          </Link>
          <span className="mx-2">/</span>
          <Link href="/town/proving-grounds" className="link link-hover">
            Proving grounds
          </Link>
          <span className="mx-2">/</span>
          <span className="text-base-content">Browserclaw</span>
        </nav>

        <ProvinGroundsNav active="browserclaw" />

        <div className="mt-4">
          <h1 className="text-3xl font-bold">Browserclaw Transport Tests</h1>
          <p className="mt-1 text-sm text-base-content/70">
            Compare WebSocket relay vs Native Messaging for commanding the Browserclaw extension.
            Each test navigates to Google and searches &ldquo;dog videos&rdquo;, measuring latency at every hop.
          </p>
        </div>

        {!user ? (
          <div className="mt-8 rounded-2xl border border-base-300 bg-base-200/50 p-8 text-center">
            <p className="text-base-content/80">Sign in to run transport tests.</p>
            <Link href="/signin?next=/town/proving-grounds/browserclaw" className="btn btn-primary mt-4">
              Sign in
            </Link>
          </div>
        ) : (
          <div className="mt-6">
            <BrowserclawTestClient />
          </div>
        )}
      </section>
    </main>
  );
}
