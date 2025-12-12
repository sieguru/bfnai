<template>
  <div class="relative">
    <button
      @click="isOpen = !isOpen"
      class="flex items-center space-x-1 px-2 py-1 text-sm text-gray-600 hover:text-gray-900 hover:bg-gray-100 rounded"
    >
      <font-awesome-icon icon="globe" />
      <span class="uppercase">{{ currentLocale }}</span>
    </button>

    <div
      v-if="isOpen"
      class="absolute right-0 mt-1 w-32 bg-white border border-gray-200 rounded-md shadow-lg z-50"
    >
      <button
        v-for="lang in languages"
        :key="lang.code"
        @click="setLocale(lang.code)"
        :class="[
          'w-full px-4 py-2 text-left text-sm hover:bg-gray-100',
          currentLocale === lang.code ? 'bg-blue-50 text-blue-700' : 'text-gray-700'
        ]"
      >
        {{ lang.name }}
      </button>
    </div>
  </div>
</template>

<script>

export default {
  name: 'LanguageSwitcher',
  data() {
    return {
      isOpen: false,
      languages: [
        { code: 'sv', name: 'Svenska' },
        { code: 'en', name: 'English' },
      ],
    }
  },
  computed: {
    currentLocale() {
      return this.$i18n.locale
    },
  },
  mounted() {
    document.addEventListener('click', this.handleClickOutside)
  },
  beforeUnmount() {
    document.removeEventListener('click', this.handleClickOutside)
  },
  methods: {
    setLocale(locale) {
      this.$i18n.locale = locale
      localStorage.setItem('locale', locale)
      this.isOpen = false
    },
    handleClickOutside(event) {
      if (!this.$el.contains(event.target)) {
        this.isOpen = false
      }
    },
  },
}
</script>
