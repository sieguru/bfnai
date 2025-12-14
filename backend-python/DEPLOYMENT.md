# Python Backend Deployment Guide

## Local Development

### Prerequisites
- Python 3.9 or higher
- MySQL 8.0
- Qdrant (local Docker or cloud)

### Setup

1. **Create virtual environment:**
   ```bash
   cd backend-python
   python3 -m venv venv
   source venv/bin/activate  # On Windows: venv\Scripts\activate
   ```

2. **Install dependencies:**
   ```bash
   pip install -r requirements.txt
   ```

3. **Configure environment:**
   ```bash
   cp .env.example .env
   # Edit .env with your settings
   ```

4. **Start MySQL and Qdrant:**
   ```bash
   # From project root
   docker-compose up -d
   ```

5. **Run the server:**
   ```bash
   python app.py
   ```

   Or with Gunicorn (production-like):
   ```bash
   gunicorn -w 4 -b 0.0.0.0:3009 wsgi:app
   ```

### API Endpoints

The server runs on `http://localhost:3009` by default.

- `GET /api/health` - Health check
- `POST /api/documents/upload` - Upload documents
- `GET /api/documents` - List documents
- `POST /api/documents/:id/process` - Process document
- `GET /api/chunks` - List chunks
- `POST /api/search` - Vector search
- `POST /api/agent/chat` - Chat with AI

---

## Loopia Shared Hosting Deployment

### Prerequisites
- Loopia web hosting with Python support
- FTP/SFTP access
- MySQL database (create via Loopia control panel)

### Important Notes
- Loopia shared hosting uses Phusion Passenger for Python apps
- Python version may be limited (check with Loopia support)
- Some packages may need to be installed in user space

### Step-by-Step Deployment

1. **Prepare the deployment package:**
   ```bash
   cd backend-python

   # Create deployment directory
   mkdir -p deploy

   # Copy application files
   cp -r *.py models/ services/ routes/ deploy/
   cp requirements.txt deploy/
   cp .htaccess deploy/
   ```

2. **Create Passenger startup file (`passenger_wsgi.py`):**
   ```python
   import sys
   import os

   # Add app directory to path
   INTERP = "/home/your_username/.local/bin/python3"
   if sys.executable != INTERP:
       os.execl(INTERP, INTERP, *sys.argv)

   sys.path.insert(0, os.path.dirname(__file__))

   from app import app as application
   ```

3. **Upload files via FTP:**
   - Upload the `deploy/` contents to `public_html/api/` or your chosen subdirectory
   - Upload `.env` file separately (do NOT include in git)

4. **Install dependencies on Loopia:**
   - SSH into your hosting (if available) or use Loopia's Python console
   ```bash
   cd ~/public_html/api
   pip3 install --user -r requirements.txt
   ```

5. **Configure MySQL:**
   - Create database via Loopia control panel
   - Import the schema (see Database Setup below)
   - Update `.env` with Loopia MySQL credentials

6. **Configure Qdrant:**
   - Use Qdrant Cloud (recommended for Loopia)
   - Sign up at https://cloud.qdrant.io
   - Create a cluster and get API credentials
   - Update `.env`:
     ```
     QDRANT_URL=https://your-cluster.qdrant.cloud:6333
     QDRANT_API_KEY=your_api_key
     ```

### Database Setup

Create the required tables in MySQL:

