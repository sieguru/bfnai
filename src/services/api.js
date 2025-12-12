import axios from 'axios'

const api = axios.create({
  baseURL: import.meta.env.VITE_API_URL || 'http://localhost:3009/api',
  timeout: 120000, // 2 minutes for large operations
})

// Response interceptor for error handling
api.interceptors.response.use(
  response => response,
  error => {
    const message = error.response?.data?.message || error.message || 'An error occurred'
    console.error('API Error:', message)
    return Promise.reject(error)
  }
)

// Health check
export const getHealth = () => api.get('/health')

// Documents API
export const uploadDocuments = (formData, onProgress) => {
  return api.post('/documents/upload', formData, {
    headers: { 'Content-Type': 'multipart/form-data' },
    onUploadProgress: onProgress,
  })
}

export const getDocuments = (params = {}) => api.get('/documents', { params })

export const getDocument = (id) => api.get(`/documents/${id}`)

export const getDocumentStats = () => api.get('/documents/stats')

export const analyzeDocumentStyles = (id) => api.post(`/documents/${id}/analyze-styles`)

export const getDocumentStyles = (id) => api.get(`/documents/${id}/styles`)

export const updateDocumentStyles = (id, styles) => api.put(`/documents/${id}/styles`, { styles })

export const processDocument = (id, options = {}) => api.post(`/documents/${id}/process`, options)

export const deleteDocument = (id) => api.delete(`/documents/${id}`)

// Chunks API
export const getChunks = (params = {}) => api.get('/chunks', { params })

export const getChunk = (id) => api.get(`/chunks/${id}`)

export const getChunkTree = (documentId) => api.get(`/chunks/tree/${documentId}`)

export const getChunkStats = () => api.get('/chunks/stats')

export const searchChunksText = (query, documentId) => {
  return api.get('/chunks/search', { params: { q: query, documentId } })
}

export const getChunksBatch = (ids) => api.post('/chunks/batch', { ids })

export const getHierarchySummary = (documentId) => api.get(`/chunks/hierarchy-summary/${documentId}`)

// Search API
export const vectorSearch = (query, options = {}) => {
  return api.post('/search', { query, ...options })
}

export const findSimilarChunks = (chunkId, options = {}) => {
  return api.post(`/search/similar/${chunkId}`, options)
}

export const hybridSearch = (query, options = {}) => {
  return api.post('/search/hybrid', { query, ...options })
}

// Agent API
export const chatWithAgent = (query, options = {}) => {
  return api.post('/agent/chat', { query, ...options })
}

export const getConversations = (params = {}) => api.get('/agent/conversations', { params })

export const getConversation = (id) => api.get(`/agent/conversations/${id}`)

export const deleteConversation = (id) => api.delete(`/agent/conversations/${id}`)

export const getQueryHistory = (params = {}) => api.get('/agent/history', { params })

export const submitFeedback = (queryId, rating, feedback) => {
  return api.post('/agent/feedback', { queryId, rating, feedback })
}

export default api
