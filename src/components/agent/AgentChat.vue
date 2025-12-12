<template>
  <div class="flex h-full">
    <!-- Chat Area -->
    <div class="flex-1 flex flex-col">
      <!-- Messages -->
      <div ref="messagesContainer" class="flex-1 overflow-y-auto p-4 space-y-4">
        <!-- Welcome Message -->
        <div v-if="messages.length === 0" class="text-center py-12">
          <font-awesome-icon icon="robot" class="text-5xl text-blue-600 mb-4" />
          <h2 class="text-xl font-semibold text-gray-900 mb-2">{{ $t('agent.welcomeTitle') }}</h2>
          <p class="text-gray-500 max-w-md mx-auto">
            {{ $t('agent.welcomeMessage') }}
          </p>
        </div>

        <!-- Messages -->
        <ChatMessage
          v-for="(message, index) in messages"
          :key="index"
          :message="message"
          @view-source="viewSource"
        />

        <!-- Loading -->
        <div v-if="loading" class="flex items-start space-x-3">
          <div class="w-8 h-8 rounded-full bg-blue-100 flex items-center justify-center">
            <font-awesome-icon icon="robot" class="text-blue-600" />
          </div>
          <div class="bg-gray-100 rounded-lg p-4">
            <font-awesome-icon icon="spinner" spin class="text-blue-600" />
            <span class="ml-2 text-gray-600">{{ $t('agent.thinking') }}</span>
          </div>
        </div>
      </div>

      <!-- Input Area -->
      <div class="border-t border-gray-200 p-4 bg-white">
        <div class="flex items-end space-x-2">
          <div class="flex-1">
            <textarea
              ref="inputField"
              v-model="inputText"
              :disabled="loading"
              :placeholder="$t('agent.placeholder')"
              rows="2"
              class="w-full border-gray-300 rounded-lg focus:ring-blue-500 focus:border-blue-500 resize-none disabled:bg-gray-100"
              @keydown.enter.exact.prevent="sendMessage"
            ></textarea>
          </div>
          <button
            @click="sendMessage"
            :disabled="!inputText.trim() || loading"
            class="px-4 py-2 bg-blue-600 text-white rounded-lg hover:bg-blue-700 disabled:opacity-50 disabled:cursor-not-allowed"
          >
            <font-awesome-icon icon="paper-plane" />
          </button>
        </div>

        <!-- Options -->
        <div class="mt-2 flex items-center justify-between text-xs text-gray-500">
          <div class="flex items-center space-x-4">
            <label class="flex items-center">
              <span class="mr-1">{{ $t('agent.chunks') }}</span>
              <input
                v-model.number="chunkLimit"
                type="number"
                min="1"
                max="20"
                class="w-12 border-gray-300 rounded text-xs"
              />
            </label>
            <label v-if="documents.length > 0" class="flex items-center">
              <span class="mr-1">{{ $t('agent.document') }}</span>
              <select v-model="selectedDocument" class="border-gray-300 rounded text-xs">
                <option value="">{{ $t('agent.allDocuments') }}</option>
                <option v-for="doc in documents" :key="doc.id" :value="doc.id">
                  {{ doc.original_name }}
                </option>
              </select>
            </label>
          </div>
          <button
            @click="clearConversation"
            class="text-gray-400 hover:text-gray-600"
          >
            {{ $t('agent.clearChat') }}
          </button>
        </div>
      </div>
    </div>

    <!-- Sources Panel -->
    <div
      v-if="showSources && currentSources.length > 0"
      class="w-80 border-l border-gray-200 bg-gray-50 overflow-y-auto"
    >
      <div class="p-4">
        <div class="flex items-center justify-between mb-4">
          <h3 class="font-semibold text-gray-900">{{ $t('agent.sources') }}</h3>
          <button @click="showSources = false" class="text-gray-400 hover:text-gray-600">
            <font-awesome-icon icon="times" />
          </button>
        </div>

        <div class="space-y-3">
          <SourceCitation
            v-for="(source, index) in currentSources"
            :key="index"
            :source="source"
            :index="index + 1"
          />
        </div>
      </div>
    </div>
  </div>
</template>

<script>
import { chatWithAgent, getDocuments } from '@/services/api'
import ChatMessage from './ChatMessage.vue'
import SourceCitation from './SourceCitation.vue'

export default {
  name: 'AgentChat',
  components: {
    ChatMessage,
    SourceCitation,
  },
  data() {
    return {
      messages: [],
      inputText: '',
      loading: false,
      conversationId: null,
      chunkLimit: 5,
      documents: [],
      selectedDocument: '',
      showSources: false,
      currentSources: [],
    }
  },
  mounted() {
    this.loadDocuments()
  },
  methods: {
    async loadDocuments() {
      try {
        const response = await getDocuments({ status: 'completed' })
        this.documents = response.data.documents
      } catch (error) {
        console.error('Failed to load documents:', error)
      }
    },
    async sendMessage() {
      const text = this.inputText.trim()
      if (!text || this.loading) return

      // Add user message
      this.messages.push({
        role: 'user',
        content: text,
      })

      this.inputText = ''
      this.loading = true
      this.scrollToBottom()

      try {
        const response = await chatWithAgent(text, {
          conversationId: this.conversationId,
          documentIds: this.selectedDocument ? [this.selectedDocument] : undefined,
          chunkLimit: this.chunkLimit,
        })

        this.conversationId = response.data.conversationId

        // Add assistant message
        this.messages.push({
          role: 'assistant',
          content: response.data.response,
          citations: response.data.citations,
          chunksUsed: response.data.chunksUsed,
          responseTimeMs: response.data.responseTimeMs,
          tokensUsed: response.data.tokensUsed,
        })

        this.currentSources = response.data.chunksUsed || []
      } catch (error) {
        console.error('Chat error:', error)
        this.messages.push({
          role: 'assistant',
          content: this.$t('agent.errorMessage'),
          error: true,
        })
      } finally {
        this.loading = false
        this.$nextTick(() => {
          this.scrollToBottom()
          // Focus input field so user can type next question
          if (this.$refs.inputField) {
            this.$refs.inputField.focus()
          }
        })
      }
    },
    scrollToBottom() {
      this.$nextTick(() => {
        const container = this.$refs.messagesContainer
        if (container) {
          container.scrollTop = container.scrollHeight
        }
      })
    },
    clearConversation() {
      this.messages.splice(0, this.messages.length)
      this.conversationId = null
      this.currentSources = []
      this.showSources = false
      this.inputText = ''
    },
    viewSource(source) {
      this.currentSources = [source]
      this.showSources = true
    },
  },
}
</script>
