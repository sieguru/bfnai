import mammoth from 'mammoth';
import { readFile } from 'fs/promises';
import { createHash } from 'crypto';
import JSZip from 'jszip';

/**
 * Numbering format definitions extracted from numbering.xml
 * Maps abstractNumId to level format configurations
 */
let abstractNumFormats = {};

/**
 * Maps numId to abstractNumId (from numbering.xml)
 */
let numIdToAbstractNumId = {};

/**
 * Counters for each numId-level combination
 */
let numberingCounters = {};

/**
 * Map of paragraph text hash to numPr info for text-based correlation
 * Key: first 100 chars of paragraph text, Value: { numId, ilvl }
 */
let textToNumberingMap = {};

/**
 * Active list context for continuation detection
 * Tracks the most recent list to continue numbering for unmarked paragraphs
 */
let activeListContext = null;

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
 * Extract numbering definitions from the docx file's numbering.xml and document.xml
 * This extracts:
 * 1. abstractNum definitions (format templates)
 * 2. num definitions (numId -> abstractNumId mappings)
 * 3. Text-to-numId mapping for correlating with mammoth paragraphs
 */
async function extractNumberingDefinitions(buffer) {
  abstractNumFormats = {};
  numIdToAbstractNumId = {};
  numberingCounters = {};
  textToNumberingMap = {};

  try {
    const zip = await JSZip.loadAsync(buffer);
    const numberingXml = await zip.file('word/numbering.xml')?.async('string');
    const documentXml = await zip.file('word/document.xml')?.async('string');

    if (numberingXml) {
      // 1. Parse abstractNum definitions (format templates)
      const abstractNumRegex = /<w:abstractNum[^>]*w:abstractNumId="(\d+)"[^>]*>([\s\S]*?)<\/w:abstractNum>/g;
      let match;

      while ((match = abstractNumRegex.exec(numberingXml)) !== null) {
        const abstractNumId = match[1];
        const content = match[2];
        abstractNumFormats[abstractNumId] = {};

        // Extract each level definition
        const lvlRegex = /<w:lvl[^>]*w:ilvl="(\d+)"[^>]*>([\s\S]*?)<\/w:lvl>/g;
        let lvlMatch;

        while ((lvlMatch = lvlRegex.exec(content)) !== null) {
          const level = parseInt(lvlMatch[1], 10);
          const lvlContent = lvlMatch[2];

          // Extract numFmt (decimal, lowerLetter, bullet, etc.)
          const numFmtMatch = lvlContent.match(/<w:numFmt[^>]*w:val="([^"]+)"/);
          // Extract lvlText (the actual format like "%1." or "%1)")
          const lvlTextMatch = lvlContent.match(/<w:lvlText[^>]*w:val="([^"]*)"/);
          // Extract start value
          const startMatch = lvlContent.match(/<w:start[^>]*w:val="(\d+)"/);

          abstractNumFormats[abstractNumId][level] = {
            numFmt: numFmtMatch ? numFmtMatch[1] : 'decimal',
            lvlText: lvlTextMatch ? lvlTextMatch[1] : '%1.',
            start: startMatch ? parseInt(startMatch[1], 10) : 1,
          };
        }
      }

      // 2. Parse num elements (numId -> abstractNumId mappings)
      const numRegex = /<w:num[^>]*w:numId="(\d+)"[^>]*>[\s\S]*?<w:abstractNumId[^>]*w:val="(\d+)"[^>]*\/>/g;
      let numMatch;

      while ((numMatch = numRegex.exec(numberingXml)) !== null) {
        numIdToAbstractNumId[numMatch[1]] = numMatch[2];
      }
    }

    if (documentXml) {
      // 3. Build text-to-numId mapping for paragraphs with numbering
      const paragraphRegex = /<w:p[^>]*>([\s\S]*?)<\/w:p>/g;
      let pMatch;

      while ((pMatch = paragraphRegex.exec(documentXml)) !== null) {
        const pContent = pMatch[1];

        // Check for numPr (numbering properties)
        const numPrMatch = pContent.match(/<w:numPr>([\s\S]*?)<\/w:numPr>/);

        if (numPrMatch) {
          const numPrContent = numPrMatch[1];
          const ilvlMatch = numPrContent.match(/<w:ilvl[^>]*w:val="(\d+)"/);
          const numIdMatch = numPrContent.match(/<w:numId[^>]*w:val="(\d+)"/);

          if (numIdMatch && numIdMatch[1] !== '0') {
            // Extract text from this paragraph for matching
            const text = extractTextFromXml(pContent);
            if (text.trim()) {
              // Use normalized text as key (trim, lowercase, first 100 chars)
              const textKey = normalizeTextForMatching(text);
              textToNumberingMap[textKey] = {
                numId: numIdMatch[1],
                ilvl: ilvlMatch ? parseInt(ilvlMatch[1], 10) : 0,
              };
            }
          }
        }
      }
    }
  } catch (error) {
    console.warn('Failed to parse numbering definitions:', error.message);
  }
}

