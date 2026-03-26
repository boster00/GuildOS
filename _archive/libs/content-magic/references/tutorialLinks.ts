// ARCHIVED: Original path was libs/content-magic/references/tutorialLinks.ts

/**
 * @deprecated Use tutorialRegistry.js as the single source of truth.
 * Tutorial links are now defined on rule meta (tutorialTitle, tutorialURL) and
 * aggregated in tutorialRegistry (getTutorialVideos, getTutorialLink, hasTutorial).
 * This file re-exports from the registry for backward compatibility.
 */

import {
  getTutorialLink as getTutorialLinkFromRegistry,
  hasTutorial as hasTutorialFromRegistry,
} from "./tutorialRegistry";

/** @deprecated Use getTutorialLink from tutorialRegistry */
export function getTutorialLink(stepKey: string): string | null {
  return getTutorialLinkFromRegistry(stepKey);
}

/** @deprecated Use hasTutorial from tutorialRegistry */
export function hasTutorial(stepKey: string): boolean {
  return hasTutorialFromRegistry(stepKey);
}

/** @deprecated Tutorial URLs now live on rule meta; see tutorialRegistry.getTutorialVideos() */
export const TUTORIAL_LINKS: Record<string, string> = {};
