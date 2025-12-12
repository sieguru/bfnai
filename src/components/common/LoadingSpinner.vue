<template>
  <div class="flex items-center justify-center" :class="containerClass">
    <font-awesome-icon
      icon="spinner"
      spin
      :class="['text-blue-600', sizeClass]"
    />
    <span v-if="text" class="ml-2 text-gray-600">{{ text }}</span>
  </div>
</template>

<script>
export default {
  name: 'LoadingSpinner',
  props: {
    size: {
      type: String,
      default: 'md',
      validator: (v) => ['sm', 'md', 'lg'].includes(v),
    },
    text: {
      type: String,
      default: '',
    },
    fullPage: {
      type: Boolean,
      default: false,
    },
  },
  computed: {
    sizeClass() {
      const sizes = {
        sm: 'text-lg',
        md: 'text-2xl',
        lg: 'text-4xl',
      }
      return sizes[this.size]
    },
    containerClass() {
      return this.fullPage ? 'min-h-[400px]' : ''
    },
  },
}
</script>
