/**
 * Estimates token count for a given text.
 * Uses a simple approximation: ~4 characters per token for English text.
 * For more accurate counting, use tiktoken or similar library.
 */
export function estimateTokens(text) {
  if (!text) return 0;
  // Rough estimate: 1 token ≈ 4 characters for English
  // This is a simple heuristic; real tokenization varies by model
  return Math.ceil(text.length / 4);
}

/**
 * Estimates tokens for an array of texts
 */
export function estimateTokensForArray(texts) {
  return texts.map(text => estimateTokens(text));
}

/**
 * Splits text to fit within token limit
 */
export function splitToTokenLimit(text, maxTokens) {
  const chunks = [];
  const estimatedChars = maxTokens * 4;

  let remaining = text;
  while (remaining.length > 0) {
    if (remaining.length <= estimatedChars) {
      chunks.push(remaining);
      break;
    }

    // Find a good breaking point (end of sentence or paragraph)
    let breakPoint = estimatedChars;
    const searchStart = Math.max(0, estimatedChars - 200);
    const searchArea = remaining.substring(searchStart, estimatedChars);

    // Try to break at paragraph
    const paraBreak = searchArea.lastIndexOf('\n\n');
    if (paraBreak !== -1) {
      breakPoint = searchStart + paraBreak + 2;
    } else {
      // Try to break at sentence
      const sentenceBreak = searchArea.lastIndexOf('. ');
      if (sentenceBreak !== -1) {
        breakPoint = searchStart + sentenceBreak + 2;
      }
    }

    chunks.push(remaining.substring(0, breakPoint).trim());
    remaining = remaining.substring(breakPoint).trim();
  }

  return chunks;
}
