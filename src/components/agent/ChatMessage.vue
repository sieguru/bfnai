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
        <div
          class="prose prose-sm max-w-none"
          :class="{
            'prose-invert': message.role === 'user',
            'prose-blue': message.role === 'user'
          }"
        >
          <div v-html="formattedContent"></div>
        </div>

        <!-- Citations (for assistant messages) -->
        <div v-if="message.role === 'assistant' && message.chunksUsed?.length > 0" class="mt-3 pt-3 border-t border-gray-200">
          <p class="text-xs text-gray-500 mb-2">{{ $t('agent.sourcesUsed') }}</p>
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
import { marked } from 'marked'

// Configure marked for safe rendering
marked.setOptions({
  breaks: true,  // Convert \n to <br>
  gfm: true,     // GitHub Flavored Markdown
})

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
      let content = this.message.content

      // For user messages, just escape and return
      if (this.message.role === 'user') {
        return this.escapeHtml(content)
      }

      // For assistant messages, render markdown
      // First, format special citations before markdown parsing
      content = content.replace(
        /\[Document:\s*([^,\]]+),\s*Section:\s*([^\]]+)\]/g,
        '`[📄 $1 › $2]`'
      )

      // Parse markdown
      let html = marked.parse(content)

      // Style the citation spans
      html = html.replace(
        /<code>\[📄 ([^›]+) › ([^\]]+)\]<\/code>/g,
        '<span class="inline-flex items-center px-1.5 py-0.5 text-xs bg-blue-100 text-blue-700 rounded not-prose">[📄 $1 › $2]</span>'
      )

      return html
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

<style scoped>
/* Ensure proper prose styling for markdown content */
.prose :deep(ul) {
  list-style-type: disc;
  padding-left: 1.5em;
}

.prose :deep(ol) {
  list-style-type: decimal;
  padding-left: 1.5em;
}

.prose :deep(li) {
  margin: 0.25em 0;
}

.prose :deep(p) {
  margin: 0.5em 0;
}

.prose :deep(p:first-child) {
  margin-top: 0;
}

.prose :deep(p:last-child) {
  margin-bottom: 0;
}

.prose :deep(code) {
  background-color: rgba(0, 0, 0, 0.1);
  padding: 0.125em 0.25em;
  border-radius: 0.25em;
  font-size: 0.875em;
}

.prose :deep(pre) {
  background-color: rgba(0, 0, 0, 0.1);
  padding: 0.75em;
  border-radius: 0.375em;
  overflow-x: auto;
}

.prose :deep(pre code) {
  background-color: transparent;
  padding: 0;
}

.prose :deep(blockquote) {
  border-left: 3px solid #d1d5db;
  padding-left: 1em;
  margin: 0.5em 0;
  font-style: italic;
}

.prose :deep(h1),
.prose :deep(h2),
.prose :deep(h3) {
  font-weight: 600;
  margin: 0.75em 0 0.5em;
}

.prose :deep(h1) {
  font-size: 1.25em;
}

.prose :deep(h2) {
  font-size: 1.125em;
}

.prose :deep(h3) {
  font-size: 1em;
}

/* User message styling adjustments */
.prose-invert :deep(code) {
  background-color: rgba(255, 255, 255, 0.2);
}

.prose-invert :deep(pre) {
  background-color: rgba(255, 255, 255, 0.1);
}

.prose-invert :deep(blockquote) {
  border-left-color: rgba(255, 255, 255, 0.5);
}
</style>
