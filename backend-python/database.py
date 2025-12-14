"""
Database connection module using MySQL
"""
import mysql.connector
from mysql.connector import pooling
from contextlib import contextmanager
from config import Config

# Connection pool for better performance
_pool = None


def get_pool():
    """Get or create the connection pool"""
    global _pool
    if _pool is None:
        _pool = pooling.MySQLConnectionPool(
            pool_name="legal_rag_pool",
            pool_size=5,
            host=Config.DB_HOST,
            port=Config.DB_PORT,
            database=Config.DB_NAME,
            user=Config.DB_USER,
            password=Config.DB_PASSWORD,
            charset='utf8mb4',
            collation='utf8mb4_unicode_ci',
            autocommit=True
        )
    return _pool


@contextmanager
def get_connection():
    """Context manager for database connections"""
    pool = get_pool()
    conn = pool.get_connection()
    try:
        yield conn
    finally:
        conn.close()


@contextmanager
def get_cursor(dictionary=True):
    """Context manager for database cursors"""
    with get_connection() as conn:
        cursor = conn.cursor(dictionary=dictionary)
        try:
            yield cursor
            conn.commit()
        except Exception:
            conn.rollback()
            raise
        finally:
            cursor.close()


def test_connection():
    """Test database connection"""
    try:
        with get_cursor() as cursor:
            cursor.execute("SELECT 1")
            cursor.fetchone()
        return True
    except Exception as e:
        print(f"Database connection failed: {e}")
        return False
