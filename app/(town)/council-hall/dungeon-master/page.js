import Link from "next/link";
import { getCurrentUser } from "@/libs/council/auth/server";
import DungeonMasterSettings from "@/components/DungeonMasterSettings";
import { MerchantGuildExplain } from "@/components/MerchantGuildExplain";

export const metadata = {
  title: "Dungeon master's room · Council Hall",
};

export default async function DungeonMasterRoomPage() {
  const user = await getCurrentUser();

  return (
    <main className="guild-bg-council min-h-dvh p-4 md:p-8">
      <section className="mx-auto max-w-3xl rounded-3xl border border-base-300 bg-base-100/88 p-6 shadow-xl backdrop-blur">
        <div className="flex flex-wrap items-center gap-2 text-sm">
          <Link href="/" className="link link-hover">
            Town map
          </Link>
          <span className="text-base-content/40" aria-hidden>
            /
          </span>
          <Link href="/council-hall" className="link link-hover">
            Council Hall
          </Link>
          <span className="text-base-content/40" aria-hidden>
            /
          </span>
          <span className="text-base-content/70">Dungeon master&apos;s room</span>
        </div>

        <div className="mt-4 flex flex-wrap items-start gap-4">
          <div
            className="flex h-16 w-16 shrink-0 items-center justify-center rounded-xl border border-base-300 bg-base-200/60 text-2xl"
            aria-hidden
          >
            🎲
          </div>
          <div className="min-w-0 flex-1">
            <h1 className="text-2xl font-bold md:text-3xl">Dungeon master&apos;s room</h1>
            <MerchantGuildExplain
              className="mt-1"
              fantasy={
                <p className="text-sm text-base-content/70">
                  Where the Council names the voice behind the curtain—the oracle that drives quests when you are not at
                  the desk.
                </p>
              }
              merchant={
                <p className="text-sm text-base-content/70">
                  Configure optional LLM API credentials and defaults for your account. If unset, the server uses{" "}
                  <code className="text-xs">OPENAI_API_KEY</code> and library defaults from the environment.
                </p>
              }
            />
          </div>
        </div>

        {!user ? (
          <div className="mt-8 rounded-2xl border border-base-300 bg-base-200/50 p-6 text-center">
            <p className="text-base-content/80">Sign in to open the Dungeon master&apos;s room.</p>
            <Link href="/signin?next=/council-hall/dungeon-master" className="btn btn-primary mt-4">
              Sign in
            </Link>
          </div>
        ) : (
          <div className="mt-8">
            <DungeonMasterSettings />
          </div>
        )}
      </section>
    </main>
  );
}
