import mammoth from 'mammoth';
import { readFile } from 'fs/promises';
import { createHash } from 'crypto';

/**
 * Parse a Word document and extract paragraphs with style information
 */
export async function parseDocument(filePath) {
  const buffer = await readFile(filePath);

  // Use mammoth's raw conversion to get style information
  const result = await mammoth.convertToHtml(buffer, {
    styleMap: [
      "p[style-name='Heading 1'] => h1:fresh",
      "p[style-name='Heading 2'] => h2:fresh",
      "p[style-name='Heading 3'] => h3:fresh",
      "p[style-name='Heading 4'] => h4:fresh",
      "p[style-name='Heading 5'] => h5:fresh",
      "p[style-name='Heading 6'] => h6:fresh",
      "p[style-name='Rubrik 1'] => h1:fresh",
      "p[style-name='Rubrik 2'] => h2:fresh",
      "p[style-name='Rubrik 3'] => h3:fresh",
      "p[style-name='Title'] => h1:fresh",
      "p[style-name='Subtitle'] => h2:fresh",
    ],
  });

  // Get raw text with messages for debugging
  const textResult = await mammoth.extractRawText(buffer);

  // Parse the raw document structure to extract paragraphs with styles
  const paragraphs = await extractParagraphsWithStyles(buffer);

  return {
    html: result.value,
    rawText: textResult.value,
    paragraphs,
    messages: result.messages,
  };
}

/**
 * Extract paragraphs with their style information using mammoth's internal API
 */
async function extractParagraphsWithStyles(buffer) {
  const result = await mammoth.convertToHtml(buffer, {
    transformDocument: transformElement,
  });

  // The paragraphs are collected during transformation
  return collectedParagraphs;
}

let collectedParagraphs = [];

function transformElement(element) {
  if (element.type === 'document') {
    collectedParagraphs = [];
  }

  if (element.type === 'paragraph') {
    const styleName = element.styleName || 'Normal';
    const text = extractTextFromElement(element);

    if (text.trim()) {
      collectedParagraphs.push({
        index: collectedParagraphs.length,
        text: text.trim(),
        style: styleName,
      });
    }
  }

  return element;
}

function extractTextFromElement(element) {
  if (element.type === 'text') {
    return element.value;
  }

  if (element.children) {
    return element.children.map(child => extractTextFromElement(child)).join('');
  }

  return '';
}

/**
 * Alternative approach: Parse document and detect all styles used
 */
export async function analyzeDocumentStyles(filePath) {
  const buffer = await readFile(filePath);
  const styleAnalysis = {};

  await mammoth.convertToHtml(buffer, {
    transformDocument: (element) => {
      analyzeElement(element, styleAnalysis);
      return element;
    },
  });

  // Convert to array format
  const styles = Object.entries(styleAnalysis).map(([name, data]) => ({
    styleName: name,
    occurrenceCount: data.count,
    sampleText: data.samples[0] || '',
  }));

  return styles;
}

function analyzeElement(element, styleAnalysis) {
  if (element.type === 'paragraph') {
    const styleName = element.styleName || 'Normal';
    const text = extractTextFromElement(element).trim();

    if (!styleAnalysis[styleName]) {
      styleAnalysis[styleName] = { count: 0, samples: [] };
    }

    styleAnalysis[styleName].count++;

    if (styleAnalysis[styleName].samples.length < 3 && text) {
      styleAnalysis[styleName].samples.push(text.substring(0, 200));
    }
  }

  if (element.children) {
    element.children.forEach(child => analyzeElement(child, styleAnalysis));
  }
}

/**
 * Parse document with a cleaner approach using internal structure
 */
export async function parseDocumentStructured(filePath) {
  const buffer = await readFile(filePath);
  const paragraphs = [];
  const tables = [];

  // Custom style handling
  const result = await mammoth.convertToHtml(buffer, {
    transformDocument: (element) => {
      processElement(element, paragraphs, tables, 0);
      return element;
    },
  });

  return {
    paragraphs,
    tables,
    html: result.value,
    warnings: result.messages.filter(m => m.type === 'warning'),
  };
}

function processElement(element, paragraphs, tables, depth) {
  if (element.type === 'paragraph') {
    const styleName = element.styleName || 'Normal';
    const text = extractTextFromElement(element).trim();

    if (text) {
      paragraphs.push({
        index: paragraphs.length,
        text,
        style: styleName,
        depth,
      });
    }
  }

  if (element.type === 'table') {
    const tableText = extractTableText(element);
    tables.push({
      index: tables.length,
      text: tableText,
      rowCount: element.children ? element.children.length : 0,
    });
  }

  if (element.children) {
    element.children.forEach(child => processElement(child, paragraphs, tables, depth + 1));
  }
}

function extractTableText(tableElement) {
  const rows = [];

  if (tableElement.children) {
    tableElement.children.forEach(row => {
      if (row.type === 'tableRow' && row.children) {
        const cells = row.children.map(cell => extractTextFromElement(cell).trim());
        rows.push(cells.join(' | '));
      }
    });
  }

  return rows.join('\n');
}

/**
 * Generate a hash for content deduplication
 */
export function generateContentHash(text) {
  return createHash('md5').update(text).digest('hex');
}
