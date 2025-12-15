-- Database initialization script
CREATE DATABASE IF NOT EXISTS legal_rag;
USE legal_rag;

-- Documents table
CREATE TABLE documents (
    id INT AUTO_INCREMENT PRIMARY KEY,
    filename VARCHAR(255) NOT NULL,
    original_name VARCHAR(255) NOT NULL,
    file_size INT,
    page_count INT,
    upload_date TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
    processed_date TIMESTAMP NULL,
    status ENUM('pending', 'processing', 'completed', 'error') DEFAULT 'pending',
    error_message TEXT,
    metadata JSON,
    hierarchy_json JSON,
    created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
    updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP,

    INDEX idx_status (status),
    INDEX idx_upload_date (upload_date)
);

-- Detected styles table (for configuration)
CREATE TABLE document_styles (
    id INT AUTO_INCREMENT PRIMARY KEY,
    document_id INT NOT NULL,
    style_name VARCHAR(100) NOT NULL,
    occurrence_count INT DEFAULT 0,
    sample_text TEXT,
    heading_level INT NULL,
    is_configured BOOLEAN DEFAULT FALSE,

    FOREIGN KEY (document_id) REFERENCES documents(id) ON DELETE CASCADE,
    UNIQUE KEY unique_doc_style (document_id, style_name)
);

-- Global style mappings (user-defined defaults)
CREATE TABLE style_mappings (
    id INT AUTO_INCREMENT PRIMARY KEY,
    style_pattern VARCHAR(100) NOT NULL,
    heading_level INT NULL,
    is_body_text BOOLEAN DEFAULT FALSE,
    priority INT DEFAULT 0,

    UNIQUE KEY unique_pattern (style_pattern)
);

-- Insert default style mappings
INSERT INTO style_mappings (style_pattern, heading_level, is_body_text, priority) VALUES
('Heading 1', 1, FALSE, 100),
('Heading 2', 2, FALSE, 100),
('Heading 3', 3, FALSE, 100),
('Heading 4', 4, FALSE, 100),
('Heading 5', 5, FALSE, 100),
('Heading 6', 6, FALSE, 100),
('Rubrik 1', 1, FALSE, 100),
('Rubrik 2', 2, FALSE, 100),
('Rubrik 3', 3, FALSE, 100),
('Title', 1, FALSE, 90),
('Subtitle', 2, FALSE, 90),
('Normal', NULL, TRUE, 50),
('Body Text', NULL, TRUE, 50),
('List Paragraph', NULL, TRUE, 50);

-- Chunks table
CREATE TABLE chunks (
    id INT AUTO_INCREMENT PRIMARY KEY,
    document_id INT NOT NULL,
    chunk_index INT NOT NULL,
    chunk_hash VARCHAR(32) NOT NULL,

    content TEXT NOT NULL,
    content_length INT,
    token_estimate INT,

    hierarchy_path VARCHAR(1000),
    hierarchy_json JSON,
    hierarchy_level INT,

    paragraph_start INT,
    paragraph_end INT,

    vector_id VARCHAR(100),
    embedded_at TIMESTAMP NULL,
    embedding_model VARCHAR(50),

    metadata JSON,
    created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,

    FOREIGN KEY (document_id) REFERENCES documents(id) ON DELETE CASCADE,
    INDEX idx_document (document_id),
    INDEX idx_vector (vector_id),
    INDEX idx_hash (chunk_hash),
    INDEX idx_hierarchy (hierarchy_path(100))
);

-- Query history (for analytics and debugging)
CREATE TABLE query_history (
    id INT AUTO_INCREMENT PRIMARY KEY,
    query_text TEXT NOT NULL,
    query_embedding_model VARCHAR(50),

    chunks_retrieved INT,
    chunk_ids JSON,

    agent_response TEXT,
    response_time_ms INT,
    tokens_used INT,

    user_rating INT,
    user_feedback TEXT,

    created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,

    INDEX idx_created (created_at)
);

-- Conversations (for multi-turn agent chat)
CREATE TABLE conversations (
    id INT AUTO_INCREMENT PRIMARY KEY,
    session_id VARCHAR(100) NOT NULL,
    created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
    updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP,

    INDEX idx_session (session_id)
);

CREATE TABLE conversation_messages (
    id INT AUTO_INCREMENT PRIMARY KEY,
    conversation_id INT NOT NULL,
    role ENUM('user', 'assistant') NOT NULL,
    content TEXT NOT NULL,

    chunks_used JSON,
    citations JSON,

    created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,

    FOREIGN KEY (conversation_id) REFERENCES conversations(id) ON DELETE CASCADE,
    INDEX idx_conversation (conversation_id)
);
