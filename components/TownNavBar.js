import Link from "next/link";
import { TOWN_NAV_LINKS } from "@/libs/council/townNav";

/**
 * Sticky top bar for all /* routes (see app/layout.js).
 */
export default function TownNavBar() {
  return (
    <header className="sticky top-0 z-40 border-b border-base-300 bg-base-100/95 shadow-sm backdrop-blur-md">
      <nav
        className="flex flex-wrap items-center gap-x-1 gap-y-2 px-3 py-2 md:gap-x-2 md:px-4"
        aria-label="Town navigation"
      >
        <span className="mr-1 hidden text-xs font-semibold uppercase tracking-wide text-base-content/50 sm:inline md:mr-2">
          Town
        </span>
        {TOWN_NAV_LINKS.map((item) => (
          <Link
            key={item.href}
            href={item.href}
            className="rounded-lg px-2.5 py-1.5 text-xs font-medium text-base-content/80 transition hover:bg-base-200 hover:text-base-content md:text-sm"
          >
            {item.label}
          </Link>
        ))}
      </nav>
    </header>
  );
}
