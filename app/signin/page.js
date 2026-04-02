import Link from "next/link";
import { getSiteUrl } from "@/libs/council/auth/urls";

export default function SignInPage() {
  return (
    <main className="guild-bg-opening flex min-h-dvh items-center justify-center p-6">
      <div className="w-full max-w-md rounded-2xl border border-base-300 bg-base-100/90 p-6 shadow-xl backdrop-blur">
        <div className="mb-4 flex items-center gap-3">
          <img src="/images/guildos/pig.png" alt="Guildmaster mascot" className="h-14 w-14 rounded-xl border border-base-300" />
          <div>
            <h1 className="text-2xl font-bold">GuildOS Sign In</h1>
            <p className="text-sm text-base-content/70">Guildmaster assists account entry.</p>
          </div>
        </div>

        <form action="/api/council/auth/signin" method="post" className="space-y-3">
          <label className="form-control">
            <span className="label-text text-sm">Email</span>
            <input
              type="email"
              name="email"
              required
              className="input input-bordered w-full"
              placeholder="you@example.com"
            />
          </label>
          <button className="btn btn-primary w-full" type="submit">
            Send Magic Link
          </button>
        </form>

        <p className="mt-4 text-xs text-base-content/70">
          In your auth provider URL settings, allow:{" "}
          <code>{getSiteUrl()}/api/council/auth/callback</code>. Legacy{" "}
          <code>/api/auth/callback</code> is rewritten to the same route.
        </p>
        <div className="mt-4">
          <Link href="/opening" className="link link-hover text-sm">
            Already signed in? Continue
          </Link>
        </div>
      </div>
    </main>
  );
}
