/** Used when guildos schema is not migrated yet or queries fail. */
export const FALLBACK_DEV_TASKS = [
  { id: "fb-1", title: "Hook up real auth flow", description: null, status: "todo", sort_order: 10, module_key: "auth" },
  { id: "fb-2", title: "Finalize module-object mapping", description: null, status: "todo", sort_order: 20, module_key: "architecture" },
  { id: "fb-3", title: "Build request intake form", description: null, status: "todo", sort_order: 30, module_key: "quest_intake" },
  { id: "fb-4", title: "Build quest planning UI", description: null, status: "todo", sort_order: 40, module_key: "planning" },
  { id: "fb-5", title: "Add quest board interactions", description: null, status: "todo", sort_order: 50, module_key: "quest_board" },
  { id: "fb-6", title: "Add adventurer assignment system", description: null, status: "todo", sort_order: 60, module_key: "adventurers" },
  { id: "fb-7", title: "Implement hats / role management", description: null, status: "todo", sort_order: 70, module_key: "hats" },
  { id: "fb-8", title: "Implement weapons / tool integrations", description: null, status: "todo", sort_order: 80, module_key: "smith" },
  { id: "fb-9", title: "Implement potion token lifecycle", description: null, status: "todo", sort_order: 90, module_key: "apothecary" },
  { id: "fb-10", title: "Implement shield safeguard policies", description: null, status: "todo", sort_order: 100, module_key: "shields" },
  { id: "fb-11", title: "Implement scribe logging viewer", description: null, status: "todo", sort_order: 110, module_key: "scribe" },
  { id: "fb-12", title: "Implement messenger channel config", description: null, status: "todo", sort_order: 120, module_key: "messenger" },
  { id: "fb-13", title: "Implement consul escalation flow", description: null, status: "todo", sort_order: 130, module_key: "consul" },
  { id: "fb-14", title: "Expand world map", description: null, status: "todo", sort_order: 140, module_key: "town" },
  { id: "fb-15", title: "Add persistent task editing", description: null, status: "todo", sort_order: 150, module_key: "dev_tasks" },
];
