import mammoth from 'mammoth';
import { readFile } from 'fs/promises';
import { createHash } from 'crypto';
import JSZip from 'jszip';

/**
 * Numbering format definitions extracted from numbering.xml
 * Maps paragraph style IDs to their format configuration
 */
let numberingFormats = {};
let numberingCounters = {};

/**
 * Parse a Word document and extract paragraphs with style information
 */
export async function parseDocument(filePath) {
  const buffer = await readFile(filePath);

  // Extract numbering definitions from the docx file
  await extractNumberingDefinitions(buffer);

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
 * Extract numbering definitions from the docx file's numbering.xml
 * This contains the actual format definitions (e.g., "a)", "1.", etc.)
 */
async function extractNumberingDefinitions(buffer) {
  numberingFormats = {};
  numberingCounters = {};

  try {
    const zip = await JSZip.loadAsync(buffer);
    const numberingXml = await zip.file('word/numbering.xml')?.async('string');

    if (!numberingXml) {
      return; // No numbering definitions
    }

    // Parse abstractNum definitions to extract format info
    // Format: <w:abstractNum w:abstractNumId="X">...<w:lvl w:ilvl="Y">...<w:pStyle w:val="StyleName"/>...
    const abstractNumRegex = /<w:abstractNum[^>]*w:abstractNumId="(\d+)"[^>]*>([\s\S]*?)<\/w:abstractNum>/g;
    let match;

    while ((match = abstractNumRegex.exec(numberingXml)) !== null) {
      const abstractNumId = match[1];
      const content = match[2];

      // Extract each level definition
      const lvlRegex = /<w:lvl[^>]*w:ilvl="(\d+)"[^>]*>([\s\S]*?)<\/w:lvl>/g;
      let lvlMatch;

      while ((lvlMatch = lvlRegex.exec(content)) !== null) {
        const level = parseInt(lvlMatch[1], 10);
        const lvlContent = lvlMatch[2];

        // Extract pStyle (paragraph style this applies to)
        const pStyleMatch = lvlContent.match(/<w:pStyle[^>]*w:val="([^"]+)"/);
        // Extract numFmt (decimal, lowerLetter, bullet, etc.)
        const numFmtMatch = lvlContent.match(/<w:numFmt[^>]*w:val="([^"]+)"/);
        // Extract lvlText (the actual format like "%1." or "%1)")
        const lvlTextMatch = lvlContent.match(/<w:lvlText[^>]*w:val="([^"]*)"/);
        // Extract start value
        const startMatch = lvlContent.match(/<w:start[^>]*w:val="(\d+)"/);

        if (pStyleMatch) {
          const styleId = pStyleMatch[1];
          numberingFormats[styleId] = {
            abstractNumId,
            level,
            numFmt: numFmtMatch ? numFmtMatch[1] : 'decimal',
            lvlText: lvlTextMatch ? lvlTextMatch[1] : '%1.',
            start: startMatch ? parseInt(startMatch[1], 10) : 1,
          };
        }
      }
    }
  } catch (error) {
    console.warn('Failed to parse numbering.xml:', error.message);
  }
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

/**
 * Reset numbering counters for a new document or section
 */
function resetNumberingCounters() {
  numberingCounters = {};
}

/**
 * Convert a number to the specified format
 * @param {number} num - The number to convert
 * @param {string} format - The format type (decimal, lowerLetter, upperLetter, lowerRoman, upperRoman, bullet)
 * @returns {string} The formatted number/letter
 */
function formatNumber(num, format) {
  switch (format) {
    case 'decimal':
      return num.toString();

    case 'lowerLetter':
      // a, b, c, ... z, aa, ab, ...
      let result = '';
      let n = num;
      while (n > 0) {
        n--;
        result = String.fromCharCode(97 + (n % 26)) + result;
        n = Math.floor(n / 26);
      }
      return result;

    case 'upperLetter':
      let resultUpper = '';
      let nUpper = num;
      while (nUpper > 0) {
        nUpper--;
        resultUpper = String.fromCharCode(65 + (nUpper % 26)) + resultUpper;
        nUpper = Math.floor(nUpper / 26);
      }
      return resultUpper;

    case 'lowerRoman':
      return toRoman(num).toLowerCase();

    case 'upperRoman':
      return toRoman(num);

    case 'bullet':
      return '•';

    case 'none':
      return '';

    default:
      return num.toString();
  }
}

/**
 * Convert number to Roman numerals
 */
function toRoman(num) {
  const romanNumerals = [
    { value: 1000, numeral: 'M' },
    { value: 900, numeral: 'CM' },
    { value: 500, numeral: 'D' },
    { value: 400, numeral: 'CD' },
    { value: 100, numeral: 'C' },
    { value: 90, numeral: 'XC' },
    { value: 50, numeral: 'L' },
    { value: 40, numeral: 'XL' },
    { value: 10, numeral: 'X' },
    { value: 9, numeral: 'IX' },
    { value: 5, numeral: 'V' },
    { value: 4, numeral: 'IV' },
    { value: 1, numeral: 'I' },
  ];

  let result = '';
  let remaining = num;

  for (const { value, numeral } of romanNumerals) {
    while (remaining >= value) {
      result += numeral;
      remaining -= value;
    }
  }

  return result;
}

