<template>
  <div class="bg-white border border-gray-200 rounded-lg p-3">
    <!-- Header -->
    <div class="flex items-start justify-between mb-2">
      <div class="flex items-center">
        <span class="w-6 h-6 rounded-full bg-blue-100 text-blue-700 text-xs font-medium flex items-center justify-center mr-2">
          {{ index }}
        </span>
        <div>
          <p class="text-sm font-medium text-gray-900">{{ source.document_name }}</p>
          <p class="text-xs text-gray-500">{{ source.hierarchy_path }}</p>
        </div>
      </div>
      <span class="text-xs text-gray-400">
        {{ formatScore(source.score) }}
      </span>
    </div>

    <!-- Content Preview -->
    <div class="text-sm text-gray-700">
      <p class="line-clamp-4">{{ source.content }}</p>
    </div>

    <!-- Expand Button -->
    <button
      v-if="source.content?.length > 200"
      @click="expanded = !expanded"
      class="mt-2 text-xs text-blue-600 hover:text-blue-700"
    >
      {{ expanded ? 'Show less' : 'Show more' }}
    </button>

    <!-- Expanded Content -->
    <div v-if="expanded" class="mt-2 p-2 bg-gray-50 rounded text-sm text-gray-700 max-h-64 overflow-y-auto">
      {{ source.content }}
    </div>
  </div>
</template>

<script>
export default {
  name: 'SourceCitation',
  props: {
    source: {
      type: Object,
      required: true,
    },
    index: {
      type: Number,
      default: 1,
    },
  },
  data() {
    return {
      expanded: false,
    }
  },
  methods: {
    formatScore(score) {
      if (!score) return ''
      return (score * 100).toFixed(0) + '% match'
    },
  },
}
</script>

<style scoped>
.line-clamp-4 {
  display: -webkit-box;
  -webkit-line-clamp: 4;
  -webkit-box-orient: vertical;
  overflow: hidden;
}
</style>
