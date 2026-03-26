// ARCHIVED: Original path was components/ui/placeholder-images/generatePlaceholders.ts

/**
 * Placeholder Image Generator
 * Generates SVG placeholder images based on theme and type
 */

import { ThemeConfig, PlaceholderTheme } from "./themes";

export type PlaceholderType = 
  | "logo"
  | "avatar"
  | "product"
  | "banner"
  | "icon"
  | "default";

/**
 * Generate placeholder SVG for a specific type and theme
 */
export function generatePlaceholderSVG(
  type: PlaceholderType,
  theme: ThemeConfig,
  options: {
    width?: number;
    height?: number;
    text?: string;
    index?: number;
  } = {}
): string {
  const { width = 150, height = 60, text, index = 0 } = options;

  switch (type) {
    case "logo":
      return generateLogoPlaceholder(width, height, theme, text || "Logo", index);
    case "avatar":
      return generateAvatarPlaceholder(width, height, theme, text || "User");
    case "product":
      return generateProductPlaceholder(width, height, theme, text || "Product");
    case "banner":
      return generateBannerPlaceholder(width, height, theme, text || "Banner");
    case "icon":
      return generateIconPlaceholder(width, height, theme, text || "Icon");
    case "default":
    default:
      return generateDefaultPlaceholder(width, height, theme, text || "Image");
  }
}

/**
 * Generate logo placeholder
 */
function generateLogoPlaceholder(
  width: number,
  height: number,
  theme: ThemeConfig,
  text: string,
  index: number
): string {
  const { colors, styles } = theme;
  const logoStyle = index % 3;
  const shadowFilter = styles.shadow ? `filter: drop-shadow(0 2px 4px rgba(0,0,0,0.1));` : "";
  const dashArray = styles.borderStyle === "dashed" ? "4 4" : styles.borderStyle === "dotted" ? "2 2" : "0";

  if (logoStyle === 0) {
    // Text-based logo
    return `<svg width="${width}" height="${height}" viewBox="0 0 ${width} ${height}" xmlns="http://www.w3.org/2000/svg" style="${shadowFilter}">
      <rect width="${width}" height="${height}" fill="${colors.background}" 
            stroke="${colors.border}" stroke-width="1" stroke-dasharray="${dashArray}" 
            rx="${styles.borderRadius}"/>
      <text x="50%" y="50%" dominant-baseline="middle" text-anchor="middle" 
            fill="${colors.text}" font-size="${Math.min(width / 8, 14)}" 
            font-family="system-ui, -apple-system, sans-serif" font-weight="600" opacity="${styles.opacity}">${text}</text>
    </svg>`;
  } else if (logoStyle === 1) {
    // Icon + text logo
    const iconSize = Math.min(width, height) * 0.4;
    return `<svg width="${width}" height="${height}" viewBox="0 0 ${width} ${height}" xmlns="http://www.w3.org/2000/svg" style="${shadowFilter}">
      <rect width="${width}" height="${height}" fill="${colors.background}" 
            stroke="${colors.border}" stroke-width="1" stroke-dasharray="${dashArray}" 
            rx="${styles.borderRadius}"/>
      <circle cx="${width * 0.25}" cy="${height / 2}" r="${iconSize / 2}" 
              fill="${colors.primary}" opacity="${styles.opacity * 0.3}"/>
      <text x="${width * 0.5}" y="50%" dominant-baseline="middle" text-anchor="start" 
            fill="${colors.text}" font-size="${Math.min(width / 10, 12)}" 
            font-family="system-ui, -apple-system, sans-serif" font-weight="500" opacity="${styles.opacity}">${text}</text>
    </svg>`;
  } else {
    // Geometric logo
    return `<svg width="${width}" height="${height}" viewBox="0 0 ${width} ${height}" xmlns="http://www.w3.org/2000/svg" style="${shadowFilter}">
      <rect width="${width}" height="${height}" fill="${colors.background}" 
            stroke="${colors.border}" stroke-width="1" stroke-dasharray="${dashArray}" 
            rx="${styles.borderRadius}"/>
      <rect x="${width * 0.2}" y="${height * 0.2}" width="${width * 0.6}" height="${height * 0.6}" 
            fill="${colors.primary}" opacity="${styles.opacity * 0.15}" rx="${styles.borderRadius / 2}"/>
      <text x="50%" y="50%" dominant-baseline="middle" text-anchor="middle" 
            fill="${colors.text}" font-size="${Math.min(width / 9, 11)}" 
            font-family="system-ui, -apple-system, sans-serif" font-weight="500" opacity="${styles.opacity}">${text}</text>
    </svg>`;
  }
}

/**
 * Generate avatar placeholder
 */
function generateAvatarPlaceholder(
  width: number,
  height: number,
  theme: ThemeConfig,
  text: string
): string {
  const { colors, styles } = theme;
  const initials = text.substring(0, 2).toUpperCase();

  return `<svg width="${width}" height="${height}" viewBox="0 0 ${width} ${height}" xmlns="http://www.w3.org/2000/svg">
    <circle cx="${width / 2}" cy="${height / 2}" r="${Math.min(width, height) / 2}" 
            fill="${colors.background}" stroke="${colors.border}" stroke-width="1"/>
    <circle cx="${width / 2}" cy="${height * 0.4}" r="${Math.min(width, height) * 0.25}" 
            fill="${colors.primary}" opacity="${styles.opacity * 0.3}"/>
    <path d="M ${width * 0.3} ${height * 0.7} Q ${width / 2} ${height * 0.5} ${width * 0.7} ${height * 0.7}" 
          stroke="${colors.accent}" stroke-width="2" fill="none" opacity="${styles.opacity * 0.4}"/>
    <text x="50%" y="${height * 0.9}" dominant-baseline="middle" text-anchor="middle" 
          fill="${colors.textMuted}" font-size="${Math.min(width / 10, 10)}" 
          font-family="system-ui, sans-serif" opacity="${styles.opacity}">${initials}</text>
  </svg>`;
}

