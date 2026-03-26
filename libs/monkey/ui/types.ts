/**
 * Types for centralized results UI
 * Part B: Two-input API (placement + binding)
 */

/**
 * Placement: where the results UI should be rendered
 */
export interface ResultsPlacement {
  // ID-based placement (component will render at mount point with this ID)
  id?: string;
  // OR direct React ref/container
  container?: HTMLElement | React.RefObject<HTMLElement>;
  // OR region key (predefined regions in the app)
  region?: string;
}

/**
 * State binding: how to read/write the selected result
 */
export interface StateBinding {
  // Get current value
  get: () => any;
  // Set new value
  set: (value: any) => void;
  // Optional: path within state (for nested updates)
  path?: string;
  // Optional: transform function to convert selection to state format
  transform?: (selection: any) => any;
}

/**
 * Results UI configuration
 */
export interface ResultsUIConfig {
  placement: ResultsPlacement;
  binding: StateBinding;
  // Task type for feedback regeneration
  taskType?: string;
  // Model to use for regeneration
  model?: string;
  // Original request context (for feedback)
  originalRequest?: any;
}

