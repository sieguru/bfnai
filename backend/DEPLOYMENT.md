# Backend Deployment Guide

## Quick Deploy to Railway

1. **Create Railway Account**: Go to [railway.app](https://railway.app)

2. **Create New Project**:
   - Click "New Project" → "Deploy from GitHub repo"
   - Select this repository
   - Railway auto-detects the Node.js app in `/backend`

3. **Set Root Directory**:
   - Go to Settings → Root Directory
   - Set to `backend`

4. **Add MySQL Database**:
   - Click "New" → "Database" → "MySQL"
   - Railway creates and connects it automatically
   - Copy the connection variables to your service

5. **Configure Environment Variables**:
   ```
   NODE_ENV=production
   PORT=3009

   # Database (from Railway MySQL)
   DB_HOST=${{MySQL.MYSQLHOST}}
   DB_PORT=${{MySQL.MYSQLPORT}}
   DB_NAME=${{MySQL.MYSQLDATABASE}}
   DB_USER=${{MySQL.MYSQLUSER}}
   DB_PASSWORD=${{MySQL.MYSQLPASSWORD}}

   # Qdrant Cloud
   QDRANT_URL=https://your-cluster.cloud.qdrant.io
   QDRANT_API_KEY=your-key
   QDRANT_COLLECTION=legal_chunks

   # API Keys
   EMBEDDING_PROVIDER=voyage
   EMBEDDING_MODEL=voyage-law-2
   VOYAGE_API_KEY=your-voyage-key
   ANTHROPIC_API_KEY=your-anthropic-key
   ANTHROPIC_MODEL=claude-sonnet-4-20250514
   ```

6. **Deploy**: Railway auto-deploys on git push

---

## Quick Deploy to Render

1. **Create Render Account**: Go to [render.com](https://render.com)

2. **Create Web Service**:
   - Click "New" → "Web Service"
   - Connect your GitHub repo
   - Set Root Directory to `backend`

3. **Configure**:
   - Build Command: `npm install`
   - Start Command: `npm start`
   - Add environment variables (same as Railway above)

4. **Add MySQL**: Use Render's managed PostgreSQL or external MySQL (PlanetScale, Railway)

---

## Local Development

```bash
# From project root
cd backend
npm install
npm run dev
```

The server loads `.env` from:
1. `backend/.env` (if exists)
2. Project root `.env` (fallback)
3. System environment variables (production)

---

## Database Setup

Create the MySQL tables:

```sql
CREATE DATABASE IF NOT EXISTS legal_rag;
USE legal_rag;

CREATE TABLE documents (
  id INT AUTO_INCREMENT PRIMARY KEY,
  original_name VARCHAR(255) NOT NULL,
  stored_name VARCHAR(255) NOT NULL,
  file_size INT,
  status ENUM('pending', 'processing', 'completed', 'error') DEFAULT 'pending',
  error_message TEXT,
  created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
  updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP
);

CREATE TABLE document_styles (
  id INT AUTO_INCREMENT PRIMARY KEY,
  document_id INT NOT NULL,
  style_name VARCHAR(255) NOT NULL,
  heading_level INT,
  sample_text TEXT,
  occurrence_count INT DEFAULT 0,
  created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
  FOREIGN KEY (document_id) REFERENCES documents(id) ON DELETE CASCADE,
  UNIQUE KEY unique_doc_style (document_id, style_name)
);

CREATE TABLE chunks (
  id INT AUTO_INCREMENT PRIMARY KEY,
  document_id INT NOT NULL,
  content TEXT NOT NULL,
  content_hash VARCHAR(64),
  hierarchy_level INT,
  hierarchy_path TEXT,
  hierarchy_json JSON,
  paragraph_start INT,
  paragraph_end INT,
  token_estimate INT,
  vector_id VARCHAR(255),
  created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
  FOREIGN KEY (document_id) REFERENCES documents(id) ON DELETE CASCADE,
  INDEX idx_document (document_id),
  INDEX idx_vector (vector_id)
);

CREATE TABLE conversations (
  id VARCHAR(36) PRIMARY KEY,
  document_id INT,
  created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
  updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP,
  FOREIGN KEY (document_id) REFERENCES documents(id) ON DELETE SET NULL
);

CREATE TABLE conversation_messages (
  id INT AUTO_INCREMENT PRIMARY KEY,
  conversation_id VARCHAR(36) NOT NULL,
  role ENUM('user', 'assistant') NOT NULL,
  content TEXT NOT NULL,
  sources JSON,
  created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
  FOREIGN KEY (conversation_id) REFERENCES conversations(id) ON DELETE CASCADE
);
```

---

## Important: File Storage

Railway and Render use **ephemeral filesystems**. Uploaded files are stored in `/uploads` and will be lost on redeploy or restart.

**Recommended workflow:**
1. Upload document
2. Analyze styles
3. Process document immediately
4. Once processed, chunks are stored in MySQL and Qdrant - the original file is no longer needed

**For persistent file storage**, consider:
- AWS S3 or Cloudflare R2
- Store file content as BLOB in MySQL
- Supabase Storage

---

## External Services Required

1. **Qdrant Cloud** (free tier available): [cloud.qdrant.io](https://cloud.qdrant.io)
2. **Voyage AI** (for embeddings): [voyageai.com](https://www.voyageai.com)
3. **Anthropic** (for AI agent): [anthropic.com](https://www.anthropic.com)

---

## Health Check

The API exposes `/api/health` for monitoring:

```bash
curl https://your-app.railway.app/api/health
```

Returns:
```json
{
  "status": "healthy",
  "services": {
    "database": "connected",
    "qdrant": "connected"
  }
}
```
