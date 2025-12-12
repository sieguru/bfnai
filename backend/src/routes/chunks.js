import { Router } from 'express';
import * as Chunk from '../models/Chunk.js';
import { getVector, scrollVectors, isQdrantAvailable } from '../services/vectorStore.js';
import { getEmbeddingInfo } from '../services/embeddings.js';

const router = Router();

/**
 * GET /api/chunks
 * List chunks with pagination
 */
router.get('/', async (req, res) => {
  try {
    const { documentId, limit = 100, offset = 0 } = req.query;

    const chunks = await Chunk.getAllChunks({
      documentId: documentId ? parseInt(documentId) : null,
      limit: parseInt(limit),
      offset: parseInt(offset),
    });

    res.json({ chunks });
  } catch (error) {
    console.error('Get chunks error:', error);
    res.status(500).json({ error: true, message: error.message });
  }
});

/**
 * GET /api/chunks/stats
 * Get chunk statistics
 */
router.get('/stats', async (req, res) => {
  try {
    const stats = await Chunk.getChunkStats();
    res.json(stats);
  } catch (error) {
    console.error('Get chunk stats error:', error);
    res.status(500).json({ error: true, message: error.message });
  }
});

/**
 * GET /api/chunks/tree/:documentId
 * Get hierarchical tree structure for document
 */
router.get('/tree/:documentId', async (req, res) => {
  try {
    const tree = await Chunk.getChunkTree(parseInt(req.params.documentId));
    res.json({ tree });
  } catch (error) {
    console.error('Get chunk tree error:', error);
    res.status(500).json({ error: true, message: error.message });
  }
});

/**
 * GET /api/chunks/search
 * Search chunks by text content
 */
router.get('/search', async (req, res) => {
  try {
    const { q, documentId, limit = 50 } = req.query;

    if (!q) {
      return res.status(400).json({ error: true, message: 'Search query (q) is required' });
    }

    const chunks = await Chunk.searchChunksText(
      q,
      documentId ? parseInt(documentId) : null,
      parseInt(limit)
    );

    res.json({ chunks });
  } catch (error) {
    console.error('Search chunks error:', error);
    res.status(500).json({ error: true, message: error.message });
  }
});

/**
 * GET /api/chunks/sync-vectors (test endpoint)
 */
router.get('/sync-vectors', (req, res) => {
  res.json({ message: 'Use POST method to sync vectors' });
});

/**
 * POST /api/chunks/sync-vectors
 * Sync vector_ids from Qdrant to MySQL chunks
 * This backfills vector_id for chunks that have vectors in Qdrant but NULL in MySQL
 */
router.post('/sync-vectors', async (req, res) => {
  console.log('=== SYNC-VECTORS ENDPOINT HIT ===');
  try {
    if (!await isQdrantAvailable()) {
      return res.status(503).json({ error: true, message: 'Qdrant not available' });
    }

    const embeddingInfo = getEmbeddingInfo();
    let synced = 0;
    let skipped = 0;
    let offset = null;

    // Scroll through all vectors in Qdrant
    while (true) {
      const result = await scrollVectors(100, offset, false);

      for (const point of result.points) {
        const chunkId = point.payload?.chunk_id;
        if (chunkId) {
          // Check if chunk exists first
          const chunk = await Chunk.getChunkById(chunkId);
          if (chunk) {
            // Update the chunk with vector_id
            await Chunk.updateChunkVector(chunkId, point.id, embeddingInfo.model);
            synced++;
          } else {
            skipped++;
          }
        }
      }

      if (!result.nextOffset) break;
      offset = result.nextOffset;
    }

    res.json({
      success: true,
      synced,
      skipped,
      message: `Synced ${synced} vector IDs, skipped ${skipped} orphaned vectors`,
    });
  } catch (error) {
    console.error('Sync vectors error:', error);
    res.status(500).json({ error: true, message: error.message });
  }
});

/**
 * GET /api/chunks/vectors/browse
 * Browse all vectors with pagination
 */
