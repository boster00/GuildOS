// ARCHIVED: Original path was libs/monkey/actions/calculateRelevance.ts

/**
 * Calculate semantic relevance of queries against full text using vector embeddings
 * Uses monkey.generateEmbeddings() for centralized API calls and usage metering
 * Manual trigger only - requires API key
 * 
 * NOTE: This file is currently NOT used in production. It's kept for potential future use.
 * If you plan to remove it, search for any imports first.
 */

import { log } from "../ui/logger";

// Monkey instance type (from libs/monkey.js)
type Monkey = any;

// NOTE: This function now requires a monkey instance to be passed in
// This allows it to use centralized embeddings generation with usage metering

export interface CalculateRelevanceInput {
  fullText: string;
  queries: string[];
  chunking?: "byParagraph" | "byHeading" | "fixedTokens";
  chunkSizeWords?: number;
  overlapWords?: number;
  topK?: number;
  batchMode?: boolean; // If true, evaluate all queries in batch
}

export interface RelevanceResult {
  query: string;
  score: number;
  band: "High" | "Mid" | "Low";
  metrics: {
    maxSimilarity: number;
    meanTopKSimilarity: number;
    chunksCount: number;
    topK: number;
  };
  topMatches: Array<{
    rank: number;
    similarity: number;
    chunk: string;
    snippet: string;
  }>;
  diagnostics: {
    keywords: string[];
    foundTerms: string[];
    missingTerms: string[];
    phraseHit: boolean;
    suggestion: string | null;
  };
}

export interface CalculateRelevanceOutput {
  results: RelevanceResult[];
  timing: {
    total: number;
    chunking: number;
    embedding: number;
    similarity: number;
    averagePerPrompt: number;
  };
  batchMode: boolean;
}

// Generate embeddings using monkey's centralized method
async function generateEmbeddings(monkey: any, texts: string | string[]): Promise<number[] | number[][]> {
  try {
    return await monkey.generateEmbeddings(texts, { model: "text-embedding-3-small" });
  } catch (error: any) {
    console.error("[calculateRelevance] Embedding error:", error);
    throw new Error(`Failed to generate embedding: ${error.message}`);
  }
}

// Normalize whitespace
function normalizeText(text: string): string {
  return text
    .replace(/\s+/g, " ")
    .replace(/\n\s*\n/g, "\n\n")
    .trim();
}

// Chunk by paragraph (split on blank lines)
function chunkByParagraph(text: string): string[] | null {
  const normalized = normalizeText(text);
  const chunks = normalized
    .split(/\n\s*\n/)
    .map(chunk => chunk.trim())
    .filter(chunk => chunk.length > 0);
  
  return chunks.length >= 3 ? chunks : null;
}

// Chunk by fixed token size (word-based approximation)
function chunkByFixedTokens(text: string, chunkSizeWords: number = 250, overlapWords: number = 50): string[] {
  const normalized = normalizeText(text);
  const words = normalized.split(/\s+/);
  const chunks: string[] = [];
  
  let i = 0;
  while (i < words.length) {
    const chunkWords = words.slice(i, i + chunkSizeWords);
    chunks.push(chunkWords.join(" "));
    
    if (i + chunkSizeWords >= words.length) {
      break;
    }
    
    i += chunkSizeWords - overlapWords;
  }
  
  return chunks;
}

// Chunk by heading (split on markdown headings)
function chunkByHeading(text: string): string[] | null {
  const normalized = normalizeText(text);
  const lines = normalized.split("\n");
  const chunks: string[] = [];
  let currentChunk: string[] = [];
  
  for (const line of lines) {
    // Check if line is a heading (markdown style)
    if (/^#{1,6}\s/.test(line.trim())) {
      if (currentChunk.length > 0) {
        chunks.push(currentChunk.join("\n").trim());
        currentChunk = [];
      }
    }
    currentChunk.push(line);
  }
  
  if (currentChunk.length > 0) {
    chunks.push(currentChunk.join("\n").trim());
  }
  
  return chunks.length >= 1 ? chunks : null;
}

