<template>
  <div
    class="bg-white border border-gray-200 rounded-lg p-4 cursor-pointer hover:shadow-md transition-shadow"
    @click="$emit('click', chunk)"
  >
    <!-- Header -->
    <div class="flex items-start justify-between mb-2">
      <div class="flex-1 min-w-0">
        <!-- Hierarchy Breadcrumb -->
        <div v-if="chunk.hierarchy_path" class="flex items-center text-xs text-gray-500 mb-1">
          <template v-for="(part, index) in hierarchyParts" :key="index">
            <span v-if="index > 0" class="mx-1">></span>
            <span class="truncate">{{ part }}</span>
          </template>
        </div>

        <!-- Document Name -->
        <p class="text-sm text-gray-600">
          <font-awesome-icon icon="file-word" class="mr-1 text-blue-600" />
          {{ chunk.document_name }}
        </p>
      </div>

      <!-- Stats -->
      <div class="flex items-center space-x-2 text-xs text-gray-500 flex-shrink-0">
        <span class="px-2 py-0.5 bg-gray-100 rounded">
          {{ chunk.token_estimate }} tokens
        </span>
        <span class="text-gray-400">#{{ chunk.id }}</span>
      </div>
    </div>

    <!-- Content Preview -->
    <div class="text-sm text-gray-700">
      <p v-html="highlightedContent" class="line-clamp-3"></p>
    </div>

    <!-- Actions -->
    <div class="mt-3 flex items-center justify-between">
      <button
        @click.stop="copyContent"
        class="text-xs text-gray-500 hover:text-gray-700"
      >
        <font-awesome-icon icon="copy" class="mr-1" />
        Copy
      </button>
    </div>
  </div>
</template>

<script>
export default {
  name: 'ChunkCard',
  props: {
    chunk: {
      type: Object,
      required: true,
    },
    highlight: {
      type: String,
      default: '',
    },
  },
  emits: ['click'],
  computed: {
    hierarchyParts() {
      if (!this.chunk.hierarchy_path) return []
      return this.chunk.hierarchy_path.split(' > ')
    },
    contentPreview() {
      const content = this.chunk.content || ''
      return content.substring(0, 300) + (content.length > 300 ? '...' : '')
    },
    highlightedContent() {
      if (!this.highlight) return this.escapeHtml(this.contentPreview)

      const regex = new RegExp(`(${this.escapeRegex(this.highlight)})`, 'gi')
      return this.escapeHtml(this.contentPreview).replace(
        regex,
        '<mark class="bg-yellow-200">$1</mark>'
      )
    },
  },
  methods: {
    escapeHtml(text) {
      const div = document.createElement('div')
      div.textContent = text
      return div.innerHTML
    },
    escapeRegex(string) {
      return string.replace(/[.*+?^${}()|[\]\\]/g, '\\$&')
    },
    copyContent() {
      navigator.clipboard.writeText(this.chunk.content)
    },
  },
}
</script>

<style scoped>
.line-clamp-3 {
  display: -webkit-box;
  -webkit-line-clamp: 3;
  -webkit-box-orient: vertical;
  overflow: hidden;
}
</style>
