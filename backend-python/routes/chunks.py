"""
Chunks API routes
"""
import math
from flask import Blueprint, request, jsonify
from models.chunk import (
    get_chunks, get_chunk_by_id, get_chunk_stats, get_chunk_tree,
    search_chunks_text, get_chunks_by_ids, get_hierarchy_summary,
    update_chunk_vector
)
from services.vector_store import (
    get_vector, scroll_vectors, is_qdrant_available
)
from services.embeddings import get_embedding_info

bp = Blueprint('chunks', __name__, url_prefix='/api/chunks')


@bp.route('/', methods=['GET'])
def list_chunks():
    """List chunks with pagination"""
    try:
        document_id = request.args.get('documentId', type=int)
        limit = request.args.get('limit', 100, type=int)
        offset = request.args.get('offset', 0, type=int)

        chunks = get_chunks(document_id, limit, offset)
        return jsonify({'chunks': chunks})

    except Exception as e:
        print(f"Get chunks error: {e}")
        return jsonify({'error': True, 'message': str(e)}), 500


@bp.route('/stats', methods=['GET'])
def chunk_stats():
    """Get chunk statistics"""
    try:
        stats = get_chunk_stats()
        return jsonify(stats)
    except Exception as e:
        print(f"Get chunk stats error: {e}")
        return jsonify({'error': True, 'message': str(e)}), 500


@bp.route('/tree/<int:document_id>', methods=['GET'])
def chunk_tree(document_id):
    """Get hierarchical tree structure for document"""
    try:
        tree = get_chunk_tree(document_id)
        return jsonify({'tree': tree})
    except Exception as e:
        print(f"Get chunk tree error: {e}")
        return jsonify({'error': True, 'message': str(e)}), 500


@bp.route('/search', methods=['GET'])
def search_chunks():
    """Search chunks by text content"""
    try:
        q = request.args.get('q')
        document_id = request.args.get('documentId', type=int)
        limit = request.args.get('limit', 50, type=int)

        if not q:
            return jsonify({'error': True, 'message': 'Search query (q) is required'}), 400

        chunks = search_chunks_text(q, document_id, limit)
        return jsonify({'chunks': chunks})

    except Exception as e:
        print(f"Search chunks error: {e}")
        return jsonify({'error': True, 'message': str(e)}), 500


@bp.route('/sync-vectors', methods=['GET'])
def sync_vectors_info():
    """Info for sync vectors endpoint"""
    return jsonify({'message': 'Use POST method to sync vectors'})


@bp.route('/sync-vectors', methods=['POST'])
def sync_vectors():
    """Sync vector_ids from Qdrant to MySQL chunks"""
    print('=== SYNC-VECTORS ENDPOINT HIT ===')
    try:
        if not is_qdrant_available():
            return jsonify({'error': True, 'message': 'Qdrant not available'}), 503

        embedding_info = get_embedding_info()
        synced = 0
        skipped = 0
        offset = None

        # Scroll through all vectors in Qdrant
        while True:
            result = scroll_vectors(100, offset, False)

            for point in result['points']:
                chunk_id = point.payload.get('chunk_id') if point.payload else None
                if chunk_id:
                    # Check if chunk exists first
                    chunk = get_chunk_by_id(chunk_id)
                    if chunk:
                        # Update the chunk with vector_id
                        update_chunk_vector(chunk_id, point.id, embedding_info['model'])
                        synced += 1
                    else:
                        skipped += 1

            if not result['nextOffset']:
                break
            offset = result['nextOffset']

        return jsonify({
            'success': True,
            'synced': synced,
            'skipped': skipped,
            'message': f'Synced {synced} vector IDs, skipped {skipped} orphaned vectors'
        })

    except Exception as e:
        print(f"Sync vectors error: {e}")
        return jsonify({'error': True, 'message': str(e)}), 500