// Extract keywords from prompt (simple heuristic)
function extractKeywords(prompt: string): string[] {
  const stopwords = new Set([
    "the", "a", "an", "and", "or", "but", "in", "on", "at", "to", "for",
    "of", "with", "by", "from", "as", "is", "was", "are", "were", "be",
    "been", "being", "have", "has", "had", "do", "does", "did", "will",
    "would", "should", "could", "may", "might", "must", "can", "this",
    "that", "these", "those", "i", "you", "he", "she", "it", "we", "they",
    "what", "which", "who", "when", "where", "why", "how", "if", "then",
    "else", "than", "so", "not", "no", "yes", "my", "your", "his", "her",
    "its", "our", "their", "me", "him", "us", "them"
  ]);
  
  const words = prompt
    .toLowerCase()
    .replace(/[^\w\s]/g, " ")
    .split(/\s+/)
    .filter(word => word.length >= 3 && !stopwords.has(word));
  
  // Count frequency
  const freq: Record<string, number> = {};
  for (const word of words) {
    freq[word] = (freq[word] || 0) + 1;
  }
  
  // Sort by frequency and take top 8-12
  const sorted = Object.entries(freq)
    .sort((a, b) => b[1] - a[1])
    .slice(0, 12)
    .map(([word]) => word);
  
  return sorted;
}

// Check if 2-word phrases from prompt appear in text
function checkPhraseHit(prompt: string, text: string): boolean {
  const promptLower = prompt.toLowerCase();
  const textLower = text.toLowerCase();
  
  const words = promptLower.split(/\s+/).filter(w => w.length >= 2);
  
  for (let i = 0; i < words.length - 1; i++) {
    const phrase = `${words[i]} ${words[i + 1]}`;
    if (textLower.includes(phrase)) {
      return true;
    }
  }
  
  return false;
}

// Compute cosine similarity
function cosineSimilarity(vecA: number[], vecB: number[]): number {
  if (vecA.length !== vecB.length) {
    throw new Error("Vectors must have same length");
  }
  
  let dotProduct = 0;
  let normA = 0;
  let normB = 0;
  
  for (let i = 0; i < vecA.length; i++) {
    dotProduct += vecA[i] * vecB[i];
    normA += vecA[i] * vecA[i];
    normB += vecB[i] * vecB[i];
  }
  
  if (normA === 0 || normB === 0) {
    return 0;
  }
  
  return dotProduct / (Math.sqrt(normA) * Math.sqrt(normB));
}

// Evaluate a single query against text chunks
function evaluateQuery(
  query: string,
  queryVec: number[],
  chunkVectors: number[][],
  chunks: string[],
  topK: number
): RelevanceResult {
  const similarityStart = Date.now();
  
  const similarities = chunkVectors.map((chunkVec, index) => ({
    index,
    chunk: chunks[index],
    similarity: cosineSimilarity(queryVec, chunkVec),
  }));
  
  // Sort by similarity (descending)
  similarities.sort((a, b) => b.similarity - a.similarity);
  
  // Get topK matches
  const topMatches = similarities.slice(0, topK);
  
  // Calculate metrics
  const maxSim = similarities[0]?.similarity || 0;
  const meanTopK = topMatches.reduce((sum, m) => sum + m.similarity, 0) / topMatches.length;
  
  // Score calculation: 0.65 * maxSim + 0.35 * meanTopK, scaled to 0-100
  const rawScore = 0.65 * maxSim + 0.35 * meanTopK;
  const score = Math.round(Math.max(0, Math.min(100, rawScore * 100)));
  
  // Banding
  let band: "High" | "Mid" | "Low";
  if (score >= 75) {
    band = "High";
  } else if (score >= 55) {
    band = "Mid";
  } else {
    band = "Low";
  }
  
  const keywords = extractKeywords(query);
  const topKText = topMatches.map(m => m.chunk).join(" ");
  
  const foundTerms = keywords.filter(keyword =>
    topKText.toLowerCase().includes(keyword.toLowerCase())
  );
  
  const missingTerms = keywords.filter(keyword =>
    !topKText.toLowerCase().includes(keyword.toLowerCase())
  );
  
  return {
    query,
    score,
    band,
    metrics: {
      maxSimilarity: maxSim,
      meanTopKSimilarity: meanTopK,
      chunksCount: chunks.length,
      topK,
    },
    topMatches: topMatches.map((m, idx) => ({
      rank: idx + 1,
      similarity: parseFloat(m.similarity.toFixed(4)),
      chunk: m.chunk,
      snippet: m.chunk.substring(0, 240) + (m.chunk.length > 240 ? "..." : ""),
    })),
    diagnostics: {
      keywords,
      foundTerms,
      missingTerms,
      phraseHit: checkPhraseHit(query, chunks.join(" ")),
      suggestion: missingTerms.length > 0
        ? `Consider adding a section that explicitly addresses: ${missingTerms.join(", ")}`
        : null,
    },
  };
}

