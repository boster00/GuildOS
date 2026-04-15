/** Top bar: short labels, main town destinations */
export const TOWN_NAV_LINKS = [
  { href: "/town", label: "Town map" },
  { href: "/town/inn", label: "Inn" },
  { href: "/town/inn/upstairs", label: "Upstairs" },
  { href: "/town/inn/quest-board", label: "Quest board" },
  { href: "/town/guildmaster-room/desk", label: "GM Desk" },
  { href: "/town/proving-grounds", label: "Proving grounds" },
  { href: "/town/town-square", label: "Town square" },
  { href: "/town/town-square/forge", label: "Forge" },
  { href: "/town/council-hall", label: "Council hall" },
  { href: "/town/world-map", label: "World map" },
];

/** Town map: three major districts + elsewhere */
export const TOWN_MAP_MAJOR = [
  {
    href: "/town/inn",
    title: "The Inn",
    text: "Quest board downstairs; adventurers upstairs; request desk at the door.",
    icon: "/images/guildos/cat.png",
  },
  {
    href: "/town/town-square",
    title: "Town Square",
    text: "The Forge (blueprints → forged weapons), Library, Apothecary.",
    icon: "/images/guildos/pig.png",
  },
  {
    href: "/town/council-hall",
    title: "Council Hall",
    text: "Charter, formulary, dungeon master (LLM) settings, and durable credentials.",
    icon: "/images/guildos/chibis/sage.svg",
  },
];

export const TOWN_MAP_ELSEWHERE = [
  {
    href: "/town/guildmaster-room",
    title: "Guildmaster's chamber",
    text: "Human-in-the-loop desk—quests that need your judgment; formulary is in Council Hall.",
    icon: "/images/guildos/monkey.png",
  },
  {
    href: "/town/world-map",
    title: "World Map",
    text: "Future expansion zones and upcoming quests.",
    icon: "/images/guildos/rabbit.png",
  },
];

/** @deprecated Use TOWN_MAP_MAJOR + TOWN_MAP_ELSEWHERE; kept for any legacy import */
export const TOWN_MAP_LOCATIONS = [
  ...TOWN_MAP_MAJOR,
  ...TOWN_MAP_ELSEWHERE,
];
