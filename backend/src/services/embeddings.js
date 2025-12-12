import OpenAI from 'openai';
import config from '../config/env.js';

let openaiClient = null;

/**
 * Get the embedding provider client
 */
function getClient() {
  if (!openaiClient) {
    if (config.embedding.provider === 'voyage') {
      // Voyage AI uses OpenAI-compatible API
      openaiClient = new OpenAI({
        apiKey: config.embedding.voyageApiKey,
        baseURL: 'https://api.voyageai.com/v1',
      });
    } else {
      openaiClient = new OpenAI({
        apiKey: config.embedding.openaiApiKey,
      });
    }
  }
  return openaiClient;
}

/**
 * Get the embedding dimension for the current model
 */
export function getEmbeddingDimension() {
  const model = config.embedding.model;

  // Voyage AI models
  if (model === 'voyage-law-2') return 1024;
  if (model === 'voyage-large-2') return 1536;
  if (model === 'voyage-2') return 1024;

  // OpenAI models
  if (model === 'text-embedding-3-small') return 1536;
  if (model === 'text-embedding-3-large') return 3072;
  if (model === 'text-embedding-ada-002') return 1536;

  // Default
  return 1536;
}

/**
 * Generate embedding for a single text
 */
export async function generateEmbedding(text) {
  const embeddings = await generateEmbeddings([text]);
  return embeddings[0];
}

/**
 * Generate embeddings for multiple texts (batch processing)
 */
export async function generateEmbeddings(texts) {
  if (!texts || texts.length === 0) {
    return [];
  }

  const client = getClient();
  const model = config.embedding.model;

  // Voyage AI has different API parameters
  if (config.embedding.provider === 'voyage') {
    const response = await client.embeddings.create({
      model,
      input: texts,
    });

    return response.data.map(item => item.embedding);
  }

  // OpenAI
  const response = await client.embeddings.create({
    model,
    input: texts,
  });

  // Sort by index to maintain order
  const sorted = response.data.sort((a, b) => a.index - b.index);
  return sorted.map(item => item.embedding);
}

/**
 * Generate embeddings in batches to handle large numbers of texts
 */
export async function generateEmbeddingsBatched(texts, batchSize = 100) {
  const allEmbeddings = [];

  for (let i = 0; i < texts.length; i += batchSize) {
    const batch = texts.slice(i, i + batchSize);
    const embeddings = await generateEmbeddings(batch);
    allEmbeddings.push(...embeddings);

    // Small delay between batches to avoid rate limits
    if (i + batchSize < texts.length) {
      await new Promise(resolve => setTimeout(resolve, 100));
    }
  }

  return allEmbeddings;
}

/**
 * Get current embedding model info
 */
export function getEmbeddingInfo() {
  return {
    provider: config.embedding.provider,
    model: config.embedding.model,
    dimension: getEmbeddingDimension(),
  };
}
