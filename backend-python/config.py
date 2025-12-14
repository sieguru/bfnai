"""
Configuration module - loads settings from environment variables
"""
import os
from pathlib import Path
from dotenv import load_dotenv

# Load .env file - try backend-python folder first, then project root
backend_env = Path(__file__).parent / '.env'
root_env = Path(__file__).parent.parent / '.env'

if backend_env.exists():
    load_dotenv(backend_env)
elif root_env.exists():
    load_dotenv(root_env)
else:
    load_dotenv()  # Try system env vars


class Config:
    # Server
    PORT = int(os.getenv('PORT', 3009))
    DEBUG = os.getenv('NODE_ENV', 'development') == 'development'
    SECRET_KEY = os.getenv('SECRET_KEY', 'dev-secret-key-change-in-production')

    # Database
    DB_HOST = os.getenv('DB_HOST', 'localhost')
    DB_PORT = int(os.getenv('DB_PORT', 3306))
    DB_NAME = os.getenv('DB_NAME', 'legal_rag')
    DB_USER = os.getenv('DB_USER', 'root')
    DB_PASSWORD = os.getenv('DB_PASSWORD', '')

    # Qdrant
    QDRANT_URL = os.getenv('QDRANT_URL')
    QDRANT_API_KEY = os.getenv('QDRANT_API_KEY')
    QDRANT_HOST = os.getenv('QDRANT_HOST', 'localhost')
    QDRANT_PORT = int(os.getenv('QDRANT_PORT', 6333))
    QDRANT_COLLECTION = os.getenv('QDRANT_COLLECTION', 'legal_chunks')

    # Embeddings
    EMBEDDING_PROVIDER = os.getenv('EMBEDDING_PROVIDER', 'voyage')
    EMBEDDING_MODEL = os.getenv('EMBEDDING_MODEL', 'voyage-law-2')
    VOYAGE_API_KEY = os.getenv('VOYAGE_API_KEY')
    OPENAI_API_KEY = os.getenv('OPENAI_API_KEY')

    # Anthropic
    ANTHROPIC_API_KEY = os.getenv('ANTHROPIC_API_KEY')
    ANTHROPIC_MODEL = os.getenv('ANTHROPIC_MODEL', 'claude-sonnet-4-20250514')

    # Processing
    DEFAULT_CHUNK_SIZE = int(os.getenv('DEFAULT_CHUNK_SIZE', 500))
    DEFAULT_CHUNK_OVERLAP = int(os.getenv('DEFAULT_CHUNK_OVERLAP', 1))

    # Paths
    BASE_DIR = Path(__file__).parent
    UPLOADS_DIR = BASE_DIR / 'uploads'

    # CORS
    CORS_ORIGINS = os.getenv('CORS_ORIGIN', '*').split(',')


# Ensure uploads directory exists
Config.UPLOADS_DIR.mkdir(exist_ok=True)
