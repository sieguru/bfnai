import { query } from '../config/database.js';

/**
 * Default style mappings for common Word document styles
 */
export const defaultStyleMappings = {
  'Heading 1': { headingLevel: 1, isBodyText: false },
  'Heading 2': { headingLevel: 2, isBodyText: false },
  'Heading 3': { headingLevel: 3, isBodyText: false },
  'Heading 4': { headingLevel: 4, isBodyText: false },
  'Heading 5': { headingLevel: 5, isBodyText: false },
  'Heading 6': { headingLevel: 6, isBodyText: false },
  'Rubrik 1': { headingLevel: 1, isBodyText: false },
  'Rubrik 2': { headingLevel: 2, isBodyText: false },
  'Rubrik 3': { headingLevel: 3, isBodyText: false },
  'Title': { headingLevel: 1, isBodyText: false },
  'Subtitle': { headingLevel: 2, isBodyText: false },
  'Normal': { headingLevel: null, isBodyText: true },
  'Body Text': { headingLevel: null, isBodyText: true },
  'List Paragraph': { headingLevel: null, isBodyText: true },
};

/**
 * Get style mapping from database or defaults
 */
export async function getStyleMapping(styleName) {
  // First check database for custom mapping
  const dbMapping = await query(
    'SELECT heading_level, is_body_text FROM style_mappings WHERE style_pattern = ? ORDER BY priority DESC LIMIT 1',
    [styleName]
  );

  if (dbMapping.length > 0) {
    return {
      headingLevel: dbMapping[0].heading_level,
      isBodyText: Boolean(dbMapping[0].is_body_text),
    };
  }

  // Check defaults
  if (defaultStyleMappings[styleName]) {
    return defaultStyleMappings[styleName];
  }

  // Try partial match (e.g., "Heading" prefix)
  const lowerStyle = styleName.toLowerCase();
  if (lowerStyle.includes('heading') || lowerStyle.includes('rubrik')) {
    const match = styleName.match(/\d+/);
    if (match) {
      const level = parseInt(match[0]);
      return { headingLevel: Math.min(level, 6), isBodyText: false };
    }
  }

  // Default to body text
  return { headingLevel: null, isBodyText: true };
}

/**
 * Get all style mappings from database
 */
export async function getAllStyleMappings() {
  const mappings = await query(
    'SELECT style_pattern, heading_level, is_body_text, priority FROM style_mappings ORDER BY priority DESC'
  );
  return mappings;
}

/**
 * Update or create a style mapping
 */
export async function upsertStyleMapping(stylePattern, headingLevel, isBodyText, priority = 50) {
  await query(
    `INSERT INTO style_mappings (style_pattern, heading_level, is_body_text, priority)
     VALUES (?, ?, ?, ?)
     ON DUPLICATE KEY UPDATE heading_level = ?, is_body_text = ?, priority = ?`,
    [stylePattern, headingLevel, isBodyText, priority, headingLevel, isBodyText, priority]
  );
}

/**
 * Map paragraph style to hierarchy information
 */
export function mapStyleToHierarchy(styleName, styleConfig) {
  const mapping = styleConfig[styleName] || { headingLevel: null, isBodyText: true };
  return mapping;
}
