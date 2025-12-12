import { Router } from 'express';
import { generateEmbedding, getEmbeddingInfo } from '../services/embeddings.js';
import { search, searchByDocuments, getCollectionInfo, isQdrantAvailable, clearCollection } from '../services/vectorStore.js';
import * as Chunk from '../models/Chunk.js';

const router = Router();

/**
 * POST /api/search
 * Vector similarity search
 */
router.post('/', async (req, res) => {
  try {
    const { query, limit = 10, documentIds } = req.body;

    if (!query) {
      return res.status(400).json({ error: true, message: 'Query is required' });
    }

    const startTime = Date.now();

    // Generate query embedding
    const queryVector = await generateEmbedding(query);

    // Search vector store
    let results;
    if (documentIds && documentIds.length > 0) {
      results = await searchByDocuments(queryVector, documentIds, limit);
    } else {
      results = await search(queryVector, limit);
    }

    // Fetch full chunk data
    const chunkIds = results.map(r => r.payload.chunk_id);
    const chunks = await Chunk.getChunksByIds(chunkIds);

    // Combine results with scores
    const enrichedResults = results.map(result => {
      const chunk = chunks.find(c => c.id === result.payload.chunk_id);
      return {
        ...result,
        chunk,
      };
    });

    const searchTime = Date.now() - startTime;

    res.json({
      results: enrichedResults,
      query,
      searchTimeMs: searchTime,
      totalResults: results.length,
    });
  } catch (error) {
    console.error('Search error:', error);
    res.status(500).json({ error: true, message: error.message });
  }
});

/**
 * POST /api/search/similar/:chunkId
 * Find chunks similar to a given chunk
 */
router.post('/similar/:chunkId', async (req, res) => {
  try {
    const { limit = 10, excludeSameDocument = false } = req.body;
    const chunkId = parseInt(req.params.chunkId);

    // Get the chunk
    const chunk = await Chunk.getChunkById(chunkId);
    if (!chunk) {
      return res.status(404).json({ error: true, message: 'Chunk not found' });
    }

    // Generate embedding for this chunk's content
    const queryVector = await generateEmbedding(chunk.content);

    // Search for similar chunks
    let filter = null;
    if (excludeSameDocument) {
      filter = {
        must_not: [
          {
            key: 'document_id',
            match: { value: chunk.document_id },
          },
        ],
      };
    }

    const results = await search(queryVector, limit + 1, filter);

    // Remove the source chunk from results
    const filteredResults = results.filter(r => r.payload.chunk_id !== chunkId);

    // Fetch full chunk data
    const chunkIds = filteredResults.slice(0, limit).map(r => r.payload.chunk_id);
    const chunks = await Chunk.getChunksByIds(chunkIds);

    const enrichedResults = filteredResults.slice(0, limit).map(result => {
      const matchedChunk = chunks.find(c => c.id === result.payload.chunk_id);
      return {
        ...result,
        chunk: matchedChunk,
      };
    });

    res.json({
      sourceChunk: chunk,
      results: enrichedResults,
    });
  } catch (error) {
    console.error('Similar search error:', error);
    res.status(500).json({ error: true, message: error.message });
  }
});

/**
 * POST /api/search/hybrid
 * Combined vector + keyword search
 */
router.post('/hybrid', async (req, res) => {
  try {
    const { query, limit = 10, documentIds, vectorWeight = 0.7 } = req.body;

    if (!query) {
      return res.status(400).json({ error: true, message: 'Query is required' });
    }

    const startTime = Date.now();

    // Vector search
    const queryVector = await generateEmbedding(query);
    let vectorResults;
    if (documentIds && documentIds.length > 0) {
      vectorResults = await searchByDocuments(queryVector, documentIds, limit * 2);
    } else {
      vectorResults = await search(queryVector, limit * 2);
    }

    // Keyword search
    const keywordResults = await Chunk.searchChunksText(
      query,
      documentIds?.[0] || null,
      limit * 2
    );

    // Combine and rank results
    const scoreMap = new Map();

    // Add vector scores
    vectorResults.forEach((result, idx) => {
      const chunkId = result.payload.chunk_id;
      const normalizedScore = result.score * vectorWeight;
      scoreMap.set(chunkId, {
        chunkId,
        vectorScore: result.score,
        keywordScore: 0,
        combinedScore: normalizedScore,
        vectorRank: idx + 1,
      });
    });

    // Add keyword scores
    keywordResults.forEach((chunk, idx) => {
      const keywordScore = 1 - (idx / keywordResults.length);
      const normalizedScore = keywordScore * (1 - vectorWeight);

      if (scoreMap.has(chunk.id)) {
        const existing = scoreMap.get(chunk.id);
        existing.keywordScore = keywordScore;
        existing.combinedScore += normalizedScore;
        existing.keywordRank = idx + 1;
      } else {
        scoreMap.set(chunk.id, {
          chunkId: chunk.id,
          vectorScore: 0,
          keywordScore,
          combinedScore: normalizedScore,
          keywordRank: idx + 1,
        });
      }
    });

    // Sort by combined score
    const sortedIds = Array.from(scoreMap.values())
      .sort((a, b) => b.combinedScore - a.combinedScore)
      .slice(0, limit);

    // Fetch chunk data
    const chunkIds = sortedIds.map(s => s.chunkId);
    const chunks = await Chunk.getChunksByIds(chunkIds);

    const results = sortedIds.map(scoreInfo => {
      const chunk = chunks.find(c => c.id === scoreInfo.chunkId);
      return {
        ...scoreInfo,
        chunk,
      };
    });

    const searchTime = Date.now() - startTime;

    res.json({
      results,
      query,
      searchTimeMs: searchTime,
      totalResults: results.length,
      weights: { vector: vectorWeight, keyword: 1 - vectorWeight },
    });
  } catch (error) {
    console.error('Hybrid search error:', error);
    res.status(500).json({ error: true, message: error.message });
  }
});

/**
 * GET /api/search/collection
 * Get Qdrant collection info and stats
 */
router.get('/collection', async (req, res) => {
  try {
    const available = await isQdrantAvailable();

    if (!available) {
      return res.json({
        available: false,
        message: 'Qdrant is not connected',
      });
    }

    const info = await getCollectionInfo();
    const embeddingInfo = getEmbeddingInfo();

    if (!info) {
      return res.json({
        available: true,
        exists: false,
        message: 'Collection does not exist yet',
        embedding: embeddingInfo,
      });
    }

    res.json({
      available: true,
      exists: true,
      collection: info,
      embedding: embeddingInfo,
    });
  } catch (error) {
    console.error('Get collection info error:', error);
    res.status(500).json({ error: true, message: error.message });
  }
});

/**
 * DELETE /api/search/collection
 * Clear all vectors from Qdrant collection
 */
router.delete('/collection', async (req, res) => {
  try {
    const available = await isQdrantAvailable();

    if (!available) {
      return res.status(503).json({
        error: true,
        message: 'Qdrant is not connected',
      });
    }

    const result = await clearCollection();

    // Also clear vector_id from all chunks in MySQL
    const { update } = await import('../config/database.js');
    const cleared = await update('UPDATE chunks SET vector_id = NULL, embedded_at = NULL, embedding_model = NULL');

    res.json({
      success: true,
      qdrant: result,
      chunksCleared: cleared,
      message: 'Collection deleted and chunk vector references cleared. Re-process documents to recreate vectors.',
    });
  } catch (error) {
    console.error('Clear collection error:', error);
    res.status(500).json({ error: true, message: error.message });
  }
});

export default router;
