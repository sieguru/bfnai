import { query, queryOne, insert, update } from '../config/database.js';

export const DocumentStatus = {
  PENDING: 'pending',
  PROCESSING: 'processing',
  COMPLETED: 'completed',
  ERROR: 'error',
};

/**
 * Create a new document record
 */
export async function createDocument(data) {
  const id = await insert(
    `INSERT INTO documents (filename, original_name, file_size, status, metadata)
     VALUES (?, ?, ?, ?, ?)`,
    [
      data.filename,
      data.originalName,
      data.fileSize || null,
      data.status || DocumentStatus.PENDING,
      JSON.stringify(data.metadata || {}),
    ]
  );
  return id;
}

/**
 * Get document by ID
 */
export async function getDocumentById(id) {
  return queryOne('SELECT * FROM documents WHERE id = ?', [id]);
}

/**
 * Get all documents
 */
export async function getAllDocuments(options = {}) {
  const { status, limit = 100, offset = 0 } = options;

  let sql = 'SELECT * FROM documents';
  const params = [];

  if (status) {
    sql += ' WHERE status = ?';
    params.push(status);
  }

  // Inline LIMIT/OFFSET to avoid mysql2 prepared statement issues
  sql += ` ORDER BY created_at DESC LIMIT ${parseInt(limit)} OFFSET ${parseInt(offset)}`;

  return query(sql, params);
}

/**
 * Update document status
 */
export async function updateDocumentStatus(id, status, errorMessage = null) {
  const updates = ['status = ?'];
  const params = [status];

  if (status === DocumentStatus.COMPLETED) {
    updates.push('processed_date = NOW()');
  }

  if (errorMessage) {
    updates.push('error_message = ?');
    params.push(errorMessage);
  }

  params.push(id);

  return update(
    `UPDATE documents SET ${updates.join(', ')} WHERE id = ?`,
    params
  );
}

/**
 * Update document metadata
 */
export async function updateDocumentMetadata(id, metadata) {
  return update(
    'UPDATE documents SET metadata = ? WHERE id = ?',
    [JSON.stringify(metadata), id]
  );
}

/**
 * Delete document
 */
export async function deleteDocument(id) {
  return update('DELETE FROM documents WHERE id = ?', [id]);
}

/**
 * Get document count by status
 */
export async function getDocumentStats() {
  const stats = await query(
    `SELECT status, COUNT(*) as count FROM documents GROUP BY status`
  );

  const result = {
    total: 0,
    pending: 0,
    processing: 0,
    completed: 0,
    error: 0,
  };

  stats.forEach(row => {
    result[row.status] = row.count;
    result.total += row.count;
  });

  return result;
}

/**
 * Save detected styles for a document
 */
export async function saveDocumentStyles(documentId, styles) {
  // Clear existing styles
  await update('DELETE FROM document_styles WHERE document_id = ?', [documentId]);

  // Insert new styles
  for (const style of styles) {
    await insert(
      `INSERT INTO document_styles (document_id, style_name, occurrence_count, sample_text)
       VALUES (?, ?, ?, ?)`,
      [documentId, style.styleName, style.occurrenceCount, style.sampleText]
    );
  }
}

/**
 * Get styles for a document
 */
export async function getDocumentStyles(documentId) {
  return query(
    'SELECT * FROM document_styles WHERE document_id = ? ORDER BY occurrence_count DESC',
    [documentId]
  );
}

/**
 * Update style configuration for a document
 */
export async function updateDocumentStyleConfig(documentId, styleName, headingLevel, isConfigured = true) {
  return update(
    `UPDATE document_styles SET heading_level = ?, is_configured = ?
     WHERE document_id = ? AND style_name = ?`,
    [headingLevel, isConfigured, documentId, styleName]
  );
}
