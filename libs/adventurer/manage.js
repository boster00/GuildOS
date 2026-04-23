/**
 * Manage-plane extensions for {@link Adventurer} — applied when `manage()` runs (dynamic load).
 * @param {import("@/libs/adventurer_runtime/server.js").Adventurer} instance
 */
export function extendAdventurerWithManage(instance) {
  if (!instance || typeof instance !== "object") return;
  instance.test = function test() {
    console.log("test function extension succesful");
  };
}