@bp.route('/vectors/browse', methods=['GET'])
def browse_vectors():
    """Browse all vectors with pagination"""
    try:
        limit = min(request.args.get('limit', 20, type=int), 100)
        offset = request.args.get('offset')
        include_values = request.args.get('values', 'false').lower() == 'true'

        if not is_qdrant_available():
            return jsonify({'error': True, 'message': 'Qdrant not available'}), 503

        result = scroll_vectors(limit, offset, include_values)

        points = []
        for point in result['points']:
            point_data = {
                'id': point.id,
                'payload': point.payload,
                'dimension': len(point.vector) if include_values and point.vector else None,
                'vector': point.vector if include_values else None,
                'vectorPreview': f"[{', '.join(f'{v:.4f}' for v in point.vector[:5])}...]" if include_values and point.vector else None
            }
            points.append(point_data)

        return jsonify({
            'points': points,
            'nextOffset': result['nextOffset'],
            'hasMore': result['nextOffset'] is not None
        })

    except Exception as e:
        print(f"Browse vectors error: {e}")
        return jsonify({'error': True, 'message': str(e)}), 500


@bp.route('/hierarchy-summary/<int:document_id>', methods=['GET'])
def hierarchy_summary(document_id):
    """Get summary of chunk hierarchy status for debugging"""
    try:
        summary = get_hierarchy_summary(document_id)
        return jsonify(summary)
    except Exception as e:
        print(f"Get hierarchy summary error: {e}")
        return jsonify({'error': True, 'message': str(e)}), 500


@bp.route('/<int:chunk_id>', methods=['GET'])
def get_chunk(chunk_id):
    """Get single chunk by ID"""
    try:
        chunk = get_chunk_by_id(chunk_id)

        if not chunk:
            return jsonify({'error': True, 'message': 'Chunk not found'}), 404

        return jsonify(chunk)

    except Exception as e:
        print(f"Get chunk error: {e}")
        return jsonify({'error': True, 'message': str(e)}), 500


@bp.route('/batch', methods=['POST'])
def batch_chunks():
    """Get multiple chunks by IDs"""
    try:
        data = request.get_json()
        ids = data.get('ids', [])

        if not isinstance(ids, list):
            return jsonify({'error': True, 'message': 'ids must be an array'}), 400

        chunks = get_chunks_by_ids(ids)
        return jsonify({'chunks': chunks})

    except Exception as e:
        print(f"Get batch chunks error: {e}")
        return jsonify({'error': True, 'message': str(e)}), 500


@bp.route('/<int:chunk_id>/vector', methods=['GET'])
def get_chunk_vector(chunk_id):
    """Get the vector embedding for a chunk"""
    try:
        include_values = request.args.get('values', 'true').lower() != 'false'

        # First get the chunk to find its vector_id
        chunk = get_chunk_by_id(chunk_id)

        if not chunk:
            return jsonify({'error': True, 'message': 'Chunk not found'}), 404

        if not chunk.get('vector_id'):
            return jsonify({
                'error': True,
                'message': 'No vector stored for this chunk',
                'chunk': {
                    'id': chunk['id'],
                    'embedding_model': chunk.get('embedding_model')
                }
            }), 404

        # Get vector from Qdrant
        vector_id = chunk['vector_id']
        if isinstance(vector_id, str) and vector_id.isdigit():
            vector_id = int(vector_id)

        vector = get_vector(vector_id, include_values)

        if not vector:
            return jsonify({
                'error': True,
                'message': 'Vector not found in Qdrant. The document may need to be reprocessed.',
                'vectorId': chunk['vector_id'],
                'hint': 'Try reprocessing this document to regenerate vectors'
            }), 404

        result = {
            'chunkId': chunk['id'],
            'vectorId': vector.id,
            'embeddingModel': chunk.get('embedding_model'),
            'dimension': len(vector.vector) if include_values and vector.vector else None,
            'vector': vector.vector if include_values else None,
            'payload': vector.payload
        }

        # Include stats about the vector
        if include_values and vector.vector:
            vec = vector.vector
            result['stats'] = {
                'min': min(vec),
                'max': max(vec),
                'mean': sum(vec) / len(vec),
                'norm': math.sqrt(sum(v * v for v in vec))
            }

        return jsonify(result)

    except Exception as e:
        print(f"Get chunk vector error: {e}")
        return jsonify({'error': True, 'message': str(e)}), 500
