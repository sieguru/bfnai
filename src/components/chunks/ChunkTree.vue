<template>
  <div>
    <div v-if="!documentId" class="text-center py-8">
      <font-awesome-icon icon="sitemap" class="text-4xl text-gray-300 mb-4" />
      <p class="text-gray-500 mb-2">{{ $t('chunks.treeViewRequiresDocument') }}</p>
      <p class="text-sm text-gray-400">{{ $t('chunks.selectDocumentAbove') }}</p>
    </div>

    <LoadingSpinner v-else-if="loading" :text="$t('chunks.loadingTree')" />

    <div v-else-if="tree" class="space-y-1">
      <!-- Summary banner -->
      <div v-if="summary" class="mb-4 p-3 bg-gray-50 rounded-lg border">
        <div class="flex items-center justify-between">
          <span class="text-sm text-gray-600">
            <strong>{{ summary.totalChunks }}</strong> {{ $t('chunks.chunksTotal') }}
          </span>
          <div class="text-xs space-x-3">
            <span class="text-green-600">
              <font-awesome-icon icon="sitemap" class="mr-1" />
              {{ summary.chunksWithHierarchy }} {{ $t('chunks.withHierarchy') }}
            </span>
            <span :class="summary.chunksWithoutHierarchy > 0 ? 'text-amber-600' : 'text-gray-400'">
              <font-awesome-icon icon="file-alt" class="mr-1" />
              {{ summary.chunksWithoutHierarchy }} {{ $t('chunks.orphan') }}
            </span>
          </div>
        </div>
        <p v-if="summary.chunksWithoutHierarchy > 0 && summary.chunksWithHierarchy === 0" class="text-xs text-amber-600 mt-2">
          <font-awesome-icon icon="exclamation-triangle" class="mr-1" />
          {{ $t('chunks.noHierarchyDetected') }}
        </p>
      </div>

      <div v-if="tree.children.length > 0" class="flex items-center justify-between mb-4">
        <span class="text-sm text-gray-500">{{ $t('chunks.hierarchy') }}</span>
        <div class="space-x-2">
          <button @click="expandAll" class="text-xs text-blue-600 hover:text-blue-700">
            {{ $t('chunks.expandAll') }}
          </button>
          <button @click="collapseAll" class="text-xs text-blue-600 hover:text-blue-700">
            {{ $t('chunks.collapseAll') }}
          </button>
        </div>
      </div>

      <TreeNode
        v-for="(node, index) in tree.children"
        :key="index"
        :node="node"
        :expanded-nodes="expandedNodes"
        @toggle="toggleNode"
        @select="$emit('select', $event)"
      />

      <!-- Orphan chunks (no hierarchy) -->
      <div v-if="tree.chunks && tree.chunks.length > 0" class="mt-4">
        <div class="flex items-center mb-2">
          <font-awesome-icon icon="folder-open" class="text-amber-500 mr-2" />
          <span class="text-sm font-medium text-gray-700">{{ $t('chunks.orphanChunks') }}</span>
          <span class="ml-2 text-xs text-gray-400">{{ tree.chunks.length }} {{ $t('common.chunks') }}</span>
        </div>
        <div class="ml-4 space-y-1 border-l-2 border-amber-200 pl-3">
          <div
            v-for="chunk in visibleOrphanChunks"
            :key="chunk.id"
            class="flex items-center p-2 rounded hover:bg-amber-50 cursor-pointer"
            @click="$emit('select', chunk)"
          >
            <font-awesome-icon icon="file-alt" class="text-amber-400 mr-2" />
            <span class="text-sm text-gray-700 truncate flex-1">{{ chunk.preview }}</span>
            <span class="text-xs text-gray-400">{{ chunk.tokenEstimate }} {{ $t('common.tokens') }}</span>
          </div>
          <button
            v-if="tree.chunks.length > orphanChunksLimit"
            @click="showMoreOrphans"
            class="w-full py-2 text-sm text-blue-600 hover:text-blue-700 hover:bg-blue-50 rounded"
          >
            {{ $t('chunks.showMore', { count: tree.chunks.length - orphanChunksLimit }) }}
          </button>
        </div>
      </div>

      <!-- Empty state when no chunks at all -->
      <div v-if="tree.children.length === 0 && (!tree.chunks || tree.chunks.length === 0)" class="text-center py-8">
        <font-awesome-icon icon="folder-open" class="text-4xl text-gray-300 mb-4" />
        <p class="text-gray-500">{{ $t('chunks.noChunksForDocument') }}</p>
      </div>
    </div>
  </div>
</template>

<script>
import { getChunkTree, getHierarchySummary } from '@/services/api'
import LoadingSpinner from '../common/LoadingSpinner.vue'
import TreeNode from './TreeNode.vue'

export default {
  name: 'ChunkTree',
  components: {
    LoadingSpinner,
    TreeNode,
  },
  props: {
    documentId: {
      type: [Number, String],
      default: null,
    },
  },
  emits: ['select'],
  data() {
    return {
      tree: null,
      summary: null,
      loading: false,
      expandedNodes: new Set(),
      orphanChunksLimit: 50,
    }
  },
  computed: {
    totalChunks() {
      if (!this.tree) return 0
      return this.countChunks(this.tree)
    },
    visibleOrphanChunks() {
      if (!this.tree || !this.tree.chunks) return []
      return this.tree.chunks.slice(0, this.orphanChunksLimit)
    },
  },
  watch: {
    documentId: {
      immediate: true,
      handler(newId) {
        this.orphanChunksLimit = 50
        if (newId) {
          this.loadTree()
        } else {
          this.tree = null
          this.summary = null
        }
      },
    },
  },
  methods: {
    async loadTree() {
      this.loading = true
      try {
        const [treeResponse, summaryResponse] = await Promise.all([
          getChunkTree(this.documentId),
          getHierarchySummary(this.documentId),
        ])
        this.tree = treeResponse.data.tree
        this.summary = summaryResponse.data
      } catch (error) {
        console.error('Failed to load tree:', error)
      } finally {
        this.loading = false
      }
    },
    countChunks(node) {
      let count = node.chunks?.length || 0
      if (node.children) {
        node.children.forEach(child => {
          count += this.countChunks(child)
        })
      }
      return count
    },
    toggleNode(nodeId) {
      if (this.expandedNodes.has(nodeId)) {
        this.expandedNodes.delete(nodeId)
      } else {
        this.expandedNodes.add(nodeId)
      }
      this.expandedNodes = new Set(this.expandedNodes)
    },
    expandAll() {
      const collectIds = (node, path = '') => {
        const ids = []
        if (node.name) {
          const id = path + node.name
          ids.push(id)
        }
        if (node.children) {
          node.children.forEach(child => {
            ids.push(...collectIds(child, path + (node.name ? node.name + '/' : '')))
          })
        }
        return ids
      }

      const allIds = collectIds(this.tree)
      this.expandedNodes = new Set(allIds)
    },
    collapseAll() {
      this.expandedNodes = new Set()
    },
    showMoreOrphans() {
      this.orphanChunksLimit += 50
    },
  },
}
</script>
