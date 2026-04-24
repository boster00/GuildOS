/** Top bar: short labels, main town destinations */
export const TOWN_NAV_LINKS = [
  { href: "/", label: "Town map" },
  { href: "/tavern", label: "Tavern" },
  { href: "/quest-board", label: "Quest board" },
  { href: "/guildmaster-room", label: "GM Room" },
  { href: "/proving-grounds", label: "Proving grounds" },
  { href: "/town-square", label: "Town square" },
  { href: "/council-hall", label: "Council hall" },
  { href: "/world-map", label: "World map" },
];

/** Town map: three major districts + elsewhere */
export const TOWN_MAP_MAJOR = [
  {
    href: "/tavern",
    title: "The Tavern",
    text: "Your adventurers gather here. Chat with them, check their status, send them to work.",
    icon: "/images/guildos/cat.png",
  },
  {
    href: "/quest-board",
    title: "Quest Board",
    text: "Kanban view of all quests by stage. Track what is executing, escalated, in review, or closing.",
    icon: "/images/guildos/chibis/ember.svg",
  },
  {
    href: "/guildmaster-room",
    title: "Guildmaster's Room",
    text: "Review quest deliverables, triage escalations, and approve work for closing.",
    icon: "/images/guildos/monkey.png",
  },
];

export const TOWN_MAP_ELSEWHERE = [
  {
    href: "/town-square",
    title: "Town Square",
    text: "The Forge (weapons), Library (skill books), Apothecary (OAuth tokens).",
    icon: "/images/guildos/pig.png",
  },
  {
    href: "/council-hall",
    title: "Council Hall",
    text: "Formulary (credentials), Dungeon Master (LLM settings).",
    icon: "/images/guildos/chibis/sage.svg",
  },
  {
    href: "/world-map",
    title: "World Map",
    text: "Pigeon Post, Outposts, and future expansion zones.",
    icon: "/images/guildos/rabbit.png",
  },
];

/** @deprecated Use TOWN_MAP_MAJOR + TOWN_MAP_ELSEWHERE; kept for any legacy import */
export const TOWN_MAP_LOCATIONS = [
  ...TOWN_MAP_MAJOR,
  ...TOWN_MAP_ELSEWHERE,
];