/**
 * Calculate semantic relevance of multiple queries against full text
 * Uses OpenAI embeddings API - requires OPENAI_API_KEY environment variable
 * Manual trigger only due to API costs
 */
export async function calculateRelevance(
  monkey: any,
  input: CalculateRelevanceInput
): Promise<CalculateRelevanceOutput> {
  const startTime = Date.now();
  
  const {
    fullText,
    queries,
    chunking = "byParagraph",
    chunkSizeWords = 250,
    overlapWords = 50,
    topK = 5,
    batchMode = true, // Default to batch mode for efficiency
  } = input;
  
  log(`[calculateRelevance] Evaluating ${queries.length} queries against text (${fullText.length} chars)`);
  
  if (!fullText || queries.length === 0) {
    throw new Error("fullText and at least one query are required");
  }
  
  // API key check is now handled by monkey.generateEmbeddings()
  // Removed direct OPENAI_API_KEY check
  
  // Timing objects
  const timing = {
    chunking: 0,
    embedding: 0,
    similarity: 0,
    total: 0,
    averagePerPrompt: 0,
  };
  
  // ============================================
  // 1. CHUNKING
  // ============================================
  const chunkingStart = Date.now();
  let chunks: string[] = [];
  
  if (chunking === "byParagraph") {
    chunks = chunkByParagraph(fullText) || chunkByFixedTokens(fullText, chunkSizeWords, overlapWords);
  } else if (chunking === "byHeading") {
    chunks = chunkByHeading(fullText) || chunkByFixedTokens(fullText, chunkSizeWords, overlapWords);
  } else if (chunking === "fixedTokens") {
    chunks = chunkByFixedTokens(fullText, chunkSizeWords, overlapWords);
  } else {
    throw new Error(`Unknown chunking method: ${chunking}`);
  }
  
  if (chunks.length === 0) {
    throw new Error("Failed to chunk text");
  }
  
  timing.chunking = Date.now() - chunkingStart;
  log(`[calculateRelevance] Chunked text into ${chunks.length} chunks (${timing.chunking}ms)`);
  
  // ============================================
  // 2. GENERATE EMBEDDINGS USING OPENAI API
  // ============================================
  const embeddingStart = Date.now();
  
  let queryVectors: number[][] = [];
  let chunkVectors: number[][] = [];
  
  if (batchMode && queries.length > 1) {
    // BATCH MODE: Generate all embeddings in a single API call
    log(`[calculateRelevance] Using batch mode: generating embeddings for ${queries.length} queries + ${chunks.length} chunks`);
    const allTexts = [...queries, ...chunks];
    const allEmbeddings = await generateEmbeddings(monkey, allTexts) as number[][];
    
    // Extract query and chunk embeddings
    queryVectors = allEmbeddings.slice(0, queries.length);
    chunkVectors = allEmbeddings.slice(queries.length);
  } else {
    // SEQUENTIAL MODE: Generate embeddings one by one
    log(`[calculateRelevance] Using sequential mode: generating embeddings separately`);
    // First, generate chunk embeddings once (shared across all queries)
    chunkVectors = await generateEmbeddings(monkey, chunks) as number[][];
    
    // Then generate query embeddings one by one
    for (const queryText of queries) {
      const queryVec = await generateEmbeddings(monkey, queryText) as number[];
      queryVectors.push(queryVec);
    }
  }
  
  timing.embedding = Date.now() - embeddingStart;
  log(`[calculateRelevance] Generated embeddings (${timing.embedding}ms)`);
  
  // ============================================
  // 3. COMPUTE SIMILARITY FOR EACH QUERY
  // ============================================
  const similarityStart = Date.now();
  
  const results = queries.map((queryText, index) => {
    return evaluateQuery(queryText, queryVectors[index], chunkVectors, chunks, topK);
  });
  
  timing.similarity = Date.now() - similarityStart;
  timing.total = Date.now() - startTime;
  timing.averagePerPrompt = timing.total / queries.length;
  
  log(`[calculateRelevance] ✅ Completed: ${results.length} queries evaluated in ${timing.total}ms`);
  
  return {
    results,
    timing,
    batchMode: batchMode && queries.length > 1,
  };
}
