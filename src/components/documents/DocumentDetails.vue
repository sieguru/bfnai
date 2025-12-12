<template>
  <div v-if="document" class="bg-white border border-gray-200 rounded-lg">
    <!-- Header -->
    <div class="p-4 border-b border-gray-200">
      <div class="flex items-center justify-between">
        <h2 class="text-lg font-semibold text-gray-900">{{ document.original_name }}</h2>
        <button @click="$emit('close')" class="text-gray-400 hover:text-gray-600">
          <font-awesome-icon icon="times" />
        </button>
      </div>
      <div class="mt-2 flex items-center space-x-4 text-sm text-gray-500">
        <span>{{ formatFileSize(document.file_size) }}</span>
        <span :class="['px-2 py-0.5 rounded-full text-xs font-medium', statusClass]">
          {{ document.status }}
        </span>
      </div>
    </div>

    <!-- Content -->
    <div class="p-4 space-y-6">
      <!-- Detected Styles Section -->
      <div>
        <div class="flex items-center justify-between mb-3">
          <h3 class="font-medium text-gray-900">
            Detected Styles
            <span v-if="styles.length" class="ml-2 text-sm font-normal text-gray-500">({{ styles.length }})</span>
          </h3>
          <div class="space-x-2">
            <button
              v-if="!styles.length"
              @click="analyzeStyles"
              :disabled="analyzingStyles"
              class="text-sm text-blue-600 hover:text-blue-700"
            >
              <font-awesome-icon v-if="analyzingStyles" icon="spinner" spin class="mr-1" />
              Analyze Styles
            </button>
            <button
              v-else
              @click="applyDefaults"
              class="text-sm text-blue-600 hover:text-blue-700"
            >
              Apply Defaults
            </button>
          </div>
        </div>

        <div v-if="styles.length === 0" class="text-sm text-gray-500 py-4 text-center">
          Click "Analyze Styles" to detect styles in this document
        </div>

        <div v-else class="space-y-2 max-h-64 overflow-y-auto">
          <div
            v-for="style in sortedStyles"
            :key="style.style_name"
            class="flex items-center justify-between p-2 bg-gray-50 rounded"
          >
            <div class="flex-1 min-w-0">
              <p class="text-sm font-medium text-gray-900">{{ style.style_name }}</p>
              <p class="text-xs text-gray-500 truncate">{{ style.sample_text }}</p>
              <span class="text-xs text-gray-400">{{ style.occurrence_count }} occurrences</span>
            </div>
            <select
              :value="styleConfig[style.style_name] ?? ''"
              @change="onStyleChange(style.style_name, $event)"
              class="ml-2 text-sm border-gray-300 rounded focus:ring-blue-500 focus:border-blue-500"
            >
              <option value="">Body Text</option>
              <option value="1">Heading 1</option>
              <option value="2">Heading 2</option>
              <option value="3">Heading 3</option>
              <option value="4">Heading 4</option>
              <option value="5">Heading 5</option>
              <option value="6">Heading 6</option>
              <option value="ignore">Ignore</option>
            </select>
          </div>
        </div>
      </div>

      <!-- Processing Options -->
      <div>
        <h3 class="font-medium text-gray-900 mb-3">Processing Options</h3>

        <div class="space-y-4">
          <div>
            <label class="block text-sm text-gray-700 mb-1">
              Chunk Size (tokens): {{ chunkSize }}
            </label>
            <input
              type="range"
              v-model.number="chunkSize"
              min="100"
              max="1000"
              step="50"
              class="w-full"
            />
            <div class="flex justify-between text-xs text-gray-400">
              <span>100</span>
              <span>1000</span>
            </div>
          </div>

          <div>
            <label class="block text-sm text-gray-700 mb-1">
              Overlap (paragraphs): {{ chunkOverlap }}
            </label>
            <input
              type="range"
              v-model.number="chunkOverlap"
              min="0"
              max="3"
              step="1"
              class="w-full"
            />
            <div class="flex justify-between text-xs text-gray-400">
              <span>0</span>
              <span>3</span>
            </div>
          </div>
        </div>
      </div>

      <!-- Process Button -->
      <button
        @click="processDocument"
        :disabled="processing"
        class="w-full px-4 py-2 bg-blue-600 text-white rounded-md hover:bg-blue-700 disabled:opacity-50 disabled:cursor-not-allowed"
      >
        <font-awesome-icon v-if="processing" icon="spinner" spin class="mr-2" />
        {{ processing ? 'Processing...' : 'Process Document' }}
      </button>

      <!-- Processing Progress -->
      <div v-if="processing" class="space-y-2">
        <ProgressBar :value="processProgress" label="Processing" />
        <p class="text-sm text-gray-500 text-center">{{ processStatus }}</p>
      </div>

      <!-- Chunk Statistics (after processing) -->
      <div v-if="document.status === 'completed' && chunkStats" class="bg-gray-50 rounded-lg p-4">
        <h3 class="font-medium text-gray-900 mb-3">Chunk Statistics</h3>
        <div class="grid grid-cols-2 gap-4 text-sm">
          <div>
            <span class="text-gray-500">Total Chunks:</span>
            <span class="ml-2 font-medium">{{ chunkStats.totalChunks }}</span>
          </div>
          <div>
            <span class="text-gray-500">Avg Tokens:</span>
            <span class="ml-2 font-medium">{{ chunkStats.avgTokens }}</span>
          </div>
          <div>
            <span class="text-gray-500">Min Tokens:</span>
            <span class="ml-2 font-medium">{{ chunkStats.minTokens }}</span>
          </div>
          <div>
            <span class="text-gray-500">Max Tokens:</span>
            <span class="ml-2 font-medium">{{ chunkStats.maxTokens }}</span>
          </div>
        </div>
      </div>
    </div>
  </div>
