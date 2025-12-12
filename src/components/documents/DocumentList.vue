<template>
  <div>
    <!-- Controls -->
    <div class="flex items-center justify-between mb-4">
      <div class="flex items-center space-x-2">
        <select
          v-model="statusFilter"
          class="border-gray-300 rounded-md text-sm focus:ring-blue-500 focus:border-blue-500"
        >
          <option value="">All Status</option>
          <option value="pending">Pending</option>
          <option value="processing">Processing</option>
          <option value="completed">Completed</option>
          <option value="error">Error</option>
        </select>
        <button
          @click="loadDocuments"
          class="p-2 text-gray-500 hover:text-gray-700"
        >
          <font-awesome-icon icon="sync" :class="{ 'animate-spin': loading }" />
        </button>
      </div>
    </div>

    <!-- Loading -->
    <LoadingSpinner v-if="loading" text="Loading documents..." />

    <!-- Empty State -->
    <div v-else-if="documents.length === 0" class="text-center py-12">
      <font-awesome-icon icon="file-word" class="text-4xl text-gray-300 mb-4" />
      <p class="text-gray-500">No documents found</p>
    </div>

    <!-- Document List -->
    <div v-else class="space-y-3">
      <DocumentCard
        v-for="doc in documents"
        :key="doc.id"
        :document="doc"
        :selected="selectedId === doc.id"
        @select="$emit('select', doc)"
        @delete="confirmDelete(doc)"
        @process="$emit('process', doc)"
      />
    </div>

    <!-- Confirm Dialog -->
    <ConfirmDialog
      :show="showDeleteConfirm"
      type="danger"
      title="Delete Document"
      :message="`Are you sure you want to delete '${documentToDelete?.original_name}'? This will also delete all associated chunks.`"
      confirm-text="Delete"
      @confirm="handleDelete"
      @cancel="showDeleteConfirm = false"
    />
  </div>
</template>

<script>
import { getDocuments, deleteDocument } from '@/services/api'
import DocumentCard from './DocumentCard.vue'
import LoadingSpinner from '../common/LoadingSpinner.vue'
import ConfirmDialog from '../common/ConfirmDialog.vue'

export default {
  name: 'DocumentList',
  components: {
    DocumentCard,
    LoadingSpinner,
    ConfirmDialog,
  },
  props: {
    selectedId: {
      type: Number,
      default: null,
    },
  },
  emits: ['select', 'process', 'deleted'],
  data() {
    return {
      documents: [],
      loading: false,
      statusFilter: '',
      showDeleteConfirm: false,
      documentToDelete: null,
    }
  },
  watch: {
    statusFilter() {
      this.loadDocuments()
    },
  },
  mounted() {
    this.loadDocuments()
  },
  methods: {
    async loadDocuments() {
      this.loading = true
      try {
        const params = {}
        if (this.statusFilter) {
          params.status = this.statusFilter
        }
        const response = await getDocuments(params)
        this.documents = response.data.documents
      } catch (error) {
        console.error('Failed to load documents:', error)
      } finally {
        this.loading = false
      }
    },
    confirmDelete(doc) {
      this.documentToDelete = doc
      this.showDeleteConfirm = true
    },
    async handleDelete() {
      if (!this.documentToDelete) return

      try {
        await deleteDocument(this.documentToDelete.id)
        this.documents = this.documents.filter(d => d.id !== this.documentToDelete.id)
        this.$emit('deleted', this.documentToDelete)
      } catch (error) {
        console.error('Failed to delete document:', error)
      } finally {
        this.showDeleteConfirm = false
        this.documentToDelete = null
      }
    },
    refresh() {
      this.loadDocuments()
    },
  },
}
</script>
