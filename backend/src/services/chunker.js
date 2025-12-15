import { estimateTokens } from '../utils/tokenEstimator.js';
import { generateContentHash } from './documentParser.js';
import { getStyleMapping } from '../utils/styleMapping.js';

/**
 * Convert number to Roman numeral (for Avsnitt numbering)
 */
function toRomanNumeral(num) {
  const romanNumerals = [
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
 * Chapter number mapping for Swedish BFN K3 documents
 * Maps chapter titles to their numbers (38 chapters)
 */
const K3_CHAPTER_TITLE_TO_NUMBER = {
  'Tillämpning': 1,
  'Begrepp och principer': 2,
  'Utformning av de finansiella rapporterna och förvaltningsberättelsens innehåll': 3,
  'Balansräkning': 4,
  'Resultaträkning': 5,
  'Förändring i eget kapital': 6,
  'Kassaflödesanalys': 7,
  'Noter': 8,
  'Koncernredovisning och andelar i dotterföretag': 9,
  'Byte av redovisningsprincip, ändrad uppskattning och bedömning samt rättelse av fel': 10,
  'Finansiella instrument värderade utifrån anskaffningsvärdet': 11,
  'Finansiella instrument värderade enligt 4 kap. 14 a–14 e §§ årsredovisningslagen': 12,
  'Varulager': 13,
  'Intresseföretag': 14,
  'Joint venture': 15,
  'Noter om förvaltningsfastigheter': 16,
  'Materiella anläggningstillgångar': 17,
  'Immateriella tillgångar utom goodwill': 18,
  'Rörelseförvärv och goodwill': 19,
  'Leasingavtal': 20,
  'Avsättningar, eventualförpliktelser och eventualtillgångar': 21,
  'Skulder och eget kapital': 22,
  'Intäkter': 23,
  'Offentliga bidrag': 24,
  'Låneutgifter': 25,
  'Aktierelaterade ersättningar': 26,
  'Nedskrivningar': 27,
  'Ersättningar till anställda': 28,
  'Inkomstskatter': 29,
  'Effekter av ändrade valutakurser': 30,
  'Höginflationsländer': 31,
  'Händelser efter balansdagen': 32,
  'Noter om närstående': 33,
  'Jord- och skogsbruksverksamhet samt utvinning av mineraltillgångar': 34,
  'Första gången detta allmänna råd tillämpas': 35,
  'Särskilda regler för stiftelser och företag som drivs under stiftelseliknande former': 36,
  'Särskilda regler för ideella föreningar, registrerade trossamfund och liknande sammanslutningar': 37,
  'Särskilda regler för bostadsrättsföreningar': 38,
};

/**
 * Chapter number mapping for Swedish BFN K2 documents
 * Maps chapter titles to their numbers (21 chapters)
 * K2 chapters are at Rubrik 3 level (below Avsnitt at Rubrik 2)
 */
const K2_CHAPTER_TITLE_TO_NUMBER = {
  'Tillämpning': 1,
  'Redovisningsprinciper': 2,
  'Årsredovisningens utformning': 3,
  'Uppställningsformer för årsredovisningen': 4,
  'Förvaltningsberättelsen': 5,
  'Rörelseintäkter': 6,
  'Rörelsekostnader': 7,
  'Finansiella poster m.m.': 8,
  'Tillgångar': 9,
  'Immateriella och materiella anläggningstillgångar': 10,
  'Finansiella anläggningstillgångar': 11,
  'Varulager': 12,
  'Kortfristiga fordringar': 13,
  'Kortfristiga placeringar inklusive kassa och bank': 14,
  'Eget kapital och obeskattade reserver': 15,
  'Avsättningar': 16,
  'Skulder': 17,
  'Noter': 18,
  'Särskilda regler för koncerner/intresseföretag': 19,
  'Särskilda regler vid byte till detta allmänna råd': 20,
  'Frivilligt upprättad kassaflödesanalys': 21,
};

/**
 * K2 Avsnitt (Section) mapping - 9 sections at Rubrik 2 level
 */
const K2_AVSNITT_TITLES = [
  'Tillämpningar och principer',
  'Årsredovisningens utformning',
  'Förvaltningsberättelsen',
  'Resultaträkning',
  'Balansräkning',
  'Noter',
  'Särskilda regler för koncerner/intresseföretag',
  'Särskilda regler vid byte till detta allmänna råd',
  'Frivilligt upprättad kassaflödesanalys',
];

/**
 * Main function to chunk a document based on number-based hierarchy
 * Uses chapter numbers and "allmänt råd" point numbering
 * Returns both chunks and the hierarchy structure
 */
export async function chunkDocument(parsedDoc, styleMapping = {}, config = {}) {
  const settings = { ...defaultConfig, ...config };
  const { paragraphs } = parsedDoc;

  if (!paragraphs || paragraphs.length === 0) {
    return { chunks: [], hierarchy: null };
  }

  // Build number-based hierarchy from paragraphs
  const hierarchy = await buildNumberBasedHierarchy(paragraphs, styleMapping);

  // Create chunks respecting hierarchy and size limits
  const chunks = createChunks(hierarchy, settings);

  return { chunks, hierarchy };
}

/**
 * Styles that indicate document part headings (Rubrik 1) - K2 Level 0
 * Major document divisions like "Lagregler, allmänna råd..."
 */
const DOCUMENT_PART_STYLES = ['Rubrik 1 indrag', 'Rubrik 1', 'heading 1'];

/**
 * Styles that indicate Avsnitt/Section headings (Rubrik 2) - K2 Level 1
 * K2: Avsnitt (Section) level - 9 sections (Avsnitt I-IX)
 * K3: Chapter level
 */
const AVSNITT_STYLES = ['Rubrik 2 indrag', 'Rubrik 2', 'heading 2'];

/**
 * Styles that indicate Kapitel/Chapter headings (Rubrik 3) - K2 Level 2
 * K2: Kapitel (Chapter) level - 21 chapters
 * K3: Section level
 */
const KAPITEL_STYLES = ['Rubrik 3 indrag', 'Rubrik 3', 'heading 3'];

/**
 * Styles that indicate subsection headings (Rubrik 4) - K2 Level 3
 */
const SUBSECTION_STYLES = ['Rubrik 4 indrag', 'Rubrik 4', 'heading 4'];

/**
 * Styles that indicate punkt reference headings (Rubrik 5) - K2 Level 4
 * K2 uses these to explicitly reference punkt numbers (e.g., "Punkt 1.1A")
 */
const PUNKT_HEADING_STYLES = ['Rubrik 5 indrag', 'Rubrik 5', 'heading 5'];

/**
 * Styles that indicate term definition headings (Rubrik 6) - K2 Level 5
 * Specific terms within sections (e.g., "Nettoomsättning", "Ekonomiska föreningar")
 */
const TERM_DEFINITION_STYLES = ['Rubrik 6 indrag', 'Rubrik 6', 'heading 6'];

/**
 * Styles that indicate content type markers (Allmänt råd, Kommentar, Lagtext)
 * K3: 'Rubrik 6 - spaltrubrik', K2: 'Spalttext'
 */
const CONTENT_TYPE_MARKER_STYLES = ['Rubrik 6 - spaltrubrik', 'Spalttext'];

/**
 * Styles that contain "Allmänt råd" body text
 */
const ALLMANT_RAD_BODY_STYLES = [
  'Allmänt råd',
  'Stycke 1',
  'Stycke 1 indrag',
  'Stycke 1 indrag inget avstånd',
  'Stycke 1A indrag', // K2 specific
  'Bokstavslista 1 indrag',
  'Bokstavlista 2 indrag', // K2 specific
];

/**
 * Styles that contain "Kommentar" body text
 */
const KOMMENTAR_BODY_STYLES = [
  'Normal Indent',
  'Normal indrag ej avstånd',
  'Punktlista indrag',
  'Punktlista 2 indrag', // K2 specific
];

/**
 * Styles that contain "Lagtext" body text
 */
const LAGTEXT_BODY_STYLES = [
  'Textruta indrag',
  'Numrerad lista textruta',
];

/**
 * Styles to ignore (TOC, titles, metadata, examples)
 */
const IGNORE_STYLES = [
  'toc 1', 'toc 2', 'toc 3', 'toc 4', 'toc 6', 'toc 7',
  'TOC Heading',
  'Title', 'Subtitle',
  'Uppdaterad datum',
  'Rubrik 2 exempel indrag', 'Rubrik 3 exempel indrag',
  'Rubrik 4 exempel indrag', 'Rubrik 5 exempel indrag', // Example sections
];

/**
 * Build a number-based hierarchical structure from paragraphs
 * Supports both K2 and K3 document structures
 *
 * K2 Document Hierarchy (6 levels):
 * - Level 0: Document Parts (Rubrik 1 indrag) - "Lagregler, allmänna råd..."
 * - Level 1: Avsnitt/Sections (Rubrik 2 indrag) - 9 sections (Avsnitt I-IX)
 * - Level 2: Kapitel/Chapters (Rubrik 3 indrag) - 21 chapters
 * - Level 3: Subsections (Rubrik 4 indrag)
 * - Level 4: Punkt References (Rubrik 5 indrag) - "Punkt 1.1A"
 * - Level 5: Term Definitions (Rubrik 6 indrag) - "Nettoomsättning"
 *
 * Key rules (from BFN K2 document structure):
 * - Punkt numbers come ONLY from explicit Rubrik 5 headings (e.g., "Punkt 1.1A")
 * - Paragraphs without a punkt number are parts of the preceding punkt
 * - Comments (Kommentar) are associated with the most recent "Allmänt råd group"
 */
export async function buildNumberBasedHierarchy(paragraphs, styleMapping = {}) {
  const root = {
    children: [],
    level: 0,
    text: '',
    paragraphs: [],
    chapterNumber: null,
    pointNumber: null,
  };

  // K2 hierarchy tracking (6 levels)
  let currentDocumentPart = null; // Level 0 - Rubrik 1
  let currentAvsnitt = null;       // Level 1 - Rubrik 2 (Avsnitt/Section)
  let currentKapitel = null;       // Level 2 - Rubrik 3 (Kapitel/Chapter)
  let currentSubsection = null;    // Level 3 - Rubrik 4
  let currentPunktRef = null;      // Level 4 - Rubrik 5 (explicit punkt headings)
  let currentTermDef = null;       // Level 5 - Rubrik 6 (term definitions)

  let currentChapterNumber = 0;
  let currentAvsnittNumber = 0;
  let currentContentType = null;     // 'allmänt råd', 'kommentar', 'lagtext', or null
  let currentAllmantRadGroup = null; // Track the current "Allmänt råd group" for associating comments
  let lastExplicitPunkt = null;      // Track explicit punkt number from Rubrik 5 headings

  for (const para of paragraphs) {
    const style = para.style;
    const text = para.text.trim();

    // Skip ignored styles
    if (IGNORE_STYLES.some(s => style.toLowerCase().includes(s.toLowerCase()))) {
      continue;
    }

    // Skip empty paragraphs
    if (!text) {
      continue;
    }

    // Level 0: Document Parts (Rubrik 1) - Major divisions
    if (DOCUMENT_PART_STYLES.some(s => style === s)) {
      currentDocumentPart = {
        level: 0,
        text: text,
        style: style,
        paragraphIndex: para.index,
        children: [],
        paragraphs: [],
        nodeType: 'documentPart',
      };

      root.children.push(currentDocumentPart);
      // Reset all lower levels
      currentAvsnitt = null;
      currentKapitel = null;
      currentSubsection = null;
      currentPunktRef = null;
      currentTermDef = null;
      currentContentType = null;
      currentAllmantRadGroup = null;
      lastExplicitPunkt = null;
      continue;
    }

    // Level 1: Avsnitt/Section (Rubrik 2) - K2 has 9 Avsnitt
    if (AVSNITT_STYLES.some(s => style === s)) {
      currentAvsnittNumber++;
      currentAvsnitt = {
        level: 1,
        text: text,
        style: style,
        paragraphIndex: para.index,
        children: [],
        paragraphs: [],
        nodeType: 'avsnitt',
        avsnittNumber: currentAvsnittNumber,
        avsnittTitle: `Avsnitt ${toRomanNumeral(currentAvsnittNumber)} – ${text}`,
      };

      if (currentDocumentPart) {
        currentDocumentPart.children.push(currentAvsnitt);
      } else {
        root.children.push(currentAvsnitt);
      }
      // Reset lower levels
      currentKapitel = null;
      currentSubsection = null;
      currentPunktRef = null;
      currentTermDef = null;
      currentContentType = null;
      currentAllmantRadGroup = null;
      lastExplicitPunkt = null;
      continue;
    }

    // Level 2: Kapitel/Chapter (Rubrik 3) - K2 has 21 chapters
    if (KAPITEL_STYLES.some(s => style === s)) {
      // Try to find chapter number from K2 mapping, fallback to K3, then auto-increment
      const chapterNum = K2_CHAPTER_TITLE_TO_NUMBER[text] ||
                         K3_CHAPTER_TITLE_TO_NUMBER[text] ||
                         ++currentChapterNumber;

      currentKapitel = {
        level: 2,
        text: text,
        style: style,
        paragraphIndex: para.index,
        children: [],
        paragraphs: [],
        nodeType: 'kapitel',
        chapterNumber: chapterNum,
        chapterTitle: `Kapitel ${chapterNum} – ${text}`,
      };

      if (currentAvsnitt) {
        currentAvsnitt.children.push(currentKapitel);
      } else if (currentDocumentPart) {
        currentDocumentPart.children.push(currentKapitel);
      } else {
        root.children.push(currentKapitel);
      }
      // Reset lower levels
      currentSubsection = null;
      currentPunktRef = null;
      currentTermDef = null;
      currentContentType = null;
      currentAllmantRadGroup = null;
      lastExplicitPunkt = null;
      continue;
    }

    // Level 3: Subsection (Rubrik 4)
    if (SUBSECTION_STYLES.some(s => style === s)) {
      currentSubsection = {
        level: 3,
        text: text,
        style: style,
        paragraphIndex: para.index,
        children: [],
        paragraphs: [],
        nodeType: 'subsection',
      };

      if (currentKapitel) {
        currentKapitel.children.push(currentSubsection);
      } else if (currentAvsnitt) {
        currentAvsnitt.children.push(currentSubsection);
      } else if (currentDocumentPart) {
        currentDocumentPart.children.push(currentSubsection);
      } else {
        root.children.push(currentSubsection);
      }
      // Reset lower levels
      currentPunktRef = null;
      currentTermDef = null;
      currentContentType = null;
      continue;
    }

    // Level 4: Punkt Reference (Rubrik 5) - ONLY source of explicit punkt numbers
    if (PUNKT_HEADING_STYLES.some(s => style === s)) {
      // Extract punkt number from text like "Punkt 1.1A" or "Punkt 1.1B a"
      const punktMatch = text.match(/^Punkt\s+(\d+\.\d+[A-Z]?)/i);
      if (punktMatch) {
        lastExplicitPunkt = punktMatch[1];
      }

      currentPunktRef = {
        level: 4,
        text: text,
        style: style,
        paragraphIndex: para.index,
        children: [],
        paragraphs: [],
        nodeType: 'punktRef',
        explicitPunktRef: punktMatch ? punktMatch[1] : null,
      };

      if (currentSubsection) {
        currentSubsection.children.push(currentPunktRef);
      } else if (currentKapitel) {
        currentKapitel.children.push(currentPunktRef);
      } else if (currentAvsnitt) {
        currentAvsnitt.children.push(currentPunktRef);
      } else if (currentDocumentPart) {
        currentDocumentPart.children.push(currentPunktRef);
      } else {
        root.children.push(currentPunktRef);
      }
      // Reset lower levels
      currentTermDef = null;
      currentContentType = null;
      continue;
    }

    // Level 5: Term Definition (Rubrik 6) - Specific terms like "Nettoomsättning"
    if (TERM_DEFINITION_STYLES.some(s => style === s)) {
      currentTermDef = {
        level: 5,
        text: text,
        style: style,
        paragraphIndex: para.index,
        children: [],
        paragraphs: [],
        nodeType: 'termDefinition',
      };

      if (currentPunktRef) {
        currentPunktRef.children.push(currentTermDef);
      } else if (currentSubsection) {
        currentSubsection.children.push(currentTermDef);
      } else if (currentKapitel) {
        currentKapitel.children.push(currentTermDef);
      } else if (currentAvsnitt) {
        currentAvsnitt.children.push(currentTermDef);
      } else if (currentDocumentPart) {
        currentDocumentPart.children.push(currentTermDef);
      } else {
        root.children.push(currentTermDef);
      }
      currentContentType = null;
      continue;
    }

    // Check if this is a content type marker (Allmänt råd, Kommentar, Lagtext)
    if (CONTENT_TYPE_MARKER_STYLES.some(s => style === s)) {
      const lowerText = text.toLowerCase();
      if (lowerText === 'allmänt råd') {
        currentContentType = 'allmänt råd';
        // Start a new "Allmänt råd group" - use the last explicit punkt if available
        currentAllmantRadGroup = {
          punktNumber: lastExplicitPunkt,
          startedAt: para.index,
        };
      } else if (lowerText === 'kommentar') {
        currentContentType = 'kommentar';
        // Kommentar is associated with the current Allmänt råd group
      } else if (lowerText === 'lagtext') {
        currentContentType = 'lagtext';
      } else {
        currentContentType = text; // Other markers
      }
      continue;
    }

    // This is body text - determine where to add it
    const isAllmantRadBody = ALLMANT_RAD_BODY_STYLES.some(s => style === s);
    const isKommentarBody = KOMMENTAR_BODY_STYLES.some(s => style === s);
    const isLagtextBody = LAGTEXT_BODY_STYLES.some(s => style === s);

    // Determine the content type from style if not already set
    let effectiveContentType = currentContentType;
    if (isAllmantRadBody && !effectiveContentType) {
      effectiveContentType = 'allmänt råd';
      // If no current group, start one (continuation of previous punkt)
      if (!currentAllmantRadGroup) {
        currentAllmantRadGroup = {
          punktNumber: lastExplicitPunkt,
          startedAt: para.index,
        };
      }
    } else if (isKommentarBody && !effectiveContentType) {
      effectiveContentType = 'kommentar';
    } else if (isLagtextBody && !effectiveContentType) {
      effectiveContentType = 'lagtext';
    }

    // Get punkt number - use explicit punkt if available, otherwise inherit from group
    const currentPunktNumber = currentAllmantRadGroup?.punktNumber || lastExplicitPunkt;

    // Create paragraph entry with metadata
    const paraEntry = {
      index: para.index,
      text: text,
      style: style,
      contentType: effectiveContentType,
      // For allmänt råd: use the current explicit punkt (paragraphs without punkt are part of preceding punkt)
      pointNumber: effectiveContentType === 'allmänt råd' ? currentPunktNumber : null,
      // For kommentar: associate with the current Allmänt råd group
      associatedGroup: effectiveContentType === 'kommentar' ? currentPunktNumber : null,
    };

    // Add to the deepest available hierarchy node
    // Priority: termDef > punktRef > subsection > kapitel > avsnitt > documentPart > root
    if (currentTermDef) {
      currentTermDef.paragraphs.push(paraEntry);
    } else if (currentPunktRef) {
      currentPunktRef.paragraphs.push(paraEntry);
    } else if (currentSubsection) {
      currentSubsection.paragraphs.push(paraEntry);
    } else if (currentKapitel) {
      currentKapitel.paragraphs.push(paraEntry);
    } else if (currentAvsnitt) {
      currentAvsnitt.paragraphs.push(paraEntry);
    } else if (currentDocumentPart) {
      currentDocumentPart.paragraphs.push(paraEntry);
    } else {
      root.paragraphs.push(paraEntry);
    }
  }

  return root;
}

/**
 * Build a hierarchical structure from paragraphs based on styles (legacy)
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
 * Create chunks from number-based hierarchical structure
 * Groups content by "allmänt råd" points and their associated comments
 * Supports K2 hierarchy (6 levels)
 */
function createChunks(hierarchy, settings) {
  const chunks = [];
  let chunkIndex = 0;

  function processNode(node, context = {}) {
    // Build context from node
    const currentContext = { ...context };

    // Update context based on node properties and type
    // K2 hierarchy: documentPart > avsnitt > kapitel > subsection > punktRef > termDefinition
    if (node.nodeType === 'documentPart') {
      currentContext.documentPart = node.text;
    }
    if (node.nodeType === 'avsnitt' || node.avsnittNumber) {
      currentContext.avsnittNumber = node.avsnittNumber;
      currentContext.avsnittTitle = node.avsnittTitle || node.text;
    }
    if (node.nodeType === 'kapitel' || node.chapterNumber) {
      currentContext.chapterNumber = node.chapterNumber;
      currentContext.chapterTitle = node.chapterTitle || node.text;
    }
    if (node.nodeType === 'subsection' || node.level === 3) {
      currentContext.subsectionTitle = node.text;
    }
    if (node.nodeType === 'punktRef' || node.explicitPunktRef) {
      currentContext.explicitPunktRef = node.explicitPunktRef;
    }
    if (node.nodeType === 'termDefinition') {
      currentContext.termDefinition = node.text;
    }

    // Group paragraphs by point number (for "allmänt råd" + associated "kommentar")
    const pointGroups = groupParagraphsByPoint(node.paragraphs);

    for (const group of pointGroups) {
      const bodyText = group.paragraphs.map(p => p.text).join('\n\n');
      if (!bodyText.trim()) continue;

      const tokens = estimateTokens(bodyText);
      const paragraphRange = {
        start: group.paragraphs[0]?.index ?? -1,
        end: group.paragraphs[group.paragraphs.length - 1]?.index ?? -1,
      };

      // Build hierarchy path using numbers
      const hierarchyPath = buildNumberBasedPath(currentContext, group);

      if (tokens > settings.maxChunkTokens) {
        // Split into smaller chunks
        const subChunks = splitContentWithContext(bodyText, settings, hierarchyPath, group.paragraphs, group);
        subChunks.forEach(subChunk => {
          chunks.push({
            ...subChunk,
            chunkIndex: chunkIndex++,
          });
        });
      } else if (tokens >= settings.minChunkTokens || group.pointNumber) {
        // Create a single chunk (always include if it has a point number)
        chunks.push({
          chunkIndex: chunkIndex++,
          content: bodyText.trim(),
          hierarchyPath: hierarchyPath.join(' > '),
          hierarchyJson: hierarchyPath,
          hierarchyLevel: hierarchyPath.length,
          paragraphStart: paragraphRange.start,
          paragraphEnd: paragraphRange.end,
          tokenEstimate: tokens,
          contentLength: bodyText.length,
          chunkHash: generateContentHash(bodyText),
          pointNumber: group.pointNumber,
          contentTypes: group.contentTypes,
        });
      }
    }

    // Process child sections
    node.children.forEach(child => processNode(child, currentContext));
  }

  processNode(hierarchy);

  // Handle small remaining content by merging with previous chunk if possible
  return mergeSmallChunks(chunks, settings);
}

/**
 * Group paragraphs by "Allmänt råd group"
 * Groups allmänt råd with their associated kommentar sections
 *
 * Key rules (from BFN K2 document structure):
 * - Comments are associated with the most recent "Allmänt råd group"
 * - Paragraphs without explicit punkt numbers are part of the preceding punkt
 * - Lagtext and other content types are grouped separately
 */
function groupParagraphsByPoint(paragraphs) {
  const groups = [];
  let currentGroup = null;
  let currentAllmantRadGroup = null; // Track the current Allmänt råd group for associating comments

  for (const para of paragraphs) {
    const pointNumber = para.pointNumber || para.associatedGroup;

    if (para.contentType === 'allmänt råd') {
      // Start or continue an "Allmänt råd group"
      if (!currentAllmantRadGroup || (para.pointNumber && para.pointNumber !== currentAllmantRadGroup.pointNumber)) {
        // Start a new Allmänt råd group
        if (currentGroup && currentGroup.paragraphs.length > 0) {
          groups.push(currentGroup);
        }
        currentGroup = {
          pointNumber: para.pointNumber,
          contentTypes: new Set(['allmänt råd']),
          paragraphs: [para],
          isAllmantRadGroup: true,
        };
        currentAllmantRadGroup = currentGroup;
      } else {
        // Continue existing Allmänt råd group (paragraph without explicit punkt)
        currentGroup.paragraphs.push(para);
        if (para.contentType) {
          currentGroup.contentTypes.add(para.contentType);
        }
      }
    } else if (para.contentType === 'kommentar') {
      // Kommentar is associated with the current Allmänt råd group
      if (currentAllmantRadGroup) {
        currentAllmantRadGroup.paragraphs.push(para);
        currentAllmantRadGroup.contentTypes.add('kommentar');
        // Keep currentGroup pointing to the Allmänt råd group
        currentGroup = currentAllmantRadGroup;
      } else {
        // No Allmänt råd group yet - start a standalone kommentar group
        if (currentGroup && currentGroup.paragraphs.length > 0 && !currentGroup.isAllmantRadGroup) {
          // Add to existing non-allmänt-råd group
          currentGroup.paragraphs.push(para);
          currentGroup.contentTypes.add('kommentar');
        } else {
          if (currentGroup && currentGroup.paragraphs.length > 0) {
            groups.push(currentGroup);
          }
          currentGroup = {
            pointNumber: pointNumber || null,
            contentTypes: new Set(['kommentar']),
            paragraphs: [para],
          };
        }
      }
    } else if (para.contentType === 'lagtext') {
      // Lagtext is typically standalone or precedes Allmänt råd
      if (currentGroup && currentGroup.paragraphs.length > 0) {
        groups.push(currentGroup);
      }
      currentGroup = {
        pointNumber: pointNumber || null,
        contentTypes: new Set(['lagtext']),
        paragraphs: [para],
      };
      // Reset Allmänt råd group when we see Lagtext (it typically starts a new section)
      currentAllmantRadGroup = null;
    } else {
      // Other content - add to current group or start new one
      if (currentGroup && !currentGroup.isAllmantRadGroup) {
        currentGroup.paragraphs.push(para);
        if (para.contentType) {
          currentGroup.contentTypes.add(para.contentType);
        }
      } else {
        if (currentGroup && currentGroup.paragraphs.length > 0) {
          groups.push(currentGroup);
        }
        currentGroup = {
          pointNumber: pointNumber || null,
          contentTypes: new Set(para.contentType ? [para.contentType] : []),
          paragraphs: [para],
        };
      }
    }
  }

  if (currentGroup && currentGroup.paragraphs.length > 0) {
    groups.push(currentGroup);
  }

  // Convert Sets to arrays for JSON serialization
  return groups.map(g => ({
    pointNumber: g.pointNumber,
    contentTypes: Array.from(g.contentTypes),
    paragraphs: g.paragraphs,
  }));
}

/**
 * Build a number-based hierarchy path for K2 documents
 * Format: Kapitel [N] > [Kapitel Title] > [Subsection Title] > punkt [N.MA] > [content types]
 *
 * K2 hierarchy levels:
 * - Level 0: Document Parts (optional, rarely used in path)
 * - Level 1: Avsnitt (Section) - Avsnitt I-IX
 * - Level 2: Kapitel (Chapter) - Kapitel 1-21
 * - Level 3: Subsections
 * - Level 4: Punkt References
 * - Level 5: Term Definitions
 */
function buildNumberBasedPath(context, group) {
  const path = [];

  // Add Kapitel (Chapter) with number - primary identifier
  if (context.chapterNumber) {
    path.push(`Kapitel ${context.chapterNumber}`);

    // Add chapter title if different from just the number
    if (context.chapterTitle && !context.chapterTitle.startsWith('Kapitel')) {
      path.push(context.chapterTitle);
    }
  }

  // Add subsection title if available
  if (context.subsectionTitle) {
    path.push(context.subsectionTitle);
  }

  // Add term definition if available
  if (context.termDefinition) {
    path.push(context.termDefinition);
  }

  // Add point number - use explicit punkt ref from context or from group
  const punktNumber = context.explicitPunktRef || group.pointNumber;
  if (punktNumber) {
    path.push(`punkt ${punktNumber}`);
  }

  // Add content type indicators
  if (group.contentTypes && group.contentTypes.length > 0) {
    const types = group.contentTypes.join(', ');
    path.push(`[${types}]`);
  }

  return path;
}

/**
 * Split large content into smaller chunks (with context)
 */
function splitContentWithContext(text, settings, hierarchyPath, paragraphs, group) {
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
        pointNumber: group.pointNumber,
        contentTypes: group.contentTypes,
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
      pointNumber: group.pointNumber,
      contentTypes: group.contentTypes,
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
