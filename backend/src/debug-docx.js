#!/usr/bin/env node
/**
 * Debug utility to extract paragraph, style, and numbering info from a .docx file
 * Usage: node src/debug-docx.js <path-to-docx> [output-file]
 */

import { writeFile } from 'fs/promises';
import { tmpdir } from 'os';
import { join } from 'path';
import { DocxExtractor } from './services/DocxExtractor.js';

/**
 * Format the extracted data for debug output
 */
function formatOutput(extractor, filePath) {
  const output = [];
  output.push(`=== DOCX Analysis: ${filePath} ===`);
  output.push(`Generated: ${new Date().toISOString()}\n`);

  // Numbering definitions
  const { abstractNumFormats, numIdToAbstractNumId } = extractor.getNumberingDefinitions();

  output.push('=== NUMBERING DEFINITIONS (from word/numbering.xml) ===\n');

  for (const [abstractNumId, levels] of Object.entries(abstractNumFormats)) {
    if (Object.keys(levels).length === 0) {
      output.push(`  AbstractNum ${abstractNumId}: (no levels - may be linked)`);
    } else {
      output.push(`  AbstractNum ${abstractNumId}:`);
      for (const [level, def] of Object.entries(levels)) {
        output.push(`    Level ${level}: format="${def.numFmt}", text="${def.lvlText}", start=${def.start}`);
      }
    }
  }

  output.push('\n  NumId -> AbstractNumId mappings:');
  for (const [numId, abstractNumId] of Object.entries(numIdToAbstractNumId)) {
    output.push(`    numId ${numId} -> abstractNumId ${abstractNumId}`);
  }
  output.push('');

  // Styles
  const styles = extractor.getParagraphStyles();

  output.push('=== STYLES (from word/styles.xml) ===\n');

  for (const [styleId, style] of Object.entries(styles)) {
    let line = `  [${styleId}] "${style.name}"`;
    if (style.basedOn) line += ` (based on: ${style.basedOn})`;
    if (style.outlineLevel !== null) line += ` [outline level: ${style.outlineLevel}]`;

    if (style.numberingDisabled) {
      line += ` {NUMBERING DISABLED}`;
    } else if (style.numInfo) {
      const abstractNumId = numIdToAbstractNumId[style.numInfo.numId];
      const formatDef = abstractNumFormats[abstractNumId]?.[style.numInfo.ilvl];
      line += ` {numId=${style.numInfo.numId}, level=${style.numInfo.ilvl}`;
      if (formatDef) {
        line += `, fmt="${formatDef.numFmt}", text="${formatDef.lvlText}"`;
      }
      line += `}`;
    } else if (style.numIdWithoutIlvl) {
      line += ` {numId=${style.numIdWithoutIlvl}, ilvl INHERITED from parent}`;
    } else if (style.ilvlOverride !== null && style.ilvlOverride !== undefined) {
      line += ` {ilvl OVERRIDE: ${style.ilvlOverride} (inherits numId from parent)}`;
    }

    output.push(line);
  }
  output.push('');

  // Paragraphs
  output.push('=== PARAGRAPHS (from word/document.xml) ===\n');

  const paragraphs = extractor.getParagraphs();
  let numberedCount = 0;

  for (const para of paragraphs) {
    // TODO: Temporarily restrict to paragraphs with numbering only
    if (!para.numInfo) continue;

    numberedCount++;

    const styleName = para.styleName || '(no style)';
    output.push(`[${para.index.toString().padStart(4, '0')}] Style: "${styleName}" (id: ${para.styleId || 'none'})`);

    output.push(`       Numbering [${para.numSource}]: numId=${para.numInfo.numId}, level=${para.numInfo.ilvl}, abstractNumId=${para.numInfo.abstractNumId}`);

    if (para.formatDef) {
      output.push(`       Format: ${para.formatDef.numFmt}, text="${para.formatDef.lvlText}", start=${para.formatDef.start}`);
    }

    // Resolve numbering
    const resolved = extractor.resolveNumbering(para);
    if (resolved) {
      output.push(`       >>> Resolved: "${resolved}"`);
    }

    // Format text - replace tabs with visible arrow
    const visibleText = para.text.replace(/\t/g, '→');
    const truncatedText = visibleText.length > 80 ? visibleText.substring(0, 80) + '...' : visibleText;
    output.push(`       Text: "${truncatedText}"`);
    output.push('');
  }

  output.push(`\nTotal paragraphs: ${paragraphs.length}`);
  output.push(`Paragraphs with numbering: ${numberedCount}`);

  return output.join('\n');
}

async function main() {
  const args = process.argv.slice(2);

  if (args.length < 1) {
    console.error('Usage: node src/debug-docx.js <path-to-docx> [output-file]');
    console.error('');
    console.error('Examples:');
    console.error('  node src/debug-docx.js ./uploads/document.docx');
    console.error('  node src/debug-docx.js ./uploads/document.docx ./debug-output.txt');
    process.exit(1);
  }

  const inputFile = args[0];
  const outputFile = args[1] || join(tmpdir(), `docx-debug-${Date.now()}.txt`);

  try {
    console.log(`Analyzing: ${inputFile}`);

    const extractor = new DocxExtractor();
    await extractor.load(inputFile);

    const result = formatOutput(extractor, inputFile);

    await writeFile(outputFile, result, 'utf-8');
    console.log(`Output written to: ${outputFile}`);

    // Also print to console if no output file was specified
    if (!args[1]) {
      console.log('\n' + result);
    }
  } catch (error) {
    console.error('Error:', error.message);
    process.exit(1);
  }
}

main();
