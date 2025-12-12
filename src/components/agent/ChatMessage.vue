<template>
  <div :class="['flex', message.role === 'user' ? 'justify-end' : 'justify-start']">
    <div :class="['max-w-3xl flex', message.role === 'user' ? 'flex-row-reverse' : 'flex-row']">
      <!-- Avatar -->
      <div
        :class="[
          'w-8 h-8 rounded-full flex items-center justify-center flex-shrink-0',
          message.role === 'user' ? 'bg-blue-600 ml-3' : 'bg-gray-200 mr-3'
        ]"
      >
        <font-awesome-icon
          :icon="message.role === 'user' ? 'user' : 'robot'"
          :class="message.role === 'user' ? 'text-white' : 'text-gray-600'"
        />
      </div>

      <!-- Content -->
      <div
        :class="[
          'rounded-lg p-4',
          message.role === 'user'
            ? 'bg-blue-600 text-white'
            : message.error
            ? 'bg-red-50 text-red-800'
            : 'bg-gray-100 text-gray-900'
        ]"
      >
        <!-- Message Text -->
        <div class="prose prose-sm max-w-none" :class="{ 'prose-invert': message.role === 'user' }">
          <div v-html="formattedContent" class="whitespace-pre-wrap"></div>
        </div>

        <!-- Citations (for assistant messages) -->
        <div v-if="message.role === 'assistant' && message.chunksUsed?.length > 0" class="mt-3 pt-3 border-t border-gray-200">
          <p class="text-xs text-gray-500 mb-2">Sources used:</p>
          <div class="flex flex-wrap gap-1">
            <button
              v-for="(chunk, index) in message.chunksUsed.slice(0, 5)"
              :key="index"
              @click="$emit('view-source', chunk)"
              class="px-2 py-0.5 text-xs bg-blue-100 text-blue-700 rounded hover:bg-blue-200"
            >
              [{{ index + 1 }}] {{ truncate(chunk.document_name, 20) }}
            </button>
          </div>
        </div>

        <!-- Metadata -->
        <div v-if="message.role === 'assistant' && (message.responseTimeMs || message.tokensUsed)" class="mt-2 text-xs text-gray-400">
          <span v-if="message.responseTimeMs">{{ message.responseTimeMs }}ms</span>
          <span v-if="message.tokensUsed" class="ml-2">{{ message.tokensUsed }} tokens</span>
        </div>
      </div>
    </div>
  </div>
</template>

<script>
export default {
  name: 'ChatMessage',
  props: {
    message: {
      type: Object,
      required: true,
    },
  },
  emits: ['view-source'],
  computed: {
    formattedContent() {
      let content = this.escapeHtml(this.message.content)

      // Format citations [Document: X, Section: Y]
      content = content.replace(
        /\[Document:\s*([^,\]]+),\s*Section:\s*([^\]]+)\]/g,
        '<span class="inline-flex items-center px-1 py-0.5 text-xs bg-blue-100 text-blue-700 rounded">[📄 $1 > $2]</span>'
      )

      // Format quotes
      content = content.replace(
        /"([^"]+)"/g,
        '<span class="italic">"$1"</span>'
      )

      return content
    },
  },
  methods: {
    escapeHtml(text) {
      const div = document.createElement('div')
      div.textContent = text
      return div.innerHTML
    },
    truncate(text, length) {
      if (!text) return ''
      return text.length > length ? text.substring(0, length) + '...' : text
    },
  },
}
</script>