</template>

<script>
import { analyzeDocumentStyles, getDocumentStyles, updateDocumentStyles, processDocument } from '@/services/api'
import ProgressBar from '../common/ProgressBar.vue'

export default {
  name: 'DocumentDetails',
  components: {
    ProgressBar,
  },
  props: {
    document: {
      type: Object,
      default: null,
    },
  },
  emits: ['close', 'processed'],
  data() {
    return {
      styles: [],
      styleConfig: {},
      chunkSize: 500,
      chunkOverlap: 1,
      analyzingStyles: false,
      processing: false,
      processProgress: 0,
      processStatus: '',
      chunkStats: null,
    }
  },
  computed: {
    statusClass() {
      const classes = {
        pending: 'bg-yellow-100 text-yellow-800',
        processing: 'bg-blue-100 text-blue-800',
        completed: 'bg-green-100 text-green-800',
        error: 'bg-red-100 text-red-800',
      }
      return classes[this.document?.status] || 'bg-gray-100 text-gray-800'
    },
    sortedStyles() {
      return [...this.styles].sort((a, b) =>
        (a.style_name || '').localeCompare(b.style_name || '')
      )
    },
  },
  watch: {
    document: {
      immediate: true,
      handler(newDoc) {
        if (newDoc) {
          this.loadStyles()
        }
      },
    },
  },
  methods: {
    formatFileSize(bytes) {
      if (!bytes) return '-'
      if (bytes < 1024) return bytes + ' B'
      if (bytes < 1024 * 1024) return (bytes / 1024).toFixed(1) + ' KB'
      return (bytes / (1024 * 1024)).toFixed(1) + ' MB'
    },
    async loadStyles() {
      try {
        const response = await getDocumentStyles(this.document.id)
        this.styles = response.data.styles || []

        // Initialize style config - convert to string values to match select options
        this.styleConfig = {}
        this.styles.forEach(style => {
          // Convert integer heading_level to string, null to empty string
          this.styleConfig[style.style_name] = style.heading_level != null
            ? String(style.heading_level)
            : ''
        })
      } catch (error) {
        console.error('Failed to load styles:', error)
      }
    },
    async analyzeStyles() {
      this.analyzingStyles = true
      try {
        const response = await analyzeDocumentStyles(this.document.id)
        this.styles = response.data.styles || []

        // Initialize style config - convert to string values to match select options
        this.styleConfig = {}
        this.styles.forEach(style => {
          this.styleConfig[style.style_name] = style.heading_level != null
            ? String(style.heading_level)
            : ''
        })
      } catch (error) {
        console.error('Failed to analyze styles:', error)
      } finally {
        this.analyzingStyles = false
      }
    },
    applyDefaults() {
      const defaults = {
        'Heading 1': '1',
        'Heading 2': '2',
        'Heading 3': '3',
        'Heading 4': '4',
        'Heading 5': '5',
        'Heading 6': '6',
        'Rubrik 1': '1',
        'Rubrik 2': '2',
        'Rubrik 3': '3',
        'Title': '1',
        'Subtitle': '2',
        'Normal': '',
        'Body Text': '',
      }

      const stylesToSave = []
      this.styles.forEach(style => {
        if (defaults.hasOwnProperty(style.style_name)) {
          const value = defaults[style.style_name]
          this.styleConfig[style.style_name] = value
          stylesToSave.push({
            styleName: style.style_name,
            headingLevel: value === '' ? null : parseInt(value, 10),
          })
        }
      })

      // Save all defaults to database
      if (stylesToSave.length > 0) {
        this.saveAllStyleMappings(stylesToSave)
      }
    },
    onStyleChange(styleName, event) {
      const rawValue = event.target.value

      // Update local state with string value for select binding
      this.styleConfig[styleName] = rawValue

      // Convert to proper type for database: empty string -> null, number strings -> integers
      let headingLevel = null
      if (rawValue === 'ignore') {
        headingLevel = null  // 'ignore' is stored as null but not configured
      } else if (rawValue && rawValue !== '') {
        headingLevel = parseInt(rawValue, 10)
      }

      // Save to database
      this.saveStyleMapping(styleName, headingLevel)
    },
    async saveStyleMapping(styleName, headingLevel) {
      try {
        await updateDocumentStyles(this.document.id, [{
          styleName,
          headingLevel: headingLevel === 'ignore' ? null : headingLevel,
        }])
      } catch (error) {
        console.error('Failed to save style mapping:', error)
      }
    },
    async saveAllStyleMappings(styles) {
      try {
        await updateDocumentStyles(this.document.id, styles)
      } catch (error) {
        console.error('Failed to save style mappings:', error)
      }
    },
    async processDocument() {
      this.processing = true
      this.processProgress = 0
      this.processStatus = 'Starting...'

      try {
        this.processStatus = 'Processing document...'
        this.processProgress = 30

        // Style mappings are loaded from database on the backend
        const response = await processDocument(this.document.id, {
          chunkSize: this.chunkSize,
          chunkOverlap: this.chunkOverlap,
        })

        this.processProgress = 100
        this.processStatus = 'Complete!'
        this.chunkStats = response.data.stats

        this.$emit('processed', response.data)
      } catch (error) {
        console.error('Processing failed:', error)
        this.processStatus = 'Failed: ' + (error.response?.data?.message || error.message)
      } finally {
        this.processing = false
      }
    },
  },
}
</script>
