import { query, queryOne, insert, update } from '../config/database.js';

/**
 * Create a new chunk
 */
export async function createChunk(data) {
  const id = await insert(
    `INSERT INTO chunks (
      document_id, chunk_index, chunk_hash, content, content_length,
      token_estimate, hierarchy_path, hierarchy_json, hierarchy_level,
      paragraph_start, paragraph_end, metadata
    ) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)`,
    [
      data.documentId,
      data.chunkIndex,
      data.chunkHash,
      data.content,
      data.contentLength,
      data.tokenEstimate,
      data.hierarchyPath,
      JSON.stringify(data.hierarchyJson || []),
      data.hierarchyLevel,
      data.paragraphStart,
      data.paragraphEnd,
      JSON.stringify(data.metadata || {}),
    ]
  );
  return id;
}

/**
 * Create multiple chunks in batch
 */
export async function createChunks(chunks) {
  const ids = [];
  for (const chunk of chunks) {
    const id = await createChunk(chunk);
    ids.push(id);
  }
  return ids;
}

/**
 * Get chunk by ID
 */
export async function getChunkById(id) {
  return queryOne('SELECT * FROM chunks WHERE id = ?', [id]);
}

/**
 * Get chunks by document ID
 */
export async function getChunksByDocumentId(documentId, options = {}) {
  const { limit = 1000, offset = 0 } = options;

  return query(
    `SELECT * FROM chunks WHERE document_id = ?
     ORDER BY chunk_index ASC LIMIT ${parseInt(limit)} OFFSET ${parseInt(offset)}`,
    [documentId]
  );
}

/**
 * Get all chunks with pagination
 */
export async function getAllChunks(options = {}) {
  const { documentId, limit = 100, offset = 0 } = options;

  let sql = `
    SELECT c.*, d.original_name as document_name
    FROM chunks c
    JOIN documents d ON c.document_id = d.id
  `;
  const params = [];

  if (documentId) {
    sql += ' WHERE c.document_id = ?';
    params.push(documentId);
  }

  sql += ` ORDER BY c.document_id, c.chunk_index LIMIT ${parseInt(limit)} OFFSET ${parseInt(offset)}`;

  return query(sql, params);
}

/**
 * Update chunk vector information
 */
export async function updateChunkVector(id, vectorId, embeddingModel) {
  return update(
    `UPDATE chunks SET vector_id = ?, embedded_at = NOW(), embedding_model = ? WHERE id = ?`,
    [vectorId, embeddingModel, id]
  );
}

/**
 * Delete chunks by document ID
 */
export async function deleteChunksByDocumentId(documentId) {
  return update('DELETE FROM chunks WHERE document_id = ?', [documentId]);
}

/**
 * Get chunk count by document
 */
export async function getChunkCountByDocument(documentId) {
  const result = await queryOne(
    'SELECT COUNT(*) as count FROM chunks WHERE document_id = ?',
    [documentId]
  );
  return result?.count || 0;
}

/**
 * Get chunk statistics
 */
export async function getChunkStats() {
  const stats = await queryOne(`
    SELECT
      COUNT(*) as total_chunks,
      AVG(token_estimate) as avg_tokens,
      MIN(token_estimate) as min_tokens,
      MAX(token_estimate) as max_tokens,
      AVG(content_length) as avg_length,
      COUNT(DISTINCT document_id) as document_count
    FROM chunks
  `);

  return {
    totalChunks: stats?.total_chunks || 0,
    avgTokens: Math.round(stats?.avg_tokens || 0),
    minTokens: stats?.min_tokens || 0,
    maxTokens: stats?.max_tokens || 0,
    avgLength: Math.round(stats?.avg_length || 0),
    documentCount: stats?.document_count || 0,
  };
}

/**
 * Get chunks by IDs
 */
export async function getChunksByIds(ids) {
  if (!ids || ids.length === 0) return [];

  const placeholders = ids.map(() => '?').join(',');
  return query(
    `SELECT c.*, d.original_name as document_name
     FROM chunks c
     JOIN documents d ON c.document_id = d.id
     WHERE c.id IN (${placeholders})`,
    ids
  );
}

/**
 * Get hierarchical tree structure for a document
 */
export async function getChunkTree(documentId) {
  const chunks = await query(
    `SELECT id, chunk_index, hierarchy_path, hierarchy_json, hierarchy_level,
            content, token_estimate, content_length
     FROM chunks WHERE document_id = ? ORDER BY chunk_index`,
    [documentId]
  );

  // Build tree structure
  const tree = { children: [], chunks: [] };

  for (const chunk of chunks) {
    const path = JSON.parse(chunk.hierarchy_json || '[]');
    let current = tree;

    for (let i = 0; i < path.length; i++) {
      const name = path[i];
      let child = current.children.find(c => c.name === name);

      if (!child) {
        child = { name, level: i + 1, children: [], chunks: [] };
        current.children.push(child);
      }

      current = child;
    }

    current.chunks.push({
      id: chunk.id,
      index: chunk.chunk_index,
      tokenEstimate: chunk.token_estimate,
      contentLength: chunk.content_length,
      preview: chunk.content.substring(0, 150) + (chunk.content.length > 150 ? '...' : ''),
    });
  }

  return tree;
}

/**
 * Get hierarchy summary for a document (for debugging)
 */
export async function getHierarchySummary(documentId) {
  const chunks = await query(
    `SELECT id, chunk_index, hierarchy_path, hierarchy_json, hierarchy_level,
            token_estimate, content_length, SUBSTRING(content, 1, 100) as preview
     FROM chunks WHERE document_id = ? ORDER BY chunk_index`,
    [documentId]
  );

  const withHierarchy = [];
  const withoutHierarchy = [];

  for (const chunk of chunks) {
    const hierarchyJson = JSON.parse(chunk.hierarchy_json || '[]');
    const summary = {
      id: chunk.id,
      index: chunk.chunk_index,
      hierarchyPath: chunk.hierarchy_path || '(none)',
      hierarchyLevel: chunk.hierarchy_level || 0,
      tokens: chunk.token_estimate,
      length: chunk.content_length,
      preview: chunk.preview + '...',
    };

    if (hierarchyJson.length > 0) {
      withHierarchy.push(summary);
    } else {
      withoutHierarchy.push(summary);
    }
  }

  return {
    totalChunks: chunks.length,
    chunksWithHierarchy: withHierarchy.length,
    chunksWithoutHierarchy: withoutHierarchy.length,
    withHierarchy,
    withoutHierarchy,
  };
}

/**
 * Search chunks by text content
 */
export async function searchChunksText(searchText, documentId = null, limit = 50) {
  let sql = `
    SELECT c.*, d.original_name as document_name
    FROM chunks c
    JOIN documents d ON c.document_id = d.id
    WHERE c.content LIKE ?
  `;
  const params = [`%${searchText}%`];

  if (documentId) {
    sql += ' AND c.document_id = ?';
    params.push(documentId);
  }

  sql += ` ORDER BY c.document_id, c.chunk_index LIMIT ${parseInt(limit)}`;

  return query(sql, params);
}
