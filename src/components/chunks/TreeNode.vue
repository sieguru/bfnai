<template>
  <div>
    <!-- Node Header -->
    <div
      class="flex items-center p-2 rounded hover:bg-gray-100 cursor-pointer"
      :style="{ paddingLeft: (node.level - 1) * 16 + 8 + 'px' }"
      @click="toggle"
    >
      <font-awesome-icon
        v-if="hasChildren"
        :icon="isExpanded ? 'chevron-down' : 'chevron-right'"
        class="w-4 h-4 text-gray-400 mr-2"
      />
      <font-awesome-icon
        v-else
        icon="file-alt"
        class="w-4 h-4 text-gray-400 mr-2"
      />

      <span :class="['px-1.5 py-0.5 text-xs font-medium rounded mr-2', levelBadgeClass]">
        H{{ node.level }}
      </span>

      <span class="text-sm text-gray-900 flex-1 truncate">{{ node.name }}</span>

      <span class="text-xs text-gray-400 ml-2">
        {{ chunkCount }} chunk{{ chunkCount !== 1 ? 's' : '' }}
      </span>
    </div>

    <!-- Children -->
    <div v-if="isExpanded && hasChildren">
      <TreeNode
        v-for="(child, index) in node.children"
        :key="index"
        :node="child"
        :expanded-nodes="expandedNodes"
        :parent-path="currentPath"
        @toggle="$emit('toggle', $event)"
        @select="$emit('select', $event)"
      />

      <!-- Chunks under this node -->
      <div v-if="node.chunks && node.chunks.length > 0">
        <div
          v-for="chunk in node.chunks"
          :key="chunk.id"
          class="flex items-center p-2 rounded hover:bg-gray-100 cursor-pointer"
          :style="{ paddingLeft: node.level * 16 + 8 + 'px' }"
          @click="$emit('select', chunk)"
        >
          <font-awesome-icon icon="file-alt" class="w-4 h-4 text-gray-400 mr-2" />
          <span class="text-sm text-gray-700 truncate flex-1">{{ chunk.preview }}</span>
          <span class="text-xs text-gray-400">{{ chunk.tokenEstimate }} tokens</span>
        </div>
      </div>
    </div>
  </div>
</template>

<script>
export default {
  name: 'TreeNode',
  props: {
    node: {
      type: Object,
      required: true,
    },
    expandedNodes: {
      type: Set,
      required: true,
    },
    parentPath: {
      type: String,
      default: '',
    },
  },
  emits: ['toggle', 'select'],
  computed: {
    currentPath() {
      return this.parentPath ? this.parentPath + '/' + this.node.name : this.node.name
    },
    isExpanded() {
      return this.expandedNodes.has(this.currentPath)
    },
    hasChildren() {
      return (this.node.children && this.node.children.length > 0) ||
             (this.node.chunks && this.node.chunks.length > 0)
    },
    chunkCount() {
      return this.countChunks(this.node)
    },
    levelBadgeClass() {
      const colors = {
        1: 'bg-red-100 text-red-700',
        2: 'bg-orange-100 text-orange-700',
        3: 'bg-yellow-100 text-yellow-700',
        4: 'bg-green-100 text-green-700',
        5: 'bg-blue-100 text-blue-700',
        6: 'bg-purple-100 text-purple-700',
      }
      return colors[this.node.level] || 'bg-gray-100 text-gray-700'
    },
  },
  methods: {
    toggle() {
      this.$emit('toggle', this.currentPath)
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
  },
}
</script>
