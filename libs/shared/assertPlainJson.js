/**
 * Deep validation: ensure value is JSON-serializable
 * Used by both client (ArticleAssetManager) and server (save-assets route)
 * 
 * ALLOWED:
 * - null, boolean, finite numbers, strings
 * - arrays of allowed values
 * - plain objects only (proto === Object.prototype or proto === null)
 * 
 * REJECTED:
 * - React SyntheticEvents / DOM Events
 * - Functions, symbols, bigint
 * - NaN, Infinity, -Infinity
 * - Date, Map, Set, RegExp, Error
 * - DOM nodes (HTMLElement, Node)
 * - File, Blob, ArrayBuffer, TypedArray
 * - Circular references
 * 
 * @param {any} value - Value to validate
 * @param {string} path - Current path for error reporting (e.g., "assets.keywords[0]")
 * @param {WeakSet} seen - Circular reference tracker
 * @throws {Error} with actionable message pointing to corruption source
 */
export function assertPlainJson(value, path = 'root', seen = new WeakSet()) {
  // Null/undefined are fine
  if (value == null) return;

  // Primitives: string, boolean, finite numbers only
  const type = typeof value;
  if (type === 'string' || type === 'boolean') return;
  
  if (type === 'number') {
    if (!Number.isFinite(value)) {
      throw new Error(`Asset corruption at '${path}': ${value} is not a finite number (NaN/Infinity not allowed).`);
    }
    return;
  }

  // Reject non-serializable types immediately
  if (type === 'function') {
    throw new Error(
      `Asset corruption at '${path}': Cannot save functions. ` +
      `Check your handler signature - you may have passed a callback instead of data.`
    );
  }
  if (type === 'symbol' || type === 'bigint') {
    throw new Error(`Asset corruption at '${path}': ${type} is not JSON-serializable.`);
  }

  // Only objects and arrays past this point
  if (type !== 'object') {
    throw new Error(`Asset corruption at '${path}': unexpected type ${type}`);
  }

  // Circular reference check
  if (seen.has(value)) {
    throw new Error(`Asset corruption at '${path}': circular reference detected.`);
  }
  seen.add(value);

  // Detect React SyntheticEvent (multiple signatures for robustness)
  if (isReactEvent(value)) {
    throw new Error(
      `Asset corruption at '${path}': React SyntheticEvent detected. ` +
      `Your handler received (event) but you treated it as data. ` +
      `Check the function signature at the call site.`
    );
  }

  // Detect DOM Event
  if (isDomEvent(value)) {
    throw new Error(
      `Asset corruption at '${path}': DOM Event object detected. ` +
      `Check your event handler - you passed the event instead of extracting data from it.`
    );
  }

  // Detect DOM nodes
  if (isDomNode(value)) {
    throw new Error(`Asset corruption at '${path}': DOM node detected (${value.nodeName || 'unknown'}).`);
  }

  // Detect non-plain objects (Map, Set, Date, File, RegExp, Error, etc.)
  const proto = Object.getPrototypeOf(value);
  const isPlainObject = proto === Object.prototype || proto === null;
  const isArray = Array.isArray(value);

  if (!isPlainObject && !isArray) {
    const ctorName = value.constructor?.name || 'Unknown';
    
    // Explicitly reject common non-serializable types
    if (value instanceof Date) {
      throw new Error(
        `Asset corruption at '${path}': Date objects are not JSON-serializable. ` +
        `Convert to ISO string first: new Date().toISOString()`
      );
    }
    if (value instanceof Map || value instanceof Set) {
      throw new Error(`Asset corruption at '${path}': ${ctorName} is not JSON-serializable. Convert to Array/Object first.`);
    }
    if (value instanceof RegExp || value instanceof Error) {
      throw new Error(`Asset corruption at '${path}': ${ctorName} is not JSON-serializable.`);
    }
    if (typeof File !== 'undefined' && value instanceof File) {
      throw new Error(`Asset corruption at '${path}': File detected. Upload to storage first, then save URL.`);
    }
    if (typeof Blob !== 'undefined' && value instanceof Blob) {
      throw new Error(`Asset corruption at '${path}': Blob detected. Upload to storage first, then save URL.`);
    }
    if (typeof ArrayBuffer !== 'undefined' && (ArrayBuffer.isView(value) || value instanceof ArrayBuffer)) {
      throw new Error(`Asset corruption at '${path}': TypedArray/ArrayBuffer detected. Convert to Array first.`);
    }
    
    throw new Error(
      `Asset corruption at '${path}': ${ctorName} is not JSON-serializable. ` +
      `Only plain objects and arrays are allowed.`
    );
  }

  // Recurse into arrays
  if (isArray) {
    value.forEach((item, index) => {
      assertPlainJson(item, `${path}[${index}]`, seen);
    });
    return;
  }

  // Recurse into plain objects
  for (const [key, val] of Object.entries(value)) {
    assertPlainJson(val, `${path}.${key}`, seen);
  }
}

/**
 * Detect React SyntheticEvent objects (multiple signatures for robustness)
 */
function isReactEvent(obj) {
  if (!obj || typeof obj !== 'object') return false;
  
  // React-specific properties
  const hasReactKeys = '_reactName' in obj || 'nativeEvent' in obj;
  
  // Event-like methods
  const hasEventMethods = 
    typeof obj.preventDefault === 'function' &&
    typeof obj.stopPropagation === 'function';
  
  // Event properties
  const hasEventProps = 
    ('bubbles' in obj || 'cancelable' in obj) &&
    ('currentTarget' in obj || 'target' in obj);
  
  return (hasReactKeys && hasEventProps) || (hasEventMethods && hasEventProps);
}

/**
 * Detect DOM Event objects
 */
function isDomEvent(obj) {
  if (!obj || typeof obj !== 'object') return false;
  
  // Click/mouse event signatures
  const isClickEvent = 
    obj.type === 'click' && 
    ('pageX' in obj || 'clientX' in obj || 'button' in obj);
  
  // Generic event signatures
  const hasEventProps = 
    'target' in obj &&
    'type' in obj &&
    ('timeStamp' in obj || 'isTrusted' in obj);
  
  return isClickEvent || hasEventProps;
}

/**
 * Detect DOM nodes
 */
function isDomNode(obj) {
  if (!obj || typeof obj !== 'object') return false;
  
  return (
    ('nodeType' in obj || 'nodeName' in obj) &&
    ('innerHTML' in obj || 'textContent' in obj || 'children' in obj)
  );
}
