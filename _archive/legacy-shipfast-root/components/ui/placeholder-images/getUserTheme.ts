/**
 * Get user's selected placeholder theme from settings
 */

import { PlaceholderTheme } from "./themes";

/**
 * Get user's placeholder theme preference
 * This should be called server-side or with proper user context
 */
export async function getUserPlaceholderTheme(): Promise<PlaceholderTheme> {
  try {
    // Import dynamically to avoid circular dependencies
    const { initMonkey } = await import("@/libs/monkey");
    
    // Initialize monkey
    const monkey = await initMonkey(true);

    // Get user profile with settings
    const profile = await monkey.read('profiles', { id: monkey.user?.id });
    
    if (profile && profile[0]?.json?.PlaceholderTheme) {
      const theme = profile[0].json.PlaceholderTheme.theme;
      if (theme && ['professional', 'casual', 'minimalist', 'colorful', 'corporate', 'creative'].includes(theme)) {
        return theme as PlaceholderTheme;
      }
    }
  } catch (error) {
  }
  
  // Default fallback
  return 'professional';
}

/**
 * Get theme config for user's selected theme
 */
import { getTheme } from "./themes";

export async function getUserThemeConfig() {
  const theme = await getUserPlaceholderTheme();
  return getTheme(theme);
}
