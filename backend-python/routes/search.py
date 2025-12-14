"""
Search API routes
"""
import time
from flask import Blueprint, request, jsonify
from services.embeddings import generate_embedding, get_embedding_info
from services.vector_store import (
    search, search_by_documents, get_collection_info, is_qdrant_available,
    clear_collection
)
from models.chunk import get_chunks_by_ids, get_chunk_by_id, search_chunks_text
from database import get_cursor

bp = Blueprint('search', __name__, url_prefix='/api/search')


@bp.route('/', methods=['POST'])
def vector_search():
    """Vector similarity search"""
    try:
        data = request.get_json()
        query = data.get('query')
        limit = data.get('limit', 10)
        document_ids = data.get('documentIds')

        if not query:
            return jsonify({'error': True, 'message': 'Query is required'}), 400

        start_time = time.time()

        # Generate query embedding
        query_vector = generate_embedding(query)

        # Search vector store
        if document_ids and len(document_ids) > 0:
            results = search_by_documents(query_vector, document_ids, limit)
        else:
            results = search(query_vector, limit)

        # Fetch full chunk data
        chunk_ids = [r['payload']['chunk_id'] for r in results]
        chunks = get_chunks_by_ids(chunk_ids)

        # Combine results with scores
        enriched_results = []
        for result in results:
            chunk = next((c for c in chunks if c['id'] == result['payload']['chunk_id']), None)
            enriched_results.append({
                **result,
                'chunk': chunk
            })

        search_time = int((time.time() - start_time) * 1000)

        return jsonify({
            'results': enriched_results,
            'query': query,
            'searchTimeMs': search_time,
            'totalResults': len(results)
        })

    except Exception as e:
        print(f"Search error: {e}")
        return jsonify({'error': True, 'message': str(e)}), 500


@bp.route('/similar/<int:chunk_id>', methods=['POST'])
def find_similar(chunk_id):
    """Find chunks similar to a given chunk"""
    try:
        data = request.get_json() or {}
        limit = data.get('limit', 10)
        exclude_same_document = data.get('excludeSameDocument', False)

        # Get the chunk
        chunk = get_chunk_by_id(chunk_id)
        if not chunk:
            return jsonify({'error': True, 'message': 'Chunk not found'}), 404

        # Generate embedding for this chunk's content
        query_vector = generate_embedding(chunk['content'])

        # Search for similar chunks
        from qdrant_client.http import models
        filter_conditions = None
        if exclude_same_document:
            filter_conditions = models.Filter(
                must_not=[
                    models.FieldCondition(
                        key="document_id",
                        match=models.MatchValue(value=chunk['document_id'])
                    )
                ]
            )

        results = search(query_vector, limit + 1, filter_conditions)

        # Remove the source chunk from results
        filtered_results = [r for r in results if r['payload']['chunk_id'] != chunk_id]

        # Fetch full chunk data
        chunk_ids = [r['payload']['chunk_id'] for r in filtered_results[:limit]]
        chunks = get_chunks_by_ids(chunk_ids)

        enriched_results = []
        for result in filtered_results[:limit]:
            matched_chunk = next((c for c in chunks if c['id'] == result['payload']['chunk_id']), None)
            enriched_results.append({
                **result,
                'chunk': matched_chunk
            })

        return jsonify({
            'sourceChunk': chunk,
            'results': enriched_results
        })

    except Exception as e:
        print(f"Similar search error: {e}")
        return jsonify({'error': True, 'message': str(e)}), 500


