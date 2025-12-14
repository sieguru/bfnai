"""
Chunker service - Split documents into semantic chunks based on styles
"""
import hashlib
from typing import List, Dict, Any, Optional


def estimate_tokens(text: str) -> int:
    """Estimate token count (rough approximation: ~4 chars per token)"""
    return len(text) // 4


def chunk_document(parsed_doc: Dict[str, Any], style_mapping: Dict[str, Any],
                   options: Optional[Dict[str, Any]] = None) -> List[Dict[str, Any]]:
    """
    Chunk a parsed document based on style mappings and hierarchy.

    Args:
        parsed_doc: Output from parse_document_structured()
        style_mapping: Dict mapping style names to {headingLevel, isBodyText, isIgnored}
        options: {maxChunkTokens: int, overlapParagraphs: int}

    Returns:
        List of chunk dictionaries
    """
    options = options or {}
    max_chunk_tokens = options.get('maxChunkTokens', 500)
    overlap_paragraphs = options.get('overlapParagraphs', 1)

    paragraphs = parsed_doc.get('paragraphs', [])
    chunks = []
    current_hierarchy = []  # Stack of {name, level}
    current_chunk_paragraphs = []
    current_chunk_start = 0

    def get_style_config(style_name: str) -> Dict[str, Any]:
        """Get configuration for a style"""
        return style_mapping.get(style_name, {
            'headingLevel': None,
            'isBodyText': True,
            'isIgnored': False
        })

    def build_hierarchy_path() -> str:
        """Build hierarchy path string from current stack"""
        if not current_hierarchy:
            return ''
        return ' > '.join(h['name'] for h in current_hierarchy)

    def build_hierarchy_json() -> List[Dict[str, Any]]:
        """Build hierarchy JSON array"""
        return [{'name': h['name'], 'level': h['level']} for h in current_hierarchy]

    def get_hierarchy_level() -> Optional[int]:
        """Get current hierarchy level"""
        if not current_hierarchy:
            return None
        return current_hierarchy[-1]['level']

    def flush_chunk(para_end: int):
        """Save current chunk if it has content"""
        nonlocal current_chunk_paragraphs, current_chunk_start

        if not current_chunk_paragraphs:
            return

        content = '\n\n'.join(p['text'] for p in current_chunk_paragraphs)
        content_length = len(content)
        token_estimate = estimate_tokens(content)

        chunk = {
            'chunkIndex': len(chunks),
            'content': content,
            'contentLength': content_length,
            'tokenEstimate': token_estimate,
            'hierarchyPath': build_hierarchy_path(),
            'hierarchyJson': build_hierarchy_json(),
            'hierarchyLevel': get_hierarchy_level(),
            'paragraphStart': current_chunk_start,
            'paragraphEnd': para_end,
            'chunkHash': hashlib.sha256(content.encode()).hexdigest()[:16]
        }

        chunks.append(chunk)
        current_chunk_paragraphs = []

    for i, para in enumerate(paragraphs):
        style_config = get_style_config(para['style'])

        # Skip ignored styles
        if style_config.get('isIgnored'):
            continue

        heading_level = style_config.get('headingLevel')

        if heading_level:
            # This is a heading - flush current chunk and update hierarchy
            flush_chunk(i - 1)
            current_chunk_start = i

            # Pop hierarchy stack to appropriate level
            while current_hierarchy and current_hierarchy[-1]['level'] >= heading_level:
                current_hierarchy.pop()

            # Push new heading onto stack
            current_hierarchy.append({
                'name': para['text'][:100],  # Truncate long headings
                'level': heading_level
            })

            # Start new chunk with heading
            current_chunk_paragraphs = [para]

        else:
            # Body text - add to current chunk
            if not current_chunk_paragraphs:
                current_chunk_start = i

            current_chunk_paragraphs.append(para)

            # Check if chunk is getting too large
            current_content = '\n\n'.join(p['text'] for p in current_chunk_paragraphs)
            if estimate_tokens(current_content) > max_chunk_tokens:
                # Flush chunk but keep overlap
                flush_chunk(i)

                # Keep last N paragraphs for overlap
                if overlap_paragraphs > 0 and len(current_chunk_paragraphs) == 0:
                    # Retrieve overlap from previous paragraphs
                    overlap_start = max(0, i - overlap_paragraphs + 1)
                    for j in range(overlap_start, i + 1):
                        if j < len(paragraphs):
                            style_cfg = get_style_config(paragraphs[j]['style'])
                            if not style_cfg.get('isIgnored') and not style_cfg.get('headingLevel'):
                                current_chunk_paragraphs.append(paragraphs[j])
                    current_chunk_start = overlap_start

    # Flush final chunk
    if current_chunk_paragraphs:
        flush_chunk(len(paragraphs) - 1)

    return chunks


def get_chunking_stats(chunks: List[Dict[str, Any]]) -> Dict[str, Any]:
    """Calculate statistics for chunks"""
    if not chunks:
        return {
            'totalChunks': 0,
            'avgTokens': 0,
            'minTokens': 0,
            'maxTokens': 0,
            'totalTokens': 0
        }

    token_counts = [c['tokenEstimate'] for c in chunks]

    return {
        'totalChunks': len(chunks),
        'avgTokens': round(sum(token_counts) / len(token_counts)),
        'minTokens': min(token_counts),
        'maxTokens': max(token_counts),
        'totalTokens': sum(token_counts)
    }
