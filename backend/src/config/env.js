import dotenv from 'dotenv';
import { fileURLToPath } from 'url';
import { dirname, join } from 'path';
import { existsSync } from 'fs';

const __filename = fileURLToPath(import.meta.url);
const __dirname = dirname(__filename);

// Load .env - try backend folder first (for deployment), then project root (for local dev)
const backendEnvPath = join(__dirname, '..', '..', '.env');
const rootEnvPath = join(__dirname, '..', '..', '..', '.env');

if (existsSync(backendEnvPath)) {
  dotenv.config({ path: backendEnvPath });
} else if (existsSync(rootEnvPath)) {
  dotenv.config({ path: rootEnvPath });
} else {
  // In production (Railway/Render), env vars are set directly - no .env file needed
  dotenv.config();
}

export default {
  port: process.env.PORT || 3000,
  nodeEnv: process.env.NODE_ENV || 'development',

  db: {
    host: process.env.DB_HOST || 'localhost',
    port: parseInt(process.env.DB_PORT || '3306'),
    database: process.env.DB_NAME || 'legal_rag',
    user: process.env.DB_USER || 'raguser',
    password: process.env.DB_PASSWORD !== undefined ? process.env.DB_PASSWORD : 'ragpassword',
  },

  qdrant: {
    url: process.env.QDRANT_URL || null,  // Cloud URL (e.g., https://xxx.aws.cloud.qdrant.io)
    apiKey: process.env.QDRANT_API_KEY || null,
    host: process.env.QDRANT_HOST || 'localhost',
    port: parseInt(process.env.QDRANT_PORT || '6333'),
    collection: process.env.QDRANT_COLLECTION || 'legal_chunks',
  },

  embedding: {
    provider: process.env.EMBEDDING_PROVIDER || 'voyage',
    model: process.env.EMBEDDING_MODEL || 'voyage-law-2',
    voyageApiKey: process.env.VOYAGE_API_KEY,
    openaiApiKey: process.env.OPENAI_API_KEY,
  },

  anthropic: {
    apiKey: process.env.ANTHROPIC_API_KEY,
    model: process.env.ANTHROPIC_MODEL || 'claude-sonnet-4-5-20250514',
  },

  processing: {
    defaultChunkSize: parseInt(process.env.DEFAULT_CHUNK_SIZE || '500'),
    defaultChunkOverlap: parseInt(process.env.DEFAULT_CHUNK_OVERLAP || '1'),
  },
};
