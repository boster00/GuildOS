import Link from "next/link";

const LOCATIONS = [
  {
    slug: "forge",
    title: "The Forge",
    text: "Turn weapon blueprints into real arms—forging is activation (OAuth, credentials, steel).",
    href: "/town/town-square/forge",
    icon: "/images/guildos/chibis/bolt.svg",
    cta: "Enter the Forge",
  },
  {
    slug: "library",
    title: "The Library",
    text: "Skill books—ordered steps, actions, and expected outputs for adventurers.",
    href: "/town/town-square/library",
    icon: "/images/guildos/chibis/sage.svg",
    cta: "Browse the Library",
  },
  {
    slug: "apothecary",
    title: "The Apothecary",
    text: "Potions—rows of brewed secrets (tokens, sessions). Not formulas: stable credentials live in Council Hall's Formulary.",
    href: "/town/town-square/apothecary",
    icon: "/images/guildos/chibis/mirth.svg",
    cta: "Visit the Apothecary",
  },
];

export default function TownSquarePage() {
  return (
    <main className="guild-bg-town-square min-h-dvh p-4 md:p-8">
      <section className="mx-auto max-w-5xl rounded-3xl border border-base-300 bg-base-100/88 p-6 shadow-xl backdrop-blur">
        <h1 className="text-3xl font-bold">Town Square</h1>
        <p className="mt-2 text-sm text-base-content/70">
          Places in the square—not abstract object types. Council Hall holds the{" "}
          <Link href="/town/council-hall/formulary" className="link link-primary">
            Formulary
          </Link>
          : <strong>formulas</strong> (immutable app ids, stable credentials you configure). The Apothecary lists{" "}
          <strong>potions</strong>—runtime brews such as OAuth access and refresh tokens.
        </p>

        <div className="mt-8 grid gap-4 md:grid-cols-3">
          {LOCATIONS.map((place) => (
            <Link
              key={place.slug}
              href={place.href}
              className="flex flex-col rounded-2xl border border-base-300 bg-base-200/70 p-4 shadow transition hover:-translate-y-0.5 hover:border-primary/40"
            >
              <img
                src={place.icon}
                alt=""
                className="h-14 w-14 rounded-xl border border-base-300 bg-base-100/80 p-2"
              />
              <h2 className="mt-3 text-xl font-semibold">{place.title}</h2>
              <p className="mt-2 flex-1 text-sm text-base-content/70">{place.text}</p>
              <span className="btn btn-ghost btn-sm mt-4 w-full pointer-events-none">{place.cta}</span>
            </Link>
          ))}
        </div>
      </section>
    </main>
  );
}
