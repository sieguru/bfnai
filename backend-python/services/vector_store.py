"""
Vector store service - Qdrant operations for semantic search
"""
import uuid
from typing import List, Dict, Any, Optional
from qdrant_client import QdrantClient
from qdrant_client.http import models
from qdrant_client.http.exceptions import UnexpectedResponse
from config import Config
from services.embeddings import get_embedding_dimension


# Global client instance
_client = None


def get_qdrant_client() -> QdrantClient:
    """Get Qdrant client instance"""
    global _client
    if _client is None:
        if Config.QDRANT_URL:
            # Cloud deployment
            _client = QdrantClient(
                url=Config.QDRANT_URL,
                api_key=Config.QDRANT_API_KEY,
            )
        else:
            # Local deployment
            _client = QdrantClient(
                host=Config.QDRANT_HOST,
                port=Config.QDRANT_PORT,
            )
    return _client


def test_qdrant_connection() -> bool:
    """Test if Qdrant is available"""
    try:
        client = get_qdrant_client()
        client.get_collections()
        return True
    except Exception as e:
        print(f"Qdrant connection failed: {e}")
        return False


def is_qdrant_available() -> bool:
    """Check if Qdrant is available"""
    return test_qdrant_connection()


def ensure_collection(name: str, vector_size: int) -> bool:
    """Ensure collection exists, create if not"""
    client = get_qdrant_client()

    try:
        collections = client.get_collections()
        exists = any(c.name == name for c in collections.collections)

        if not exists:
            client.create_collection(
                collection_name=name,
                vectors_config=models.VectorParams(
                    size=vector_size,
                    distance=models.Distance.COSINE
                )
            )
            print(f"Created Qdrant collection: {name}")

            # Create payload indexes for filtering
            client.create_payload_index(
                collection_name=name,
                field_name="document_id",
                field_schema=models.PayloadSchemaType.INTEGER
            )
            print("Created index on document_id")

            client.create_payload_index(
                collection_name=name,
                field_name="chunk_id",
                field_schema=models.PayloadSchemaType.INTEGER
            )
            print("Created index on chunk_id")

        return True
    except Exception as e:
        print(f"Failed to ensure collection: {e}")
        return False


def initialize_collection() -> bool:
    """Initialize the vector store collection"""
    if not is_qdrant_available():
        print("Qdrant not available, skipping collection initialization")
        return False
    dimension = get_embedding_dimension()
    return ensure_collection(Config.QDRANT_COLLECTION, dimension)


def upsert_vectors(points: List[Dict[str, Any]]) -> List[Optional[str]]:
    """Upsert vectors (add or update)"""
    if not is_qdrant_available():
        print("Qdrant not available, skipping vector upsert")
        return [None] * len(points)

    client = get_qdrant_client()
    collection = Config.QDRANT_COLLECTION

    # Ensure collection exists
    initialize_collection()

    # Format points for Qdrant
    qdrant_points = []
    for point in points:
        point_id = point.get('id') or str(uuid.uuid4())
        qdrant_points.append(models.PointStruct(
            id=point_id,
            vector=point['vector'],
            payload=point.get('payload', {})
        ))

    client.upsert(
        collection_name=collection,
        wait=True,
        points=qdrant_points
    )

    return [p.id for p in qdrant_points]


def search(
    query_vector: List[float],
    limit: int = 10,
    filter_conditions: Optional[models.Filter] = None
) -> List[Dict[str, Any]]:
    """Search for similar vectors"""
    if not is_qdrant_available():
        raise Exception("Vector search unavailable: Qdrant is not connected")

    client = get_qdrant_client()
    collection = Config.QDRANT_COLLECTION

    results = client.search(
        collection_name=collection,
        query_vector=query_vector,
        limit=limit,
        query_filter=filter_conditions,
        with_payload=True
    )

    return [
        {
            'id': result.id,
            'score': result.score,
            'payload': result.payload
        }
        for result in results
    ]


def search_by_documents(
    query_vector: List[float],
    document_ids: Optional[List[int]],
    limit: int = 10
) -> List[Dict[str, Any]]:
    """Search with document ID filter"""
    filter_conditions = None
    if document_ids and len(document_ids) > 0:
        filter_conditions = models.Filter(
            must=[
                models.FieldCondition(
                    key="document_id",
                    match=models.MatchAny(any=document_ids)
                )
            ]
        )

    return search(query_vector, limit, filter_conditions)


