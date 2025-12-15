<template>
  <div class="hierarchy-node">
    <!-- Node header -->
    <div
      :class="[
        'flex items-start gap-2 py-2 px-2 rounded hover:bg-gray-50 transition-colors',
        { 'bg-blue-50': isExpanded }
      ]"
      :style="{ paddingLeft: `${level * 1.5}rem` }"
    >
      <!-- Expand/collapse icon -->
      <button
        v-if="hasChildren"
        class="w-5 h-5 flex items-center justify-center text-gray-400 hover:text-gray-600 flex-shrink-0 mt-0.5 cursor-pointer"
        @click.stop="toggle"
      >
        <font-awesome-icon :icon="isExpanded ? 'chevron-down' : 'chevron-right'" class="text-xs" />
      </button>
      <div v-else class="w-5 h-5 flex-shrink-0"></div>

      <!-- Clickable content area - shows node details -->
      <div class="flex-1 flex items-start gap-2 cursor-pointer" @click.stop="selectNode">
        <!-- Level indicator -->
        <span
          :class="[
            'px-2 py-0.5 text-xs font-medium rounded flex-shrink-0',
            levelColorClass
          ]"
        >
          {{ levelLabel }}
        </span>

        <!-- Node title -->
        <div class="flex-1 min-w-0">
          <div class="font-medium text-gray-900 truncate">{{ node.text || '(Untitled)' }}</div>
          <div class="flex items-center gap-2 mt-0.5">
            <span v-if="node.style" class="text-xs text-gray-400 font-mono" :title="node.style">{{ truncateStyle(node.style) }}</span>
            <span v-if="node.chapterTitle" class="text-xs text-gray-500">{{ node.chapterTitle }}</span>
          </div>
        </div>

        <!-- Stats -->
        <div class="flex items-center gap-3 text-xs text-gray-500 flex-shrink-0">
          <span v-if="node.children && node.children.length > 0">
            {{ node.children.length }} sections
          </span>
          <span v-if="node.paragraphs && node.paragraphs.length > 0">
            {{ node.paragraphs.length }} paragraphs
          </span>
        </div>
      </div>
    </div>

    <!-- Children (when expanded) -->
    <div v-if="isExpanded && hasChildren" class="border-l border-gray-200 ml-4">
      <HierarchyNode
        v-for="(child, index) in node.children"
        :key="index"
        :node="child"
        :level="level + 1"
        :expanded-nodes="expandedNodes"
        :parent-id="nodeId"
        @toggle="$emit('toggle', $event)"
        @select-paragraph="$emit('select-paragraph', $event)"
        @select-node="$emit('select-node', $event)"
      />
    </div>

    <!-- Paragraphs (when expanded) -->
    <div v-if="isExpanded && node.paragraphs && node.paragraphs.length > 0" class="ml-8 mt-2 space-y-1">
      <div
        v-for="(para, index) in displayedParagraphs"
        :key="index"
        class="px-3 py-2 bg-gray-50 rounded text-sm cursor-pointer hover:bg-gray-100 transition-colors"
        @click.stop="$emit('select-paragraph', para)"
      >
        <div class="flex items-start gap-2">
          <span
            v-if="para.contentType"
            :class="[
              'px-1.5 py-0.5 text-xs rounded flex-shrink-0',
              contentTypeClass(para.contentType)
            ]"
          >
            {{ para.contentType }}
          </span>
          <span
            v-if="para.style"
            class="px-1.5 py-0.5 text-xs rounded flex-shrink-0 bg-slate-100 text-slate-600 font-mono"
            :title="para.style"
          >
            {{ truncateStyle(para.style) }}
          </span>
          <span class="text-gray-700 line-clamp-2">{{ para.text }}</span>
        </div>
      </div>

      <!-- Show more button -->
      <button
        v-if="node.paragraphs.length > maxParagraphs && !showAllParagraphs"
        @click.stop="showAllParagraphs = true"
        class="text-sm text-blue-600 hover:text-blue-800 px-3 py-1"
      >
        Show {{ node.paragraphs.length - maxParagraphs }} more...
      </button>
      <button
        v-if="showAllParagraphs && node.paragraphs.length > maxParagraphs"
        @click.stop="showAllParagraphs = false"
        class="text-sm text-blue-600 hover:text-blue-800 px-3 py-1"
      >
        Show less
      </button>
    </div>
  </div>
</template>

<script>
export default {
  name: 'HierarchyNode',
  props: {
    node: {
      type: Object,
      required: true,
    },
    level: {
      type: Number,
      default: 0,
    },
    expandedNodes: {
      type: Set,
      default: () => new Set(),
    },
    parentId: {
      type: String,
      default: '0',
    },
  },
  emits: ['toggle', 'select-paragraph', 'select-node'],
  data() {
    return {
      showAllParagraphs: false,
      maxParagraphs: 3,
    }
  },
  computed: {
    nodeId() {
      // Get our index from parent's children array
      const index = this.$parent?.node?.children?.indexOf(this.node) ?? 0
      return `${this.parentId}-${index}`
    },
    isExpanded() {
      return this.expandedNodes.has(this.nodeId)
    },
    hasChildren() {
      return (this.node.children && this.node.children.length > 0) ||
             (this.node.paragraphs && this.node.paragraphs.length > 0)
    },
    levelLabel() {
      const nodeLevel = this.node.level || this.level + 1
      if (this.node.chapterNumber) {
        return `Ch. ${this.node.chapterNumber}`
      }
      const labels = ['Top', 'Section', 'Chapter', 'Subsection', 'Content']
      return labels[Math.min(nodeLevel - 1, labels.length - 1)] || `L${nodeLevel}`
    },
    levelColorClass() {
      const nodeLevel = this.node.level || this.level + 1
      const colors = [
        'bg-blue-100 text-blue-800',
        'bg-green-100 text-green-800',
        'bg-yellow-100 text-yellow-800',
        'bg-purple-100 text-purple-800',
        'bg-gray-100 text-gray-800',
      ]
      return colors[Math.min(nodeLevel - 1, colors.length - 1)] || colors[colors.length - 1]
    },
    displayedParagraphs() {
      if (this.showAllParagraphs || !this.node.paragraphs) {
        return this.node.paragraphs || []
      }
      return this.node.paragraphs.slice(0, this.maxParagraphs)
    },
  },
  methods: {
    toggle() {
      this.$emit('toggle', this.nodeId)
    },
    selectNode() {
      this.$emit('select-node', this.node)
    },
    contentTypeClass(type) {
      const classes = {
        'allmänt råd': 'bg-blue-100 text-blue-700',
        'kommentar': 'bg-green-100 text-green-700',
        'lagtext': 'bg-yellow-100 text-yellow-700',
      }
      return classes[type?.toLowerCase()] || 'bg-gray-100 text-gray-700'
    },
    truncateStyle(style) {
      // Shorten common Swedish style name patterns for display
      if (!style) return ''
      // Remove " indrag" suffix for brevity
      let short = style.replace(/ indrag$/, '')
      // Truncate if still too long
      if (short.length > 20) {
        return short.substring(0, 18) + '…'
      }
      return short
    },
  },
}
</script>

<style scoped>
.line-clamp-2 {
  display: -webkit-box;
  -webkit-line-clamp: 2;
  -webkit-box-orient: vertical;
  overflow: hidden;
}
</style>