/**
 * Extract text content from Word XML paragraph content
 */
function extractTextFromXml(xmlContent) {
  // Extract text from w:t elements
  const textMatches = xmlContent.match(/<w:t[^>]*>([^<]*)<\/w:t>/g) || [];
  return textMatches.map(m => m.replace(/<[^>]+>/g, '')).join('');
}

/**
 * Normalize text for matching between document.xml and mammoth
 * Handles Unicode special characters that differ between sources
 */
function normalizeTextForMatching(text) {
  return text
    .trim()
    .toLowerCase()
    // Remove soft hyphens (U+00AD) - Word uses these for optional line breaks
    .replace(/\u00AD/g, '')
    // Replace non-breaking spaces (U+00A0) with regular spaces
    .replace(/\u00A0/g, ' ')
    // Replace en-dash (U+2013) and em-dash (U+2014) with regular hyphen
    .replace(/[\u2013\u2014]/g, '-')
    // Replace various quote characters with standard ones
    .replace(/[\u2018\u2019]/g, "'")
    .replace(/[\u201C\u201D]/g, '"')
    // Normalize whitespace
    .replace(/\s+/g, ' ')
    .substring(0, 100);
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
 * Reset all document state for a new document
 */
function resetDocumentState() {
  collectedParagraphs = [];
  numberingCounters = {};
  activeListContext = null;
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
 * Get the list marker for a paragraph using text-based correlation with document.xml
 * This uses the actual numId from the document to track separate list instances
 * @param {string} paragraphText - The text of the paragraph to match
 * @param {string} styleName - The style name for continuation tracking
 * @returns {{ marker: string|null, isExplicit: boolean }} - The marker and whether it was from explicit numPr
 */
function getListMarker(paragraphText, styleName) {
  if (!paragraphText) {
    return { marker: null, isExplicit: false };
  }

  // Look up numbering info using normalized text
  const textKey = normalizeTextForMatching(paragraphText);
  const numInfo = textToNumberingMap[textKey];

  if (!numInfo) {
    return { marker: null, isExplicit: false }; // No numbering found for this text
  }

  const { numId, ilvl } = numInfo;

  // Get the abstractNumId for this numId
  const abstractNumId = numIdToAbstractNumId[numId];

  if (!abstractNumId) {
    return { marker: null, isExplicit: false }; // No abstract definition found
  }

  // Get the format definition for this level
  const formatDef = abstractNumFormats[abstractNumId]?.[ilvl];

  if (!formatDef) {
    return { marker: null, isExplicit: false }; // No format definition found
  }

  // Handle bullets - no counter needed
  if (formatDef.numFmt === 'bullet') {
    // Set active context for bullet continuation
    activeListContext = {
      numId,
      ilvl,
      abstractNumId,
      formatDef,
      styleName,
      isBullet: true,
    };
    return { marker: '•', isExplicit: true };
  }

  // Track counter per numId-level combination (each list instance has its own counter)
  const counterKey = `${numId}-${ilvl}`;

  // Initialize or increment counter
  if (numberingCounters[counterKey] === undefined) {
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

  // Set active context for numbered list continuation
  activeListContext = {
    numId,
    ilvl,
    abstractNumId,
    formatDef,
    counterKey,
    styleName,
    isBullet: false,
  };

  return { marker, isExplicit: true };
}

/**
 * Get a continuation marker for paragraphs that follow a list item
 * but don't have their own numPr in document.xml
 * @param {string} styleName - The style name of the current paragraph
 * @returns {string|null} - The continuation marker or null
 */
function getContinuationMarker(styleName) {
  if (!activeListContext) {
    return null;
  }

  // Check if this paragraph could be a list continuation
  // It should have the same style as the list items
  const styleMatch = activeListContext.styleName &&
    styleName.toLowerCase() === activeListContext.styleName.toLowerCase();

  if (!styleMatch) {
    return null;
  }

  // For bullets, return bullet marker
  if (activeListContext.isBullet) {
    return '•';
  }

  // For numbered lists, increment and return next number
  const { counterKey, formatDef } = activeListContext;

  if (!counterKey || !formatDef) {
    return null;
  }

  // Increment counter for continuation
  numberingCounters[counterKey]++;

  const currentNum = numberingCounters[counterKey];
  const formattedNum = formatNumber(currentNum, formatDef.numFmt);

  let marker = formatDef.lvlText;
  marker = marker.replace(/%\d+/g, formattedNum);

  return marker;
}

/**
 * Legacy function to detect bullet lists from style names
 * Used as fallback when numId is not available
 */
function getStyleBasedListMarker(styleName) {
  const styleNameLower = (styleName || '').toLowerCase();

  if (styleNameLower.includes('punktlista')) {
    // Swedish: Punktlista = bullet list
    return '•';
  }

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
    resetDocumentState();
  }

  if (element.type === 'paragraph') {
    const styleName = element.styleName || 'Normal';

    // Check if this style should break list continuation
    if (shouldResetNumberingCounter(element, styleName)) {
      activeListContext = null;
    }

    // Get the raw text first (needed for numbering lookup)
    const rawText = extractTextFromElement(element);

    // Get list marker using text-based correlation with document.xml
    let { marker: listMarker, isExplicit } = getListMarker(rawText, styleName);

    // If no explicit marker, try continuation detection
    if (!listMarker && activeListContext) {
      listMarker = getContinuationMarker(styleName);
    }

    // Fallback to style-based bullet detection
    if (!listMarker) {
      listMarker = getStyleBasedListMarker(styleName);
      if (listMarker) {
        // Set active context for style-based bullets too
        activeListContext = {
          styleName,
          isBullet: true,
        };
      }
    }

    // If we have a marker but it's not explicit and not a continuation match, clear context
    // This prevents unrelated paragraphs from inheriting markers
    if (!listMarker && !isExplicit) {
      // Check if this paragraph breaks the list (different style, heading, etc.)
      const styleNameLower = styleName.toLowerCase();
      if (styleNameLower.includes('rubrik') ||
          styleNameLower.includes('heading') ||
          styleNameLower.includes('normal') ||
          styleNameLower === 'spalttext' ||
          styleNameLower === 'kommentar') {
        activeListContext = null;
      }
    }

    // Prepend list marker to text if applicable
    let text;
    if (listMarker && rawText.trim()) {
      text = `${listMarker} ${rawText.trim()}`;
    } else {
      text = rawText.trim();
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
  numberingCounters = {};

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

    // Check if this style should break list continuation
    if (shouldResetNumberingCounter(element, styleName)) {
      activeListContext = null;
    }

    // Get the raw text first (needed for numbering lookup)
    const rawText = extractTextFromElement(element);

    // Get list marker using text-based correlation with document.xml
    let { marker: listMarker, isExplicit } = getListMarker(rawText, styleName);

    // If no explicit marker, try continuation detection
    if (!listMarker && activeListContext) {
      listMarker = getContinuationMarker(styleName);
    }

    // Fallback to style-based bullet detection
    if (!listMarker) {
      listMarker = getStyleBasedListMarker(styleName);
      if (listMarker) {
        activeListContext = { styleName, isBullet: true };
      }
    }

    // Clear context for non-list paragraphs
    if (!listMarker && !isExplicit) {
      const styleNameLower = styleName.toLowerCase();
      if (styleNameLower.includes('rubrik') ||
          styleNameLower.includes('heading') ||
          styleNameLower.includes('normal') ||
          styleNameLower === 'spalttext' ||
          styleNameLower === 'kommentar') {
        activeListContext = null;
      }
    }

    // Prepend list marker to text if applicable
    let text;
    if (listMarker && rawText.trim()) {
      text = `${listMarker} ${rawText.trim()}`;
    } else {
      text = rawText.trim();
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