def delete_by_document_id(document_id: int):
    """Delete all vectors for a document"""
    if not is_qdrant_available():
        print("Qdrant not available, skipping vector deletion")
        return

    client = get_qdrant_client()
    collection = Config.QDRANT_COLLECTION

    try:
        # Check if collection exists first
        client.get_collection(collection)

        client.delete(
            collection_name=collection,
            wait=True,
            points_selector=models.FilterSelector(
                filter=models.Filter(
                    must=[
                        models.FieldCondition(
                            key="document_id",
                            match=models.MatchValue(value=document_id)
                        )
                    ]
                )
            )
        )
    except UnexpectedResponse as e:
        if 'not found' in str(e).lower():
            return
        print(f"Failed to delete vectors: {e}")
    except Exception as e:
        print(f"Failed to delete vectors: {e}")


def delete_vectors(vector_ids: List[str]):
    """Delete specific vectors by ID"""
    if not is_qdrant_available():
        print("Qdrant not available, skipping vector deletion")
        return

    client = get_qdrant_client()
    collection = Config.QDRANT_COLLECTION

    client.delete(
        collection_name=collection,
        wait=True,
        points_selector=models.PointIdsList(points=vector_ids)
    )


def get_collection_stats() -> Dict[str, Any]:
    """Get collection statistics"""
    if not is_qdrant_available():
        return {
            'vectorsCount': 0,
            'pointsCount': 0,
            'segmentsCount': 0,
            'status': 'unavailable'
        }

    client = get_qdrant_client()
    collection = Config.QDRANT_COLLECTION

    try:
        info = client.get_collection(collection)
        return {
            'vectorsCount': info.vectors_count,
            'pointsCount': info.points_count,
            'segmentsCount': info.segments_count,
            'status': info.status.value if info.status else 'unknown'
        }
    except UnexpectedResponse as e:
        if 'not found' in str(e).lower():
            return {
                'vectorsCount': 0,
                'pointsCount': 0,
                'segmentsCount': 0,
                'status': 'not_created'
            }
        raise


def get_vector(vector_id: str, include_vector: bool = False) -> Optional[Dict[str, Any]]:
    """Get a specific vector by ID"""
    if not is_qdrant_available():
        return None

    client = get_qdrant_client()
    collection = Config.QDRANT_COLLECTION

    # Handle numeric string IDs
    if isinstance(vector_id, str) and vector_id.isdigit():
        vector_id = int(vector_id)

    try:
        result = client.retrieve(
            collection_name=collection,
            ids=[vector_id],
            with_payload=True,
            with_vectors=include_vector
        )
        return result[0] if result else None
    except Exception as e:
        print(f"Vector {vector_id} not found or invalid ID format: {e}")
        return None


def get_vectors(vector_ids: List[str], include_vector: bool = False) -> List[Dict[str, Any]]:
    """Get multiple vectors by IDs"""
    if not is_qdrant_available():
        return []

    client = get_qdrant_client()
    collection = Config.QDRANT_COLLECTION

    result = client.retrieve(
        collection_name=collection,
        ids=vector_ids,
        with_payload=True,
        with_vectors=include_vector
    )

    return result


def scroll_vectors(
    limit: int = 10,
    offset: Optional[str] = None,
    include_vector: bool = False
) -> Dict[str, Any]:
    """Scroll through all vectors in collection"""
    if not is_qdrant_available():
        return {'points': [], 'nextOffset': None}

    client = get_qdrant_client()
    collection = Config.QDRANT_COLLECTION

    result = client.scroll(
        collection_name=collection,
        limit=limit,
        offset=offset,
        with_payload=True,
        with_vectors=include_vector
    )

    return {
        'points': result[0],
        'nextOffset': result[1]
    }


def clear_collection() -> Dict[str, Any]:
    """Clear all vectors from the collection"""
    if not is_qdrant_available():
        raise Exception("Qdrant not available")

    client = get_qdrant_client()
    collection = Config.QDRANT_COLLECTION

    try:
        client.delete_collection(collection)
        print(f"Deleted Qdrant collection: {collection}")
        return {'deleted': True}
    except UnexpectedResponse as e:
        if 'not found' in str(e).lower():
            return {'deleted': False, 'message': 'Collection did not exist'}
        raise


def get_collection_info() -> Optional[Dict[str, Any]]:
    """Get detailed collection info including config"""
    if not is_qdrant_available():
        return None

    client = get_qdrant_client()
    collection = Config.QDRANT_COLLECTION

    try:
        info = client.get_collection(collection)
        return {
            'name': collection,
            'status': info.status.value if info.status else 'unknown',
            'vectorsCount': info.vectors_count,
            'pointsCount': info.points_count,
            'segmentsCount': info.segments_count,
            'config': str(info.config),
            'payloadSchema': info.payload_schema
        }
    except UnexpectedResponse as e:
        if 'not found' in str(e).lower():
            return None
        raise
