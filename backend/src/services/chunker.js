import { estimateTokens } from '../utils/tokenEstimator.js';
import { generateContentHash } from './documentParser.js';
import { getStyleMapping } from '../utils/styleMapping.js';

/**
 * Default chunking configuration
 */
const defaultConfig = {
  maxChunkTokens: 500,
  minChunkTokens: 100,
  overlapParagraphs: 1,
  preserveTableIntegrity: true,
  includeHeadingInChunk: true,
};

/**
 * Main function to chunk a document based on style hierarchy
 */
export async function chunkDocument(parsedDoc, styleMapping = {}, config = {}) {
  const settings = { ...defaultConfig, ...config };
  const { paragraphs } = parsedDoc;

  if (!paragraphs || paragraphs.length === 0) {
    return [];
  }

  // Build hierarchy from paragraphs
  const hierarchy = await buildHierarchy(paragraphs, styleMapping);

  // Create chunks respecting hierarchy and size limits
  const chunks = createChunks(hierarchy, settings);

  return chunks;
}

/**
 * Build a hierarchical structure from paragraphs based on styles
 */
export async function buildHierarchy(paragraphs, styleMapping = {}) {
  const root = { children: [], level: 0, text: '', paragraphs: [] };
  const stack = [root];

  for (const para of paragraphs) {
    const mapping = styleMapping[para.style] || await getStyleMapping(para.style);
    const headingLevel = mapping.headingLevel;
    const isBodyText = mapping.isBodyText;
    const isIgnored = mapping.isIgnored;

    // Skip paragraphs with ignored styles (e.g., TOC entries)
    if (isIgnored) {
      continue;
    }

    if (headingLevel) {
      // This is a heading - create a new section
      const section = {
        level: headingLevel,
        text: para.text,
        style: para.style,
        paragraphIndex: para.index,
        children: [],
        paragraphs: [],
      };

      // Pop stack until we find a parent with lower level
      while (stack.length > 1 && stack[stack.length - 1].level >= headingLevel) {
        stack.pop();
      }

      // Add to parent
      stack[stack.length - 1].children.push(section);
      stack.push(section);
    } else if (isBodyText !== false) {
      // This is body text - add to current section
      const currentSection = stack[stack.length - 1];
      currentSection.paragraphs.push({
        index: para.index,
        text: para.text,
        style: para.style,
      });
    }
  }

  return root;
}

/**
 * Create chunks from hierarchical structure
 */
function createChunks(hierarchy, settings) {
  const chunks = [];
  let chunkIndex = 0;

  function processNode(node, hierarchyPath = []) {
    const currentPath = node.text ? [...hierarchyPath, node.text] : hierarchyPath;

    // Collect all body text under this node
    let bodyText = node.paragraphs.map(p => p.text).join('\n\n');
    const paragraphRange = {
      start: node.paragraphs[0]?.index ?? -1,
      end: node.paragraphs[node.paragraphs.length - 1]?.index ?? -1,
    };

    if (bodyText.trim()) {
      // Check if we need to split this content
      const tokens = estimateTokens(bodyText);

      if (tokens > settings.maxChunkTokens) {
        // Split into smaller chunks
        const subChunks = splitContent(bodyText, settings, currentPath, node.paragraphs);
        subChunks.forEach(subChunk => {
          chunks.push({
            ...subChunk,
            chunkIndex: chunkIndex++,
          });
        });
      } else if (tokens >= settings.minChunkTokens) {
        // Create a single chunk
        chunks.push({
          chunkIndex: chunkIndex++,
          content: bodyText.trim(),
          hierarchyPath: currentPath.join(' > '),
          hierarchyJson: currentPath,
          hierarchyLevel: currentPath.length,
          paragraphStart: paragraphRange.start,
          paragraphEnd: paragraphRange.end,
          tokenEstimate: tokens,
          contentLength: bodyText.length,
          chunkHash: generateContentHash(bodyText),
        });
      }
    }

    // Process child sections
    node.children.forEach(child => processNode(child, currentPath));
  }

  processNode(hierarchy);

  // Handle small remaining content by merging with previous chunk if possible
  return mergeSmallChunks(chunks, settings);
}

/**
 * Split large content into smaller chunks
 */
