"""
Chunk model - CRUD operations for document chunks
"""
import json
from database import get_cursor
from typing import Optional, List, Dict, Any


def create_chunk(document_id: int, chunk_index: int, content: str,
                 content_length: int, token_estimate: int,
                 chunk_hash: Optional[str] = None,
                 hierarchy_path: Optional[str] = None,
                 hierarchy_json: Optional[List] = None,
                 hierarchy_level: Optional[int] = None,
                 paragraph_start: Optional[int] = None,
                 paragraph_end: Optional[int] = None) -> int:
    """Create a new chunk"""
    with get_cursor() as cursor:
        cursor.execute("""
            INSERT INTO chunks
            (document_id, chunk_index, content, content_length, token_estimate,
             content_hash, hierarchy_path, hierarchy_json, hierarchy_level,
             paragraph_start, paragraph_end)
            VALUES (%s, %s, %s, %s, %s, %s, %s, %s, %s, %s, %s)
        """, (
            document_id, chunk_index, content, content_length, token_estimate,
            chunk_hash, hierarchy_path,
            json.dumps(hierarchy_json) if hierarchy_json else None,
            hierarchy_level, paragraph_start, paragraph_end
        ))
        return cursor.lastrowid


def get_chunk_by_id(chunk_id: int) -> Optional[Dict[str, Any]]:
    """Get chunk by ID with document info"""
    with get_cursor() as cursor:
        cursor.execute("""
            SELECT c.*, d.original_name as document_name
            FROM chunks c
            JOIN documents d ON c.document_id = d.id
            WHERE c.id = %s
        """, (chunk_id,))
        row = cursor.fetchone()
        if row and row.get('hierarchy_json'):
            try:
                row['hierarchy_json'] = json.loads(row['hierarchy_json'])
            except:
                pass
        return row


def get_chunks(document_id: Optional[int] = None, limit: int = 50,
               offset: int = 0) -> List[Dict[str, Any]]:
    """Get chunks with optional document filter"""
    with get_cursor() as cursor:
        if document_id:
            cursor.execute("""
                SELECT c.id, c.document_id, c.content, c.content_length,
                       c.token_estimate, c.hierarchy_path, c.hierarchy_level,
                       c.vector_id, d.original_name as document_name
                FROM chunks c
                JOIN documents d ON c.document_id = d.id
                WHERE c.document_id = %s
                ORDER BY c.id
                LIMIT %s OFFSET %s
            """, (document_id, limit, offset))
        else:
            cursor.execute("""
                SELECT c.id, c.document_id, c.content, c.content_length,
                       c.token_estimate, c.hierarchy_path, c.hierarchy_level,
                       c.vector_id, d.original_name as document_name
                FROM chunks c
                JOIN documents d ON c.document_id = d.id
                ORDER BY c.id DESC
                LIMIT %s OFFSET %s
            """, (limit, offset))
        return cursor.fetchall()


def get_chunk_count_by_document(document_id: int) -> int:
    """Get chunk count for a document"""
    with get_cursor() as cursor:
        cursor.execute(
            "SELECT COUNT(*) as count FROM chunks WHERE document_id = %s",
            (document_id,)
        )
        result = cursor.fetchone()
        return result['count'] if result else 0


def get_chunk_stats() -> Dict[str, Any]:
    """Get chunk statistics"""
    with get_cursor() as cursor:
        cursor.execute("""
            SELECT
                COUNT(*) as total_chunks,
                ROUND(AVG(token_estimate)) as avg_tokens,
                MIN(token_estimate) as min_tokens,
                MAX(token_estimate) as max_tokens
            FROM chunks
        """)
        result = cursor.fetchone()
        return {
            'totalChunks': result['total_chunks'] or 0,
            'avgTokens': result['avg_tokens'] or 0,
            'minTokens': result['min_tokens'] or 0,
            'maxTokens': result['max_tokens'] or 0
        }


def delete_chunks_by_document_id(document_id: int):
    """Delete all chunks for a document"""
    with get_cursor() as cursor:
        cursor.execute("DELETE FROM chunks WHERE document_id = %s", (document_id,))


def update_chunk_vector(chunk_id: int, vector_id: str, embedding_model: str):
    """Update chunk with vector ID"""
    with get_cursor() as cursor:
        cursor.execute("""
            UPDATE chunks SET vector_id = %s, embedding_model = %s
            WHERE id = %s
        """, (str(vector_id), embedding_model, chunk_id))


