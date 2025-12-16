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
      // numId="0" explicitly disables numbering (blocks inheritance from parent style)
      // ilvl without numId means: inherit numId from parent but override the level
      // numId without ilvl means: use this numId but inherit ilvl from parent
      const pPrMatch = content.match(/<w:pPr>([\s\S]*?)<\/w:pPr>/);
      let numInfo = null;
      let numberingDisabled = false;
      let ilvlOverride = null;  // Level override without numId (inherits numId from parent)
      let numIdWithoutIlvl = null;  // numId specified without ilvl (inherits ilvl from parent)
      if (pPrMatch) {
        const pPrContent = pPrMatch[1];
        const numPrMatch = pPrContent.match(/<w:numPr>([\s\S]*?)<\/w:numPr>/);
        if (numPrMatch) {
          const numPrContent = numPrMatch[1];
          const ilvlMatch = numPrContent.match(/<w:ilvl[^>]*w:val="(\d+)"/);
          const numIdMatch = numPrContent.match(/<w:numId[^>]*w:val="(\d+)"/);
          if (numIdMatch) {
            if (numIdMatch[1] === '0') {
              // numId="0" explicitly disables numbering
              numberingDisabled = true;
            } else if (ilvlMatch) {
              // Both numId and ilvl specified - complete numbering info
              numInfo = {
                numId: numIdMatch[1],
                ilvl: ilvlMatch[1],
              };
            } else {
              // numId specified without ilvl - need to inherit ilvl from parent
              numIdWithoutIlvl = numIdMatch[1];
            }
          } else if (ilvlMatch) {
            // ilvl specified without numId - this overrides the level from parent style
            ilvlOverride = ilvlMatch[1];
          }
        }
      }

      this.styleIdToName[styleId] = name;
      this.styleDetails[styleId] = { type, name, basedOn, outlineLevel, numInfo, numberingDisabled, ilvlOverride, numIdWithoutIlvl };
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
      // numId="0" explicitly disables numbering (blocks inheritance from style)
      const numPrMatch = pContent.match(/<w:numPr>([\s\S]*?)<\/w:numPr>/);
      let numInfo = null;
      let numSource = 'explicit';
      let numberingExplicitlyDisabled = false;

      if (numPrMatch) {
        const numPrContent = numPrMatch[1];
        const ilvlMatch = numPrContent.match(/<w:ilvl[^>]*w:val="(\d+)"/);
        const numIdMatch = numPrContent.match(/<w:numId[^>]*w:val="(\d+)"/);

        if (numIdMatch) {
          if (numIdMatch[1] === '0') {
            // numId="0" explicitly disables numbering - don't inherit from style
            numberingExplicitlyDisabled = true;
          } else {
            numInfo = {
              numId: numIdMatch[1],
              ilvl: ilvlMatch ? ilvlMatch[1] : '0',
              abstractNumId: this.numIdToAbstractNumId[numIdMatch[1]],
            };
          }
        }
      }

      // If no explicit numbering and not explicitly disabled, check style chain
      if (!numInfo && !numberingExplicitlyDisabled && styleId) {
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
   * Stops if a style has numberingDisabled (numId="0") which blocks inheritance
   * Handles:
   * - ilvlOverride: when a style specifies ilvl without numId, it overrides
   *   the level from the parent style while inheriting the numId
   * - numIdWithoutIlvl: when a style specifies numId without ilvl, it uses
   *   its own numId but inherits the ilvl from the parent style
   */
  _getStyleNumberingInfo(styleId, visited = new Set(), ilvlOverride = null) {
    if (!styleId || visited.has(styleId)) {
      return null;
    }
    visited.add(styleId);

    const style = this.styleDetails[styleId];
    if (!style) {
      return null;
    }

    // If this style explicitly disables numbering, stop searching
    if (style.numberingDisabled) {
      return null;
    }

    // Track ilvl override from this style (if any)
    // The first (most derived) override takes precedence
    const effectiveIlvlOverride = ilvlOverride ?? style.ilvlOverride;

    // If this style has complete numbering info, return it (with any ilvl override applied)
    if (style.numInfo) {
      return {
        numId: style.numInfo.numId,
        ilvl: effectiveIlvlOverride ?? style.numInfo.ilvl,
        fromStyle: styleId,
        ilvlOverriddenBy: effectiveIlvlOverride !== null && effectiveIlvlOverride !== style.numInfo.ilvl
          ? visited.values().next().value  // First style in the chain that had the override
          : null,
      };
    }

    // If this style has numId without ilvl, we need to get ilvl from parent chain
    if (style.numIdWithoutIlvl) {
      // Get ilvl from parent chain (either from ilvlOverride or parent's numInfo)
      const parentIlvl = this._getInheritedIlvl(style.basedOn, effectiveIlvlOverride);
      return {
        numId: style.numIdWithoutIlvl,
        ilvl: parentIlvl ?? '0',  // Default to 0 if no ilvl found in chain
        fromStyle: styleId,
        ilvlInheritedFrom: parentIlvl !== null ? 'parent' : null,
      };
    }

    // Recursively check basedOn style, passing along any ilvl override
    if (style.basedOn) {
      return this._getStyleNumberingInfo(style.basedOn, visited, effectiveIlvlOverride);
    }

    return null;
  }

  /**
   * Get inherited ilvl from parent style chain
   * Returns the first ilvlOverride or numInfo.ilvl found
   */
  _getInheritedIlvl(styleId, currentOverride = null, visited = new Set()) {
    // If we already have an override, use it
    if (currentOverride !== null) {
      return currentOverride;
    }

    if (!styleId || visited.has(styleId)) {
      return null;
    }
    visited.add(styleId);

    const style = this.styleDetails[styleId];
    if (!style) {
      return null;
    }

    // If this style has an ilvl override, return it
    if (style.ilvlOverride !== null && style.ilvlOverride !== undefined) {
      return style.ilvlOverride;
    }

    // If this style has numInfo with ilvl, return it
    if (style.numInfo?.ilvl !== undefined) {
      return style.numInfo.ilvl;
    }

    // Recursively check parent
    if (style.basedOn) {
      return this._getInheritedIlvl(style.basedOn, null, visited);
    }

    return null;
  }

  /**
   * Resolve numbering to actual string for a paragraph
   * @param {object} paragraph - Paragraph object from this.paragraphs
   * @returns {string|null} - Resolved numbering string or null
   */
  resolveNumbering(paragraph) {
    // Initialize tracking structures
    this._lastIndexPerList = this._lastIndexPerList || {};
    this._nonNumberedAfterList = this._nonNumberedAfterList || {};
    this._formatCounters = this._formatCounters || {};  // Track counter per format (for visual continuity)
    this._lastNumIdPerFormat = this._lastNumIdPerFormat || {};  // Track last numId per format
    this._lastIlvlPerNumId = this._lastIlvlPerNumId || {};  // Track last ilvl per numId for multi-level reset

    if (!paragraph.numInfo) {
      // Mark that there was a non-numbered paragraph after each active list
      for (const key of Object.keys(this._lastIndexPerList)) {
        this._nonNumberedAfterList[key] = true;
      }
      // Also mark break in format counters
      for (const key of Object.keys(this._formatCounters)) {
        this._nonNumberedAfterList[`fmt:${key}`] = true;
      }
      return null;
    }

    const { numId, ilvl, abstractNumId } = paragraph.numInfo;
    const ilvlNum = parseInt(ilvl, 10);
    const formatDef = this.abstractNumFormats[abstractNumId]?.[ilvl];

    if (!formatDef) {
      return null;
    }

    // Track counter per numId-level combination
    const counterKey = `${numId}-${ilvl}`;

    // Track format-level combination for visual continuity across different numIds
    const formatKey = `${formatDef.numFmt}-${ilvl}`;

    // Handle bullets - no counter needed
    if (formatDef.numFmt === 'bullet') {
      this._lastIndexPerList[counterKey] = paragraph.index;
      this._nonNumberedAfterList[counterKey] = false;
      this._lastIlvlPerNumId[numId] = ilvlNum;
      return '•';
    }

    // Multi-level list reset: when encountering a higher level (lower ilvl number),
    // reset all lower levels (higher ilvl numbers) in the same numId
    const lastIlvl = this._lastIlvlPerNumId[numId];
    if (lastIlvl !== undefined && ilvlNum < lastIlvl) {
      // We're at a higher level than before - reset all lower levels
      for (let lvl = ilvlNum + 1; lvl <= 9; lvl++) {
        const resetKey = `${numId}-${lvl}`;
        delete this.numberingCounters[resetKey];
      }
    }

    // Detect conditions
    const isStyleBased = paragraph.numSource && paragraph.numSource.startsWith('style:');
    const hadBreakInThisList = this._nonNumberedAfterList[counterKey] === true;
    const hadBreakInFormat = this._nonNumberedAfterList[`fmt:${formatKey}`] === true;

    // Check if a different numId with the same format was used immediately before
    // (no non-numbered paragraph in between)
    const lastNumIdForThisFormat = this._lastNumIdPerFormat[formatKey];
    const differentNumIdUsedFormat = lastNumIdForThisFormat && lastNumIdForThisFormat !== numId;
    const canContinueFromOtherNumId = differentNumIdUsedFormat && !hadBreakInFormat;

    // Determine counter value
    if (isStyleBased && canContinueFromOtherNumId) {
      // Continue from the format counter (visual list continuity)
      // Increment the shared format counter
      this._formatCounters[formatKey] = (this._formatCounters[formatKey] || formatDef.start || 1) + 1;
      this.numberingCounters[counterKey] = this._formatCounters[formatKey];
    } else if (isStyleBased && hadBreakInThisList && this.numberingCounters[counterKey] !== undefined) {
      // Reset after a break (non-numbered paragraph) in this list
      this.numberingCounters[counterKey] = formatDef.start || 1;
      this._formatCounters[formatKey] = this.numberingCounters[counterKey];
    } else if (this.numberingCounters[counterKey] === undefined) {
      // Initialize counter
      this.numberingCounters[counterKey] = formatDef.start || 1;
      this._formatCounters[formatKey] = this.numberingCounters[counterKey];
    } else {
      // Increment existing counter
      this.numberingCounters[counterKey]++;
      this._formatCounters[formatKey] = this.numberingCounters[counterKey];
    }

    // Track for this list
    this._lastIndexPerList[counterKey] = paragraph.index;
    this._nonNumberedAfterList[counterKey] = false;
    this._nonNumberedAfterList[`fmt:${formatKey}`] = false;
    this._lastNumIdPerFormat[formatKey] = numId;
    this._lastIlvlPerNumId[numId] = ilvlNum;

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
    this._lastIndexPerList = {};
    this._nonNumberedAfterList = {};
    this._formatCounters = {};
    this._lastNumIdPerFormat = {};
    this._lastIlvlPerNumId = {};
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
