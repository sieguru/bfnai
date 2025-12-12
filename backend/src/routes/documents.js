import { Router } from 'express';
import multer from 'multer';
import { v4 as uuidv4 } from 'uuid';
import { fileURLToPath } from 'url';
import { dirname, join, extname } from 'path';
import { unlink } from 'fs/promises';

import * as Document from '../models/Document.js';
import * as Chunk from '../models/Chunk.js';
import { parseDocumentStructured, analyzeDocumentStyles } from '../services/documentParser.js';
import { chunkDocument, getChunkingStats } from '../services/chunker.js';
import { generateEmbeddingsBatched, getEmbeddingInfo } from '../services/embeddings.js';
import { upsertVectors, deleteByDocumentId, isQdrantAvailable } from '../services/vectorStore.js';

const __filename = fileURLToPath(import.meta.url);
const __dirname = dirname(__filename);

const router = Router();

// Configure multer for file uploads
const storage = multer.diskStorage({
  destination: join(__dirname, '..', '..', 'uploads'),
  filename: (req, file, cb) => {
    const uniqueName = `${uuidv4()}${extname(file.originalname)}`;
    cb(null, uniqueName);
  },
});

const upload = multer({
  storage,
  fileFilter: (req, file, cb) => {
    const ext = extname(file.originalname).toLowerCase();
    if (ext !== '.docx') {
      cb(new Error('Only .docx files are allowed'));
      return;
    }
    cb(null, true);
  },
  limits: {
    fileSize: 50 * 1024 * 1024, // 50MB limit
  },
});

/**
 * POST /api/documents/upload
 * Upload one or more documents
 */
router.post('/upload', upload.array('files', 10), async (req, res) => {
  try {
    if (!req.files || req.files.length === 0) {
      return res.status(400).json({ error: true, message: 'No files uploaded' });
    }

    const documents = [];

    for (const file of req.files) {
      const docId = await Document.createDocument({
        filename: file.filename,
        originalName: file.originalname,
        fileSize: file.size,
        status: Document.DocumentStatus.PENDING,
      });

      documents.push({
        id: docId,
        filename: file.filename,
        originalName: file.originalname,
        size: file.size,
      });
    }

    res.json({
      success: true,
      documents,
    });
  } catch (error) {
    console.error('Upload error:', error);
    res.status(500).json({ error: true, message: error.message });
  }
});

/**
 * GET /api/documents
 * List all documents
 */
router.get('/', async (req, res) => {
  try {
    const { status, limit = 100, offset = 0 } = req.query;

    const documents = await Document.getAllDocuments({
      status,
      limit: parseInt(limit),
      offset: parseInt(offset),
    });

    // Get chunk counts for each document
    const docsWithCounts = await Promise.all(
      documents.map(async (doc) => {
        const chunkCount = await Chunk.getChunkCountByDocument(doc.id);
        return { ...doc, chunkCount };
      })
    );

    res.json({ documents: docsWithCounts });
  } catch (error) {
    console.error('Get documents error:', error);
    res.status(500).json({ error: true, message: error.message });
  }
});

/**
 * GET /api/documents/stats
 * Get document statistics
 */
router.get('/stats', async (req, res) => {
  try {
    const stats = await Document.getDocumentStats();
    res.json(stats);
  } catch (error) {
    console.error('Get stats error:', error);
    res.status(500).json({ error: true, message: error.message });
  }
});

/**
 * GET /api/documents/:id
 * Get document by ID
 */
router.get('/:id', async (req, res) => {
  try {
    const doc = await Document.getDocumentById(req.params.id);

    if (!doc) {
      return res.status(404).json({ error: true, message: 'Document not found' });
    }

    const chunkCount = await Chunk.getChunkCountByDocument(doc.id);
    const styles = await Document.getDocumentStyles(doc.id);

    res.json({
      ...doc,
      chunkCount,
      styles,
    });
  } catch (error) {
    console.error('Get document error:', error);
    res.status(500).json({ error: true, message: error.message });
  }
});

/**
 * POST /api/documents/:id/analyze-styles
 * Analyze and detect styles in a document
 */
router.post('/:id/analyze-styles', async (req, res) => {
  try {
    const doc = await Document.getDocumentById(req.params.id);

    if (!doc) {
      return res.status(404).json({ error: true, message: 'Document not found' });
    }

    const filePath = join(__dirname, '..', '..', 'uploads', doc.filename);
    const detectedStyles = await analyzeDocumentStyles(filePath);

    // Save styles to database
    await Document.saveDocumentStyles(doc.id, detectedStyles);

    // Re-fetch from database to return consistent snake_case format
    const styles = await Document.getDocumentStyles(doc.id);

    res.json({
      success: true,
      styles,
    });
  } catch (error) {
    console.error('Analyze styles error:', error);
    res.status(500).json({ error: true, message: error.message });
  }
});

/**
 * GET /api/documents/:id/styles
 * Get detected styles for a document
 */
router.get('/:id/styles', async (req, res) => {
  try {
    const styles = await Document.getDocumentStyles(req.params.id);
    res.json({ styles });
  } catch (error) {
    console.error('Get styles error:', error);
    res.status(500).json({ error: true, message: error.message });
  }
});

/**
 * PUT /api/documents/:id/styles
 * Update style mappings for a document
 */
