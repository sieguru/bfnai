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
  if (model === 'voyage-3') return 1024;
  if (model === 'voyage-3-lite') return 512;
  if (model === 'voyage-3-large') return 1024;
  if (model === 'voyage-code-2') return 1536;
  if (model === 'voyage-finance-2') return 1024;

  // OpenAI models
  if (model === 'text-embedding-3-small') return 1536;
  if (model === 'text-embedding-3-large') return 3072;
  if (model === 'text-embedding-ada-002') return 1536;

  // Default - log warning
  console.warn(`Unknown embedding model: ${model}, defaulting to dimension 1536`);
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
 * Includes retry logic for rate limit errors (429)
 */
export async function generateEmbeddings(texts, retryCount = 0) {
  if (!texts || texts.length === 0) {
    return [];
  }

  const client = getClient();
  const model = config.embedding.model;
  const maxRetries = 5;

  try {
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
  } catch (error) {
    // Handle rate limit errors with exponential backoff
    if (error.status === 429 && retryCount < maxRetries) {
      const delay = Math.pow(2, retryCount) * 2000; // 2s, 4s, 8s, 16s, 32s
      console.warn(`Rate limited (429), retrying in ${delay / 1000}s (attempt ${retryCount + 1}/${maxRetries})`);
      await new Promise(resolve => setTimeout(resolve, delay));
      return generateEmbeddings(texts, retryCount + 1);
    }
    throw error;
  }
}

/**
 * Generate embeddings in batches to handle large numbers of texts
 * @param {string[]} texts - Array of texts to embed
 * @param {number} batchSize - Number of texts per batch
 * @param {function} onProgress - Optional callback for progress updates (batchNum, totalBatches)
 */
export async function generateEmbeddingsBatched(texts, batchSize = 10, onProgress = null) {
  const allEmbeddings = [];
  const totalBatches = Math.ceil(texts.length / batchSize);

  for (let i = 0; i < texts.length; i += batchSize) {
    const batch = texts.slice(i, i + batchSize);
    const batchNum = Math.floor(i / batchSize) + 1;
    console.log(`Processing embedding batch ${batchNum}/${totalBatches} (${batch.length} texts)`);

    // Report progress
    if (onProgress) {
      onProgress(batchNum, totalBatches);
    }

    const embeddings = await generateEmbeddings(batch);
    allEmbeddings.push(...embeddings);

    // Longer delay between batches to avoid rate limits
    if (i + batchSize < texts.length) {
      await new Promise(resolve => setTimeout(resolve, 2000));
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
