<template>
  <div class="h-[calc(100vh-8rem)]">
    <h1 class="text-2xl font-bold text-gray-900 mb-6">{{ $t('search.title') }}</h1>

    <div class="grid grid-cols-1 lg:grid-cols-3 gap-6 h-full">
      <!-- Left: Search & Results -->
      <div class="lg:col-span-2 space-y-6">
        <!-- Search Bar -->
        <div class="bg-white border border-gray-200 rounded-lg p-6">
          <SearchBar :loading="loading" @search="performSearch" />
        </div>

        <!-- Results -->
        <div class="bg-white border border-gray-200 rounded-lg p-6 overflow-y-auto" style="max-height: calc(100vh - 20rem);">
          <LoadingSpinner v-if="loading" :text="$t('common.searching')" />
          <SearchResults
            v-else
            :results="results"
            :query="lastQuery"
            :search-time-ms="searchTimeMs"
            :has-searched="hasSearched"
            @select="selectResult"
          />
        </div>
      </div>

      <!-- Right: Chunk Detail -->
      <div class="lg:col-span-1 overflow-hidden">
        <ChunkDetail
          v-if="selectedChunk"
          :chunk="selectedChunk"
          @close="selectedChunk = null"
          @find-similar="findSimilar"
        />
        <div v-else class="bg-white border border-gray-200 rounded-lg p-6 text-center text-gray-500 h-full flex items-center justify-center">
          {{ $t('search.selectToView') }}
        </div>
      </div>
    </div>
  </div>
</template>

<script>
import SearchBar from '@/components/search/SearchBar.vue'
import SearchResults from '@/components/search/SearchResults.vue'
import ChunkDetail from '@/components/chunks/ChunkDetail.vue'
import LoadingSpinner from '@/components/common/LoadingSpinner.vue'
import { vectorSearch, hybridSearch, findSimilarChunks, getChunk } from '@/services/api'

export default {
  name: 'SearchView',
  components: {
    SearchBar,
    SearchResults,
    ChunkDetail,
    LoadingSpinner,
  },
  data() {
    return {
      results: [],
      loading: false,
      lastQuery: '',
      searchTimeMs: 0,
      hasSearched: false,
      selectedChunk: null,
    }
  },
  mounted() {
    // Check for similar chunk query param
    const chunkId = this.$route.query.chunkId
    if (chunkId) {
      this.searchSimilar(chunkId)
    }
  },
  methods: {
    async performSearch(params) {
      this.loading = true
      this.lastQuery = params.query
      this.hasSearched = true

      try {
        let response
        if (params.type === 'hybrid') {
          response = await hybridSearch(params.query, {
            limit: params.limit,
            documentIds: params.documentIds,
            vectorWeight: params.vectorWeight,
          })
        } else {
          response = await vectorSearch(params.query, {
            limit: params.limit,
            documentIds: params.documentIds,
          })
        }

        this.results = response.data.results
        this.searchTimeMs = response.data.searchTimeMs
      } catch (error) {
        console.error('Search failed:', error)
        this.results = []
      } finally {
        this.loading = false
      }
    },
    async searchSimilar(chunkId) {
      this.loading = true
      this.lastQuery = this.$t('search.similarTo', { id: chunkId })
      this.hasSearched = true

      try {
        const response = await findSimilarChunks(chunkId, { limit: 10 })
        this.results = response.data.results
        this.searchTimeMs = 0
      } catch (error) {
        console.error('Similar search failed:', error)
        this.results = []
      } finally {
        this.loading = false
      }
    },
    async selectResult(result) {
      const chunkId = result.chunk?.id || result.payload?.chunk_id
      if (chunkId) {
        try {
          const response = await getChunk(chunkId)
          this.selectedChunk = response.data
        } catch (error) {
          console.error('Failed to load chunk:', error)
        }
      }
    },
    findSimilar(chunk) {
      this.searchSimilar(chunk.id)
    },
  },
}
</script>