```sql
-- Documents table
CREATE TABLE documents (
    id INT AUTO_INCREMENT PRIMARY KEY,
    stored_name VARCHAR(255) NOT NULL,
    original_name VARCHAR(255) NOT NULL,
    file_size INT NOT NULL,
    status ENUM('pending', 'processing', 'completed', 'error') DEFAULT 'pending',
    error_message TEXT,
    created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
    updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP
);

-- Document styles table
CREATE TABLE document_styles (
    id INT AUTO_INCREMENT PRIMARY KEY,
    document_id INT NOT NULL,
    style_name VARCHAR(255) NOT NULL,
    heading_level INT,
    sample_text TEXT,
    occurrence_count INT DEFAULT 0,
    created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
    FOREIGN KEY (document_id) REFERENCES documents(id) ON DELETE CASCADE
);

-- Chunks table
CREATE TABLE chunks (
    id INT AUTO_INCREMENT PRIMARY KEY,
    document_id INT NOT NULL,
    chunk_index INT NOT NULL,
    content TEXT NOT NULL,
    content_length INT NOT NULL,
    token_estimate INT NOT NULL,
    content_hash VARCHAR(64),
    hierarchy_path TEXT,
    hierarchy_json JSON,
    hierarchy_level INT,
    paragraph_start INT,
    paragraph_end INT,
    vector_id VARCHAR(255),
    embedding_model VARCHAR(100),
    embedded_at TIMESTAMP,
    created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
    FOREIGN KEY (document_id) REFERENCES documents(id) ON DELETE CASCADE,
    INDEX idx_document_id (document_id),
    INDEX idx_vector_id (vector_id)
);

-- Conversations table
CREATE TABLE conversations (
    id INT AUTO_INCREMENT PRIMARY KEY,
    session_id VARCHAR(255),
    created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
    updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP
);

-- Conversation messages table
CREATE TABLE conversation_messages (
    id INT AUTO_INCREMENT PRIMARY KEY,
    conversation_id INT NOT NULL,
    role ENUM('user', 'assistant') NOT NULL,
    content TEXT NOT NULL,
    chunks_used JSON,
    citations JSON,
    created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
    FOREIGN KEY (conversation_id) REFERENCES conversations(id) ON DELETE CASCADE
);

-- Query history table
CREATE TABLE query_history (
    id INT AUTO_INCREMENT PRIMARY KEY,
    query_text TEXT NOT NULL,
    chunks_retrieved INT,
    chunk_ids JSON,
    agent_response TEXT,
    response_time_ms INT,
    tokens_used INT,
    user_rating INT,
    user_feedback TEXT,
    created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
);
```

### Troubleshooting

1. **500 Internal Server Error:**
   - Check Loopia error logs (via control panel)
   - Verify Python path in `passenger_wsgi.py`
   - Ensure all dependencies are installed

2. **Module not found errors:**
   - Install missing packages: `pip3 install --user <package>`
   - Check Python version compatibility

3. **Database connection errors:**
   - Verify MySQL credentials in `.env`
   - Check if Loopia allows remote MySQL connections

4. **Qdrant connection errors:**
   - Ensure Qdrant Cloud URL and API key are correct
   - Check if outbound connections are allowed

### File Structure on Loopia

```
public_html/
└── api/
    ├── .htaccess
    ├── .env
    ├── passenger_wsgi.py
    ├── wsgi.py
    ├── app.py
    ├── config.py
    ├── database.py
    ├── requirements.txt
    ├── models/
    │   ├── __init__.py
    │   ├── document.py
    │   └── chunk.py
    ├── services/
    │   ├── __init__.py
    │   ├── document_parser.py
    │   ├── chunker.py
    │   ├── embeddings.py
    │   ├── vector_store.py
    │   └── ai_agent.py
    ├── routes/
    │   ├── __init__.py
    │   ├── documents.py
    │   ├── chunks.py
    │   ├── search.py
    │   └── agent.py
    └── uploads/
        └── (uploaded files)
```

### CORS Configuration

For the frontend to connect, update the CORS settings in `.env`:

```
CORS_ORIGIN=https://your-domain.se,https://www.your-domain.se
```

### Security Checklist

- [ ] `.env` file is not accessible via web
- [ ] Upload directory has restricted access
- [ ] HTTPS is enabled (Loopia usually provides this)
- [ ] API keys are not exposed in client-side code
- [ ] Database credentials are secure
