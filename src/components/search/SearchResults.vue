<template>
  <div>
    <!-- Results Header -->
    <div v-if="results.length > 0" class="flex items-center justify-between mb-4">
      <p class="text-sm text-gray-600">
        {{ $t('search.foundResults', { count: results.length, time: searchTimeMs }) }}
      </p>
    </div>

    <!-- Empty State -->
    <div v-if="results.length === 0 && !loading" class="text-center py-12">
      <font-awesome-icon icon="search" class="text-4xl text-gray-300 mb-4" />
      <p class="text-gray-500">{{ hasSearched ? $t('search.noResultsFound') : $t('search.enterQuery') }}</p>
    </div>

    <!-- Results List -->
    <div v-else class="space-y-4">
      <div
        v-for="(result, index) in results"
        :key="index"
        class="bg-white border border-gray-200 rounded-lg p-4 hover:shadow-md transition-shadow cursor-pointer"
        @click="$emit('select', result)"
      >
        <!-- Score & Header -->
        <div class="flex items-start justify-between mb-2">
          <div class="flex items-center space-x-3">
            <!-- Similarity Score -->
            <div class="flex items-center">
              <div class="w-12 h-2 bg-gray-200 rounded-full overflow-hidden">
                <div
                  class="h-full bg-green-500 rounded-full"
                  :style="{ width: scorePercent(result) + '%' }"
                ></div>
              </div>
              <span class="ml-2 text-sm font-medium" :class="scoreColorClass(result)">
                {{ formatScore(result) }}
              </span>
            </div>

            <!-- Hybrid scores -->
            <template v-if="result.vectorScore !== undefined">
              <span class="text-xs text-gray-400">
                V: {{ (result.vectorScore * 100).toFixed(0) }}%
              </span>
              <span class="text-xs text-gray-400">
                K: {{ (result.keywordScore * 100).toFixed(0) }}%
              </span>
            </template>
          </div>

          <span class="text-xs text-gray-400">#{{ result.chunk?.id || result.payload?.chunk_id }}</span>
        </div>

        <!-- Document & Hierarchy -->
        <div class="mb-2">
          <p class="text-sm font-medium text-gray-900">
            <font-awesome-icon icon="file-word" class="text-blue-600 mr-1" />
            {{ result.chunk?.document_name || result.payload?.document_name }}
          </p>
          <p v-if="hierarchyPath(result)" class="text-xs text-gray-500 mt-1">
            {{ hierarchyPath(result) }}
          </p>
        </div>

        <!-- Content Preview -->
        <div class="text-sm text-gray-700">
          <p v-html="highlightedContent(result)" class="line-clamp-3"></p>
        </div>

        <!-- Stats -->
        <div class="mt-2 flex items-center text-xs text-gray-400 space-x-4">
          <span>{{ result.chunk?.token_estimate || result.payload?.token_count }} {{ $t('common.tokens') }}</span>
        </div>
      </div>
    </div>
  </div>
</template>

<script>
export default {
  name: 'SearchResults',
  props: {
    results: {
      type: Array,
      default: () => [],
    },
    query: {
      type: String,
      default: '',
    },
    searchTimeMs: {
      type: Number,
      default: 0,
    },
    loading: {
      type: Boolean,
      default: false,
    },
    hasSearched: {
      type: Boolean,
      default: false,
    },
  },
  emits: ['select'],
  methods: {
    formatScore(result) {
      const score = result.score || result.combinedScore || 0
      return (score * 100).toFixed(1) + '%'
    },
    scorePercent(result) {
      const score = result.score || result.combinedScore || 0
      return Math.round(score * 100)
    },
    scoreColorClass(result) {
      const score = result.score || result.combinedScore || 0
      if (score >= 0.8) return 'text-green-600'
      if (score >= 0.6) return 'text-yellow-600'
      return 'text-red-600'
    },
    hierarchyPath(result) {
      return result.chunk?.hierarchy_path || result.payload?.hierarchy_path
    },
    getContent(result) {
      return result.chunk?.content || result.payload?.text_preview || ''
    },
    highlightedContent(result) {
      const content = this.getContent(result)
      const preview = content.substring(0, 300) + (content.length > 300 ? '...' : '')

      if (!this.query) return this.escapeHtml(preview)

      // Highlight query terms
      const terms = this.query.split(/\s+/).filter(t => t.length > 2)
      let highlighted = this.escapeHtml(preview)

      terms.forEach(term => {
        const regex = new RegExp(`(${this.escapeRegex(term)})`, 'gi')
        highlighted = highlighted.replace(regex, '<mark class="bg-yellow-200">$1</mark>')
      })

      return highlighted
    },
    escapeHtml(text) {
      const div = document.createElement('div')
      div.textContent = text
      return div.innerHTML
    },
    escapeRegex(string) {
      return string.replace(/[.*+?^${}()|[\]\\]/g, '\\$&')
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
