import Link from "next/link";
import { listSkillBooksForLibrary } from "@/libs/skill_book";

export default function LibraryPage() {
  const books = listSkillBooksForLibrary();

  return (
    <main className="guild-bg-library min-h-dvh p-4 md:p-8">
      <section className="mx-auto max-w-4xl rounded-3xl border border-base-300 bg-base-100/88 p-6 shadow-xl backdrop-blur">
        <nav className="text-sm text-base-content/60">
          <Link href="/town/town-square" className="link link-hover">
            Town square
          </Link>
          <span className="mx-2">/</span>
          <span className="text-base-content">Library</span>
        </nav>

        <div className="mt-4 flex flex-wrap items-start gap-4">
          <img
            src="/images/guildos/chibis/sage.svg"
            alt=""
            className="h-16 w-16 rounded-xl border border-base-300 bg-base-200/50 p-2"
          />
          <div className="min-w-0 flex-1">
            <h1 className="text-3xl font-bold">The Library</h1>
            <p className="text-sm text-base-content/70">
              Skill books—ordered action sequences adventurers follow. Each book names steps, weapons, and expected
              outputs.
            </p>
          </div>
        </div>

        <ul className="mt-8 grid gap-4">
          {books.map((b) => (
            <li
              key={b.id}
              className="rounded-2xl border border-base-300 bg-base-200/70 p-4 shadow-sm"
            >
              <h2 className="text-lg font-semibold">{b.title}</h2>
              <p className="mt-1 font-mono text-xs text-base-content/50">id: {b.id}</p>
              <p className="mt-2 text-sm text-base-content/75">{b.description}</p>
            </li>
          ))}
        </ul>
      </section>
    </main>
  );
}
