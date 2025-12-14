"""
Passenger WSGI entry point for Loopia shared hosting.
This file is used by Phusion Passenger to start the Python application.

IMPORTANT: Update the INTERP path to match your Loopia Python installation.
Common paths:
- /usr/bin/python3
- /home/your_username/.local/bin/python3
- /opt/python3/bin/python3

Check with Loopia support for the exact path.
"""
import sys
import os

# IMPORTANT: Update this path to your Python interpreter on Loopia
# INTERP = "/home/your_username/.local/bin/python3"
# if sys.executable != INTERP:
#     os.execl(INTERP, INTERP, *sys.argv)

# Add the application directory to the Python path
app_dir = os.path.dirname(os.path.abspath(__file__))
if app_dir not in sys.path:
    sys.path.insert(0, app_dir)

# Load environment variables
from dotenv import load_dotenv
env_path = os.path.join(app_dir, '.env')
if os.path.exists(env_path):
    load_dotenv(env_path)

# Import the Flask application
from app import app as application
