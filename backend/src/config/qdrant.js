import { QdrantClient } from '@qdrant/js-client-rest';
import config from './env.js';

let client = null;

export function getQdrantClient() {
  if (!client) {
    // Use cloud URL if provided, otherwise fall back to host/port
    if (config.qdrant.url) {
      client = new QdrantClient({
        url: config.qdrant.url,
        apiKey: config.qdrant.apiKey,
        checkCompatibility: false,
      });
    } else {
      client = new QdrantClient({
        host: config.qdrant.host,
        port: config.qdrant.port,
        checkCompatibility: false,
      });
    }
  }
  return client;
}

export async function testQdrantConnection() {
  try {
    const qdrant = getQdrantClient();
    await qdrant.getCollections();
    return true;
  } catch (error) {
    console.error('Qdrant connection failed:', error.message);
    return false;
  }
}

export async function ensureCollection(name, vectorSize) {
  const qdrant = getQdrantClient();

  try {
    const collections = await qdrant.getCollections();
    const exists = collections.collections.some(c => c.name === name);

    if (!exists) {
      await qdrant.createCollection(name, {
        vectors: {
          size: vectorSize,
          distance: 'Cosine',
        },
      });
      console.log(`Created Qdrant collection: ${name}`);

      // Create payload indexes for filtering
      await qdrant.createPayloadIndex(name, {
        field_name: 'document_id',
        field_schema: 'integer',
      });
      console.log(`Created index on document_id`);

      await qdrant.createPayloadIndex(name, {
        field_name: 'chunk_id',
        field_schema: 'integer',
      });
      console.log(`Created index on chunk_id`);
    }

    return true;
  } catch (error) {
    console.error('Failed to ensure collection:', error.message);
    return false;
  }
}

/**
 * Ensure payload indexes exist on an existing collection
 */
export async function ensurePayloadIndexes(name) {
  const qdrant = getQdrantClient();

  try {
    // Get collection info to check existing indexes
    const info = await qdrant.getCollection(name);
    const existingIndexes = Object.keys(info.payload_schema || {});

    if (!existingIndexes.includes('document_id')) {
      await qdrant.createPayloadIndex(name, {
        field_name: 'document_id',
        field_schema: 'integer',
      });
      console.log(`Created index on document_id`);
    }

    if (!existingIndexes.includes('chunk_id')) {
      await qdrant.createPayloadIndex(name, {
        field_name: 'chunk_id',
        field_schema: 'integer',
      });
      console.log(`Created index on chunk_id`);
    }

    return true;
  } catch (error) {
    console.error('Failed to ensure payload indexes:', error.message);
    return false;
  }
}
