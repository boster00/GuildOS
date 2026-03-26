/**
 * Segment competitor content into blocks by headings
 */

import { FetchedPage } from "./competitorFetch";

export interface ContentBlock {
  blockId: string;
  heading: string;
  snippet: string;
  level: number; // heading level (1, 2, 3)
}

/**
 * Segment page content into blocks based on headings
 */
export function segmentCompetitorContent(page: FetchedPage): ContentBlock[] {
  const blocks: ContentBlock[] = [];
  const text = page.extractedText;
  const headings = page.headings;

  if (headings.length === 0) {
    // No headings - create a single block
    return [{
      blockId: "block-1",
      heading: page.h1 || page.title || "Content",
      snippet: text.substring(0, 500),
      level: 1,
    }];
  }

  // Split text by headings (approximate)
  let currentPos = 0;
  headings.forEach((heading, index) => {
    const headingPos = text.toLowerCase().indexOf(heading.toLowerCase(), currentPos);
    
    if (headingPos >= 0) {
      // Find next heading or end of text
      let nextPos = text.length;
      for (let i = index + 1; i < headings.length; i++) {
        const nextHeadingPos = text.toLowerCase().indexOf(headings[i].toLowerCase(), headingPos);
        if (nextHeadingPos > headingPos) {
          nextPos = nextHeadingPos;
          break;
        }
      }

      const snippet = text.substring(headingPos, Math.min(headingPos + 500, nextPos)).trim();
      
      if (snippet.length > 50) {
        blocks.push({
          blockId: `block-${index + 1}`,
          heading: heading,
          snippet: snippet,
          level: heading.startsWith("H1") || heading === page.h1 ? 1 : heading.startsWith("H2") ? 2 : 3,
        });
      }

      currentPos = headingPos + heading.length;
    }
  });

  // If no blocks created, create one from first heading
  if (blocks.length === 0 && headings.length > 0) {
    blocks.push({
      blockId: "block-1",
      heading: headings[0],
      snippet: text.substring(0, 500),
      level: 1,
    });
  }

  return blocks;
}
