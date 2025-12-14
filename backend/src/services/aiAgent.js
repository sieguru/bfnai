import Anthropic from '@anthropic-ai/sdk';
import config from '../config/env.js';

let anthropicClient = null;

const SYSTEM_PROMPT = `You are a legal document assistant that answers questions EXCLUSIVELY based on the provided rules.

CRITICAL RULES - YOU MUST FOLLOW THESE:
1. ONLY use information explicitly stated in the <documents> section below
2. If the answer cannot be found in the provided documents, respond with: "I cannot find information about this in the BFN rules. The rules I have access to cover: [list main topics from provided chunks]"
3. NEVER use outside knowledge, even if you know the answer from training
4. NEVER make assumptions or inferences beyond what's explicitly stated
5. If documents are ambiguous, say so clearly
6. If documents seem contradictory, point out the contradiction with citations

CITATION REQUIREMENTS:
- Always cite sources as [Document: X, Section: Y] after relevant statements
- Quote exact text for critical legal language using quotation marks
- Distinguish between direct statements and reasonable interpretations

RESPONSE FORMAT:
- Always respond in Swedish
- Lead with a direct answer to the question
- Provide supporting details with citations
- Note any limitations or caveats
- If multiple documents are relevant, synthesize them coherently

Remember: It's better to say "I don't have information about that" than to guess or use outside knowledge.`;

/**
 * Get Anthropic client
 */
function getClient() {
  if (!anthropicClient) {
    anthropicClient = new Anthropic({
      apiKey: config.anthropic.apiKey,
    });
  }
  return anthropicClient;
}

/**
 * Format retrieved chunks for context
 */
export function formatChunksForContext(chunks) {
  if (!chunks || chunks.length === 0) {
    return '<documents>\nNo relevant documents found.\n</documents>';
  }

  const formattedChunks = chunks.map((chunk, index) => {
    const docName = chunk.document_name || `Document ${chunk.document_id}`;
    const section = chunk.hierarchy_path || 'Unknown section';

    return `<document index="${index + 1}">
<source>Document: ${docName}, Section: ${section}</source>
<chunk_id>${chunk.id || chunk.chunk_id}</chunk_id>
<content>
${chunk.content || chunk.text}
</content>
</document>`;
  }).join('\n\n');

  return `<documents>
${formattedChunks}
</documents>`;
}

/**
 * Chat with the AI agent
 */
export async function chat(query, conversationHistory = [], retrievedChunks = []) {
  const client = getClient();

  // Build messages array
  const messages = [];

  // Add conversation history
  for (const msg of conversationHistory) {
    messages.push({
      role: msg.role,
      content: msg.content,
    });
  }

  // Build the user message with context
  const context = formatChunksForContext(retrievedChunks);
  const userMessage = `${context}

<user_question>
${query}
</user_question>

Please answer the question based ONLY on the documents provided above. Include citations for all factual statements.`;

  messages.push({
    role: 'user',
    content: userMessage,
  });

  const startTime = Date.now();

  const response = await client.messages.create({
    model: config.anthropic.model,
    max_tokens: 4096,
    system: SYSTEM_PROMPT,
    messages,
  });

  const responseTime = Date.now() - startTime;
  const assistantMessage = response.content[0].text;

  // Extract citations from the response
  const citations = extractCitations(assistantMessage, retrievedChunks);

  return {
    response: assistantMessage,
    citations,
    tokensUsed: response.usage?.input_tokens + response.usage?.output_tokens,
    responseTimeMs: responseTime,
    chunksUsed: retrievedChunks.map(c => c.id || c.chunk_id),
  };
}

/**
 * Extract citations from the response text
 */
export function extractCitations(responseText, chunks) {
  const citations = [];
  const citationPattern = /\[Document:\s*([^,\]]+),\s*Section:\s*([^\]]+)\]/g;

  let match;
  while ((match = citationPattern.exec(responseText)) !== null) {
    const docName = match[1].trim();
    const section = match[2].trim();

    // Try to find the matching chunk
    const matchingChunk = chunks.find(c => {
      const chunkDocName = c.document_name || `Document ${c.document_id}`;
      const chunkSection = c.hierarchy_path || '';
      return (
        chunkDocName.toLowerCase().includes(docName.toLowerCase()) ||
        docName.toLowerCase().includes(chunkDocName.toLowerCase()) ||
        chunkSection.toLowerCase().includes(section.toLowerCase())
      );
    });

    citations.push({
      documentName: docName,
      section,
      chunkId: matchingChunk?.id || matchingChunk?.chunk_id || null,
      position: match.index,
    });
  }

  return citations;
}

/**
 * Generate a summary of document topics
 */
export async function summarizeTopics(chunks) {
  if (!chunks || chunks.length === 0) {
    return 'No documents available.';
  }

  const client = getClient();

  const context = formatChunksForContext(chunks.slice(0, 10)); // Limit to 10 chunks

  const response = await client.messages.create({
    model: config.anthropic.model,
    max_tokens: 500,
    messages: [
      {
        role: 'user',
        content: `${context}

Based on these document excerpts, provide a brief summary (2-3 sentences) of the main topics covered. Just list the topics, don't explain them in detail.`,
      },
    ],
  });

  return response.content[0].text;
}
