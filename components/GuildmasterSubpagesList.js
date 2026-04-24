"use client";

import Link from "next/link";
import { MerchantGuildExplain } from "@/components/MerchantGuildExplain";

export default function GuildmasterSubpagesList() {
  return (
    <div className="mt-8 space-y-6">
      <p className="text-sm text-base-content/65">
        This chamber holds one place of work: the desk, where adventurers leave what they cannot finish alone.
        Integration formulas live in the Council Hall—not here.
      </p>
      <ul className="space-y-3">
        <li>
          <Link
            href="/guildmaster-room/commission-new-adventurer"
            className="block rounded-2xl border border-primary/30 bg-primary/10 p-4 transition hover:border-primary/50 hover:bg-primary/15"
          >
            <h2 className="text-lg font-semibold">Commission a new adventurer</h2>
            <MerchantGuildExplain
              className="mt-1"
              fantasy={
                <p className="text-sm text-base-content/70">
                  Tell the <strong>cat</strong> what you need—notes, checklist, and a canvas until the recruit is ready
                  to sign the roster.
                </p>
              }
              merchant={
                <p className="text-sm text-base-content/70">
                  Guided flow to define name, class, instructions, and tools; optional AI assist from the cat.
                </p>
              }
            />
          </Link>
        </li>
        <li>
          <Link
            href="/guildmaster-room/desk"
            className="block rounded-2xl border border-base-300 bg-base-200/60 p-4 transition hover:border-primary/40 hover:bg-base-200"
          >
            <h2 className="text-lg font-semibold">The desk</h2>
            <MerchantGuildExplain
              className="mt-1"
              fantasy={
                <p className="text-sm text-base-content/70">
                  Piled letters, reports, and scrolls—where you <strong>help adventurers</strong> with judgments and
                  answers they could not resolve in the field.
                </p>
              }
              merchant={
                <p className="text-sm text-base-content/70">
                  Human-in-the-loop queue: quests flagged for input and submissions in review. The adventurer roster is
                  listed upstairs at the Inn.
                </p>
              }
            />
          </Link>
        </li>
      </ul>
    </div>
  );
}
