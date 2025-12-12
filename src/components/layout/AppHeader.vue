<template>
  <header class="bg-white border-b border-gray-200 fixed top-0 left-0 right-0 z-30">
    <div class="flex items-center justify-between h-16 px-4">
      <!-- Mobile menu button -->
      <button
        @click="$emit('toggle-sidebar')"
        class="lg:hidden p-2 rounded-md text-gray-500 hover:text-gray-600 hover:bg-gray-100"
      >
        <font-awesome-icon icon="bars" class="w-6 h-6" />
      </button>

      <!-- Logo/Title -->
      <div class="flex items-center">
        <font-awesome-icon icon="file-word" class="text-blue-600 text-2xl mr-3" />
        <h1 class="text-xl font-semibold text-gray-900">Bokföringsnämndens normgivning</h1>
      </div>

      <!-- Right side -->
      <div class="flex items-center space-x-4">
        <span class="text-sm text-gray-500">
          <font-awesome-icon icon="database" class="mr-1" />
          <span :class="statusColorClass">
            {{ statusLabel }}
          </span>
        </span>
      </div>
    </div>
  </header>
  <!-- Spacer for fixed header -->
  <div class="h-16"></div>
</template>

<script>
import { getHealth } from '@/services/api'

export default {
  name: 'AppHeader',
  emits: ['toggle-sidebar'],
  data() {
    return {
      healthStatus: 'checking...',
    }
  },
  computed: {
    statusLabel() {
      const labels = {
        'healthy': 'connected',
        'partial': 'DB only',
        'error': 'error',
        'disconnected': 'offline',
        'checking...': 'checking...',
      }
      return labels[this.healthStatus] || this.healthStatus
    },
    statusColorClass() {
      const colors = {
        'healthy': 'text-green-600',
        'partial': 'text-yellow-600',
        'error': 'text-red-600',
        'disconnected': 'text-red-600',
        'checking...': 'text-gray-400',
      }
      return colors[this.healthStatus] || 'text-gray-600'
    },
  },
  mounted() {
    this.checkHealth()
    // Check health every 30 seconds
    this.healthInterval = setInterval(this.checkHealth, 30000)
  },
  beforeUnmount() {
    if (this.healthInterval) {
      clearInterval(this.healthInterval)
    }
  },
  methods: {
    async checkHealth() {
      try {
        const response = await getHealth()
        this.healthStatus = response.data.status
      } catch (error) {
        this.healthStatus = 'disconnected'
      }
    },
  },
}
</script>
