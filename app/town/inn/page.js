import Link from "next/link";
import {
  Beer,
  ScrollText,
  Send,
  Inbox,
  Swords,
  ClipboardList,
  Crown,
} from "lucide-react";
import PlaceCard from "@/components/guildos/PlaceCard";

export const metadata = {
  title: "The Inn — GuildOS",
};

export default function InnPage() {
  return (
    <div className="mx-auto max-w-5xl space-y-6">
      <div className="flex flex-wrap items-end justify-between gap-3">
        <div>
          <h1 className="guildos-title text-3xl font-bold text-amber-950">
            The Inn
          </h1>
          <p className="mt-1 text-sm text-base-content/65">
            Where quests are born, planned, logged, and sometimes handed to a
            human.
          </p>
        </div>
        <Link href="/town" className="btn btn-ghost btn-sm">
          ← Town Map
        </Link>
      </div>

      <div className="grid gap-4 sm:grid-cols-2">
        <PlaceCard
          href="/town/inn#tavern"
          title="Tavern"
          subtitle="Quest management"
          icon={<Beer className="h-5 w-5" aria-hidden />}
        >
          Tracks open, active, and completed quests (
          <code>quest_board_entries</code>, <code>quest_status_history</code>
          ). Future: claim / assign flows.
        </PlaceCard>
        <PlaceCard
          href="/town/inn#scribe"
          title="Scribe’s Desk"
          subtitle="Logs & artifacts"
          icon={<ScrollText className="h-5 w-5" aria-hidden />}
        >
          Run logs, downloadable artifacts, and quest summaries (
          <code>scribe_logs</code>, <code>run_artifacts</code>,{" "}
          <code>quest_reports</code>).
        </PlaceCard>
        <PlaceCard
          href="/town/inn#messenger"
          title="Messenger’s Desk"
          subtitle="Outbound comms"
          icon={<Send className="h-5 w-5" aria-hidden />}
        >
          Notifications and delivery attempts (
          <code>messages</code>, <code>notification_channels</code>,{" "}
          <code>delivery_attempts</code>).
        </PlaceCard>
        <PlaceCard
          href="/town/inn#request"
          title="Request Desk"
          subtitle="Natural-language intake"
          icon={<Inbox className="h-5 w-5" aria-hidden />}
        >
          Captures user requests into the planning pipeline (
          <code>requests</code> → <code>quests</code>).{" "}
          {/* TODO: form POST /api/guildos/requests */}
        </PlaceCard>
        <PlaceCard
          href="/town/inn#war-room"
          title="War Room"
          subtitle="Planning & strategy"
          icon={<Swords className="h-5 w-5" aria-hidden />}
        >
          Decompose work into plans, steps, and acceptance criteria (
          <code>quest_plans</code>, <code>quest_steps</code>,{" "}
          <code>success_criteria</code>).
        </PlaceCard>
        <PlaceCard
          href="/town/inn#quest-board"
          title="Quest Board"
          subtitle="Available work"
          icon={<ClipboardList className="h-5 w-5" aria-hidden />}
        >
          Surfaced listings for adventurers; links to{" "}
          <code>quests</code> and board slots.
        </PlaceCard>
        <PlaceCard
          href="/town/inn#consul"
          title="Consul’s Chamber"
          subtitle="Human escalation"
          icon={<Crown className="h-5 w-5" aria-hidden />}
        >
          Escalations and approval queues (
          <code>escalations</code>, <code>approval_requests</code>).
        </PlaceCard>
      </div>

      <p className="text-xs text-base-content/50">
        Clarification needed: should “Tavern” and “Quest Board” be separate
        products or one module with two UIs? Current schema supports both;
        merge or split after product sign-off.
      </p>
    </div>
  );
}
