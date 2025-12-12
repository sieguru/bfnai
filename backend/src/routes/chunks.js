import { Router } from 'express';
import * as Chunk from '../models/Chunk.js';

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

export default router;
