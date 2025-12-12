import { v4 as uuidv4 } from 'uuid';
import { getQdrantClient, ensureCollection, testQdrantConnection } from '../config/qdrant.js';
import config from '../config/env.js';
import { getEmbeddingDimension } from './embeddings.js';

/**
 * Check if Qdrant is available
 */
export async function isQdrantAvailable() {
  return testQdrantConnection();
}

/**
 * Initialize the vector store collection
 */
export async function initializeCollection() {
  if (!await isQdrantAvailable()) {
    console.warn('Qdrant not available, skipping collection initialization');
    return false;
  }
  const dimension = getEmbeddingDimension();
  return ensureCollection(config.qdrant.collection, dimension);
}

/**
 * Upsert vectors (add or update)
 */
export async function upsertVectors(points) {
  if (!await isQdrantAvailable()) {
    console.warn('Qdrant not available, skipping vector upsert');
    return points.map(() => null);
  }

  const qdrant = getQdrantClient();
  const collection = config.qdrant.collection;

  // Ensure collection exists
  await initializeCollection();

  // Format points for Qdrant
  const qdrantPoints = points.map(point => ({
    id: point.id || uuidv4(),
    vector: point.vector,
    payload: point.payload || {},
  }));

  await qdrant.upsert(collection, {
    wait: true,
    points: qdrantPoints,
  });

  return qdrantPoints.map(p => p.id);
}

/**
 * Search for similar vectors
 */
export async function search(queryVector, limit = 10, filter = null) {
  if (!await isQdrantAvailable()) {
    throw new Error('Vector search unavailable: Qdrant is not connected');
  }

  const qdrant = getQdrantClient();
  const collection = config.qdrant.collection;

  const searchParams = {
    vector: queryVector,
    limit,
    with_payload: true,
  };

  if (filter) {
    searchParams.filter = filter;
  }

  const results = await qdrant.search(collection, searchParams);

  return results.map(result => ({
    id: result.id,
    score: result.score,
    payload: result.payload,
  }));
}

/**
 * Search with document ID filter
 */
export async function searchByDocuments(queryVector, documentIds, limit = 10) {
  const filter = documentIds && documentIds.length > 0
    ? {
        must: [
          {
            key: 'document_id',
            match: {
              any: documentIds,
            },
          },
        ],
      }
    : null;

  return search(queryVector, limit, filter);
}

/**
 * Delete all vectors for a document
 */
export async function deleteByDocumentId(documentId) {
  if (!await isQdrantAvailable()) {
    console.warn('Qdrant not available, skipping vector deletion');
    return;
  }

  const qdrant = getQdrantClient();
  const collection = config.qdrant.collection;

  try {
    // Check if collection exists first
    await qdrant.getCollection(collection);

    await qdrant.delete(collection, {
      wait: true,
      filter: {
        must: [
          {
            key: 'document_id',
            match: {
              value: documentId,
            },
          },
        ],
      },
    });
  } catch (error) {
    // Collection doesn't exist yet - this is fine, nothing to delete
    if (error.message?.includes('Not found') || error.message?.includes('not found')) {
      return;
    }
    console.warn('Failed to delete vectors:', error.message);
  }
}

/**
 * Delete specific vectors by ID
 */
export async function deleteVectors(vectorIds) {
  if (!await isQdrantAvailable()) {
    console.warn('Qdrant not available, skipping vector deletion');
    return;
  }

  const qdrant = getQdrantClient();
  const collection = config.qdrant.collection;

  await qdrant.delete(collection, {
    wait: true,
    points: vectorIds,
  });
}

/**
 * Get collection statistics
 */
export async function getCollectionStats() {
  if (!await isQdrantAvailable()) {
    return {
      vectorsCount: 0,
      pointsCount: 0,
      segmentsCount: 0,
      status: 'unavailable',
    };
  }

  const qdrant = getQdrantClient();
  const collection = config.qdrant.collection;

  try {
    const info = await qdrant.getCollection(collection);
    return {
      vectorsCount: info.vectors_count,
      pointsCount: info.points_count,
      segmentsCount: info.segments_count,
      status: info.status,
    };
  } catch (error) {
    if (error.message?.includes('not found')) {
      return {
        vectorsCount: 0,
        pointsCount: 0,
        segmentsCount: 0,
        status: 'not_created',
      };
    }
    throw error;
  }
}

/**
 * Get a specific vector by ID
 */
export async function getVector(vectorId, includeVector = false) {
  if (!await isQdrantAvailable()) {
    return null;
  }

  const qdrant = getQdrantClient();
  const collection = config.qdrant.collection;

  const result = await qdrant.retrieve(collection, {
    ids: [vectorId],
    with_payload: true,
    with_vector: includeVector,
  });

  return result[0] || null;
}

/**
 * Get multiple vectors by IDs
 */
export async function getVectors(vectorIds, includeVector = false) {
  if (!await isQdrantAvailable()) {
    return [];
  }

  const qdrant = getQdrantClient();
  const collection = config.qdrant.collection;

  const result = await qdrant.retrieve(collection, {
    ids: vectorIds,
    with_payload: true,
    with_vector: includeVector,
  });

  return result;
}

/**
 * Scroll through all vectors in collection
 */
export async function scrollVectors(limit = 10, offset = null, includeVector = false) {
  if (!await isQdrantAvailable()) {
    return { points: [], nextOffset: null };
  }

  const qdrant = getQdrantClient();
  const collection = config.qdrant.collection;

  const result = await qdrant.scroll(collection, {
    limit,
    offset,
    with_payload: true,
    with_vector: includeVector,
  });

  return {
    points: result.points,
    nextOffset: result.next_page_offset,
  };
}

/**
 * Get detailed collection info including config
 */
export async function getCollectionInfo() {
  if (!await isQdrantAvailable()) {
    return null;
  }

  const qdrant = getQdrantClient();
  const collection = config.qdrant.collection;

  try {
    const info = await qdrant.getCollection(collection);
    return {
      name: collection,
      status: info.status,
      vectorsCount: info.vectors_count,
      pointsCount: info.points_count,
      segmentsCount: info.segments_count,
      config: info.config,
      payloadSchema: info.payload_schema,
    };
  } catch (error) {
    if (error.message?.includes('not found')) {
      return null;
    }
    throw error;
  }
}