@bp.route('/hybrid', methods=['POST'])
def hybrid_search():
    """Combined vector + keyword search"""
    try:
        data = request.get_json()
        query = data.get('query')
        limit = data.get('limit', 10)
        document_ids = data.get('documentIds')
        vector_weight = data.get('vectorWeight', 0.7)

        if not query:
            return jsonify({'error': True, 'message': 'Query is required'}), 400

        start_time = time.time()

        # Vector search
        query_vector = generate_embedding(query)
        if document_ids and len(document_ids) > 0:
            vector_results = search_by_documents(query_vector, document_ids, limit * 2)
        else:
            vector_results = search(query_vector, limit * 2)

        # Keyword search
        keyword_results = search_chunks_text(
            query,
            document_ids[0] if document_ids else None,
            limit * 2
        )

        # Combine and rank results
        score_map = {}

        # Add vector scores
        for idx, result in enumerate(vector_results):
            chunk_id = result['payload']['chunk_id']
            normalized_score = result['score'] * vector_weight
            score_map[chunk_id] = {
                'chunkId': chunk_id,
                'vectorScore': result['score'],
                'keywordScore': 0,
                'combinedScore': normalized_score,
                'vectorRank': idx + 1
            }

        # Add keyword scores
        for idx, chunk in enumerate(keyword_results):
            keyword_score = 1 - (idx / len(keyword_results)) if keyword_results else 0
            normalized_score = keyword_score * (1 - vector_weight)

            if chunk['id'] in score_map:
                score_map[chunk['id']]['keywordScore'] = keyword_score
                score_map[chunk['id']]['combinedScore'] += normalized_score
                score_map[chunk['id']]['keywordRank'] = idx + 1
            else:
                score_map[chunk['id']] = {
                    'chunkId': chunk['id'],
                    'vectorScore': 0,
                    'keywordScore': keyword_score,
                    'combinedScore': normalized_score,
                    'keywordRank': idx + 1
                }

        # Sort by combined score
        sorted_scores = sorted(score_map.values(), key=lambda x: x['combinedScore'], reverse=True)[:limit]

        # Fetch chunk data
        chunk_ids = [s['chunkId'] for s in sorted_scores]
        chunks = get_chunks_by_ids(chunk_ids)

        results = []
        for score_info in sorted_scores:
            chunk = next((c for c in chunks if c['id'] == score_info['chunkId']), None)
            results.append({
                **score_info,
                'chunk': chunk
            })

        search_time = int((time.time() - start_time) * 1000)

        return jsonify({
            'results': results,
            'query': query,
            'searchTimeMs': search_time,
            'totalResults': len(results),
            'weights': {'vector': vector_weight, 'keyword': 1 - vector_weight}
        })

    except Exception as e:
        print(f"Hybrid search error: {e}")
        return jsonify({'error': True, 'message': str(e)}), 500


@bp.route('/collection', methods=['GET'])
def collection_info():
    """Get Qdrant collection info and stats"""
    try:
        available = is_qdrant_available()

        if not available:
            return jsonify({
                'available': False,
                'message': 'Qdrant is not connected'
            })

        info = get_collection_info()
        embedding_info = get_embedding_info()

        if not info:
            return jsonify({
                'available': True,
                'exists': False,
                'message': 'Collection does not exist yet',
                'embedding': embedding_info
            })

        return jsonify({
            'available': True,
            'exists': True,
            'collection': info,
            'embedding': embedding_info
        })

    except Exception as e:
        print(f"Get collection info error: {e}")
        return jsonify({'error': True, 'message': str(e)}), 500


@bp.route('/collection', methods=['DELETE'])
def delete_collection():
    """Clear all vectors from Qdrant collection"""
    try:
        available = is_qdrant_available()

        if not available:
            return jsonify({
                'error': True,
                'message': 'Qdrant is not connected'
            }), 503

        result = clear_collection()

        # Also clear vector_id from all chunks in MySQL
        with get_cursor() as cursor:
            cursor.execute('UPDATE chunks SET vector_id = NULL, embedded_at = NULL, embedding_model = NULL')
            cleared = cursor.rowcount

        return jsonify({
            'success': True,
            'qdrant': result,
            'chunksCleared': cleared,
            'message': 'Collection deleted and chunk vector references cleared. Re-process documents to recreate vectors.'
        })

    except Exception as e:
        print(f"Clear collection error: {e}")
        return jsonify({'error': True, 'message': str(e)}), 500
