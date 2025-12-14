"""
WSGI entry point for production deployment (Apache/mod_wsgi on Loopia)
"""
import sys
import os

# Add the application directory to the Python path
app_dir = os.path.dirname(os.path.abspath(__file__))
if app_dir not in sys.path:
    sys.path.insert(0, app_dir)

# Load environment variables from .env file if present
from dotenv import load_dotenv
env_paths = [
    os.path.join(app_dir, '.env'),
    os.path.join(os.path.dirname(app_dir), '.env'),
]
for env_path in env_paths:
    if os.path.exists(env_path):
        load_dotenv(env_path)
        break

# Import the application
from app import app as application

# For compatibility with different WSGI servers
app = application
