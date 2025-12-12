<template>
  <div v-if="chunk" class="bg-white border border-gray-200 rounded-lg h-full flex flex-col">
    <!-- Header -->
    <div class="p-4 border-b border-gray-200 flex-shrink-0">
      <div class="flex items-center justify-between">
        <h3 class="font-semibold text-gray-900">Chunk #{{ chunk.id }}</h3>
        <button @click="$emit('close')" class="text-gray-400 hover:text-gray-600">
          <font-awesome-icon icon="times" />
        </button>
      </div>

      <!-- Hierarchy Path -->
      <div v-if="chunk.hierarchy_path" class="mt-2 flex items-center flex-wrap text-sm">
        <template v-for="(part, index) in hierarchyParts" :key="index">
          <span v-if="index > 0" class="mx-1 text-gray-400">></span>
          <span class="text-blue-600">{{ part }}</span>
        </template>
      </div>
    </div>

    <!-- Content -->
    <div class="flex-1 overflow-y-auto p-4">
      <div class="prose prose-sm max-w-none">
        <p class="whitespace-pre-wrap">{{ chunk.content }}</p>
      </div>
    </div>

    <!-- Footer -->
    <div class="p-4 border-t border-gray-200 bg-gray-50 flex-shrink-0">
      <!-- Metadata -->
      <div class="grid grid-cols-2 gap-4 text-sm mb-4">
        <div>
          <span class="text-gray-500">Document:</span>
          <span class="ml-2 font-medium">{{ chunk.document_name }}</span>
        </div>
        <div>
          <span class="text-gray-500">Tokens:</span>
          <span class="ml-2 font-medium">{{ chunk.token_estimate }}</span>
        </div>
        <div>
          <span class="text-gray-500">Characters:</span>
          <span class="ml-2 font-medium">{{ chunk.content_length }}</span>
        </div>
        <div>
          <span class="text-gray-500">Vector ID:</span>
          <span class="ml-2 font-medium text-xs">{{ chunk.vector_id || 'N/A' }}</span>
        </div>
      </div>

      <!-- Actions -->
      <div class="flex items-center space-x-2">
        <button
          @click="copyContent"
          class="px-3 py-1.5 text-sm bg-gray-100 text-gray-700 rounded hover:bg-gray-200"
        >
          <font-awesome-icon icon="copy" class="mr-1" />
          Copy
        </button>
        <button
          @click="$emit('find-similar', chunk)"
          class="px-3 py-1.5 text-sm bg-blue-100 text-blue-700 rounded hover:bg-blue-200"
        >
          <font-awesome-icon icon="search" class="mr-1" />
          Find Similar
        </button>
      </div>
    </div>
  </div>
</template>

<script>
export default {
  name: 'ChunkDetail',
  props: {
    chunk: {
      type: Object,
      default: null,
    },
  },
  emits: ['close', 'find-similar'],
  computed: {
    hierarchyParts() {
      if (!this.chunk?.hierarchy_path) return []
      return this.chunk.hierarchy_path.split(' > ')
    },
  },
  methods: {
    copyContent() {
      if (this.chunk?.content) {
        navigator.clipboard.writeText(this.chunk.content)
      }
    },
  },
}
</script>
