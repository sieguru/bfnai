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

/**
 * Process document with SSE progress updates
 * @param {number} id - Document ID
 * @param {object} options - Processing options (chunkSize, chunkOverlap)
 * @param {function} onProgress - Callback for progress updates ({ stage, progress, message })
 * @returns {Promise} - Resolves with final result when complete
 */
export const processDocumentStream = async (id, options = {}, onProgress) => {
  const baseURL = import.meta.env.VITE_API_URL || 'http://localhost:3009/api'
  const url = `${baseURL}/documents/${id}/process-stream`

  const response = await fetch(url, {
    method: 'POST',
    headers: {
      'Content-Type': 'application/json',
    },
    body: JSON.stringify(options),
  })

  if (!response.ok) {
    throw new Error(`HTTP error! status: ${response.status}`)
  }

  const reader = response.body.getReader()
  const decoder = new TextDecoder()
  let buffer = ''
  let result = null

  while (true) {
    const { done, value } = await reader.read()

    if (done) break

    buffer += decoder.decode(value, { stream: true })

    // Process complete SSE messages
    const lines = buffer.split('\n')
    buffer = lines.pop() // Keep incomplete line in buffer

    for (const line of lines) {
      if (line.startsWith('data: ')) {
        try {
          const data = JSON.parse(line.slice(6))

          if (data.stage === 'done') {
            result = data.result
          } else if (data.stage === 'error') {
            throw new Error(data.message)
          } else if (onProgress) {
            onProgress(data)
          }
        } catch (e) {
          if (e.message !== 'Unexpected end of JSON input') {
            console.error('Failed to parse SSE data:', e)
          }
        }
      }
    }
  }

  return { data: result }
}

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

export const getChunkVector = (id, includeValues = true) => {
  return api.get(`/chunks/${id}/vector`, { params: { values: includeValues } })
}

export const browseVectors = (params = {}) => api.get('/chunks/vectors/browse', { params })

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

export const getCollectionInfo = () => api.get('/search/collection')

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