/**
 * Generate product placeholder
 */
function generateProductPlaceholder(
  width: number,
  height: number,
  theme: ThemeConfig,
  text: string
): string {
  const { colors, styles } = theme;
  const shadowFilter = styles.shadow ? `filter: drop-shadow(0 2px 4px rgba(0,0,0,0.1));` : "";
  const dashArray = styles.borderStyle === "dashed" ? "4 4" : styles.borderStyle === "dotted" ? "2 2" : "0";

  return `<svg width="${width}" height="${height}" viewBox="0 0 ${width} ${height}" xmlns="http://www.w3.org/2000/svg" style="${shadowFilter}">
    <rect width="${width}" height="${height}" fill="${colors.background}" 
          stroke="${colors.border}" stroke-width="1" stroke-dasharray="${dashArray}" 
          rx="${styles.borderRadius}"/>
    <rect x="${width * 0.15}" y="${height * 0.25}" width="${width * 0.7}" height="${height * 0.5}" 
          fill="${colors.primary}" opacity="${styles.opacity * 0.1}" rx="${styles.borderRadius / 2}"/>
    <circle cx="${width * 0.3}" cy="${height * 0.5}" r="${Math.min(width, height) * 0.1}" 
            fill="${colors.accent}" opacity="${styles.opacity * 0.3}"/>
    <circle cx="${width * 0.7}" cy="${height * 0.5}" r="${Math.min(width, height) * 0.08}" 
            fill="${colors.secondary}" opacity="${styles.opacity * 0.2}"/>
    <text x="50%" y="${height * 0.85}" dominant-baseline="middle" text-anchor="middle" 
          fill="${colors.textMuted}" font-size="${Math.min(width / 12, 10)}" 
          font-family="system-ui, sans-serif" opacity="${styles.opacity}">${text}</text>
  </svg>`;
}

/**
 * Generate banner placeholder
 */
function generateBannerPlaceholder(
  width: number,
  height: number,
  theme: ThemeConfig,
  text: string
): string {
  const { colors, styles } = theme;
  const shadowFilter = styles.shadow ? `filter: drop-shadow(0 2px 4px rgba(0,0,0,0.1));` : "";
  const gradientId = `bannerGrad-${width}-${height}`;

  return `<svg width="${width}" height="${height}" viewBox="0 0 ${width} ${height}" xmlns="http://www.w3.org/2000/svg" style="${shadowFilter}">
    <defs>
      <linearGradient id="${gradientId}" x1="0%" y1="0%" x2="100%" y2="100%">
        <stop offset="0%" style="stop-color:${colors.primary};stop-opacity:${styles.opacity * 0.15}" />
        <stop offset="100%" style="stop-color:${colors.secondary};stop-opacity:${styles.opacity * 0.05}" />
      </linearGradient>
    </defs>
    <rect width="${width}" height="${height}" fill="url(#${gradientId})" 
          rx="${styles.borderRadius}"/>
    <text x="50%" y="50%" dominant-baseline="middle" text-anchor="middle" 
          fill="${colors.text}" font-size="${Math.min(width / 10, 16)}" 
          font-family="system-ui, sans-serif" font-weight="500" opacity="${styles.opacity}">${text}</text>
  </svg>`;
}

/**
 * Generate icon placeholder
 */
function generateIconPlaceholder(
  width: number,
  height: number,
  theme: ThemeConfig,
  text: string
): string {
  const { colors, styles } = theme;
  const size = Math.min(width, height);

  return `<svg width="${width}" height="${height}" viewBox="0 0 ${width} ${height}" xmlns="http://www.w3.org/2000/svg">
    <circle cx="${width / 2}" cy="${height / 2}" r="${size * 0.3}" 
            fill="${colors.primary}" opacity="${styles.opacity * 0.2}"/>
    <text x="50%" y="50%" dominant-baseline="middle" text-anchor="middle" 
          fill="${colors.primary}" font-size="${size * 0.5}" 
          font-family="system-ui, sans-serif" opacity="${styles.opacity}" font-weight="600">${text.charAt(0).toUpperCase()}</text>
  </svg>`;
}

/**
 * Generate default placeholder
 */
function generateDefaultPlaceholder(
  width: number,
  height: number,
  theme: ThemeConfig,
  text: string
): string {
  const { colors, styles } = theme;
  const shadowFilter = styles.shadow ? `filter: drop-shadow(0 2px 4px rgba(0,0,0,0.1));` : "";
  const dashArray = styles.borderStyle === "dashed" ? "4 4" : styles.borderStyle === "dotted" ? "2 2" : "0";

  return `<svg width="${width}" height="${height}" viewBox="0 0 ${width} ${height}" xmlns="http://www.w3.org/2000/svg" style="${shadowFilter}">
    <rect width="${width}" height="${height}" fill="${colors.background}" 
          stroke="${colors.border}" stroke-width="1" stroke-dasharray="${dashArray}" 
          rx="${styles.borderRadius}"/>
    <rect x="${width * 0.1}" y="${height * 0.2}" width="${width * 0.8}" height="${height * 0.5}" 
          fill="${colors.primary}" opacity="${styles.opacity * 0.1}" rx="${styles.borderRadius / 2}"/>
    <text x="50%" y="${height * 0.85}" dominant-baseline="middle" text-anchor="middle" 
          fill="${colors.textMuted}" font-size="${Math.min(width / 12, 10)}" 
          font-family="system-ui, sans-serif" opacity="${styles.opacity}">${text}</text>
  </svg>`;
}
