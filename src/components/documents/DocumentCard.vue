<template>
  <div
    class="bg-white border rounded-lg p-4 cursor-pointer transition-all hover:shadow-md"
    :class="selected ? 'border-blue-500 ring-2 ring-blue-200' : 'border-gray-200'"
    @click="$emit('select', document)"
  >
    <div class="flex items-start justify-between">
      <div class="flex items-start">
        <font-awesome-icon icon="file-word" class="text-blue-600 text-xl mt-1 mr-3" />
        <div>
          <h3 class="font-medium text-gray-900">{{ document.original_name }}</h3>
          <p class="text-sm text-gray-500">{{ formatFileSize(document.file_size) }}</p>
        </div>
      </div>

      <!-- Status Badge -->
      <span :class="['px-2.5 py-0.5 rounded-full text-xs font-medium', statusClass]">
        {{ document.status }}
      </span>
    </div>

    <!-- Stats Row -->
    <div class="mt-3 flex items-center justify-between text-sm text-gray-500">
      <div class="flex items-center space-x-4">
        <span>
          <font-awesome-icon icon="layer-group" class="mr-1" />
          {{ document.chunkCount || 0 }} chunks
        </span>
        <span>
          <font-awesome-icon icon="clock" class="mr-1" />
          {{ formatDate(document.upload_date) }}
        </span>
      </div>

      <!-- Actions -->
      <div class="flex items-center space-x-2" @click.stop>
        <button
          v-if="document.status === 'pending' || document.status === 'error'"
          @click="$emit('process', document)"
          class="p-1.5 text-blue-600 hover:bg-blue-50 rounded"
          title="Process document"
        >
          <font-awesome-icon icon="play" />
        </button>
        <button
          @click="$emit('delete', document)"
          class="p-1.5 text-red-600 hover:bg-red-50 rounded"
          title="Delete document"
        >
          <font-awesome-icon icon="trash" />
        </button>
      </div>
    </div>

    <!-- Error Message -->
    <div v-if="document.status === 'error' && document.error_message" class="mt-2">
      <p class="text-sm text-red-600">
        <font-awesome-icon icon="exclamation-circle" class="mr-1" />
        {{ document.error_message }}
      </p>
    </div>
  </div>
</template>

<script>
export default {
  name: 'DocumentCard',
  props: {
    document: {
      type: Object,
      required: true,
    },
    selected: {
      type: Boolean,
      default: false,
    },
  },
  emits: ['select', 'delete', 'process'],
  computed: {
    statusClass() {
      const classes = {
        pending: 'bg-yellow-100 text-yellow-800',
        processing: 'bg-blue-100 text-blue-800',
        completed: 'bg-green-100 text-green-800',
        error: 'bg-red-100 text-red-800',
      }
      return classes[this.document.status] || 'bg-gray-100 text-gray-800'
    },
  },
  methods: {
    formatFileSize(bytes) {
      if (!bytes) return '-'
      if (bytes < 1024) return bytes + ' B'
      if (bytes < 1024 * 1024) return (bytes / 1024).toFixed(1) + ' KB'
      return (bytes / (1024 * 1024)).toFixed(1) + ' MB'
    },
    formatDate(dateString) {
      if (!dateString) return '-'
      return new Date(dateString).toLocaleDateString()
    },
  },
}
</script>
