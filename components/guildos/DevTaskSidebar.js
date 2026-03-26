import { Hammer } from "lucide-react";

const statusBadge = {
  todo: "badge-ghost",
  in_progress: "badge-info",
  blocked: "badge-warning",
  done: "badge-success",
};

/**
 * @param {{ tasks: Array<{ id: string, title: string, description?: string | null, status: string, module_key?: string | null }> }} props
 */
export default function DevTaskSidebar({ tasks }) {
  return (
    <aside className="flex h-full min-h-0 flex-col border-r border-amber-900/20 bg-base-200/80">
      <div className="border-b border-amber-900/15 bg-amber-950/10 px-3 py-3">
        <div className="flex items-center gap-2 text-amber-950">
          <Hammer className="h-4 w-4 shrink-0 opacity-80" aria-hidden />
          <div>
            <p className="text-xs font-bold uppercase tracking-wider text-amber-900/70">
              Dev build ledger
            </p>
            <p className="text-[11px] text-base-content/60">
              Internal roadmap — not shown to end users at launch.
            </p>
          </div>
        </div>
      </div>
      <ul className="min-h-0 flex-1 list-none space-y-2 overflow-y-auto p-3">
        {tasks.map((t) => (
          <li
            key={t.id}
            className="rounded-lg border border-base-300 bg-base-100 p-2.5 shadow-sm"
          >
            <div className="flex flex-wrap items-center gap-1.5">
              <span
                className={`badge badge-xs ${statusBadge[t.status] || "badge-ghost"}`}
              >
                {t.status?.replace("_", " ") || "todo"}
              </span>
              {t.module_key ? (
                <span className="badge badge-xs badge-outline opacity-70">
                  {t.module_key}
                </span>
              ) : null}
            </div>
            <p className="mt-1 text-sm font-medium leading-snug">{t.title}</p>
            {t.description ? (
              <p className="mt-0.5 text-xs text-base-content/55">{t.description}</p>
            ) : null}
          </li>
        ))}
      </ul>
    </aside>
  );
}
