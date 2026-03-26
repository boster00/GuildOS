// ARCHIVED: Original path was libs/content-magic/keywords/structure-analyzer.js

/**
 * Analyzes document structure for keyword placement spacing detection
 */
export class StructureAnalyzer {
  constructor(editorElement) {
    this.editorElement = editorElement;
    this.blocks = this.extractBlocks(editorElement);
    this.sections = this.groupBySection(this.blocks);
  }

  /**
   * Extract all blocks (paragraphs, headings, list items) with metadata
   */
  extractBlocks(element) {
    if (!element) return [];
    
    const blocks = [];
    const elements = element.querySelectorAll('p, h1, h2, h3, h4, h5, h6, li');
    
    let blockIndex = 0;
    let currentSection = "Introduction";
    
    elements.forEach((el, idx) => {
      const tagName = el.tagName.toLowerCase();
      const text = (el.textContent || '').trim();
      const blockId = el.getAttribute('data-block-id') || `block-${idx}`;
      
      // Ensure block has ID
      el.setAttribute('data-block-id', blockId);
      
      if (tagName.match(/^h[1-6]$/)) {
        // Heading - update current section
        currentSection = text;
      } else {
        // Regular block
        blocks.push({
          id: blockId,
          type: tagName,
          text: text,
          sectionTitle: currentSection,
          index: blockIndex,
          element: el,
        });
        blockIndex++;
      }
    });
    
    return blocks;
  }

  /**
   * Group blocks by section
   */
  groupBySection(blocks) {
    const sections = {};
    
    blocks.forEach(block => {
      const sectionTitle = block.sectionTitle || "Introduction";
      if (!sections[sectionTitle]) {
        sections[sectionTitle] = {
          title: sectionTitle,
          blocks: [],
        };
      }
      sections[sectionTitle].blocks.push(block);
    });
    
    return Object.values(sections);
  }

  /**
   * Get section for a block ID
   */
  getSectionForBlock(blockId) {
    const block = this.blocks.find(b => b.id === blockId);
    return block ? block.sectionTitle : null;
  }

  /**
   * Get distance between two blocks
   */
  getBlockDistance(blockId1, blockId2) {
    const block1 = this.blocks.find(b => b.id === blockId1);
    const block2 = this.blocks.find(b => b.id === blockId2);
    
    if (!block1 || !block2) {
      return { sameSection: false, paragraphsBetween: null };
    }
    
    const sameSection = block1.sectionTitle === block2.sectionTitle;
    const paragraphsBetween = Math.abs(block1.index - block2.index) - 1;
    
    return {
      sameSection,
      paragraphsBetween,
      blocksBetween: paragraphsBetween,
    };
  }

  /**
   * Check if two blocks are adjacent paragraphs
   */
  isAdjacentParagraphs(blockId1, blockId2) {
    const distance = this.getBlockDistance(blockId1, blockId2);
    return distance.sameSection && distance.paragraphsBetween === 0;
  }

  /**
   * Check if two positions are in the same sentence
   */
  isSameSentence(blockId1, offset1, blockId2, offset2) {
    if (blockId1 !== blockId2) return false;
    
    const block = this.blocks.find(b => b.id === blockId1);
    if (!block) return false;
    
    const text = block.text;
    
    // Find sentences using simple period detection
    const sentences = text.split(/[.!?]+/).map(s => s.trim()).filter(s => s.length > 0);
    
    let charCount = 0;
    for (const sentence of sentences) {
      const sentenceStart = charCount;
      const sentenceEnd = charCount + sentence.length;
      
      const pos1InSentence = offset1 >= sentenceStart && offset1 <= sentenceEnd;
      const pos2InSentence = offset2 >= sentenceStart && offset2 <= sentenceEnd;
      
      if (pos1InSentence && pos2InSentence) {
        return true;
      }
      
      charCount = sentenceEnd + 1; // +1 for the period/delimiter
    }
    
    return false;
  }

  /**
   * Get block element by ID
   */
  getBlockElement(blockId) {
    const block = this.blocks.find(b => b.id === blockId);
    return block ? block.element : null;
  }

  /**
   * Calculate distribution of placements across document
   */
  calculateDistribution(placements) {
    if (!placements || placements.length === 0) {
      return { top: 0, mid: 0, bottom: 0 };
    }
    
    const totalBlocks = this.blocks.length;
    if (totalBlocks === 0) {
      return { top: 0, mid: 0, bottom: 0 };
    }
    
    const distribution = { top: 0, mid: 0, bottom: 0 };
    
    placements.forEach(placement => {
      const block = this.blocks.find(b => b.id === placement.anchor?.blockId);
      if (block) {
        const position = block.index / totalBlocks;
        if (position < 0.33) {
          distribution.top++;
        } else if (position < 0.67) {
          distribution.mid++;
        } else {
          distribution.bottom++;
        }
      }
    });
    
    return distribution;
  }
}
