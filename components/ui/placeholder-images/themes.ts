/**
 * Placeholder Image Themes
 * Multiple theme sets for placeholder images (professional, casual, etc.)
 */

export type PlaceholderTheme = 
  | "professional"
  | "casual"
  | "minimalist"
  | "colorful"
  | "corporate"
  | "creative";

export interface ThemeConfig {
  name: string;
  description: string;
  colors: {
    primary: string;
    secondary: string;
    accent: string;
    background: string;
    border: string;
    text: string;
    textMuted: string;
  };
  styles: {
    borderStyle: "solid" | "dashed" | "dotted" | "none";
    borderRadius: number;
    opacity: number;
    shadow: boolean;
  };
}

export const themes: Record<PlaceholderTheme, ThemeConfig> = {
  professional: {
    name: "Professional",
    description: "Clean, corporate style with subtle colors",
    colors: {
      primary: "#1e40af",
      secondary: "#3b82f6",
      accent: "#60a5fa",
      background: "#ffffff",
      border: "#e5e7eb",
      text: "#1f2937",
      textMuted: "#6b7280",
    },
    styles: {
      borderStyle: "solid",
      borderRadius: 4,
      opacity: 0.9,
      shadow: false,
    },
  },
  casual: {
    name: "Casual",
    description: "Friendly, approachable style with warmer tones",
    colors: {
      primary: "#f59e0b",
      secondary: "#fbbf24",
      accent: "#fcd34d",
      background: "#fef3c7",
      border: "#fde68a",
      text: "#92400e",
      textMuted: "#b45309",
    },
    styles: {
      borderStyle: "dashed",
      borderRadius: 8,
      opacity: 0.8,
      shadow: true,
    },
  },
  minimalist: {
    name: "Minimalist",
    description: "Ultra-clean with minimal styling",
    colors: {
      primary: "#000000",
      secondary: "#ffffff",
      accent: "#f3f4f6",
      background: "#ffffff",
      border: "#e5e7eb",
      text: "#000000",
      textMuted: "#9ca3af",
    },
    styles: {
      borderStyle: "solid",
      borderRadius: 2,
      opacity: 1,
      shadow: false,
    },
  },
  colorful: {
    name: "Colorful",
    description: "Vibrant, energetic style with bold colors",
    colors: {
      primary: "#8b5cf6",
      secondary: "#ec4899",
      accent: "#f59e0b",
      background: "#fef3c7",
      border: "#fbbf24",
      text: "#7c3aed",
      textMuted: "#a855f7",
    },
    styles: {
      borderStyle: "solid",
      borderRadius: 12,
      opacity: 0.85,
      shadow: true,
    },
  },
  corporate: {
    name: "Corporate",
    description: "Formal, business-focused with conservative colors",
    colors: {
      primary: "#1f2937",
      secondary: "#374151",
      accent: "#4b5563",
      background: "#f9fafb",
      border: "#d1d5db",
      text: "#111827",
      textMuted: "#4b5563",
    },
    styles: {
      borderStyle: "solid",
      borderRadius: 2,
      opacity: 0.95,
      shadow: false,
    },
  },
  creative: {
    name: "Creative",
    description: "Artistic, expressive style with unique patterns",
    colors: {
      primary: "#ec4899",
      secondary: "#8b5cf6",
      accent: "#06b6d4",
      background: "#f0f9ff",
      border: "#bae6fd",
      text: "#be185d",
      textMuted: "#a855f7",
    },
    styles: {
      borderStyle: "dotted",
      borderRadius: 16,
      opacity: 0.75,
      shadow: true,
    },
  },
};

/**
 * Get theme by name, fallback to professional
 */
export function getTheme(themeName?: string): ThemeConfig {
  if (!themeName || !themes[themeName as PlaceholderTheme]) {
    return themes.professional;
  }
  return themes[themeName as PlaceholderTheme];
}

/**
 * Get all available theme names
 */
export function getAvailableThemes(): Array<{ value: PlaceholderTheme; label: string; description: string }> {
  return Object.entries(themes).map(([value, config]) => ({
    value: value as PlaceholderTheme,
    label: config.name,
    description: config.description,
  }));
}
