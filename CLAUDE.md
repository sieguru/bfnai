# CLAUDE.md

This file provides guidance to Claude Code (claude.ai/code) when working with code in this repository.

## Commands

### Frontend (root directory)
```bash
npm install              # Install frontend dependencies
npm run dev              # Start frontend dev server (port 5173)
npm run build            # Build for production
```

### Backend
```bash
cd backend
npm install              # Install backend dependencies
npm run dev              # Start backend with auto-reload (port 3000)
npm start                # Start backend
```

### Infrastructure
```bash
docker-compose up -d     # Start MySQL + Qdrant
docker-compose down      # Stop services
```

### Setup
```bash
cp .env.example .env     # Create env file, then edit with API keys
```

## Architecture

### Overview
Legal Document RAG application for uploading Word documents, chunking them based on paragraph styles, storing chunks in vector database, and querying via AI agent.

### Frontend (Vue 3 + Options API)
- **Entry**: `src/main.js` - mounts app, registers FontAwesome icons
- **Router**: `src/router/index.js` - 5 routes (home, documents, chunks, search, agent)
- **API Client**: `src/services/api.js` - Axios client for all backend calls
- **Path alias**: `@` maps to `./src`

**Views**:
- `HomeView` - Dashboard with stats
- `DocumentsView` - Upload and manage documents
- `ChunksView` - Explore chunks with list/tree views
- `SearchView` - Vector similarity search
- `AgentView` - Chat with AI agent

**Component Groups**:
- `layout/` - AppHeader, AppSidebar
- `documents/` - DocumentUpload, DocumentList, DocumentCard, DocumentDetails
- `chunks/` - ChunkExplorer, ChunkCard, ChunkTree, TreeNode, ChunkDetail
- `search/` - SearchBar, SearchResults
- `agent/` - AgentChat, ChatMessage, SourceCitation
- `common/` - LoadingSpinner, AlertMessage, ProgressBar, ConfirmDialog

### Backend (Node.js + Express)
- **Entry**: `backend/src/index.js`
- **Config**: `backend/src/config/` - env, database (MySQL), qdrant

**Routes** (`backend/src/routes/`):
- `documents.js` - Upload, analyze styles, process documents
- `chunks.js` - List, search, tree view
- `search.js` - Vector search, hybrid search, find similar
- `agent.js` - Chat with Claude, conversation management

**Services** (`backend/src/services/`):
- `documentParser.js` - Parse .docx files with mammoth
- `chunker.js` - Style-based chunking with hierarchy
- `embeddings.js` - Voyage AI or OpenAI embeddings
- `vectorStore.js` - Qdrant operations
- `aiAgent.js` - Claude API with grounded responses

**Models** (`backend/src/models/`):
- `Document.js` - Document CRUD
- `Chunk.js` - Chunk CRUD with tree queries

### Database
- **MySQL**: Documents, chunks, styles, conversations, query history
- **Qdrant**: Vector storage for semantic search

## Tech Stack

- Vue 3.5+ with **Options API** (not Composition API)
- Tailwind CSS + @tailwindcss/forms + @tailwindcss/typography
- FontAwesome via @fortawesome/vue-fontawesome
- Vue Router 4
- Axios for HTTP
- Express.js backend
- MySQL 8 + Qdrant vector DB
- Voyage AI or OpenAI for embeddings
- Anthropic Claude for AI agent

## Key Patterns

### Document Processing Pipeline
1. Upload .docx file -> save to `backend/uploads/`
2. Analyze styles -> detect heading levels
3. Process: parse -> chunk by style hierarchy -> embed -> store in Qdrant + MySQL

### Style-Based Chunking
Chunks respect document hierarchy (Heading 1 > Heading 2 > etc.). Each chunk stores:
- `hierarchy_path`: "Chapter 1 > Section 1.2 > Article 5"
- `hierarchy_json`: Array for tree building
- Token count, paragraph range, content hash

### AI Agent Grounding
Agent uses strict system prompt to only answer from provided document chunks. Citations formatted as `[Document: X, Section: Y]`.
