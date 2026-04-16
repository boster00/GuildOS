import Link from "next/link";
import BigQueryTestClient from "./BigQueryTestClient";
import ProvinGroundsNav from "../../ProvinGroundsNav.js";

export const metadata = { title: "BigQuery Weapon Test · Proving Grounds · GuildOS" };

export default function BigQueryTestPage() {
  return (
    <main className="guild-bg-proving-grounds min-h-dvh p-4 md:p-8">
      <section className="mx-auto max-w-3xl rounded-3xl border border-base-300 bg-base-100/88 p-6 shadow-xl backdrop-blur">
        <nav className="text-sm text-base-content/60">
          <Link href="/town" className="link link-hover">Town map</Link>
          <span className="mx-2">/</span>
          <Link href="/town/proving-grounds" className="link link-hover">Proving grounds</Link>
          <span className="mx-2">/</span>
          <span className="text-base-content">BigQuery weapon</span>
        </nav>

        <ProvinGroundsNav active="bigquery" />

        <h1 className="mt-4 text-2xl font-bold">BigQuery Weapon Test</h1>
        <p className="mt-1 text-sm text-base-content/60">
          Test the BigQuery weapon: credential check, list datasets, and query recent events.
        </p>

        <BigQueryTestClient />
      </section>
    </main>
  );
}