function splitContent(text, settings, hierarchyPath, paragraphs) {
  const chunks = [];
  const paragraphTexts = text.split('\n\n').filter(p => p.trim());
  let currentChunkParagraphs = [];
  let currentTokens = 0;

  for (let i = 0; i < paragraphTexts.length; i++) {
    const paraText = paragraphTexts[i];
    const paraTokens = estimateTokens(paraText);

    if (currentTokens + paraTokens > settings.maxChunkTokens && currentChunkParagraphs.length > 0) {
      // Save current chunk
      const chunkText = currentChunkParagraphs.join('\n\n');
      chunks.push({
        content: chunkText.trim(),
        hierarchyPath: hierarchyPath.join(' > '),
        hierarchyJson: hierarchyPath,
        hierarchyLevel: hierarchyPath.length,
        paragraphStart: paragraphs[0]?.index ?? -1,
        paragraphEnd: paragraphs[Math.min(i - 1, paragraphs.length - 1)]?.index ?? -1,
        tokenEstimate: currentTokens,
        contentLength: chunkText.length,
        chunkHash: generateContentHash(chunkText),
      });

      // Start new chunk with overlap
      const overlapStart = Math.max(0, currentChunkParagraphs.length - settings.overlapParagraphs);
      currentChunkParagraphs = currentChunkParagraphs.slice(overlapStart);
      currentTokens = estimateTokens(currentChunkParagraphs.join('\n\n'));
    }

    currentChunkParagraphs.push(paraText);
    currentTokens += paraTokens;
  }

  // Don't forget the last chunk
  if (currentChunkParagraphs.length > 0) {
    const chunkText = currentChunkParagraphs.join('\n\n');
    chunks.push({
      content: chunkText.trim(),
      hierarchyPath: hierarchyPath.join(' > '),
      hierarchyJson: hierarchyPath,
      hierarchyLevel: hierarchyPath.length,
      paragraphStart: paragraphs[0]?.index ?? -1,
      paragraphEnd: paragraphs[paragraphs.length - 1]?.index ?? -1,
      tokenEstimate: estimateTokens(chunkText),
      contentLength: chunkText.length,
      chunkHash: generateContentHash(chunkText),
    });
  }

  return chunks;
}

/**
 * Merge chunks that are too small
 */
function mergeSmallChunks(chunks, settings) {
  if (chunks.length < 2) return chunks;

  const merged = [];
  let pending = null;

  for (const chunk of chunks) {
    if (pending) {
      // Check if we should merge
      const combinedTokens = pending.tokenEstimate + chunk.tokenEstimate;
      const sameHierarchy = pending.hierarchyPath === chunk.hierarchyPath;

      if (sameHierarchy && combinedTokens <= settings.maxChunkTokens) {
        // Merge chunks
        pending = {
          ...pending,
          content: pending.content + '\n\n' + chunk.content,
          tokenEstimate: combinedTokens,
          contentLength: pending.contentLength + chunk.contentLength + 2,
          paragraphEnd: chunk.paragraphEnd,
          chunkHash: generateContentHash(pending.content + '\n\n' + chunk.content),
        };
      } else {
        merged.push(pending);
        pending = chunk;
      }
    } else {
      pending = chunk;
    }
  }

  if (pending) {
    merged.push(pending);
  }

  // Re-index chunks
  return merged.map((chunk, idx) => ({ ...chunk, chunkIndex: idx }));
}

/**
 * Get statistics about chunking results
 */
export function getChunkingStats(chunks) {
  if (!chunks || chunks.length === 0) {
    return {
      totalChunks: 0,
      avgTokens: 0,
      minTokens: 0,
      maxTokens: 0,
      avgLength: 0,
      hierarchyLevels: {},
    };
  }

  const tokens = chunks.map(c => c.tokenEstimate);
  const hierarchyLevels = {};

  chunks.forEach(chunk => {
    const level = chunk.hierarchyLevel;
    hierarchyLevels[level] = (hierarchyLevels[level] || 0) + 1;
  });

  return {
    totalChunks: chunks.length,
    avgTokens: Math.round(tokens.reduce((a, b) => a + b, 0) / tokens.length),
    minTokens: Math.min(...tokens),
    maxTokens: Math.max(...tokens),
    avgLength: Math.round(chunks.reduce((a, c) => a + c.contentLength, 0) / chunks.length),
    hierarchyLevels,
  };
}
