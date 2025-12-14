"""
Document model - CRUD operations for documents and styles
"""
from enum import Enum
from database import get_cursor
from typing import Optional, List, Dict, Any


class DocumentStatus(str, Enum):
    PENDING = 'pending'
    PROCESSING = 'processing'
    COMPLETED = 'completed'
    ERROR = 'error'


def create_document(filename: str, original_name: str, file_size: int,
                    status: str = DocumentStatus.PENDING) -> int:
    """Create a new document record"""
    with get_cursor() as cursor:
        cursor.execute("""
            INSERT INTO documents (stored_name, original_name, file_size, status)
            VALUES (%s, %s, %s, %s)
        """, (filename, original_name, file_size, status))
        return cursor.lastrowid


def get_document_by_id(doc_id: int) -> Optional[Dict[str, Any]]:
    """Get document by ID"""
    with get_cursor() as cursor:
        cursor.execute("""
            SELECT id, stored_name as filename, original_name, file_size,
                   status, error_message, created_at, updated_at
            FROM documents WHERE id = %s
        """, (doc_id,))
        return cursor.fetchone()


def get_all_documents(status: Optional[str] = None, limit: int = 100,
                      offset: int = 0) -> List[Dict[str, Any]]:
    """Get all documents with optional status filter"""
    with get_cursor() as cursor:
        if status:
            cursor.execute("""
                SELECT id, stored_name as filename, original_name, file_size,
                       status, error_message, created_at, updated_at
                FROM documents WHERE status = %s
                ORDER BY created_at DESC
                LIMIT %s OFFSET %s
            """, (status, limit, offset))
        else:
            cursor.execute("""
                SELECT id, stored_name as filename, original_name, file_size,
                       status, error_message, created_at, updated_at
                FROM documents
                ORDER BY created_at DESC
                LIMIT %s OFFSET %s
            """, (limit, offset))
        return cursor.fetchall()


def update_document_status(doc_id: int, status: str,
                           error_message: Optional[str] = None):
    """Update document status"""
    with get_cursor() as cursor:
        cursor.execute("""
            UPDATE documents SET status = %s, error_message = %s
            WHERE id = %s
        """, (status, error_message, doc_id))


def delete_document(doc_id: int):
    """Delete document (chunks cascade delete)"""
    with get_cursor() as cursor:
        cursor.execute("DELETE FROM documents WHERE id = %s", (doc_id,))


def get_document_stats() -> Dict[str, int]:
    """Get document statistics"""
    with get_cursor() as cursor:
        cursor.execute("""
            SELECT
                COUNT(*) as total,
                SUM(CASE WHEN status = 'completed' THEN 1 ELSE 0 END) as completed,
                SUM(CASE WHEN status = 'pending' THEN 1 ELSE 0 END) as pending,
                SUM(CASE WHEN status = 'processing' THEN 1 ELSE 0 END) as processing,
                SUM(CASE WHEN status = 'error' THEN 1 ELSE 0 END) as error
            FROM documents
        """)
        result = cursor.fetchone()
        return {
            'total': result['total'] or 0,
            'completed': result['completed'] or 0,
            'pending': result['pending'] or 0,
            'processing': result['processing'] or 0,
            'error': result['error'] or 0
        }


# Document Styles

def save_document_styles(doc_id: int, styles: List[Dict[str, Any]]):
    """Save detected styles for a document"""
    with get_cursor() as cursor:
        # Clear existing styles
        cursor.execute("DELETE FROM document_styles WHERE document_id = %s", (doc_id,))

        # Insert new styles
        for style in styles:
            cursor.execute("""
                INSERT INTO document_styles
                (document_id, style_name, heading_level, sample_text, occurrence_count)
                VALUES (%s, %s, %s, %s, %s)
            """, (
                doc_id,
                style.get('style_name'),
                style.get('heading_level'),
                style.get('sample_text', '')[:500],
                style.get('occurrence_count', 0)
            ))


def get_document_styles(doc_id: int) -> List[Dict[str, Any]]:
    """Get styles for a document"""
    with get_cursor() as cursor:
        cursor.execute("""
            SELECT style_name, heading_level, sample_text, occurrence_count,
                   CASE WHEN heading_level IS NOT NULL THEN 1 ELSE 0 END as is_configured
            FROM document_styles
            WHERE document_id = %s
            ORDER BY occurrence_count DESC
        """, (doc_id,))
        return cursor.fetchall()


def update_document_style_config(doc_id: int, style_name: str,
                                  heading_level: Optional[int]):
    """Update style configuration"""
    with get_cursor() as cursor:
        cursor.execute("""
            UPDATE document_styles
            SET heading_level = %s
            WHERE document_id = %s AND style_name = %s
        """, (heading_level, doc_id, style_name))
