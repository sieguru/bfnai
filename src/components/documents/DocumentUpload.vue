<template>
  <div
    class="border-2 border-dashed rounded-lg p-8 text-center transition-colors"
    :class="isDragging ? 'border-blue-500 bg-blue-50' : 'border-gray-300 hover:border-gray-400'"
    @dragover.prevent="isDragging = true"
    @dragleave.prevent="isDragging = false"
    @drop.prevent="handleDrop"
  >
    <input
      ref="fileInput"
      type="file"
      accept=".docx"
      multiple
      class="hidden"
      @change="handleFileSelect"
    />

    <font-awesome-icon icon="cloud-upload-alt" class="text-5xl text-gray-400 mb-4" />
    <h3 class="text-lg font-medium text-gray-900 mb-2">Upload Documents</h3>
    <p class="text-sm text-gray-500 mb-4">Drag and drop .docx files here, or click to select</p>

    <button
      @click="$refs.fileInput.click()"
      class="px-4 py-2 bg-blue-600 text-white rounded-md hover:bg-blue-700 focus:outline-none focus:ring-2 focus:ring-blue-500"
    >
      Select Files
    </button>

    <!-- Upload Queue -->
    <div v-if="uploadQueue.length > 0" class="mt-6 text-left">
      <h4 class="text-sm font-medium text-gray-700 mb-2">Upload Queue</h4>
      <div class="space-y-2">
        <div
          v-for="(file, index) in uploadQueue"
          :key="index"
          class="flex items-center justify-between p-3 bg-gray-50 rounded-lg"
        >
          <div class="flex items-center">
            <font-awesome-icon icon="file-word" class="text-blue-600 mr-3" />
            <div>
              <p class="text-sm font-medium text-gray-900">{{ file.name }}</p>
              <p class="text-xs text-gray-500">{{ formatFileSize(file.size) }}</p>
            </div>
          </div>
          <div class="flex items-center">
            <font-awesome-icon
              v-if="file.status === 'uploading'"
              icon="spinner"
              spin
              class="text-blue-600"
            />
            <font-awesome-icon
              v-else-if="file.status === 'success'"
              icon="check-circle"
              class="text-green-600"
            />
            <font-awesome-icon
              v-else-if="file.status === 'error'"
              icon="exclamation-circle"
              class="text-red-600"
            />
            <button
              v-else
              @click="removeFromQueue(index)"
              class="text-gray-400 hover:text-red-600"
            >
              <font-awesome-icon icon="times" />
            </button>
          </div>
        </div>
      </div>

      <div class="mt-4 flex justify-end space-x-3">
        <button
          @click="clearQueue"
          class="px-3 py-1.5 text-sm text-gray-600 hover:text-gray-800"
        >
          Clear
        </button>
        <button
          @click="uploadAll"
          :disabled="isUploading"
          class="px-4 py-2 bg-blue-600 text-white rounded-md hover:bg-blue-700 disabled:opacity-50"
        >
          <font-awesome-icon v-if="isUploading" icon="spinner" spin class="mr-2" />
          Upload All
        </button>
      </div>
    </div>
  </div>
</template>

<script>
import { uploadDocuments } from '@/services/api'

export default {
  name: 'DocumentUpload',
  emits: ['uploaded'],
  data() {
    return {
      isDragging: false,
      uploadQueue: [],
      isUploading: false,
    }
  },
  methods: {
    handleDrop(event) {
      this.isDragging = false
      const files = Array.from(event.dataTransfer.files)
      this.addFiles(files)
    },
    handleFileSelect(event) {
      const files = Array.from(event.target.files)
      this.addFiles(files)
      event.target.value = ''
    },
    addFiles(files) {
      const validFiles = files.filter(file => {
        if (!file.name.toLowerCase().endsWith('.docx')) {
          alert(`${file.name} is not a .docx file`)
          return false
        }
        return true
      })

      validFiles.forEach(file => {
        this.uploadQueue.push({
          file,
          name: file.name,
          size: file.size,
          status: 'pending',
        })
      })
    },
    removeFromQueue(index) {
      this.uploadQueue.splice(index, 1)
    },
    clearQueue() {
      this.uploadQueue = this.uploadQueue.filter(f => f.status === 'uploading')
    },
    formatFileSize(bytes) {
      if (bytes < 1024) return bytes + ' B'
      if (bytes < 1024 * 1024) return (bytes / 1024).toFixed(1) + ' KB'
      return (bytes / (1024 * 1024)).toFixed(1) + ' MB'
    },
    async uploadAll() {
      this.isUploading = true
      const pendingFiles = this.uploadQueue.filter(f => f.status === 'pending')

      const formData = new FormData()
      pendingFiles.forEach(item => {
        formData.append('files', item.file)
        item.status = 'uploading'
      })

      try {
        const response = await uploadDocuments(formData)

        pendingFiles.forEach(item => {
          item.status = 'success'
        })

        this.$emit('uploaded', response.data.documents)

        // Clear successful uploads after a delay
        setTimeout(() => {
          this.uploadQueue = this.uploadQueue.filter(f => f.status !== 'success')
        }, 2000)
      } catch (error) {
        pendingFiles.forEach(item => {
          item.status = 'error'
        })
        console.error('Upload failed:', error)
      } finally {
        this.isUploading = false
      }
    },
  },
}
</script>
