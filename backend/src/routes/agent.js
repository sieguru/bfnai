import { Router } from 'express';
import { v4 as uuidv4 } from 'uuid';
import { chat } from '../services/aiAgent.js';
import { generateEmbedding } from '../services/embeddings.js';
import { search, searchByDocuments } from '../services/vectorStore.js';
import * as Chunk from '../models/Chunk.js';
import { query, queryOne, insert, update } from '../config/database.js';

const router = Router();

/**
 * POST /api/agent/chat
 * Chat with the AI agent
 */
router.post('/chat', async (req, res) => {
  try {
    const {
      query: userQuery,
      conversationId,
      documentIds,
      chunkLimit = 5,
    } = req.body;

    if (!userQuery) {
      return res.status(400).json({ error: true, message: 'Query is required' });
    }

    // Get or create conversation
    let convId = conversationId;
    let conversationHistory = [];

    if (convId) {
      // Load existing conversation
      const messages = await query(
        'SELECT role, content FROM conversation_messages WHERE conversation_id = ? ORDER BY created_at',
        [convId]
      );
      conversationHistory = messages;
    } else {
      // Create new conversation
      const sessionId = uuidv4();
      convId = await insert(
        'INSERT INTO conversations (session_id) VALUES (?)',
        [sessionId]
      );
    }

    // Retrieve relevant chunks
    const queryVector = await generateEmbedding(userQuery);

    let searchResults;
    if (documentIds && documentIds.length > 0) {
      searchResults = await searchByDocuments(queryVector, documentIds, chunkLimit);
    } else {
      searchResults = await search(queryVector, chunkLimit);
    }

    // Get full chunk data
    const chunkIds = searchResults.map(r => r.payload.chunk_id);
    const chunks = await Chunk.getChunksByIds(chunkIds);

    // Format chunks for the agent
    const formattedChunks = searchResults.map(result => {
      const chunk = chunks.find(c => c.id === result.payload.chunk_id);
      return {
        id: chunk?.id,
        document_id: chunk?.document_id,
        document_name: chunk?.document_name || result.payload.document_name,
        hierarchy_path: chunk?.hierarchy_path || result.payload.hierarchy_path,
        content: chunk?.content || result.payload.text_preview,
        score: result.score,
      };
    });

    // Call the AI agent
    const agentResponse = await chat(userQuery, conversationHistory, formattedChunks);

    // Save user message
    await insert(
      'INSERT INTO conversation_messages (conversation_id, role, content) VALUES (?, ?, ?)',
      [convId, 'user', userQuery]
    );

    // Save assistant message
    await insert(
      `INSERT INTO conversation_messages (conversation_id, role, content, chunks_used, citations)
       VALUES (?, ?, ?, ?, ?)`,
      [
        convId,
        'assistant',
        agentResponse.response,
        JSON.stringify(agentResponse.chunksUsed),
        JSON.stringify(agentResponse.citations),
      ]
    );

    // Update conversation timestamp
    await update(
      'UPDATE conversations SET updated_at = NOW() WHERE id = ?',
      [convId]
    );

    // Save to query history
    await insert(
      `INSERT INTO query_history (query_text, chunks_retrieved, chunk_ids, agent_response, response_time_ms, tokens_used)
       VALUES (?, ?, ?, ?, ?, ?)`,
      [
        userQuery,
        formattedChunks.length,
        JSON.stringify(chunkIds),
        agentResponse.response,
        agentResponse.responseTimeMs,
        agentResponse.tokensUsed,
      ]
    );

    res.json({
      conversationId: convId,
      response: agentResponse.response,
      citations: agentResponse.citations,
      chunksUsed: formattedChunks,
      responseTimeMs: agentResponse.responseTimeMs,
      tokensUsed: agentResponse.tokensUsed,
    });
  } catch (error) {
    console.error('Agent chat error:', error);
    res.status(500).json({ error: true, message: error.message });
  }
});

/**
 * GET /api/agent/conversations
 * List recent conversations
 */
router.get('/conversations', async (req, res) => {
  try {
    const { limit = 20, offset = 0 } = req.query;

    const conversations = await query(
      `SELECT c.*,
        (SELECT content FROM conversation_messages WHERE conversation_id = c.id AND role = 'user' ORDER BY created_at LIMIT 1) as first_message,
        (SELECT COUNT(*) FROM conversation_messages WHERE conversation_id = c.id) as message_count
       FROM conversations c
       ORDER BY c.updated_at DESC
       LIMIT ${parseInt(limit)} OFFSET ${parseInt(offset)}`
    );

    res.json({ conversations });
  } catch (error) {
    console.error('Get conversations error:', error);
    res.status(500).json({ error: true, message: error.message });
  }
});

/**
 * GET /api/agent/conversations/:id
 * Get conversation history
 */
router.get('/conversations/:id', async (req, res) => {
  try {
    const conversation = await queryOne(
      'SELECT * FROM conversations WHERE id = ?',
      [req.params.id]
    );

    if (!conversation) {
      return res.status(404).json({ error: true, message: 'Conversation not found' });
    }

    const messages = await query(
      'SELECT * FROM conversation_messages WHERE conversation_id = ? ORDER BY created_at',
      [req.params.id]
    );

    res.json({
      conversation,
      messages,
    });
  } catch (error) {
    console.error('Get conversation error:', error);
    res.status(500).json({ error: true, message: error.message });
  }
});

/**
 * DELETE /api/agent/conversations/:id
 * Delete a conversation
 */
router.delete('/conversations/:id', async (req, res) => {
  try {
    const result = await update(
      'DELETE FROM conversations WHERE id = ?',
      [req.params.id]
    );

    if (result === 0) {
      return res.status(404).json({ error: true, message: 'Conversation not found' });
    }

    res.json({ success: true });
  } catch (error) {
    console.error('Delete conversation error:', error);
    res.status(500).json({ error: true, message: error.message });
  }
});

/**
 * GET /api/agent/history
 * Get query history
 */
router.get('/history', async (req, res) => {
  try {
    const { limit = 50, offset = 0 } = req.query;

    const history = await query(
      `SELECT * FROM query_history ORDER BY created_at DESC LIMIT ${parseInt(limit)} OFFSET ${parseInt(offset)}`
    );

    res.json({ history });
  } catch (error) {
    console.error('Get history error:', error);
    res.status(500).json({ error: true, message: error.message });
  }
});

/**
 * POST /api/agent/feedback
 * Submit feedback for a query
 */
router.post('/feedback', async (req, res) => {
  try {
    const { queryId, rating, feedback } = req.body;

    if (!queryId) {
      return res.status(400).json({ error: true, message: 'queryId is required' });
    }

    await update(
      'UPDATE query_history SET user_rating = ?, user_feedback = ? WHERE id = ?',
      [rating, feedback, queryId]
    );

    res.json({ success: true });
  } catch (error) {
    console.error('Submit feedback error:', error);
    res.status(500).json({ error: true, message: error.message });
  }
});

export default router;
