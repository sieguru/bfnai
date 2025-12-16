/**
 * DocxExtractor - A library for extracting structured content from .docx files
 * Extracts paragraphs, styles, and numbering information using JSZip
 */

import JSZip from 'jszip';
import { readFile } from 'fs/promises';

/**
 * Convert a number to the specified OOXML format
 */
function formatNumber(num, format) {
  switch (format) {
    case 'decimal':
      return num.toString();

    case 'lowerLetter': {
      let result = '';
      let n = num;
      while (n > 0) {
        n--;
        result = String.fromCharCode(97 + (n % 26)) + result;
        n = Math.floor(n / 26);
      }
      return result;
    }

    case 'upperLetter': {
      let result = '';
      let n = num;
      while (n > 0) {
        n--;
        result = String.fromCharCode(65 + (n % 26)) + result;
        n = Math.floor(n / 26);
      }
      return result;
    }

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

export class DocxExtractor {
  constructor() {
    this.zip = null;
    this.abstractNumFormats = {};
    this.numIdToAbstractNumId = {};
    this.styleIdToName = {};
    this.styleDetails = {};
    this.paragraphs = [];
    this.numberingCounters = {};
  }

  /**
   * Load and parse a .docx file
   * @param {string|Buffer} source - File path or buffer
   */
  async load(source) {
    const buffer = typeof source === 'string' ? await readFile(source) : source;
    this.zip = await JSZip.loadAsync(buffer);

    // Parse in order: numbering -> styles -> document
    await this._parseNumbering();
    await this._parseStyles();
    await this._parseDocument();

    return this;
  }

  /**
   * Parse numbering.xml to extract numbering definitions
   */
  async _parseNumbering() {
    const numberingXml = await this.zip.file('word/numbering.xml')?.async('string');
    if (!numberingXml) return;

    // Maps for resolving linked list styles
    const styleLinkToAbstractNumId = {};
    const numStyleLinks = {};

    // Parse abstractNum definitions
    const abstractNumRegex = /<w:abstractNum[^>]*w:abstractNumId="(\d+)"[^>]*>([\s\S]*?)<\/w:abstractNum>/g;
    let match;

    while ((match = abstractNumRegex.exec(numberingXml)) !== null) {
      const [, abstractNumId, content] = match;
      this.abstractNumFormats[abstractNumId] = {};

      // Check for styleLink (this abstractNum IS the source definition)
      const styleLinkMatch = content.match(/<w:styleLink[^>]*w:val="([^"]+)"/);
      if (styleLinkMatch) {
        styleLinkToAbstractNumId[styleLinkMatch[1]] = abstractNumId;
      }

      // Check for numStyleLink (this abstractNum REFERENCES another via style)
      const numStyleLinkMatch = content.match(/<w:numStyleLink[^>]*w:val="([^"]+)"/);
      if (numStyleLinkMatch) {
        numStyleLinks[abstractNumId] = numStyleLinkMatch[1];
        continue;
      }

      // Parse level definitions
      const lvlRegex = /<w:lvl[^>]*w:ilvl="(\d+)"[^>]*>([\s\S]*?)<\/w:lvl>/g;
      let lvlMatch;

      while ((lvlMatch = lvlRegex.exec(content)) !== null) {
        const [, level, lvlContent] = lvlMatch;

        const numFmtMatch = lvlContent.match(/<w:numFmt[^>]*w:val="([^"]+)"/);
        const lvlTextMatch = lvlContent.match(/<w:lvlText[^>]*w:val="([^"]*)"/);
        const startMatch = lvlContent.match(/<w:start[^>]*w:val="(\d+)"/);

        this.abstractNumFormats[abstractNumId][level] = {
          numFmt: numFmtMatch ? numFmtMatch[1] : 'decimal',
          lvlText: lvlTextMatch ? lvlTextMatch[1] : '%1.',
          start: startMatch ? parseInt(startMatch[1], 10) : 1,
        };
      }
    }

    // Resolve numStyleLinks - copy formats from source abstractNum
    for (const [abstractNumId, styleName] of Object.entries(numStyleLinks)) {
      const sourceAbstractNumId = styleLinkToAbstractNumId[styleName];
      if (sourceAbstractNumId && this.abstractNumFormats[sourceAbstractNumId]) {
        this.abstractNumFormats[abstractNumId] = { ...this.abstractNumFormats[sourceAbstractNumId] };
      }
    }

    // Parse num -> abstractNum mappings
    const numRegex = /<w:num\s[^>]*w:numId="(\d+)"[^>]*>[\s\S]*?<w:abstractNumId[^>]*w:val="(\d+)"/g;
    while ((match = numRegex.exec(numberingXml)) !== null) {
      const [, numId, abstractNumId] = match;
      this.numIdToAbstractNumId[numId] = abstractNumId;
    }
  }

  /**
   * Parse styles.xml to extract style definitions
   */
  async _parseStyles() {
    const stylesXml = await this.zip.file('word/styles.xml')?.async('string');
    if (!stylesXml) return;

    const styleRegex = /<w:style[^>]*w:type="([^"]*)"[^>]*w:styleId="([^"]*)"[^>]*>([\s\S]*?)<\/w:style>/g;
    let match;

    while ((match = styleRegex.exec(stylesXml)) !== null) {
      const [, type, styleId, content] = match;

      // Extract style name
      const nameMatch = content.match(/<w:name[^>]*w:val="([^"]*)"/);
      const name = nameMatch ? nameMatch[1] : styleId;

      // Extract basedOn
      const basedOnMatch = content.match(/<w:basedOn[^>]*w:val="([^"]*)"/);
      const basedOn = basedOnMatch ? basedOnMatch[1] : null;

      // Extract outlineLvl (for headings)
      const outlineLvlMatch = content.match(/<w:outlineLvl[^>]*w:val="(\d+)"/);
      const outlineLevel = outlineLvlMatch ? parseInt(outlineLvlMatch[1], 10) : null;

      // Extract numbering properties from style
      const pPrMatch = content.match(/<w:pPr>([\s\S]*?)<\/w:pPr>/);
      let numInfo = null;
      if (pPrMatch) {
        const pPrContent = pPrMatch[1];
        const numPrMatch = pPrContent.match(/<w:numPr>([\s\S]*?)<\/w:numPr>/);
        if (numPrMatch) {
          const numPrContent = numPrMatch[1];
          const ilvlMatch = numPrContent.match(/<w:ilvl[^>]*w:val="(\d+)"/);
          const numIdMatch = numPrContent.match(/<w:numId[^>]*w:val="(\d+)"/);
          if (numIdMatch && numIdMatch[1] !== '0') {
            numInfo = {
              numId: numIdMatch[1],
              ilvl: ilvlMatch ? ilvlMatch[1] : '0',
            };
          }
        }
      }

      this.styleIdToName[styleId] = name;
      this.styleDetails[styleId] = { type, name, basedOn, outlineLevel, numInfo };
    }
  }

  /**
   * Parse document.xml to extract paragraphs
   */
  async _parseDocument() {
    const documentXml = await this.zip.file('word/document.xml')?.async('string');
    if (!documentXml) return;

    const paragraphRegex = /<w:p[^>]*>([\s\S]*?)<\/w:p>/g;
    let match;
    let index = 0;

    while ((match = paragraphRegex.exec(documentXml)) !== null) {
      const pContent = match[1];

      // Extract style
      const pStyleMatch = pContent.match(/<w:pStyle[^>]*w:val="([^"]+)"/);
      const styleId = pStyleMatch ? pStyleMatch[1] : null;
      const styleName = styleId ? (this.styleIdToName[styleId] || styleId) : null;

      // Extract explicit numbering properties from paragraph
      const numPrMatch = pContent.match(/<w:numPr>([\s\S]*?)<\/w:numPr>/);
      let numInfo = null;
      let numSource = 'explicit';

      if (numPrMatch) {
        const numPrContent = numPrMatch[1];
        const ilvlMatch = numPrContent.match(/<w:ilvl[^>]*w:val="(\d+)"/);
        const numIdMatch = numPrContent.match(/<w:numId[^>]*w:val="(\d+)"/);

        if (numIdMatch && numIdMatch[1] !== '0') {
          numInfo = {
            numId: numIdMatch[1],
            ilvl: ilvlMatch ? ilvlMatch[1] : '0',
            abstractNumId: this.numIdToAbstractNumId[numIdMatch[1]],
          };
        }
      }

      // If no explicit numbering, check style chain
      if (!numInfo && styleId) {
        const styleNumInfo = this._getStyleNumberingInfo(styleId);
        if (styleNumInfo) {
          numInfo = {
            numId: styleNumInfo.numId,
            ilvl: styleNumInfo.ilvl,
            abstractNumId: this.numIdToAbstractNumId[styleNumInfo.numId],
          };
          numSource = `style:${styleNumInfo.fromStyle}`;
        }
      }

      // Get format definition if numbering exists
      let formatDef = null;
      if (numInfo) {
        formatDef = this.abstractNumFormats[numInfo.abstractNumId]?.[numInfo.ilvl];
      }

      // Extract text
      const textMatches = pContent.match(/<w:t[^>]*>([^<]*)<\/w:t>/g) || [];
      const text = textMatches.map(m => m.replace(/<[^>]+>/g, '')).join('');

      this.paragraphs.push({
        index,
        styleId,
        styleName,
        numInfo,
        numSource,
        formatDef,
        text,
      });

      index++;
    }
  }

  /**
   * Recursively find numbering info from style chain
   */
  _getStyleNumberingInfo(styleId, visited = new Set()) {
    if (!styleId || visited.has(styleId)) {
      return null;
    }
    visited.add(styleId);

    const style = this.styleDetails[styleId];
    if (!style) {
      return null;
    }

    if (style.numInfo) {
      return { ...style.numInfo, fromStyle: styleId };
    }

    if (style.basedOn) {
      return this._getStyleNumberingInfo(style.basedOn, visited);
    }

    return null;
  }

  /**
   * Resolve numbering to actual string for a paragraph
   * @param {object} paragraph - Paragraph object from this.paragraphs
   * @returns {string|null} - Resolved numbering string or null
   */
  resolveNumbering(paragraph) {
    if (!paragraph.numInfo) {
      return null;
    }

    const { numId, ilvl, abstractNumId } = paragraph.numInfo;
    const formatDef = this.abstractNumFormats[abstractNumId]?.[ilvl];

    if (!formatDef) {
      return null;
    }

    // Handle bullets - no counter needed
    if (formatDef.numFmt === 'bullet') {
      return '•';
    }

    // Track counter per numId-level combination
    const counterKey = `${numId}-${ilvl}`;

    // Initialize or increment counter
    if (this.numberingCounters[counterKey] === undefined) {
      this.numberingCounters[counterKey] = formatDef.start || 1;
    } else {
      this.numberingCounters[counterKey]++;
    }

    // Build level counters for multi-level formats
    const levelCounters = {};
    for (let lvl = 0; lvl <= parseInt(ilvl, 10); lvl++) {
      const key = `${numId}-${lvl}`;
      levelCounters[lvl] = this.numberingCounters[key] ||
        (this.abstractNumFormats[abstractNumId]?.[lvl]?.start || 1);
    }

    // Apply the lvlText format
    let marker = formatDef.lvlText;
    marker = marker.replace(/%(\d+)/g, (match, levelNum) => {
      const lvl = parseInt(levelNum, 10) - 1;
      const lvlFormat = this.abstractNumFormats[abstractNumId]?.[lvl];
      const counter = levelCounters[lvl] || 1;
      return formatNumber(counter, lvlFormat?.numFmt || 'decimal');
    });

    return marker;
  }

  /**
   * Reset numbering counters (call before re-processing paragraphs)
   */
  resetNumberingCounters() {
    this.numberingCounters = {};
  }

  /**
   * Get all styles
   */
  getStyles() {
    return this.styleDetails;
  }

  /**
   * Get all paragraph styles only
   */
  getParagraphStyles() {
    return Object.fromEntries(
      Object.entries(this.styleDetails).filter(([, style]) => style.type === 'paragraph')
    );
  }

  /**
   * Get all numbering definitions
   */
  getNumberingDefinitions() {
    return {
      abstractNumFormats: this.abstractNumFormats,
      numIdToAbstractNumId: this.numIdToAbstractNumId,
    };
  }

  /**
   * Get all paragraphs
   */
  getParagraphs() {
    return this.paragraphs;
  }

  /**
   * Get paragraphs with numbering only
   */
  getNumberedParagraphs() {
    return this.paragraphs.filter(p => p.numInfo !== null);
  }

  /**
   * Get format definition for a numId/ilvl combination
   */
  getFormatDefinition(numId, ilvl) {
    const abstractNumId = this.numIdToAbstractNumId[numId];
    if (!abstractNumId) return null;
    return this.abstractNumFormats[abstractNumId]?.[ilvl] || null;
  }
}

export default DocxExtractor;
