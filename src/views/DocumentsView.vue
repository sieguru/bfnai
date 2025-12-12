<template>
  <div>
    <h1 class="text-2xl font-bold text-gray-900 mb-6">Documents</h1>

    <div class="grid grid-cols-1 lg:grid-cols-3 gap-6">
      <!-- Left: Upload & List -->
      <div class="lg:col-span-2 space-y-6">
        <!-- Upload Section -->
        <div class="bg-white border border-gray-200 rounded-lg p-6">
          <h2 class="text-lg font-semibold text-gray-900 mb-4">Upload Documents</h2>
          <DocumentUpload @uploaded="handleUploaded" />
        </div>

        <!-- Document List -->
        <div class="bg-white border border-gray-200 rounded-lg p-6">
          <h2 class="text-lg font-semibold text-gray-900 mb-4">Your Documents</h2>
          <DocumentList
            ref="documentList"
            :selected-id="selectedDocument?.id"
            @select="selectDocument"
            @process="openProcess"
            @deleted="handleDeleted"
          />
        </div>
      </div>

      <!-- Right: Document Details -->
      <div class="lg:col-span-1">
        <div v-if="selectedDocument" class="sticky top-20">
          <DocumentDetails
            :document="selectedDocument"
            @close="selectedDocument = null"
            @processed="handleProcessed"
          />
        </div>
        <div v-else class="bg-white border border-gray-200 rounded-lg p-6 text-center text-gray-500">
          Select a document to view details
        </div>
      </div>
    </div>
  </div>
</template>

<script>
import DocumentUpload from '@/components/documents/DocumentUpload.vue'
import DocumentList from '@/components/documents/DocumentList.vue'
import DocumentDetails from '@/components/documents/DocumentDetails.vue'

export default {
  name: 'DocumentsView',
  components: {
    DocumentUpload,
    DocumentList,
    DocumentDetails,
  },
  data() {
    return {
      selectedDocument: null,
    }
  },
  methods: {
    handleUploaded(documents) {
      this.$refs.documentList.refresh()
      if (documents.length === 1) {
        this.selectedDocument = documents[0]
      }
    },
    selectDocument(doc) {
      this.selectedDocument = doc
    },
    openProcess(doc) {
      this.selectedDocument = doc
    },
    handleDeleted(doc) {
      if (this.selectedDocument?.id === doc.id) {
        this.selectedDocument = null
      }
    },
    handleProcessed(result) {
      this.$refs.documentList.refresh()
    },
  },
}
</script>
