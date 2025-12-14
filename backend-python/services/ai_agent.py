"""
AI Agent service - Chat with Claude using document context
"""
import re
import time
from typing import List, Dict, Any, Optional
import anthropic
from config import Config


# Global client instance
_client = None

SYSTEM_PROMPT = """You are a legal document assistant that answers questions EXCLUSIVELY based on the provided document excerpts.

CRITICAL RULES - YOU MUST FOLLOW THESE:
1. ONLY use information explicitly stated in the <documents> section below
2. If the answer cannot be found in the provided documents, respond with: "I cannot find information about this in the provided documents. The documents I have access to cover: [list main topics from provided chunks]"
3. NEVER use outside knowledge, even if you know the answer from training
4. NEVER make assumptions or inferences beyond what's explicitly stated
5. If documents are ambiguous, say so clearly
6. If documents seem contradictory, point out the contradiction with citations

CITATION REQUIREMENTS:
- Always cite sources as [Document: X, Section: Y] after relevant statements
- Quote exact text for critical legal language using quotation marks
- Distinguish between direct statements and reasonable interpretations

RESPONSE FORMAT:
- Lead with a direct answer to the question
- Provide supporting details with citations
- Note any limitations or caveats
- If multiple documents are relevant, synthesize them coherently

Remember: It's better to say "I don't have information about that" than to guess or use outside knowledge."""


def get_client() -> anthropic.Anthropic:
    """Get Anthropic client"""
    global _client
    if _client is None:
        _client = anthropic.Anthropic(api_key=Config.ANTHROPIC_API_KEY)
    return _client


def format_chunks_for_context(chunks: List[Dict[str, Any]]) -> str:
    """Format retrieved chunks for context"""
    if not chunks:
        return '<documents>\nNo relevant documents found.\n</documents>'

    formatted_chunks = []
    for i, chunk in enumerate(chunks):
        doc_name = chunk.get('document_name') or f"Document {chunk.get('document_id', 'unknown')}"
        section = chunk.get('hierarchy_path') or 'Unknown section'
        chunk_id = chunk.get('id') or chunk.get('chunk_id', 'unknown')
        content = chunk.get('content') or chunk.get('text', '')

        formatted_chunks.append(f'''<document index="{i + 1}">
<source>Document: {doc_name}, Section: {section}</source>
<chunk_id>{chunk_id}</chunk_id>
<content>
{content}
</content>
</document>''')

    return f'''<documents>
{chr(10).join(formatted_chunks)}
</documents>'''


def chat(
    query: str,
    conversation_history: Optional[List[Dict[str, str]]] = None,
    retrieved_chunks: Optional[List[Dict[str, Any]]] = None
) -> Dict[str, Any]:
    """Chat with the AI agent"""
    client = get_client()
    conversation_history = conversation_history or []
    retrieved_chunks = retrieved_chunks or []

    # Build messages array
    messages = []

    # Add conversation history
    for msg in conversation_history:
        messages.append({
            'role': msg['role'],
            'content': msg['content']
        })

    # Build the user message with context
    context = format_chunks_for_context(retrieved_chunks)
    user_message = f"""{context}

<user_question>
{query}
</user_question>

Please answer the question based ONLY on the documents provided above. Include citations for all factual statements."""

    messages.append({
        'role': 'user',
        'content': user_message
    })

    start_time = time.time()

    response = client.messages.create(
        model=Config.ANTHROPIC_MODEL,
        max_tokens=4096,
        system=SYSTEM_PROMPT,
        messages=messages
    )

    response_time = int((time.time() - start_time) * 1000)
    assistant_message = response.content[0].text

    # Extract citations from the response
    citations = extract_citations(assistant_message, retrieved_chunks)

    tokens_used = 0
    if response.usage:
        tokens_used = (response.usage.input_tokens or 0) + (response.usage.output_tokens or 0)

    return {
        'response': assistant_message,
        'citations': citations,
        'tokensUsed': tokens_used,
        'responseTimeMs': response_time,
        'chunksUsed': [c.get('id') or c.get('chunk_id') for c in retrieved_chunks]
    }


def extract_citations(response_text: str, chunks: List[Dict[str, Any]]) -> List[Dict[str, Any]]:
    """Extract citations from the response text"""
    citations = []
    citation_pattern = r'\[Document:\s*([^,\]]+),\s*Section:\s*([^\]]+)\]'

    for match in re.finditer(citation_pattern, response_text):
        doc_name = match.group(1).strip()
        section = match.group(2).strip()

        # Try to find the matching chunk
        matching_chunk = None
        for c in chunks:
            chunk_doc_name = c.get('document_name') or f"Document {c.get('document_id', '')}"
            chunk_section = c.get('hierarchy_path') or ''

            if (doc_name.lower() in chunk_doc_name.lower() or
                chunk_doc_name.lower() in doc_name.lower() or
                section.lower() in chunk_section.lower()):
                matching_chunk = c
                break

        citations.append({
            'documentName': doc_name,
            'section': section,
            'chunkId': matching_chunk.get('id') or matching_chunk.get('chunk_id') if matching_chunk else None,
            'position': match.start()
        })

    return citations


def summarize_topics(chunks: List[Dict[str, Any]]) -> str:
    """Generate a summary of document topics"""
    if not chunks:
        return 'No documents available.'

    client = get_client()

    # Limit to 10 chunks
    context = format_chunks_for_context(chunks[:10])

    response = client.messages.create(
        model=Config.ANTHROPIC_MODEL,
        max_tokens=500,
        messages=[
            {
                'role': 'user',
                'content': f"""{context}

Based on these document excerpts, provide a brief summary (2-3 sentences) of the main topics covered. Just list the topics, don't explain them in detail."""
            }
        ]
    )

    return response.content[0].text
