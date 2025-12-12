<template>
  <div class="h-[calc(100vh-8rem)]">
    <div class="bg-white border border-gray-200 rounded-lg h-full overflow-hidden">
      <AgentChat />
    </div>
  </div>
</template>

<script>
import AgentChat from '@/components/agent/AgentChat.vue'

export default {
  name: 'AgentView',
  components: {
    AgentChat,
  },
}
</script>
