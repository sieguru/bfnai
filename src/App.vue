<template>
  <div class="min-h-screen bg-gray-50">
    <!-- Header -->
    <AppHeader @toggle-sidebar="toggleSidebar" />

    <div class="flex">
      <!-- Sidebar -->
      <AppSidebar :is-open="sidebarOpen" @close="sidebarOpen = false" />

      <!-- Main Content -->
      <main class="flex-1 p-6 lg:ml-64">
        <router-view />
      </main>
    </div>
  </div>
</template>

<script>
import AppHeader from './components/layout/AppHeader.vue'
import AppSidebar from './components/layout/AppSidebar.vue'

export default {
  name: 'App',
  components: {
    AppHeader,
    AppSidebar,
  },
  data() {
    return {
      sidebarOpen: false,
    }
  },
  methods: {
    toggleSidebar() {
      this.sidebarOpen = !this.sidebarOpen
    },
  },
}
</script>
