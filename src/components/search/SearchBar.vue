<template>
  <div class="space-y-4">
    <!-- Main Search Input -->
    <div class="flex items-center space-x-2">
      <div class="relative flex-1">
        <font-awesome-icon icon="search" class="absolute left-3 top-1/2 transform -translate-y-1/2 text-gray-400" />
        <input
          v-model="query"
          type="text"
          placeholder="Enter your search query..."
          class="w-full pl-10 pr-4 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-transparent"
          @keyup.enter="search"
        />
        <button
          v-if="query"
          @click="clearSearch"
          class="absolute right-3 top-1/2 transform -translate-y-1/2 text-gray-400 hover:text-gray-600"
        >
          <font-awesome-icon icon="times" />
        </button>
      </div>
      <button
        @click="search"
        :disabled="!query || loading"
        class="px-6 py-2 bg-blue-600 text-white rounded-lg hover:bg-blue-700 disabled:opacity-50 disabled:cursor-not-allowed"
      >
        <font-awesome-icon v-if="loading" icon="spinner" spin class="mr-2" />
        Search
      </button>
    </div>

    <!-- Filters -->
    <div class="flex flex-wrap items-center gap-4">
      <!-- Document Filter -->
      <div class="flex items-center space-x-2">
        <label class="text-sm text-gray-600">Documents:</label>
        <select
          v-model="selectedDocuments"
          multiple
          class="border-gray-300 rounded-md text-sm focus:ring-blue-500 focus:border-blue-500 min-w-[200px]"
        >
          <option v-for="doc in documents" :key="doc.id" :value="doc.id">
            {{ doc.original_name }}
          </option>
        </select>
      </div>

      <!-- Result Count -->
      <div class="flex items-center space-x-2">
        <label class="text-sm text-gray-600">Results:</label>
        <input
          v-model.number="resultLimit"
          type="number"
          min="1"
          max="50"
          class="w-16 border-gray-300 rounded-md text-sm focus:ring-blue-500 focus:border-blue-500"
        />
      </div>

      <!-- Search Type -->
      <div class="flex items-center space-x-2">
        <label class="text-sm text-gray-600">Type:</label>
        <select
          v-model="searchType"
          class="border-gray-300 rounded-md text-sm focus:ring-blue-500 focus:border-blue-500"
        >
          <option value="vector">Vector Search</option>
          <option value="hybrid">Hybrid Search</option>
        </select>
      </div>

      <!-- Vector Weight (for hybrid) -->
      <div v-if="searchType === 'hybrid'" class="flex items-center space-x-2">
        <label class="text-sm text-gray-600">Vector Weight:</label>
        <input
          v-model.number="vectorWeight"
          type="range"
          min="0"
          max="1"
          step="0.1"
          class="w-24"
        />
        <span class="text-sm text-gray-500">{{ vectorWeight }}</span>
      </div>
    </div>

    <!-- Recent Searches -->
    <div v-if="recentSearches.length > 0" class="flex items-center space-x-2">
      <span class="text-xs text-gray-500">Recent:</span>
      <button
        v-for="recent in recentSearches.slice(0, 5)"
        :key="recent"
        @click="useRecent(recent)"
        class="px-2 py-0.5 text-xs bg-gray-100 text-gray-600 rounded hover:bg-gray-200"
      >
        {{ recent }}
      </button>
    </div>
  </div>
</template>

<script>
import { getDocuments } from '@/services/api'

export default {
  name: 'SearchBar',
  props: {
    loading: {
      type: Boolean,
      default: false,
    },
  },
  emits: ['search'],
  data() {
    return {
      query: '',
      documents: [],
      selectedDocuments: [],
      resultLimit: 10,
      searchType: 'vector',
      vectorWeight: 0.7,
      recentSearches: [],
    }
  },
  mounted() {
    this.loadDocuments()
    this.loadRecentSearches()
  },
  methods: {
    async loadDocuments() {
      try {
        const response = await getDocuments({ status: 'completed' })
        this.documents = response.data.documents
      } catch (error) {
        console.error('Failed to load documents:', error)
      }
    },
    loadRecentSearches() {
      const stored = localStorage.getItem('recentSearches')
      if (stored) {
        this.recentSearches = JSON.parse(stored)
      }
    },
    saveRecentSearch(query) {
      this.recentSearches = [
        query,
        ...this.recentSearches.filter(s => s !== query),
      ].slice(0, 10)
      localStorage.setItem('recentSearches', JSON.stringify(this.recentSearches))
    },
    search() {
      if (!this.query) return

      this.saveRecentSearch(this.query)

      this.$emit('search', {
        query: this.query,
        documentIds: this.selectedDocuments.length > 0 ? this.selectedDocuments : undefined,
        limit: this.resultLimit,
        type: this.searchType,
        vectorWeight: this.searchType === 'hybrid' ? this.vectorWeight : undefined,
      })
    },
    clearSearch() {
      this.query = ''
    },
    useRecent(query) {
      this.query = query
      this.search()
    },
  },
}
</script>