router.put('/:id/styles', async (req, res) => {
  try {
    const { styles } = req.body;

    if (!Array.isArray(styles)) {
      return res.status(400).json({ error: true, message: 'styles must be an array' });
    }

    for (const style of styles) {
      await Document.updateDocumentStyleConfig(
        req.params.id,
        style.styleName,
        style.headingLevel
      );
    }

    res.json({ success: true });
  } catch (error) {
    console.error('Update styles error:', error);
    res.status(500).json({ error: true, message: error.message });
  }
});

/**
 * POST /api/documents/:id/process
 * Process document: parse, chunk, embed, and store
 */
router.post('/:id/process', async (req, res) => {
  try {
    const doc = await Document.getDocumentById(req.params.id);

    if (!doc) {
      return res.status(404).json({ error: true, message: 'Document not found' });
    }

    const { styleMapping = {}, chunkSize = 500, chunkOverlap = 1 } = req.body;

    // Update status to processing
    await Document.updateDocumentStatus(doc.id, Document.DocumentStatus.PROCESSING);

    const filePath = join(__dirname, '..', '..', 'uploads', doc.filename);

    // Parse document
    const parsedDoc = await parseDocumentStructured(filePath);

    // Build style mapping from request or database
    let finalStyleMapping = styleMapping;
    if (Object.keys(styleMapping).length === 0) {
      const dbStyles = await Document.getDocumentStyles(doc.id);
      for (const style of dbStyles) {
        if (style.is_configured && style.heading_level !== null) {
          finalStyleMapping[style.style_name] = {
            headingLevel: style.heading_level,
            isBodyText: false,
          };
        }
      }
    }

    // Chunk document
    const chunks = await chunkDocument(parsedDoc, finalStyleMapping, {
      maxChunkTokens: chunkSize,
      overlapParagraphs: chunkOverlap,
    });

    // Delete existing chunks for this document
    await Chunk.deleteChunksByDocumentId(doc.id);
    await deleteByDocumentId(doc.id);

    // Save chunks to database
    const chunkIds = [];
    for (const chunk of chunks) {
      const chunkId = await Chunk.createChunk({
        documentId: doc.id,
        chunkIndex: chunk.chunkIndex,
        chunkHash: chunk.chunkHash,
        content: chunk.content,
        contentLength: chunk.contentLength,
        tokenEstimate: chunk.tokenEstimate,
        hierarchyPath: chunk.hierarchyPath,
        hierarchyJson: chunk.hierarchyJson,
        hierarchyLevel: chunk.hierarchyLevel,
        paragraphStart: chunk.paragraphStart,
        paragraphEnd: chunk.paragraphEnd,
      });
      chunkIds.push(chunkId);
    }

    // Generate embeddings and store vectors (only if Qdrant is available)
    let vectorsCreated = false;
    const qdrantAvailable = await isQdrantAvailable();

    if (qdrantAvailable) {
      try {
        const embeddingInfo = getEmbeddingInfo();
        const texts = chunks.map(c => c.content);
        const embeddings = await generateEmbeddingsBatched(texts);

        // Store in vector database
        const vectorPoints = chunks.map((chunk, idx) => ({
          id: `${doc.id}-${chunkIds[idx]}`,
          vector: embeddings[idx],
          payload: {
            chunk_id: chunkIds[idx],
            document_id: doc.id,
            document_name: doc.original_name,
            hierarchy_path: chunk.hierarchyPath,
            text_preview: chunk.content.substring(0, 200),
            token_count: chunk.tokenEstimate,
          },
        }));

        const vectorIds = await upsertVectors(vectorPoints);

        // Update chunks with vector IDs
        for (let i = 0; i < chunkIds.length; i++) {
          await Chunk.updateChunkVector(chunkIds[i], vectorIds[i], embeddingInfo.model);
        }
        vectorsCreated = true;
      } catch (embeddingError) {
        console.warn('Failed to create embeddings:', embeddingError.message);
        // Continue without embeddings - chunks are still saved to MySQL
      }
    } else {
      console.warn('Qdrant not available, skipping embeddings');
    }

    // Update document status
    await Document.updateDocumentStatus(doc.id, Document.DocumentStatus.COMPLETED);

    const stats = getChunkingStats(chunks);

    res.json({
      success: true,
      documentId: doc.id,
      chunksCreated: chunks.length,
      vectorsCreated,
      stats,
    });
  } catch (error) {
    console.error('Process document error:', error);

    // Update status to error
    await Document.updateDocumentStatus(
      req.params.id,
      Document.DocumentStatus.ERROR,
      error.message
    );

    res.status(500).json({ error: true, message: error.message });
  }
});

/**
 * DELETE /api/documents/:id
 * Delete a document and its chunks
 */
router.delete('/:id', async (req, res) => {
  try {
    const doc = await Document.getDocumentById(req.params.id);

    if (!doc) {
      return res.status(404).json({ error: true, message: 'Document not found' });
    }

    // Delete from vector store
    await deleteByDocumentId(doc.id);

    // Delete chunks (cascades from document deletion)
    // Delete document
    await Document.deleteDocument(doc.id);

    // Delete file
    try {
      const filePath = join(__dirname, '..', '..', 'uploads', doc.filename);
      await unlink(filePath);
    } catch (e) {
      // File might not exist
    }

    res.json({ success: true });
  } catch (error) {
    console.error('Delete document error:', error);
    res.status(500).json({ error: true, message: error.message });
  }
});

export default router;
