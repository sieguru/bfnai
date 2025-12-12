<template>
  <div>
    <!-- Controls -->
    <div class="flex flex-wrap items-center gap-4 mb-4">
      <div class="flex items-center gap-2">
        <label class="text-sm text-gray-600">{{ $t('common.document') }}:</label>
        <select
          v-model="selectedDocument"
          class="border-gray-300 rounded-md text-sm focus:ring-blue-500 focus:border-blue-500"
        >
          <option value="">{{ $t('chunks.allDocuments') }}</option>
          <option v-for="doc in documents" :key="doc.id" :value="doc.id">
            {{ doc.original_name }}
          </option>
        </select>
      </div>

      <input
        v-model="searchQuery"
        type="text"
        :placeholder="$t('chunks.searchChunks')"
        class="border-gray-300 rounded-md text-sm focus:ring-blue-500 focus:border-blue-500"
        @input="debouncedSearch"
      />

      <div class="flex items-center space-x-1 border border-gray-300 rounded-md">
        <button
          @click="viewMode = 'list'"
          :class="[
            'px-3 py-1.5 text-sm',
            viewMode === 'list' ? 'bg-blue-100 text-blue-700' : 'text-gray-600 hover:bg-gray-100'
          ]"
        >
          <font-awesome-icon icon="list" />
        </button>
        <button
          @click="viewMode = 'tree'"
          :class="[
            'px-3 py-1.5 text-sm',
            viewMode === 'tree' ? 'bg-blue-100 text-blue-700' : 'text-gray-600 hover:bg-gray-100'
          ]"
        >
          <font-awesome-icon icon="tree" />
        </button>
      </div>

      <button
        @click="loadChunks"
        class="p-2 text-gray-500 hover:text-gray-700"
      >
        <font-awesome-icon icon="sync" :class="{ 'animate-spin': loading }" />
      </button>
    </div>

    <!-- Loading -->
    <LoadingSpinner v-if="loading" :text="$t('chunks.loadingChunks')" />

    <!-- Empty State -->
    <div v-else-if="chunks.length === 0" class="text-center py-12">
      <font-awesome-icon icon="layer-group" class="text-4xl text-gray-300 mb-4" />
      <p class="text-gray-500">{{ $t('chunks.noChunks') }}</p>
    </div>

    <!-- List View -->
    <div v-else-if="viewMode === 'list'" class="overflow-y-auto max-h-[calc(100vh-20rem)] space-y-3 pr-2">
      <ChunkCard
        v-for="chunk in chunks"
        :key="chunk.id"
        :chunk="chunk"
        :highlight="searchQuery"
        @click="selectChunk(chunk)"
      />

      <!-- Load More -->
      <div v-if="hasMore" class="text-center py-4">
        <button
          @click="loadMore"
          class="text-blue-600 hover:text-blue-700"
        >
          {{ $t('chunks.loadMore') }}
        </button>
      </div>
    </div>

    <!-- Tree View -->
    <div v-else class="overflow-y-auto max-h-[calc(100vh-20rem)] pr-2">
      <ChunkTree
        :document-id="selectedDocument"
        @select="selectChunk"
      />
    </div>
  </div>
</template>

<script>
import { getDocuments, getChunks, searchChunksText } from '@/services/api'
import LoadingSpinner from '../common/LoadingSpinner.vue'
import ChunkCard from './ChunkCard.vue'
import ChunkTree from './ChunkTree.vue'

export default {
  name: 'ChunkExplorer',
  components: {
    LoadingSpinner,
    ChunkCard,
    ChunkTree,
  },
  emits: ['select'],
  data() {
    return {
      documents: [],
      chunks: [],
      selectedDocument: '',
      searchQuery: '',
      viewMode: 'list',
      loading: false,
      offset: 0,
      limit: 50,
      hasMore: false,
      searchTimeout: null,
    }
  },
  watch: {
    selectedDocument() {
      this.offset = 0
      this.loadChunks()
    },
  },
  mounted() {
    this.loadDocuments()
    this.loadChunks()
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
    async loadChunks() {
      this.loading = true
      this.offset = 0

      try {
        if (this.searchQuery) {
          const response = await searchChunksText(this.searchQuery, this.selectedDocument || null)
          this.chunks = response.data.chunks
          this.hasMore = false
        } else {
          const response = await getChunks({
            documentId: this.selectedDocument || undefined,
            limit: this.limit,
            offset: 0,
          })
          this.chunks = response.data.chunks
          this.hasMore = response.data.chunks.length === this.limit
        }
      } catch (error) {
        console.error('Failed to load chunks:', error)
      } finally {
        this.loading = false
      }
    },
    async loadMore() {
      this.offset += this.limit

      try {
        const response = await getChunks({
          documentId: this.selectedDocument || undefined,
          limit: this.limit,
          offset: this.offset,
        })
        this.chunks.push(...response.data.chunks)
        this.hasMore = response.data.chunks.length === this.limit
      } catch (error) {
        console.error('Failed to load more chunks:', error)
      }
    },
    debouncedSearch() {
      clearTimeout(this.searchTimeout)
      this.searchTimeout = setTimeout(() => {
        this.loadChunks()
      }, 300)
    },
    selectChunk(chunk) {
      this.$emit('select', chunk)
    },
  },
}
</script>
