/**
 * Document Parser - Uses DocxExtractor for parsing .docx files
 * Provides paragraph extraction with style and numbering information
 */

import { createHash } from 'crypto';
import { DocxExtractor } from './DocxExtractor.js';

/**
 * Parse a Word document and extract paragraphs with style information
 * @param {string} filePath - Path to the .docx file
 * @returns {Promise<{paragraphs: Array, html: string, rawText: string, messages: Array}>}
 */
export async function parseDocument(filePath) {
  const extractor = new DocxExtractor();
  await extractor.load(filePath);

  const paragraphs = buildParagraphsWithMarkers(extractor);
  const rawText = paragraphs.map(p => p.text).join('\n');

  return {
    html: '',  // No HTML conversion with DocxExtractor
    rawText,
    paragraphs,
    messages: [],
  };
}

/**
 * Parse document with structured output for chunking
 * @param {string} filePath - Path to the .docx file
 * @returns {Promise<{paragraphs: Array, tables: Array, html: string, warnings: Array}>}
 */
export async function parseDocumentStructured(filePath) {
  const extractor = new DocxExtractor();
  await extractor.load(filePath);

  const paragraphs = buildParagraphsWithMarkers(extractor);

  return {
    paragraphs,
    tables: [],  // Table extraction not yet implemented in DocxExtractor
    html: '',
    warnings: [],
  };
}

/**
 * Build paragraph array with list markers resolved
 * @param {DocxExtractor} extractor - Loaded DocxExtractor instance
 * @returns {Array} Paragraphs with resolved list markers
 */
function buildParagraphsWithMarkers(extractor) {
  const sourceParagraphs = extractor.getParagraphs();
  const result = [];

  for (const para of sourceParagraphs) {
    // Resolve numbering to get list marker
    let listMarker = null;
    if (para.numInfo) {
      listMarker = extractor.resolveNumbering(para);
    }

    // Build text with list marker prepended if applicable
    let text = para.text;
    if (listMarker && text.trim()) {
      text = `${listMarker} ${text.trim()}`;
    }

    if (text.trim()) {
      result.push({
        index: result.length,
        text: text.trim(),
        style: para.styleName || 'Normal',
        styleId: para.styleId,
        depth: 0,
        hasListMarker: !!listMarker,
        listMarker: listMarker,
        listLevel: para.numInfo?.ilvl ? parseInt(para.numInfo.ilvl, 10) : null,
      });
    }
  }

  return result;
}

/**
 * Analyze document to detect all styles used
 * @param {string} filePath - Path to the .docx file
 * @returns {Promise<Array<{styleName: string, occurrenceCount: number, sampleText: string}>>}
 */
export async function analyzeDocumentStyles(filePath) {
  const extractor = new DocxExtractor();
  await extractor.load(filePath);

  // Count style occurrences from paragraphs
  const styleAnalysis = {};
  const paragraphs = extractor.getParagraphs();

  for (const para of paragraphs) {
    const styleName = para.styleName || 'Normal';
    const text = para.text.trim();

    if (!styleAnalysis[styleName]) {
      styleAnalysis[styleName] = { count: 0, samples: [] };
    }

    styleAnalysis[styleName].count++;

    if (styleAnalysis[styleName].samples.length < 3 && text) {
      styleAnalysis[styleName].samples.push(text.substring(0, 200));
    }
  }

  // Convert to array format
  const styles = Object.entries(styleAnalysis).map(([name, data]) => ({
    styleName: name,
    occurrenceCount: data.count,
    sampleText: data.samples[0] || '',
  }));

  return styles;
}

/**
 * Generate a hash for content deduplication
 * @param {string} text - Text to hash
 * @returns {string} MD5 hash of the text
 */
export function generateContentHash(text) {
  return createHash('md5').update(text).digest('hex');
}
