<template>
  <div
    :class="[
      'rounded-lg p-4 flex items-start',
      typeClasses
    ]"
  >
    <font-awesome-icon :icon="icon" class="flex-shrink-0 mt-0.5" />
    <div class="ml-3 flex-1">
      <p :class="['text-sm font-medium', textClass]">{{ title }}</p>
      <p v-if="message" :class="['mt-1 text-sm', messageClass]">{{ message }}</p>
      <slot></slot>
    </div>
    <button
      v-if="dismissible"
      @click="$emit('dismiss')"
      :class="['ml-4 flex-shrink-0 rounded-md p-1.5 hover:bg-opacity-20', dismissClass]"
    >
      <font-awesome-icon icon="times" />
    </button>
  </div>
</template>

<script>
export default {
  name: 'AlertMessage',
  props: {
    type: {
      type: String,
      default: 'info',
      validator: (v) => ['success', 'error', 'warning', 'info'].includes(v),
    },
    title: {
      type: String,
      required: true,
    },
    message: {
      type: String,
      default: '',
    },
    dismissible: {
      type: Boolean,
      default: false,
    },
  },
  emits: ['dismiss'],
  computed: {
    typeClasses() {
      const classes = {
        success: 'bg-green-50 text-green-800',
        error: 'bg-red-50 text-red-800',
        warning: 'bg-yellow-50 text-yellow-800',
        info: 'bg-blue-50 text-blue-800',
      }
      return classes[this.type]
    },
    textClass() {
      const classes = {
        success: 'text-green-800',
        error: 'text-red-800',
        warning: 'text-yellow-800',
        info: 'text-blue-800',
      }
      return classes[this.type]
    },
    messageClass() {
      const classes = {
        success: 'text-green-700',
        error: 'text-red-700',
        warning: 'text-yellow-700',
        info: 'text-blue-700',
      }
      return classes[this.type]
    },
    dismissClass() {
      const classes = {
        success: 'text-green-500 hover:bg-green-100',
        error: 'text-red-500 hover:bg-red-100',
        warning: 'text-yellow-500 hover:bg-yellow-100',
        info: 'text-blue-500 hover:bg-blue-100',
      }
      return classes[this.type]
    },
    icon() {
      const icons = {
        success: 'check-circle',
        error: 'exclamation-circle',
        warning: 'exclamation-triangle',
        info: 'exclamation-circle',
      }
      return icons[this.type]
    },
  },
}
</script>
