<template>
  <div v-if="chunk" class="bg-white border border-gray-200 rounded-lg h-full flex flex-col">
    <!-- Loading indicator for full chunk data -->
    <div v-if="loadingChunk" class="p-4 text-center text-gray-500">
      <font-awesome-icon icon="spinner" spin class="mr-2" />
      {{ $t('common.loading') }}
    </div>

    <template v-else>
      <!-- Header -->
      <div class="p-4 border-b border-gray-200 flex-shrink-0">
        <div class="flex items-center justify-between">
          <div class="flex items-center gap-2">
            <h3 class="font-semibold text-gray-900">{{ $t('common.chunk') }} #{{ displayChunk.id }}</h3>
            <span
              v-if="displayChunk.hierarchy_level"
              :class="['px-2 py-0.5 text-xs font-medium rounded', levelBadgeClass]"
            >
              {{ $t('common.level') }} {{ displayChunk.hierarchy_level }}
            </span>
          </div>
          <button @click="$emit('close')" class="text-gray-400 hover:text-gray-600">
            <font-awesome-icon icon="times" />
          </button>
        </div>

        <!-- Hierarchy Path -->
        <div v-if="displayChunk.hierarchy_path" class="mt-2">
          <div class="text-xs text-gray-500 mb-1">{{ $t('chunks.hierarchyPath') }}</div>
          <div class="flex items-center flex-wrap text-sm">
            <template v-for="(part, index) in hierarchyParts" :key="index">
              <span v-if="index > 0" class="mx-1 text-gray-400">›</span>
              <span class="text-blue-600 bg-blue-50 px-1.5 py-0.5 rounded">{{ part }}</span>
            </template>
          </div>
        </div>
        <div v-else class="mt-2 text-sm text-gray-400 italic">
          {{ $t('chunks.noHierarchy') }}
        </div>
      </div>

      <!-- Content -->
      <div class="flex-1 overflow-y-auto p-4">
        <div class="prose prose-sm max-w-none">
          <p class="whitespace-pre-wrap">{{ displayChunk.content }}</p>
        </div>

        <!-- Vector Section (collapsible) -->
        <div v-if="hasVectorId" class="mt-4 border-t pt-4">
        <div class="flex items-center gap-2">
          <button
            @click="toggleVector"
            class="flex items-center gap-2 text-sm font-medium text-gray-700 hover:text-gray-900"
          >
            <font-awesome-icon :icon="showVector ? 'chevron-down' : 'chevron-right'" class="w-3" />
            {{ $t('chunks.vectorEmbedding') }}
            <span v-if="vectorData" class="text-xs text-gray-500 font-normal">
              ({{ vectorData.dimension }} dimensions)
            </span>
          </button>
          <div class="relative inline-block">
            <button
              @click.stop="showVectorInfo = !showVectorInfo"
              class="text-gray-400 hover:text-blue-600"
            >
              <font-awesome-icon icon="info-circle" />
            </button>
            <div
              v-if="showVectorInfo"
              class="absolute left-0 bottom-full mb-2 w-72 p-3 bg-gray-900 text-white text-xs rounded-lg shadow-lg z-10"
            >
              <div class="relative">
                {{ $t('chunks.vectorEmbeddingInfo') }}
                <div class="absolute left-4 top-full w-0 h-0 border-l-8 border-r-8 border-t-8 border-transparent border-t-gray-900"></div>
              </div>
            </div>
          </div>
        </div>

        <div v-if="showVector" class="mt-3">
          <div v-if="loadingVector" class="text-sm text-gray-500">
            <font-awesome-icon icon="spinner" spin class="mr-2" />
            {{ $t('chunks.loadingVector') }}
          </div>

          <div v-else-if="vectorError" class="text-sm text-red-600">
            {{ vectorError }}
          </div>

          <div v-else-if="vectorData" class="space-y-3">
            <!-- Vector Stats -->
            <div class="grid grid-cols-2 gap-2 text-xs">
              <div class="bg-gray-50 p-2 rounded">
                <span class="text-gray-500">{{ $t('chunks.dimension') }}</span>
                <span class="ml-1 font-mono">{{ vectorData.dimension }}</span>
              </div>
              <div class="bg-gray-50 p-2 rounded">
                <span class="text-gray-500">{{ $t('chunks.model') }}</span>
                <span class="ml-1 font-mono">{{ vectorData.embeddingModel }}</span>
              </div>
              <div class="bg-gray-50 p-2 rounded">
                <span class="text-gray-500">{{ $t('chunks.norm') }}</span>
                <span class="ml-1 font-mono">{{ vectorData.stats?.norm?.toFixed(4) }}</span>
              </div>
              <div class="bg-gray-50 p-2 rounded">
                <span class="text-gray-500">{{ $t('chunks.mean') }}</span>
                <span class="ml-1 font-mono">{{ vectorData.stats?.mean?.toFixed(6) }}</span>
              </div>
            </div>

            <!-- Vector Preview -->
            <div>
              <div class="text-xs text-gray-500 mb-1">{{ $t('chunks.vectorPreview') }}</div>
              <div class="bg-gray-900 text-green-400 p-2 rounded text-xs font-mono overflow-x-auto">
                [{{ vectorPreview }}]
              </div>
            </div>

            <!-- Full Vector Toggle -->
            <div>
              <button
                @click="showFullVector = !showFullVector"
                class="text-xs text-blue-600 hover:text-blue-700"
              >
                {{ showFullVector ? $t('chunks.hideFullVector') : $t('chunks.showFullVector') }}
              </button>
              <div
                v-if="showFullVector"
                class="mt-2 bg-gray-900 text-green-400 p-2 rounded text-xs font-mono max-h-48 overflow-auto"
              >
                [{{ vectorData.vector?.map(v => v.toFixed(6)).join(', ') }}]
              </div>
            </div>

            <!-- Copy Vector -->
            <button
              @click="copyVector"
              class="text-xs px-2 py-1 bg-gray-100 text-gray-600 rounded hover:bg-gray-200"
            >
              <font-awesome-icon icon="copy" class="mr-1" />
              {{ $t('chunks.copyVectorJson') }}
            </button>
          </div>
        </div>
      </div>
    </div>

      <!-- Footer -->
      <div class="p-4 border-t border-gray-200 bg-gray-50 flex-shrink-0">
        <!-- Metadata -->
        <div class="grid grid-cols-2 gap-4 text-sm mb-4">
          <div>
            <span class="text-gray-500">{{ $t('chunks.documentLabel') }}</span>
            <span class="ml-2 font-medium">{{ displayChunk.document_name }}</span>
          </div>
          <div>
            <span class="text-gray-500">{{ $t('chunks.tokensLabel') }}</span>
            <span class="ml-2 font-medium">{{ displayChunk.token_estimate }}</span>
          </div>
          <div>
            <span class="text-gray-500">{{ $t('chunks.characters') }}</span>
            <span class="ml-2 font-medium">{{ displayChunk.content_length }}</span>
          </div>
          <div>
            <span class="text-gray-500">{{ $t('chunks.vectorId') }}</span>
            <span class="ml-2 font-medium text-xs">{{ displayChunk.vector_id || 'N/A' }}</span>
          </div>
        </div>

        <!-- Actions -->
        <div class="flex items-center space-x-2">
          <button
            @click="copyContent"
            class="px-3 py-1.5 text-sm bg-gray-100 text-gray-700 rounded hover:bg-gray-200"
          >
            <font-awesome-icon icon="copy" class="mr-1" />
            {{ $t('common.copy') }}
          </button>
          <button
            @click="$emit('find-similar', displayChunk)"
            class="px-3 py-1.5 text-sm bg-blue-100 text-blue-700 rounded hover:bg-blue-200"
          >
            <font-awesome-icon icon="search" class="mr-1" />
            {{ $t('chunks.findSimilar') }}
          </button>
        </div>
      </div>
    </template>
  </div>
