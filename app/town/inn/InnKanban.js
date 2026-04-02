import Link from "next/link";

const COLUMNS = [
  {
    id: "request-desk",
    fantasyName: "Request Desk",
    flavorSubtitle: "Ideas",
    businessTip:
      "New requests, not yet processed. Raw ideas land here until the questmaster picks them up.",
    stages: ["idea"],
  },
  {
    id: "paw-lanning",
    fantasyName: "Paw-lanning",
    flavorSubtitle: "Plan",
    businessTip:
      "Plan: quests the questmaster (cat) is still shaping—titles, deliverables, assignments.",
    stages: ["plan"],
  },
  {
    id: "quest-board",
    fantasyName: "Quest Board",
    flavorSubtitle: "Assign & venture forth",
    businessTip:
      "Quests ready for adventurers to pick up and run. Active execution is grouped here as well (no separate “execute” column yet—you may add a prayer room later for heroes in the field).",
    stages: ["assign", "execute"],
  },
  {
    id: "guildmaster-room",
    fantasyName: "Guildmaster room",
    flavorSubtitle: "Review submission",
    businessTip:
      "Review: submissions checked by the questmaster, or escalated for human troubleshooting, approval, or rework decisions.",
    stages: ["review"],
  },
  {
    id: "scribes-room",
    fantasyName: "Scribe's room",
    flavorSubtitle: "Closing",
    businessTip:
      "Closing: deliverables and assets from the quest are archived, cataloged, and prepared for handoff or storage.",
    stages: ["closing"],
  },
  {
    id: "bards-lounge",
    fantasyName: "Bard's lounge",
    flavorSubtitle: "Songs of victory",
    businessTip:
      "Completed archive: finished quests—the tavern tales of work done. Past victories rest here for reference.",
    stages: ["completed"],
  },
];

function InfoTip({ text }) {
  return (
    <div
      className="tooltip tooltip-top z-20 max-w-[min(100vw,24rem)] before:max-w-[min(92vw,22rem)] before:whitespace-normal before:text-left before:content-[attr(data-tip)]"
      data-tip={text}
    >
      <span
        className="inline-flex h-6 w-6 cursor-help items-center justify-center rounded-full border border-base-300 bg-base-200/80 text-xs font-bold text-base-content/60"
        aria-label="What this column means"
      >
        i
      </span>
    </div>
  );
}

function QuestCard({ quest }) {
  const stageLabel =
    quest.stage === "execute"
      ? "Executing"
      : quest.stage === "assign"
        ? "Ready"
        : null;

  return (
    <Link
      href={`/town/inn/quest-board/${quest.id}`}
      className="relative block rounded-lg border border-base-300 bg-base-100/95 p-3 shadow-sm transition hover:border-primary/40 hover:bg-base-100"
      data-quest-id={quest.id}
    >
      <div>
        <div className="flex items-start justify-between gap-2">
          <h3 className="text-sm font-semibold leading-snug">{quest.title || "Untitled quest"}</h3>
          {stageLabel && (
            <span className="badge badge-ghost badge-xs shrink-0 whitespace-nowrap">{stageLabel}</span>
          )}
        </div>
        {quest.description ? (
          <p className="mt-1 line-clamp-2 text-xs text-base-content/65">{quest.description}</p>
        ) : null}
        <div className="mt-2 flex flex-wrap items-center gap-x-2 gap-y-1 text-[10px] uppercase tracking-wide text-base-content/50">
          {quest.assigned_to ? <span>Assignee: {quest.assigned_to}</span> : null}
          <span className="font-mono normal-case tracking-normal">id · {String(quest.id).slice(0, 8)}…</span>
        </div>
      </div>
    </Link>
  );
}

function partitionQuestsByColumn(quests) {
  return COLUMNS.map((col) => ({
    ...col,
    quests: (quests || []).filter((q) => col.stages.includes(q.stage)),
  }));
}

export function InnKanban({ quests }) {
  const columns = partitionQuestsByColumn(quests);

  return (
    <div className="flex gap-3 overflow-x-auto pb-4 pt-1 [scrollbar-gutter:stable]">
      {columns.map((col) => (
        <section
          key={col.id}
          className="flex w-[min(100%,17.5rem)] shrink-0 flex-col rounded-2xl border border-base-300 bg-base-200/40"
        >
          <header className="border-b border-base-300/80 px-3 py-2.5">
            <div className="flex items-start justify-between gap-2">
              <div>
                <h2 className="text-lg font-bold leading-tight text-base-content">{col.fantasyName}</h2>
                <p className="text-[11px] font-medium text-primary/90">{col.flavorSubtitle}</p>
              </div>
              <InfoTip text={col.businessTip} />
            </div>
            <p className="mt-1 text-xs text-base-content/55">{col.quests.length} quest{col.quests.length === 1 ? "" : "s"}</p>
          </header>
          <div className="flex max-h-[min(70vh,36rem)] flex-col gap-2 overflow-y-auto p-2">
            {col.quests.length === 0 ? (
              <p className="px-1 py-6 text-center text-xs italic text-base-content/45">None yet</p>
            ) : (
              col.quests.map((q) => <QuestCard key={q.id} quest={q} />)
            )}
          </div>
        </section>
      ))}
    </div>
  );
}

export function InnKanbanFooter() {
  return (
    <div className="mt-6 flex flex-wrap items-center justify-between gap-3 border-t border-base-300 pt-4 text-sm">
      <p className="text-base-content/65">
        Submit a new idea from the request desk. Open the full{" "}
        <Link href="/town/inn/quest-board" className="link link-primary font-medium">
          quest board
        </Link>{" "}
        for every quest by id. Stages follow your quest rows (including{" "}
        <code className="rounded bg-base-200 px-1 text-xs">completed</code> for the Bard&apos;s lounge).
      </p>
      <div className="flex flex-wrap gap-2">
        <Link href="/town/inn/quest-board" className="btn btn-ghost btn-sm">
          Quest board
        </Link>
        <Link href="/town/inn/request-desk" className="btn btn-primary btn-sm">
          Request Desk
        </Link>
      </div>
    </div>
  );
}