/**
 * Get the list marker for a paragraph based on extracted numbering definitions
 * Uses the actual format from the Word document's numbering.xml
 */
function getListMarker(element) {
  const numbering = element.numbering;
  const styleName = element.styleName || '';
  const styleId = element.styleId || styleName.replace(/\s+/g, '');

  // If we have numbering info from mammoth
  if (numbering) {
    const level = parseInt(numbering.level, 10) || 0;

    // Look up the format definition from numbering.xml
    const formatDef = numberingFormats[styleId];

    if (formatDef) {
      // Use the actual format from the document
      const counterKey = `${formatDef.abstractNumId}-${formatDef.level}`;

      // Initialize or increment counter
      if (!numberingCounters[counterKey]) {
        numberingCounters[counterKey] = formatDef.start || 1;
      } else {
        numberingCounters[counterKey]++;
      }

      const currentNum = numberingCounters[counterKey];
      const formattedNum = formatNumber(currentNum, formatDef.numFmt);

      // Apply the lvlText format (e.g., "%1." or "%1)" or "(%1)")
      // Replace %1, %2, etc. with the actual formatted number
      let marker = formatDef.lvlText;
      marker = marker.replace(/%\d+/g, formattedNum);

      return marker;
    }

    // Fallback: use mammoth's numbering info if no format definition found
    const isOrdered = numbering.isOrdered;
    const counterKey = `fallback-${styleId}-${level}`;

    if (isOrdered) {
      if (!numberingCounters[counterKey]) {
        numberingCounters[counterKey] = 1;
      } else {
        numberingCounters[counterKey]++;
      }
      return `${numberingCounters[counterKey]}.`;
    } else {
      // Unordered - use bullet
      return '•';
    }
  }

  // No numbering info from mammoth - check if style name indicates a bullet list
  // This handles cases where Word uses style-based bullets without numbering definition
  const styleNameLower = styleName.toLowerCase();

  if (styleNameLower.includes('punktlista')) {
    // Swedish: Punktlista = bullet list
    return '•';
  }

  // No list marker needed
  return null;
}

/**
 * Check if a new paragraph should reset numbering counters
 * (e.g., when moving to a different section or heading)
 */
function shouldResetNumberingCounter(element, styleName) {
  // Reset counters when encountering major headings
  if (styleName.toLowerCase().includes('rubrik 1') ||
      styleName.toLowerCase().includes('rubrik 2') ||
      styleName.toLowerCase().includes('heading 1') ||
      styleName.toLowerCase().includes('heading 2')) {
    resetNumberingCounters();
    return true;
  }
  // Reset when encountering content type markers (Spalttext)
  if (styleName.toLowerCase() === 'spalttext') {
    resetNumberingCounters();
    return true;
  }
  return false;
}

function transformElement(element) {
  if (element.type === 'document') {
    collectedParagraphs = [];
    resetNumberingCounters();
  }

  if (element.type === 'paragraph') {
    const styleName = element.styleName || 'Normal';

    // Check if we should reset numbering counters
    shouldResetNumberingCounter(element, styleName);

    // Get the raw text
    let text = extractTextFromElement(element);

    // Get list marker if this is a list item (uses extracted numbering definitions)
    const listMarker = getListMarker(element);

    // Prepend list marker to text if applicable
    if (listMarker && text.trim()) {
      text = `${listMarker} ${text.trim()}`;
    } else {
      text = text.trim();
    }

    if (text) {
      collectedParagraphs.push({
        index: collectedParagraphs.length,
        text: text,
        style: styleName,
        styleId: element.styleId,
        hasListMarker: !!listMarker,
        listMarker: listMarker,
        listLevel: element.numbering?.level,
      });
    }
  }

  // Recursively process children
  if (element.children) {
    element.children.forEach(child => transformElement(child));
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

  // Extract numbering definitions from the docx file
  await extractNumberingDefinitions(buffer);

  // Reset numbering counters for new document
  resetNumberingCounters();

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

    // Check if we should reset numbering counters
    shouldResetNumberingCounter(element, styleName);

    // Get the raw text
    let text = extractTextFromElement(element);

    // Get list marker if this is a list item (uses extracted numbering definitions)
    const listMarker = getListMarker(element);

    // Prepend list marker to text if applicable
    if (listMarker && text.trim()) {
      text = `${listMarker} ${text.trim()}`;
    } else {
      text = text.trim();
    }

    if (text) {
      paragraphs.push({
        index: paragraphs.length,
        text,
        style: styleName,
        styleId: element.styleId,
        depth,
        hasListMarker: !!listMarker,
        listMarker: listMarker,
        listLevel: element.numbering?.level,
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
