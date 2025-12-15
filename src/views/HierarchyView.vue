<template>
  <div class="h-[calc(100vh-8rem)]">
    <h1 class="text-2xl font-bold text-gray-900 mb-6">{{ $t('hierarchy.title') }}</h1>

    <div class="grid grid-cols-1 lg:grid-cols-4 gap-6 h-full">
      <!-- Left: Document selector -->
      <div class="lg:col-span-1 bg-white border border-gray-200 rounded-lg p-4 overflow-hidden flex flex-col">
        <h2 class="text-lg font-semibold mb-4">{{ $t('hierarchy.selectDocument') }}</h2>

        <div v-if="loading" class="text-center py-4 text-gray-500">
          {{ $t('common.loading') }}
        </div>

        <div v-else-if="documents.length === 0" class="text-center py-4 text-gray-500">
          {{ $t('hierarchy.noDocuments') }}
        </div>

        <div v-else class="space-y-2 overflow-y-auto flex-1">
          <button
            v-for="doc in documents"
            :key="doc.id"
            @click="selectDocument(doc)"
            :class="[
              'w-full text-left px-3 py-2 rounded-lg border transition-colors',
              selectedDocument?.id === doc.id
                ? 'border-blue-500 bg-blue-50 text-blue-700'
                : 'border-gray-200 hover:border-gray-300 hover:bg-gray-50'
            ]"
          >
            <div class="font-medium truncate">{{ stripExtension(doc.original_name) }}</div>
            <div class="text-xs text-gray-500">
              {{ doc.chunkCount }} {{ $t('common.chunks') }}
            </div>
          </button>
        </div>
      </div>

      <!-- Right: Hierarchy tree -->
      <div class="lg:col-span-3 bg-white border border-gray-200 rounded-lg p-6 overflow-hidden flex flex-col">
        <div v-if="!selectedDocument" class="text-center text-gray-500 h-full flex items-center justify-center">
          {{ $t('hierarchy.selectToView') }}
        </div>

        <div v-else-if="hierarchyLoading" class="text-center text-gray-500 h-full flex items-center justify-center">
          {{ $t('common.loading') }}
        </div>

        <div v-else-if="!hierarchy || !hierarchy.children || hierarchy.children.length === 0" class="text-center text-gray-500 h-full flex items-center justify-center">
          {{ $t('hierarchy.noHierarchy') }}
        </div>

        <template v-else>
          <div class="flex items-center justify-between mb-4">
            <h2 class="text-lg font-semibold">{{ documentName }}</h2>
            <div class="flex gap-2">
              <button
                @click="expandAll"
                class="px-3 py-1 text-sm bg-gray-100 hover:bg-gray-200 rounded transition-colors"
              >
                {{ $t('hierarchy.expandAll') }}
              </button>
              <button
                @click="collapseAll"
                class="px-3 py-1 text-sm bg-gray-100 hover:bg-gray-200 rounded transition-colors"
              >
                {{ $t('hierarchy.collapseAll') }}
              </button>
            </div>
          </div>

          <div class="overflow-y-auto flex-1">
            <HierarchyNode
              v-for="(node, index) in hierarchy.children"
              :key="index"
              :node="node"
              :level="0"
              :expanded-nodes="expandedNodes"
              @toggle="toggleNode"
              @select-paragraph="selectParagraph"
            />
          </div>
        </template>
      </div>
    </div>

    <!-- Paragraph detail modal -->
    <div
      v-if="selectedParagraph"
      class="fixed inset-0 bg-black bg-opacity-50 flex items-center justify-center z-50"
      @click.self="selectedParagraph = null"
    >
      <div class="bg-white rounded-lg shadow-xl max-w-2xl w-full mx-4 max-h-[80vh] overflow-hidden">
        <div class="p-4 border-b flex items-center justify-between">
          <h3 class="font-semibold">{{ $t('hierarchy.paragraphDetail') }}</h3>
          <button @click="selectedParagraph = null" class="text-gray-500 hover:text-gray-700">
            <font-awesome-icon icon="times" />
          </button>
        </div>
        <div class="p-4 overflow-y-auto max-h-[60vh]">
          <div class="mb-2 text-sm text-gray-500">
            <span class="font-medium">{{ $t('hierarchy.style') }}:</span> {{ selectedParagraph.style }}
          </div>
          <div v-if="selectedParagraph.contentType" class="mb-2 text-sm text-gray-500">
            <span class="font-medium">{{ $t('hierarchy.contentType') }}:</span> {{ selectedParagraph.contentType }}
          </div>
          <div class="prose prose-sm max-w-none">
            {{ selectedParagraph.text }}
          </div>
        </div>
      </div>
    </div>
  </div>
</template>

<script>
import { getDocuments, getDocumentHierarchy } from '@/services/api'
import HierarchyNode from '@/components/hierarchy/HierarchyNode.vue'

export default {
  name: 'HierarchyView',
  components: {
    HierarchyNode,
  },
  data() {
    return {
      documents: [],
      loading: true,
      selectedDocument: null,
      hierarchy: null,
      hierarchyLoading: false,
      documentName: '',
      expandedNodes: new Set(),
      selectedParagraph: null,
    }
  },
  async mounted() {
    await this.loadDocuments()
  },
  methods: {
    stripExtension(filename) {
      if (!filename) return ''
      return filename.replace(/\.[^/.]+$/, '')
    },
    async loadDocuments() {
      this.loading = true
      try {
        const response = await getDocuments({ status: 'completed' })
        this.documents = response.data.documents || []
      } catch (error) {
        console.error('Failed to load documents:', error)
      } finally {
        this.loading = false
      }
    },
    async selectDocument(doc) {
      this.selectedDocument = doc
      this.hierarchyLoading = true
      this.hierarchy = null
      this.expandedNodes = new Set()

      try {
        const response = await getDocumentHierarchy(doc.id)
        this.hierarchy = response.data.hierarchy
        this.documentName = response.data.documentName

        // Auto-expand first level
        if (this.hierarchy?.children) {
          this.hierarchy.children.forEach((_, index) => {
            this.expandedNodes.add(`0-${index}`)
          })
        }
      } catch (error) {
        console.error('Failed to load hierarchy:', error)
      } finally {
        this.hierarchyLoading = false
      }
    },
    toggleNode(nodeId) {
      if (this.expandedNodes.has(nodeId)) {
        this.expandedNodes.delete(nodeId)
      } else {
        this.expandedNodes.add(nodeId)
      }
      // Force reactivity
      this.expandedNodes = new Set(this.expandedNodes)
    },
    expandAll() {
      const collectNodeIds = (nodes, prefix = '0') => {
        nodes.forEach((node, index) => {
          const nodeId = `${prefix}-${index}`
          this.expandedNodes.add(nodeId)
          if (node.children && node.children.length > 0) {
            collectNodeIds(node.children, nodeId)
          }
        })
      }
      if (this.hierarchy?.children) {
        collectNodeIds(this.hierarchy.children)
        this.expandedNodes = new Set(this.expandedNodes)
      }
    },
    collapseAll() {
      this.expandedNodes = new Set()
    },
    selectParagraph(paragraph) {
      this.selectedParagraph = paragraph
    },
  },
}
</script>