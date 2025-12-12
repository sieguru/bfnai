import express from 'express';
import cors from 'cors';
import config from './config/env.js';
import { testConnection } from './config/database.js';
import { testQdrantConnection } from './config/qdrant.js';
import { getCollectionStats } from './services/vectorStore.js';
import { getEmbeddingInfo } from './services/embeddings.js';

import documentsRoutes from './routes/documents.js';
import chunksRoutes from './routes/chunks.js';
import searchRoutes from './routes/search.js';
import agentRoutes from './routes/agent.js';

const app = express();

// Middleware
app.use(cors());
app.use(express.json({ limit: '10mb' }));

// Health check
app.get('/api/health', async (req, res) => {
  const dbConnected = await testConnection();
  const qdrantConnected = await testQdrantConnection();

  let vectorStats = null;
  if (qdrantConnected) {
    try {
      vectorStats = await getCollectionStats();
    } catch (e) {
      // Collection might not exist yet
    }
  }

  // Status is healthy if database works; Qdrant is optional for basic operations
  let status = 'healthy';
  if (!dbConnected) {
    status = 'error';
  } else if (!qdrantConnected) {
    status = 'partial'; // DB works, but vector search unavailable
  }

  res.json({
    status,
    services: {
      database: dbConnected ? 'connected' : 'disconnected',
      qdrant: qdrantConnected ? 'connected' : 'disconnected',
    },
    vectorStore: vectorStats,
    embedding: getEmbeddingInfo(),
    timestamp: new Date().toISOString(),
  });
});

// Routes
app.use('/api/documents', documentsRoutes);
app.use('/api/chunks', chunksRoutes);
app.use('/api/search', searchRoutes);
app.use('/api/agent', agentRoutes);

// Error handling
app.use((err, req, res, next) => {
  console.error('Unhandled error:', err);
  res.status(500).json({
    error: true,
    message: config.nodeEnv === 'development' ? err.message : 'Internal server error',
  });
});

// 404 handler
app.use((req, res) => {
  res.status(404).json({
    error: true,
    message: 'Not found',
  });
});

// Start server
const PORT = config.port;

app.listen(PORT, () => {
  console.log(`Server running on port ${PORT}`);
  console.log(`Environment: ${config.nodeEnv}`);
  console.log(`Embedding provider: ${config.embedding.provider}`);
});
