import { createClient } from "@libs-db/server";
import { FALLBACK_DEV_TASKS } from "@/libs/guildos/constants/fallbacks";

const SCHEMA = "guildos";

/**
 * @returns {Promise<Array<{id: string, title: string, description: string | null, status: string, sort_order: number, module_key: string | null}>>}
 */
export async function getDevTasksForSidebar() {
  try {
    const sb = await createClient();
    const { data, error } = await sb
      .schema(SCHEMA)
      .from("dev_tasks")
      .select("id, title, description, status, sort_order, module_key")
      .order("sort_order", { ascending: true });

    if (error) {
      if (process.env.NODE_ENV === "development") {
        console.warn("[guildos/getDevTasksForSidebar]", error.message);
      }
      return FALLBACK_DEV_TASKS;
    }
    if (!data?.length) return FALLBACK_DEV_TASKS;
    return data;
  } catch (e) {
    if (process.env.NODE_ENV === "development") {
      console.warn("[guildos/getDevTasksForSidebar]", e?.message || e);
    }
    return FALLBACK_DEV_TASKS;
  }
}

/**
 * Map locations for the town (slug, name, route_path, map_x, map_y).
 */
export async function getTownLocations() {
  try {
    const sb = await createClient();
    const { data, error } = await sb
      .schema(SCHEMA)
      .from("locations")
      .select("slug, name, description, route_path, map_x, map_y, icon_key, sort_order")
      .in("slug", ["inn", "town-square", "world-map"])
      .order("sort_order", { ascending: true });

    if (error || !data?.length) {
      return [
        { slug: "inn", name: "The Inn", description: "Quest hall", route_path: "/town/inn", map_x: 22, map_y: 38, icon_key: "inn" },
        { slug: "town-square", name: "Town Square", description: "Shops", route_path: "/town/town-square", map_x: 55, map_y: 42, icon_key: "square" },
        { slug: "world-map", name: "World Map", description: "Beyond", route_path: "/town/world-map", map_x: 78, map_y: 28, icon_key: "globe" },
      ];
    }
    return data;
  } catch {
    return [
      { slug: "inn", name: "The Inn", route_path: "/town/inn", map_x: 22, map_y: 38, icon_key: "inn" },
      { slug: "town-square", name: "Town Square", route_path: "/town/town-square", map_x: 55, map_y: 42, icon_key: "square" },
      { slug: "world-map", name: "World Map", route_path: "/town/world-map", map_x: 78, map_y: 28, icon_key: "globe" },
    ];
  }
}

/**
 * Characters with first portrait asset URL.
 */
export async function getOpeningCharacters() {
  try {
    const sb = await createClient();
    const { data: chars, error: cErr } = await sb
      .schema(SCHEMA)
      .from("characters")
      .select("id, slug, name, title, role_hint, sort_order")
      .eq("is_active", true)
      .order("sort_order", { ascending: true });

    if (cErr || !chars?.length) {
      return defaultOpeningCharacters();
    }

    const { data: assets } = await sb
      .schema(SCHEMA)
      .from("character_assets")
      .select("character_id, public_url, alt_text, asset_kind")
      .eq("asset_kind", "portrait");

    const byChar = new Map((assets || []).map((a) => [a.character_id, a]));

    return chars.map((c) => {
      const a = byChar.get(c.id);
      return {
        ...c,
        portraitUrl: a?.public_url || `/images/guildos/chibis/${c.slug}.svg`,
        portraitAlt: a?.alt_text || c.name,
      };
    });
  } catch {
    return defaultOpeningCharacters();
  }
}

function defaultOpeningCharacters() {
  const slugs = ["ember", "sage", "bolt", "mirth"];
  const names = ["Ember", "Sage", "Bolt", "Mirth"];
  return slugs.map((slug, i) => ({
    id: slug,
    slug,
    name: names[i],
    title: null,
    role_hint: null,
    sort_order: i,
    portraitUrl: `/images/guildos/chibis/${slug}.svg`,
    portraitAlt: `${names[i]} chibi`,
  }));
}