def search_chunks_text(query: str, document_id: Optional[int] = None,
                       limit: int = 50) -> List[Dict[str, Any]]:
    """Full-text search in chunks"""
    with get_cursor() as cursor:
        search_pattern = f"%{query}%"
        if document_id:
            cursor.execute("""
                SELECT c.id, c.document_id, c.content, c.content_length,
                       c.token_estimate, c.hierarchy_path, c.hierarchy_level,
                       c.vector_id, d.original_name as document_name
                FROM chunks c
                JOIN documents d ON c.document_id = d.id
                WHERE c.document_id = %s AND c.content LIKE %s
                ORDER BY c.id
                LIMIT %s
            """, (document_id, search_pattern, limit))
        else:
            cursor.execute("""
                SELECT c.id, c.document_id, c.content, c.content_length,
                       c.token_estimate, c.hierarchy_path, c.hierarchy_level,
                       c.vector_id, d.original_name as document_name
                FROM chunks c
                JOIN documents d ON c.document_id = d.id
                WHERE c.content LIKE %s
                ORDER BY c.id
                LIMIT %s
            """, (search_pattern, limit))
        return cursor.fetchall()


def get_chunks_by_ids(chunk_ids: List[int]) -> List[Dict[str, Any]]:
    """Get multiple chunks by IDs"""
    if not chunk_ids:
        return []
    with get_cursor() as cursor:
        placeholders = ','.join(['%s'] * len(chunk_ids))
        cursor.execute(f"""
            SELECT c.*, d.original_name as document_name
            FROM chunks c
            JOIN documents d ON c.document_id = d.id
            WHERE c.id IN ({placeholders})
        """, tuple(chunk_ids))
        return cursor.fetchall()


def get_chunk_tree(document_id: int) -> Dict[str, Any]:
    """Build hierarchical tree structure for document chunks"""
    with get_cursor() as cursor:
        cursor.execute("""
            SELECT id, content, hierarchy_path, hierarchy_json,
                   hierarchy_level, token_estimate
            FROM chunks
            WHERE document_id = %s
            ORDER BY id
        """, (document_id,))
        chunks = cursor.fetchall()

    # Build tree structure
    tree = {'name': 'root', 'children': [], 'chunks': []}

    for chunk in chunks:
        hierarchy_json = chunk.get('hierarchy_json')
        if hierarchy_json:
            try:
                hierarchy = json.loads(hierarchy_json) if isinstance(hierarchy_json, str) else hierarchy_json
            except:
                hierarchy = []
        else:
            hierarchy = []

        chunk_data = {
            'id': chunk['id'],
            'preview': chunk['content'][:100] + '...' if len(chunk['content']) > 100 else chunk['content'],
            'tokenEstimate': chunk['token_estimate']
        }

        if not hierarchy:
            # Orphan chunk (no hierarchy)
            tree['chunks'].append(chunk_data)
        else:
            # Navigate/create tree path
            current = tree
            for i, node_info in enumerate(hierarchy):
                node_name = node_info.get('name', 'Unknown')
                node_level = node_info.get('level', i + 1)

                # Find or create child node
                child = next(
                    (c for c in current.get('children', []) if c['name'] == node_name),
                    None
                )
                if not child:
                    child = {
                        'name': node_name,
                        'level': node_level,
                        'children': [],
                        'chunks': []
                    }
                    if 'children' not in current:
                        current['children'] = []
                    current['children'].append(child)
                current = child

            # Add chunk to leaf node
            current['chunks'].append(chunk_data)

    return tree


def get_hierarchy_summary(document_id: int) -> Dict[str, int]:
    """Get hierarchy summary for a document"""
    with get_cursor() as cursor:
        cursor.execute("""
            SELECT
                COUNT(*) as total_chunks,
                SUM(CASE WHEN hierarchy_path IS NOT NULL AND hierarchy_path != '' THEN 1 ELSE 0 END) as with_hierarchy,
                SUM(CASE WHEN hierarchy_path IS NULL OR hierarchy_path = '' THEN 1 ELSE 0 END) as without_hierarchy
            FROM chunks
            WHERE document_id = %s
        """, (document_id,))
        result = cursor.fetchone()
        return {
            'totalChunks': result['total_chunks'] or 0,
            'chunksWithHierarchy': result['with_hierarchy'] or 0,
            'chunksWithoutHierarchy': result['without_hierarchy'] or 0
        }