router.get('/vectors/browse', async (req, res) => {
  try {
    const limit = Math.min(parseInt(req.query.limit) || 20, 100);
    const offset = req.query.offset || null;
    const includeValues = req.query.values === 'true'; // Don't include values by default (large)

    if (!await isQdrantAvailable()) {
      return res.status(503).json({ error: true, message: 'Qdrant not available' });
    }

    const result = await scrollVectors(limit, offset, includeValues);

    res.json({
      points: result.points.map(point => ({
        id: point.id,
        payload: point.payload,
        dimension: includeValues && point.vector ? point.vector.length : null,
        vector: includeValues ? point.vector : null,
        vectorPreview: includeValues && point.vector
          ? `[${point.vector.slice(0, 5).map(v => v.toFixed(4)).join(', ')}...]`
          : null,
      })),
      nextOffset: result.nextOffset,
      hasMore: result.nextOffset !== null,
    });
  } catch (error) {
    console.error('Browse vectors error:', error);
    res.status(500).json({ error: true, message: error.message });
  }
});

/**
 * GET /api/chunks/hierarchy-summary/:documentId
 * Get summary of chunk hierarchy status for debugging
 */
router.get('/hierarchy-summary/:documentId', async (req, res) => {
  try {
    const summary = await Chunk.getHierarchySummary(parseInt(req.params.documentId));
    res.json(summary);
  } catch (error) {
    console.error('Get hierarchy summary error:', error);
    res.status(500).json({ error: true, message: error.message });
  }
});

/**
 * GET /api/chunks/:id
 * Get single chunk by ID
 */
router.get('/:id', async (req, res) => {
  try {
    const chunk = await Chunk.getChunkById(parseInt(req.params.id));

    if (!chunk) {
      return res.status(404).json({ error: true, message: 'Chunk not found' });
    }

    res.json(chunk);
  } catch (error) {
    console.error('Get chunk error:', error);
    res.status(500).json({ error: true, message: error.message });
  }
});

/**
 * POST /api/chunks/batch
 * Get multiple chunks by IDs
 */
router.post('/batch', async (req, res) => {
  try {
    const { ids } = req.body;

    if (!Array.isArray(ids)) {
      return res.status(400).json({ error: true, message: 'ids must be an array' });
    }

    const chunks = await Chunk.getChunksByIds(ids);
    res.json({ chunks });
  } catch (error) {
    console.error('Get batch chunks error:', error);
    res.status(500).json({ error: true, message: error.message });
  }
});

/**
 * GET /api/chunks/:id/vector
 * Get the vector embedding for a chunk
 */
router.get('/:id/vector', async (req, res) => {
  try {
    const chunkId = parseInt(req.params.id);
    const includeValues = req.query.values !== 'false'; // Include vector values by default

    // First get the chunk to find its vector_id
    const chunk = await Chunk.getChunkById(chunkId);

    if (!chunk) {
      return res.status(404).json({ error: true, message: 'Chunk not found' });
    }

    if (!chunk.vector_id) {
      return res.status(404).json({
        error: true,
        message: 'No vector stored for this chunk',
        chunk: {
          id: chunk.id,
          embedding_model: chunk.embedding_model,
        }
      });
    }

    // Get vector from Qdrant (vector_id may be stored as string in MySQL)
    const vectorId = typeof chunk.vector_id === 'string' ? parseInt(chunk.vector_id) : chunk.vector_id;
    const vector = await getVector(vectorId, includeValues);

    if (!vector) {
      return res.status(404).json({
        error: true,
        message: 'Vector not found in Qdrant. The document may need to be reprocessed.',
        vectorId: chunk.vector_id,
        hint: 'Try reprocessing this document to regenerate vectors',
      });
    }

    res.json({
      chunkId: chunk.id,
      vectorId: vector.id,
      embeddingModel: chunk.embedding_model,
      dimension: includeValues && vector.vector ? vector.vector.length : null,
      vector: includeValues ? vector.vector : null,
      payload: vector.payload,
      // Include some stats about the vector
      stats: includeValues && vector.vector ? {
        min: Math.min(...vector.vector),
        max: Math.max(...vector.vector),
        mean: vector.vector.reduce((a, b) => a + b, 0) / vector.vector.length,
        norm: Math.sqrt(vector.vector.reduce((a, b) => a + b * b, 0)),
      } : null,
    });
  } catch (error) {
    console.error('Get chunk vector error:', error);
    res.status(500).json({ error: true, message: error.message });
  }
});

export default router;
