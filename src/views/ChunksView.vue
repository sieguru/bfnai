<template>
  <div class="h-[calc(100vh-8rem)]">
    <h1 class="text-2xl font-bold text-gray-900 mb-6">{{ $t('chunks.title') }}</h1>

    <div class="grid grid-cols-1 lg:grid-cols-3 gap-6 h-full">
      <!-- Left: Explorer -->
      <div class="lg:col-span-2 bg-white border border-gray-200 rounded-lg p-6 overflow-hidden flex flex-col">
        <ChunkExplorer @select="selectChunk" />
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
          {{ $t('chunks.selectToView') }}
        </div>
      </div>
    </div>
  </div>
</template>

<script>
import ChunkExplorer from '@/components/chunks/ChunkExplorer.vue'
import ChunkDetail from '@/components/chunks/ChunkDetail.vue'
import { getChunk } from '@/services/api'

export default {
  name: 'ChunksView',
  components: {
    ChunkExplorer,
    ChunkDetail,
  },
  data() {
    return {
      selectedChunk: null,
    }
  },
  methods: {
    async selectChunk(chunk) {
      // If it's a tree node chunk, load full details
      if (chunk.id && !chunk.content) {
        try {
          const response = await getChunk(chunk.id)
          this.selectedChunk = response.data
        } catch (error) {
          console.error('Failed to load chunk:', error)
        }
      } else {
        this.selectedChunk = chunk
      }
    },
    findSimilar(chunk) {
      this.$router.push({
        name: 'search',
        query: { chunkId: chunk.id },
      })
    },
  },
}
</script>
