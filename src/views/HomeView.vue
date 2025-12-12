<template>
  <div>
    <h1 class="text-2xl font-bold text-gray-900 mb-6">{{ $t('home.title') }}</h1>

    <!-- Stats Cards -->
    <div class="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-4 mb-8">
      <div class="bg-white border border-gray-200 rounded-lg p-6">
        <div class="flex items-center">
          <div class="w-12 h-12 bg-blue-100 rounded-lg flex items-center justify-center">
            <font-awesome-icon icon="file-word" class="text-blue-600 text-xl" />
          </div>
          <div class="ml-4">
            <p class="text-sm text-gray-500">{{ $t('home.totalDocuments') }}</p>
            <p class="text-2xl font-semibold text-gray-900">{{ stats.documents.total }}</p>
          </div>
        </div>
        <div class="mt-4 flex items-center text-xs text-gray-500 space-x-2">
          <span class="flex items-center">
            <span class="w-2 h-2 bg-green-500 rounded-full mr-1"></span>
            {{ stats.documents.completed }} {{ $t('status.completed') }}
          </span>
          <span class="flex items-center">
            <span class="w-2 h-2 bg-yellow-500 rounded-full mr-1"></span>
            {{ stats.documents.pending }} {{ $t('status.pending') }}
          </span>
        </div>
      </div>

      <div class="bg-white border border-gray-200 rounded-lg p-6">
        <div class="flex items-center">
          <div class="w-12 h-12 bg-green-100 rounded-lg flex items-center justify-center">
            <font-awesome-icon icon="layer-group" class="text-green-600 text-xl" />
          </div>
          <div class="ml-4">
            <p class="text-sm text-gray-500">{{ $t('home.totalChunks') }}</p>
            <p class="text-2xl font-semibold text-gray-900">{{ stats.chunks.totalChunks }}</p>
          </div>
        </div>
        <div class="mt-4 text-xs text-gray-500">
          {{ $t('home.avgTokensPerChunk', { count: stats.chunks.avgTokens }) }}
        </div>
      </div>

      <div class="bg-white border border-gray-200 rounded-lg p-6">
        <div class="flex items-center">
          <div class="w-12 h-12 bg-purple-100 rounded-lg flex items-center justify-center">
            <font-awesome-icon icon="database" class="text-purple-600 text-xl" />
          </div>
          <div class="ml-4">
            <p class="text-sm text-gray-500">{{ $t('home.vectorStore') }}</p>
            <p class="text-2xl font-semibold text-gray-900">{{ stats.vectors.pointsCount }}</p>
          </div>
        </div>
        <div class="mt-4 text-xs text-gray-500">
          {{ $t('common.status') }}: {{ stats.vectors.status || $t('common.na') }}
        </div>
      </div>

      <div class="bg-white border border-gray-200 rounded-lg p-6">
        <div class="flex items-center">
          <div class="w-12 h-12 bg-orange-100 rounded-lg flex items-center justify-center">
            <font-awesome-icon icon="server" class="text-orange-600 text-xl" />
          </div>
          <div class="ml-4">
            <p class="text-sm text-gray-500">{{ $t('home.systemStatus') }}</p>
            <p class="text-2xl font-semibold" :class="health.status === 'healthy' ? 'text-green-600' : 'text-red-600'">
              {{ health.status }}
            </p>
          </div>
        </div>
        <div class="mt-4 text-xs text-gray-500">
          {{ health.embedding?.provider }}: {{ health.embedding?.model }}
        </div>
      </div>
    </div>

    <!-- Quick Actions -->
    <div class="grid grid-cols-1 md:grid-cols-2 gap-6 mb-8">
      <div class="bg-white border border-gray-200 rounded-lg p-6">
        <h2 class="text-lg font-semibold text-gray-900 mb-4">{{ $t('home.quickActions') }}</h2>
        <div class="space-y-3">
          <router-link
            to="/documents"
            class="flex items-center p-3 bg-blue-50 rounded-lg hover:bg-blue-100 transition-colors"
          >
            <font-awesome-icon icon="cloud-upload-alt" class="text-blue-600 mr-3" />
            <span class="font-medium text-blue-700">{{ $t('home.uploadDocument') }}</span>
          </router-link>
          <router-link
            to="/agent"
            class="flex items-center p-3 bg-green-50 rounded-lg hover:bg-green-100 transition-colors"
          >
            <font-awesome-icon icon="robot" class="text-green-600 mr-3" />
            <span class="font-medium text-green-700">{{ $t('home.startNewChat') }}</span>
          </router-link>
          <router-link
            to="/search"
            class="flex items-center p-3 bg-purple-50 rounded-lg hover:bg-purple-100 transition-colors"
          >
            <font-awesome-icon icon="search" class="text-purple-600 mr-3" />
            <span class="font-medium text-purple-700">{{ $t('home.searchDocuments') }}</span>
          </router-link>
        </div>
      </div>

      <div class="bg-white border border-gray-200 rounded-lg p-6">
        <h2 class="text-lg font-semibold text-gray-900 mb-4">{{ $t('home.recentDocuments') }}</h2>
        <div v-if="recentDocuments.length === 0" class="text-gray-500 text-sm">
          {{ $t('home.noDocumentsYet') }}
        </div>
        <div v-else class="space-y-2">
          <router-link
            v-for="doc in recentDocuments"
            :key="doc.id"
            to="/documents"
            class="flex items-center justify-between p-2 hover:bg-gray-50 rounded"
          >
            <div class="flex items-center">
              <font-awesome-icon icon="file-word" class="text-blue-600 mr-2" />
              <span class="text-sm text-gray-700">{{ doc.original_name }}</span>
            </div>
            <span :class="['text-xs px-2 py-0.5 rounded-full', statusClass(doc.status)]">
              {{ $t(`status.${doc.status}`) }}
            </span>
          </router-link>
        </div>
      </div>
    </div>
  </div>
</template>

<script>
import { getHealth, getDocumentStats, getChunkStats, getDocuments } from '@/services/api'

export default {
  name: 'HomeView',
  data() {
    return {
      health: {},
      stats: {
        documents: { total: 0, completed: 0, pending: 0 },
        chunks: { totalChunks: 0, avgTokens: 0 },
        vectors: { pointsCount: 0, status: 'unknown' },
      },
      recentDocuments: [],
    }
  },
  mounted() {
    this.loadData()
  },
  methods: {
    async loadData() {
      try {
        const [healthRes, docStatsRes, chunkStatsRes, docsRes] = await Promise.all([
          getHealth(),
          getDocumentStats(),
          getChunkStats(),
          getDocuments({ limit: 5 }),
        ])

        this.health = healthRes.data
        this.stats.documents = docStatsRes.data
        this.stats.chunks = chunkStatsRes.data
        this.stats.vectors = healthRes.data.vectorStore || {}
        this.recentDocuments = docsRes.data.documents
      } catch (error) {
        console.error('Failed to load dashboard data:', error)
      }
    },
    statusClass(status) {
      const classes = {
        pending: 'bg-yellow-100 text-yellow-800',
        processing: 'bg-blue-100 text-blue-800',
        completed: 'bg-green-100 text-green-800',
        error: 'bg-red-100 text-red-800',
      }
      return classes[status] || 'bg-gray-100 text-gray-800'
    },
  },
}
</script>
