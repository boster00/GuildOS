import { redirect } from "next/navigation";
import Link from "next/link";
import { createClient } from "@libs-db/server";
import DevTaskSidebar from "@/components/guildos/DevTaskSidebar";
import { getDevTasksForSidebar } from "@/libs/guildos/queries/server";
import "@/app/guildos-theme.css";

export default async function TownLayout({ children }) {
  const sb = await createClient();
  const {
    data: { user },
  } = await sb.auth.getUser();

  if (!user) {
    redirect("/signin?next=/town");
  }

  const tasks = await getDevTasksForSidebar();

  return (
    <div className="guildos-parchment flex min-h-screen flex-col">
      <header className="border-b border-amber-900/15 bg-amber-950/10 px-4 py-3">
        <div className="mx-auto flex max-w-7xl flex-wrap items-center justify-between gap-2">
          <div className="flex items-center gap-3">
            <Link
              href="/opening"
              className="guildos-title text-lg font-bold text-amber-950 hover:underline"
            >
              GuildOS
            </Link>
            <span className="hidden text-xs text-base-content/50 sm:inline">
              Town console
            </span>
          </div>
          <nav className="flex flex-wrap items-center gap-2 text-sm">
            <Link href="/town" className="link link-hover">
              Map
            </Link>
            <span className="text-base-content/30">·</span>
            <Link href="/town/inn" className="link link-hover">
              Inn
            </Link>
            <Link href="/town/town-square" className="link link-hover">
              Square
            </Link>
            <Link href="/town/world-map" className="link link-hover">
              World
            </Link>
          </nav>
        </div>
      </header>
      <div className="flex min-h-0 flex-1">
        <div className="hidden w-1/4 min-w-[220px] max-w-sm shrink-0 md:flex md:flex-col">
          <DevTaskSidebar tasks={tasks} />
        </div>
        <div className="min-w-0 flex-1 p-4 md:p-6">{children}</div>
      </div>
      <div className="border-t border-amber-900/15 bg-base-200 p-3 md:hidden">
        <p className="mb-2 text-center text-[10px] font-bold uppercase tracking-wider text-amber-900/60">
          Dev tasks (open on desktop for full ledger)
        </p>
        <ul className="max-h-32 list-none space-y-1 overflow-y-auto text-xs">
          {tasks.slice(0, 5).map((t) => (
            <li key={t.id} className="truncate text-base-content/70">
              • {t.title}
            </li>
          ))}
        </ul>
      </div>
    </div>
  );
}
