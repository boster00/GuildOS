/**
 * State patch operations helper
 * Note: This is used by feature code, NOT by monkey itself
 */

import { PatchOp } from "../references/types";

// Re-export PatchOp for convenience
export type { PatchOp };

/**
 * Apply patch operations to a state object
 */
export function applyStatePatches<T>(state: T, patches: PatchOp[]): T {
  let result = JSON.parse(JSON.stringify(state)); // Deep clone
  
  for (const patch of patches) {
    const pathParts = parsePath(patch.path);
    result = applyPatch(result, pathParts, patch);
  }
  
  return result;
}

function parsePath(path: string): Array<string | number> {
  const parts: Array<string | number> = [];
  const segments = path.split(".");
  
  for (const segment of segments) {
    // Handle array indices: "items[0]" -> "items" and 0
    const arrayMatch = segment.match(/^([^\[]+)\[(\d+)\]$/);
    if (arrayMatch) {
      parts.push(arrayMatch[1]);
      parts.push(parseInt(arrayMatch[2], 10));
    } else {
      parts.push(segment);
    }
  }
  
  return parts;
}

function applyPatch(obj: any, pathParts: Array<string | number>, patch: PatchOp): any {
  if (pathParts.length === 0) {
    // Apply at root
    switch (patch.op) {
      case "set":
        return patch.value;
      case "merge":
        return { ...obj, ...patch.value };
      case "remove":
        return undefined;
      default:
        return obj;
    }
  }
  
  const [head, ...tail] = pathParts;
  const current = obj[head];
  
  if (tail.length === 0) {
    // Terminal path
    switch (patch.op) {
      case "set":
        obj[head] = patch.value;
        break;
      case "merge":
        obj[head] = { ...(obj[head] || {}), ...patch.value };
        break;
      case "append":
        if (Array.isArray(obj[head])) {
          obj[head] = [...obj[head], ...(Array.isArray(patch.value) ? patch.value : [patch.value])];
        } else {
          obj[head] = patch.value;
        }
        break;
      case "remove":
        if (Array.isArray(obj)) {
          // Removing from array by index
          const index = head as number;
          if (index >= 0 && index < obj.length) {
            obj.splice(index, 1);
          }
        } else if (typeof head === "string") {
          delete obj[head];
        }
        break;
    }
  } else {
    // Recursive path
    if (current === undefined || current === null) {
      // Create intermediate object/array
      const isNextNumeric = typeof tail[0] === "number";
      obj[head] = isNextNumeric ? [] : {};
    }
    
    // Special case: if removing from array by index (e.g., sections[0])
    if (patch.op === "remove" && Array.isArray(current) && tail.length === 1 && typeof tail[0] === "number") {
      const index = tail[0];
      if (index >= 0 && index < current.length) {
        // Create new array without the element at index
        obj[head] = [...current.slice(0, index), ...current.slice(index + 1)];
      } else {
        obj[head] = current; // Keep as-is if index invalid
      }
    } else {
      obj[head] = applyPatch(obj[head], tail, patch);
    }
  }
  
  return obj;
}
