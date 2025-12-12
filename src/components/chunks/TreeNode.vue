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

      <font-awesome-icon
        :icon="hasChildren ? 'folder' : 'file-alt'"
        :class="['mr-2', levelColorClass]"
      />

      <span class="text-sm text-gray-900 flex-1 truncate">{{ node.name }}</span>

      <span class="text-xs text-gray-400">
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
    levelColorClass() {
      const colors = [
        'text-blue-600',
        'text-green-600',
        'text-purple-600',
        'text-orange-600',
        'text-pink-600',
        'text-teal-600',
      ]
      return colors[(this.node.level - 1) % colors.length]
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
