"""
Embeddings service - Generate embeddings using Voyage AI or OpenAI
"""
import time
from typing import List, Optional, Dict, Any, Callable
import openai
from config import Config


# Global client instance
_client = None


def get_client():
    """Get the embedding provider client"""
    global _client
    if _client is None:
        if Config.EMBEDDING_PROVIDER == 'voyage':
            _client = openai.OpenAI(
                api_key=Config.VOYAGE_API_KEY,
                base_url='https://api.voyageai.com/v1'
            )
        else:
            _client = openai.OpenAI(
                api_key=Config.OPENAI_API_KEY
            )
    return _client


def get_embedding_dimension() -> int:
    """Get the embedding dimension for the current model"""
    model = Config.EMBEDDING_MODEL

    # Voyage AI models
    dimensions = {
        'voyage-law-2': 1024,
        'voyage-large-2': 1536,
        'voyage-2': 1024,
        'voyage-3': 1024,
        'voyage-3-lite': 512,
        'voyage-3-large': 1024,
        'voyage-code-2': 1536,
        'voyage-finance-2': 1024,
        # OpenAI models
        'text-embedding-3-small': 1536,
        'text-embedding-3-large': 3072,
        'text-embedding-ada-002': 1536,
    }

    if model in dimensions:
        return dimensions[model]

    print(f"Warning: Unknown embedding model: {model}, defaulting to dimension 1536")
    return 1536


def generate_embedding(text: str) -> List[float]:
    """Generate embedding for a single text"""
    embeddings = generate_embeddings([text])
    return embeddings[0] if embeddings else []


def generate_embeddings(texts: List[str], retry_count: int = 0) -> List[List[float]]:
    """
    Generate embeddings for multiple texts (batch processing)
    Includes retry logic for rate limit errors (429)
    """
    if not texts:
        return []

    client = get_client()
    model = Config.EMBEDDING_MODEL
    max_retries = 5

    try:
        response = client.embeddings.create(
            model=model,
            input=texts
        )

        # Sort by index to maintain order (OpenAI returns in order, but be safe)
        sorted_data = sorted(response.data, key=lambda x: x.index)
        return [item.embedding for item in sorted_data]

    except openai.RateLimitError as e:
        if retry_count < max_retries:
            delay = (2 ** retry_count) * 2  # 2s, 4s, 8s, 16s, 32s
            print(f"Rate limited (429), retrying in {delay}s (attempt {retry_count + 1}/{max_retries})")
            time.sleep(delay)
            return generate_embeddings(texts, retry_count + 1)
        raise e


def generate_embeddings_batched(
    texts: List[str],
    batch_size: int = 10,
    on_progress: Optional[Callable[[int, int], None]] = None
) -> List[List[float]]:
    """
    Generate embeddings in batches to handle large numbers of texts

    Args:
        texts: Array of texts to embed
        batch_size: Number of texts per batch
        on_progress: Optional callback for progress updates (batch_num, total_batches)
    """
    all_embeddings = []
    total_batches = (len(texts) + batch_size - 1) // batch_size

    for i in range(0, len(texts), batch_size):
        batch = texts[i:i + batch_size]
        batch_num = (i // batch_size) + 1
        print(f"Processing embedding batch {batch_num}/{total_batches} ({len(batch)} texts)")

        if on_progress:
            on_progress(batch_num, total_batches)

        embeddings = generate_embeddings(batch)
        all_embeddings.extend(embeddings)

        # Longer delay between batches to avoid rate limits
        if i + batch_size < len(texts):
            time.sleep(2)

    return all_embeddings


def get_embedding_info() -> Dict[str, Any]:
    """Get current embedding model info"""
    return {
        'provider': Config.EMBEDDING_PROVIDER,
        'model': Config.EMBEDDING_MODEL,
        'dimension': get_embedding_dimension(),
    }
