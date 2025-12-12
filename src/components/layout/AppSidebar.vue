<template>
  <!-- Mobile overlay -->
  <div
    v-if="isOpen"
    class="fixed inset-0 bg-gray-600 bg-opacity-75 z-40 lg:hidden"
    @click="$emit('close')"
  ></div>

  <!-- Sidebar -->
  <aside
    :class="[
      'fixed top-16 left-0 bottom-0 w-64 bg-white border-r border-gray-200 z-40',
      'transform transition-transform duration-300 ease-in-out',
      isOpen ? 'translate-x-0' : '-translate-x-full lg:translate-x-0'
    ]"
  >
    <nav class="p-4 space-y-2">
      <router-link
        v-for="item in navItems"
        :key="item.route"
        :to="item.route"
        class="flex items-center px-4 py-3 text-gray-700 rounded-lg hover:bg-gray-100 transition-colors"
        :class="{ 'bg-blue-50 text-blue-700': isActive(item.route) }"
        @click="$emit('close')"
      >
        <font-awesome-icon :icon="item.icon" class="w-5 h-5 mr-3" />
        <span>{{ item.label }}</span>
      </router-link>
    </nav>

    <!-- Quick Stats -->
    <div class="absolute bottom-0 left-0 right-0 p-4 border-t border-gray-200 bg-gray-50">
      <div class="text-xs text-gray-500 space-y-1">
        <div class="flex justify-between">
          <span>Documents:</span>
          <span class="font-medium">{{ stats.documents }}</span>
        </div>
        <div class="flex justify-between">
          <span>Chunks:</span>
          <span class="font-medium">{{ stats.chunks }}</span>
        </div>
      </div>
    </div>
  </aside>
</template>

<script>
import { getDocumentStats, getChunkStats } from '@/services/api'

export default {
  name: 'AppSidebar',
  props: {
    isOpen: {
      type: Boolean,
      default: false,
    },
  },
  emits: ['close'],
  data() {
    return {
      navItems: [
        { route: '/', icon: 'home', label: 'Dashboard' },
        { route: '/documents', icon: 'file-word', label: 'Documents' },
        { route: '/chunks', icon: 'layer-group', label: 'Chunks' },
        { route: '/search', icon: 'search', label: 'Search' },
        { route: '/agent', icon: 'robot', label: 'AI Agent' },
      ],
      stats: {
        documents: 0,
        chunks: 0,
      },
    }
  },
  mounted() {
    this.loadStats()
  },
  methods: {
    isActive(route) {
      if (route === '/') {
        return this.$route.path === '/'
      }
      return this.$route.path.startsWith(route)
    },
    async loadStats() {
      try {
        const [docStats, chunkStats] = await Promise.all([
          getDocumentStats(),
          getChunkStats(),
        ])
        this.stats.documents = docStats.data.total || 0
        this.stats.chunks = chunkStats.data.totalChunks || 0
      } catch (error) {
        console.error('Failed to load stats:', error)
      }
    },
  },
}
</script>
