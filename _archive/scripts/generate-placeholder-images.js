// ARCHIVED: Original path was scripts/generate-placeholder-images.js

/**
 * Script to generate all placeholder SVG images
 * Run with: node scripts/generate-placeholder-images.js
 */

const fs = require('fs');
const path = require('path');

// Import the theme and generator utilities
// Note: This requires TypeScript compilation or we need to use require
// For now, we'll inline the necessary functions or use a JS version

const themes = {
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

const placeholderTypes = ['logo', 'avatar', 'product', 'banner', 'icon', 'default'];

function generateLogoPlaceholder(width, height, theme, text, index) {
  const { colors, styles } = theme;
  const logoStyle = index % 3;
  const shadowFilter = styles.shadow ? `filter: drop-shadow(0 2px 4px rgba(0,0,0,0.1));` : "";
  const dashArray = styles.borderStyle === "dashed" ? "4 4" : styles.borderStyle === "dotted" ? "2 2" : "0";

  if (logoStyle === 0) {
    return `<svg width="${width}" height="${height}" viewBox="0 0 ${width} ${height}" xmlns="http://www.w3.org/2000/svg" style="${shadowFilter}">
      <rect width="${width}" height="${height}" fill="${colors.background}" 
            stroke="${colors.border}" stroke-width="1" stroke-dasharray="${dashArray}" 
            rx="${styles.borderRadius}"/>
      <text x="50%" y="50%" dominant-baseline="middle" text-anchor="middle" 
            fill="${colors.text}" font-size="${Math.min(width / 8, 14)}" 
            font-family="system-ui, -apple-system, sans-serif" font-weight="600" opacity="${styles.opacity}">${text}</text>
    </svg>`;
  } else if (logoStyle === 1) {
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

function generateAvatarPlaceholder(width, height, theme, text) {
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

function generateProductPlaceholder(width, height, theme, text) {
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

function generateBannerPlaceholder(width, height, theme, text) {
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

function generateIconPlaceholder(width, height, theme, text) {
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

function generateDefaultPlaceholder(width, height, theme, text) {
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

function generatePlaceholderSVG(type, theme, options = {}) {
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

// Main execution
function main() {
  const outputDir = path.join(process.cwd(), 'public', 'images', 'placeholders');
  
  // Ensure base directory exists
  if (!fs.existsSync(path.join(process.cwd(), 'public', 'images'))) {
    fs.mkdirSync(path.join(process.cwd(), 'public', 'images'), { recursive: true });
  }
  
  if (!fs.existsSync(outputDir)) {
    fs.mkdirSync(outputDir, { recursive: true });
  }

  let totalGenerated = 0;

  // Generate files for each theme and type
  Object.entries(themes).forEach(([themeName, theme]) => {
    const themeDir = path.join(outputDir, themeName);
    
    // Create theme directory
    if (!fs.existsSync(themeDir)) {
      fs.mkdirSync(themeDir, { recursive: true });
    }

    placeholderTypes.forEach(type => {
      // Use appropriate dimensions based on type
      let width, height;
      if (type === 'avatar') {
        width = height = 100; // Square for avatars
      } else if (type === 'banner') {
        width = 400;
        height = 120;
      } else if (type === 'icon') {
        width = height = 64;
      } else {
        width = 150;
        height = 60; // Default logo dimensions
      }

      const svg = generatePlaceholderSVG(type, theme, {
        width,
        height,
        text: type.charAt(0).toUpperCase() + type.slice(1),
        index: 0
      });

      const filePath = path.join(themeDir, `${type}.svg`);
      fs.writeFileSync(filePath, svg, 'utf8');
      totalGenerated++;
      console.log(`✓ Generated: ${themeName}/${type}.svg`);
    });
  });

  console.log(`\n✅ Successfully generated ${totalGenerated} placeholder SVG files!`);
  console.log(`   Location: ${outputDir}`);
}

// Run the script
main();
