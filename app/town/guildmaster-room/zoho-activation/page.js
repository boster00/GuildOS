import Link from "next/link";
import { MerchantGuildExplain } from "@/components/MerchantGuildExplain";
import { getZohoOAuthCallbackUrl } from "@/libs/weapon/zoho";

export const metadata = {
  title: "Zoho Books bridge · Guildmaster's chamber",
};

const ZOHO_LINKS = [
  {
    href: "https://api-console.zoho.com/",
    label: "Zoho API Console",
    note: "Create a client (Server-based / Web), add scopes, and paste the redirect URI below under Authorized Redirect URIs. Must match character-for-character.",
  },
  {
    href: "https://www.zoho.com/accounts/protocol/oauth-setup.html",
    label: "OAuth 2.0 — Register your application",
    note: "Official overview of client types, redirect URIs, and token flow.",
  },
  {
    href: "https://www.zoho.com/accounts/protocol/oauth/web-apps/authorization.html",
    label: "Server-based apps — authorization code",
    note: "Describes redirect_uri and the authorization request your app builds.",
  },
  {
    href: "https://www.zoho.com/books/api/v3/",
    label: "Zoho Books API v3",
    note: "Product API reference; OAuth scope used here is typically ZohoBooks.fullaccess.all (configure in API Console).",
  },
];

export default function ZohoActivationPage() {
  const callback = getZohoOAuthCallbackUrl();

  return (
    <main className="guild-bg-town-map min-h-dvh p-8">
      <section className="mx-auto max-w-3xl rounded-3xl border border-base-300 bg-base-100/88 p-6 shadow-xl backdrop-blur">
        <div className="flex flex-wrap items-center gap-2 text-sm">
          <Link href="/town/guildmaster-room" className="link link-hover">
            Guildmaster&apos;s chamber
          </Link>
          <span className="text-base-content/40" aria-hidden>
            ·
          </span>
          <span className="text-base-content/70">Zoho Books bridge</span>
        </div>

        <h1 className="mt-4 text-2xl font-bold">Zoho Books bridge</h1>

        <MerchantGuildExplain
          className="mt-2"
          fantasy={
            <p className="text-sm text-base-content/70">
              The outer merchants of Zoho demand that the <strong>return door</strong> you name in their ledger match
              the very threshold carved in GuildOS—letter for letter—or they bar the way with &quot;Invalid Redirect
              Uri.&quot;
            </p>
          }
          merchant={
            <p className="text-sm text-base-content/70">
              Zoho compares the <code className="text-xs">redirect_uri</code> in the OAuth request with the list of{" "}
              <strong>Authorized Redirect URIs</strong> on your Zoho API client. They must match exactly (scheme, host,
              port, path, and query string).
            </p>
          }
        />

        <div className="mt-6 rounded-2xl border border-warning/40 bg-warning/10 p-4">
          <p className="text-xs font-semibold uppercase tracking-wide text-base-content/70">
            Paste this into Zoho — Authorized Redirect URI
          </p>
          <p className="mt-2 break-all font-mono text-sm text-base-content">{callback}</p>
          <p className="mt-3 text-xs text-base-content/70">
            If your dev server runs on another port (e.g. you opened{" "}
            <code className="text-[10px]">localhost:3002</code> but this shows{" "}
            <code className="text-[10px]">localhost:3000</code>), set{" "}
            <code className="text-[10px]">NEXT_PUBLIC_SITE_URL</code> (and restart) so the callback matches what you
            register in Zoho, or register both URIs in the API Console.
          </p>
        </div>

        <h2 className="mt-8 text-sm font-semibold uppercase tracking-wide text-base-content/60">
          Where to configure (Zoho)
        </h2>
        <ol className="mt-3 list-decimal space-y-4 pl-5 text-sm text-base-content/85">
          {ZOHO_LINKS.map((item) => (
            <li key={item.href}>
              <a href={item.href} className="link link-primary font-medium" target="_blank" rel="noopener noreferrer">
                {item.label}
              </a>
              <p className="mt-1 text-xs text-base-content/65">{item.note}</p>
            </li>
          ))}
        </ol>

        <div className="mt-8 rounded-xl border border-base-300 bg-base-200/40 p-4 text-sm text-base-content/80">
          <p className="font-medium text-base-content">Quick checklist</p>
          <ul className="mt-2 list-disc space-y-1 pl-5 text-xs">
            <li>
              In{" "}
              <a href="https://api-console.zoho.com/" className="link" target="_blank" rel="noopener noreferrer">
                API Console
              </a>
              , open your client → add the redirect URI above.
            </li>
            <li>Copy the same <strong>Client ID</strong> and <strong>Client Secret</strong> into the Formulary (or server env).</li>
            <li>Ensure Books-related scopes are enabled for the client (e.g. ZohoBooks.fullaccess.all).</li>
          </ul>
        </div>

        <p className="mt-6 text-xs text-base-content/55">
          GuildOS builds the authorize URL like the one that failed:{" "}
          <code className="break-all text-[10px]">
            https://accounts.zoho.com/oauth/v2/auth?...&redirect_uri=...&state=com
          </code>{" "}
          — the <code className="text-[10px]">redirect_uri</code> parameter must equal a registered URI.
        </p>

        <div className="mt-6">
          <Link href="/town/council-hall/formulary" className="btn btn-outline btn-sm">
            Open the Formulary
          </Link>
        </div>
      </section>
    </main>
  );
}
