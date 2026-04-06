/**
 * NPC registry — single source of truth for all NPC identity.
 * Import from here. Do not duplicate NPC definitions elsewhere.
 *
 * Key = lowercase lookup key (used in assigned_to, DB, and URL lookups).
 * slug = folder name under libs/npcs/ (= job title).
 */

export const NPC_REGISTRY = {
  cat: {
    key: "cat",
    slug: "questmaster",
    name: "Cat",
    fullName: "Wendy the Kitty",
    role: "questmaster",
    icon: "/images/guildos/chibis/questmaster.svg",
    tooltip: "Wendy the Kitty — Questmaster",
    skill_books: ["questmaster"],
  },
  pig: {
    key: "pig",
    slug: "guildmaster",
    name: "Pig",
    fullName: "Oinky the Piggy",
    role: "guildmaster",
    icon: "/images/guildos/chibis/guildmaster.svg",
    tooltip: "Oinky the Piggy — Guildmaster",
    skill_books: ["guildmaster"],
  },
  blacksmith: {
    key: "blacksmith",
    slug: "blacksmith",
    name: "Blacksmith",
    fullName: "Flash Blacksloth",
    role: "blacksmith",
    icon: "/images/guildos/chibis/blacksmith.svg",
    tooltip: "Flash Blacksloth — Blacksmith",
    skill_books: ["blacksmith"],
  },
  runesmith: {
    key: "runesmith",
    slug: "runesmith",
    name: "Runesmith",
    fullName: "Nick Wildrunes",
    role: "runesmith",
    icon: "/images/guildos/chibis/runesmith.svg",
    tooltip: "Nick Wildrunes — Runesmith",
    skill_books: ["blacksmith"],
  },
};

/** Prep quest type → NPC key that handles it. */
export const PREP_NPC_ROUTING = {
  prepare_weapon: "blacksmith",
  prepare_skillbook: "runesmith",
  prepare_adventurer: "pig",
};

/** Array form for UI iteration. */
export const NPC_LIST = Object.values(NPC_REGISTRY);

/**
 * Look up an NPC by key, name, or slug (case-insensitive).
 * @param {string} identifier
 * @returns {object | null}
 */
export function getNpc(identifier) {
  if (!identifier) return null;
  const key = String(identifier).trim().toLowerCase();
  if (NPC_REGISTRY[key]) return NPC_REGISTRY[key];
  // Try matching by name or slug
  for (const npc of NPC_LIST) {
    if (npc.name.toLowerCase() === key || npc.slug === key) return npc;
  }
  return null;
}

/**
 * Check if a name/key refers to an NPC.
 * @param {string} identifier
 */
export function isNpc(identifier) {
  return getNpc(identifier) != null;
}
