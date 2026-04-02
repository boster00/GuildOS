import Link from "next/link";
import { getCurrentUser } from "@/libs/council/auth/server";
import GuildmasterSubpagesList from "@/components/GuildmasterSubpagesList";
import { MerchantGuildExplain } from "@/components/MerchantGuildExplain";

export default async function GuildmasterRoomPage() {
  const user = await getCurrentUser();

  return (
    <main className="guild-bg-town-map min-h-dvh p-8">
      <section className="mx-auto max-w-3xl rounded-3xl border border-base-300 bg-base-100/88 p-6 shadow-xl backdrop-blur">
        <div className="flex flex-wrap items-start gap-4">
          <img
            src="/images/guildos/monkey.png"
            alt="Guildmaster"
            className="h-16 w-16 rounded-xl border border-base-300"
          />
          <div className="min-w-0 flex-1">
            <h1 className="text-3xl font-bold">The Guildmaster&apos;s chamber</h1>
            <MerchantGuildExplain
              className="mt-1"
              fantasy={
                <p className="text-sm text-base-content/70">
                  A quiet chamber for the <strong>desk</strong>—letters and reports from adventurers who need your
                  judgment. The <strong>formulary</strong> is kept in the Council Hall; the quest board and adventurer
                  roster are at the Inn.
                </p>
              }
              merchant={
                <p className="text-sm text-base-content/70">
                  Inbox for quests requiring human input or review. Integration formulas and the formulary are in Council
                  Hall; the adventurer roster lives upstairs at the Inn.
                </p>
              }
            />
          </div>
        </div>

        {!user ? (
          <div className="mt-8 rounded-2xl border border-base-300 bg-base-200/50 p-6 text-center">
            <p className="text-base-content/80">Present your guild seal at the gate to enter the chamber.</p>
            <Link href="/signin" className="btn btn-primary mt-4">
              Sign in
            </Link>
          </div>
        ) : (
          <GuildmasterSubpagesList />
        )}
      </section>
    </main>
  );
}