</template>

<script>
import { getChunkVector, getChunk } from '@/services/api'

export default {
  name: 'ChunkDetail',
  props: {
    chunk: {
      type: Object,
      default: null,
    },
  },
  emits: ['close', 'find-similar'],
  data() {
    return {
      fullChunk: null,
      loadingChunk: false,
      showVector: false,
      showFullVector: false,
      showVectorInfo: false,
      loadingVector: false,
      vectorData: null,
      vectorError: null,
    }
  },
  computed: {
    // Use fullChunk if available, otherwise fall back to prop
    displayChunk() {
      return this.fullChunk || this.chunk
    },
    hierarchyParts() {
      if (!this.displayChunk?.hierarchy_path) return []
      return this.displayChunk.hierarchy_path.split(' > ')
    },
    levelBadgeClass() {
      const colors = {
        1: 'bg-red-100 text-red-700',
        2: 'bg-orange-100 text-orange-700',
        3: 'bg-yellow-100 text-yellow-700',
        4: 'bg-green-100 text-green-700',
        5: 'bg-blue-100 text-blue-700',
        6: 'bg-purple-100 text-purple-700',
      }
      return colors[this.displayChunk?.hierarchy_level] || 'bg-gray-100 text-gray-700'
    },
    vectorPreview() {
      if (!this.vectorData?.vector) return ''
      return this.vectorData.vector.slice(0, 20).map(v => v.toFixed(4)).join(', ') + ', ...'
    },
    hasVectorId() {
      return this.displayChunk?.vector_id != null
    },
  },
  watch: {
    chunk: {
      immediate: true,
      async handler(newChunk) {
        // Reset state when chunk changes
        this.showVector = false
        this.showFullVector = false
        this.vectorData = null
        this.vectorError = null
        this.fullChunk = null

        // If chunk is missing key fields, fetch full data
        if (newChunk && newChunk.id && !newChunk.content) {
          await this.loadFullChunk()
        }
      },
    },
  },
  methods: {
    async loadFullChunk() {
      this.loadingChunk = true
      try {
        const response = await getChunk(this.chunk.id)
        this.fullChunk = response.data
      } catch (error) {
        console.error('Failed to load full chunk:', error)
      } finally {
        this.loadingChunk = false
      }
    },
    copyContent() {
      if (this.displayChunk?.content) {
        navigator.clipboard.writeText(this.displayChunk.content)
      }
    },
    async toggleVector() {
      this.showVector = !this.showVector

      if (this.showVector && !this.vectorData && !this.loadingVector) {
        await this.loadVector()
      }
    },
    async loadVector() {
      this.loadingVector = true
      this.vectorError = null

      try {
        const response = await getChunkVector(this.displayChunk.id)
        this.vectorData = response.data
      } catch (error) {
        this.vectorError = error.response?.data?.message || error.message
      } finally {
        this.loadingVector = false
      }
    },
    copyVector() {
      if (this.vectorData?.vector) {
        navigator.clipboard.writeText(JSON.stringify(this.vectorData.vector))
      }
    },
  },
}
</script>
