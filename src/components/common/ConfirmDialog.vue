<template>
  <div v-if="show" class="fixed inset-0 z-50 overflow-y-auto">
    <!-- Backdrop -->
    <div class="fixed inset-0 bg-gray-500 bg-opacity-75 transition-opacity" @click="cancel"></div>

    <!-- Dialog -->
    <div class="flex min-h-full items-center justify-center p-4">
      <div class="relative bg-white rounded-lg shadow-xl max-w-md w-full p-6">
        <!-- Icon -->
        <div class="mx-auto flex h-12 w-12 items-center justify-center rounded-full" :class="iconBgClass">
          <font-awesome-icon :icon="icon" :class="iconClass" />
        </div>

        <!-- Content -->
        <div class="mt-4 text-center">
          <h3 class="text-lg font-semibold text-gray-900">{{ title }}</h3>
          <p class="mt-2 text-sm text-gray-500">{{ message }}</p>
        </div>

        <!-- Actions -->
        <div class="mt-6 flex justify-center space-x-3">
          <button
            @click="cancel"
            class="px-4 py-2 text-sm font-medium text-gray-700 bg-white border border-gray-300 rounded-md hover:bg-gray-50 focus:outline-none focus:ring-2 focus:ring-blue-500"
          >
            {{ cancelText }}
          </button>
          <button
            @click="confirm"
            :class="[
              'px-4 py-2 text-sm font-medium text-white rounded-md focus:outline-none focus:ring-2 focus:ring-offset-2',
              confirmClass
            ]"
          >
            {{ confirmText }}
          </button>
        </div>
      </div>
    </div>
  </div>
</template>

<script>
export default {
  name: 'ConfirmDialog',
  props: {
    show: {
      type: Boolean,
      default: false,
    },
    title: {
      type: String,
      default: 'Confirm Action',
    },
    message: {
      type: String,
      default: 'Are you sure you want to proceed?',
    },
    type: {
      type: String,
      default: 'warning',
      validator: (v) => ['warning', 'danger', 'info'].includes(v),
    },
    confirmText: {
      type: String,
      default: 'Confirm',
    },
    cancelText: {
      type: String,
      default: 'Cancel',
    },
  },
  emits: ['confirm', 'cancel'],
  computed: {
    icon() {
      const icons = {
        warning: 'exclamation-triangle',
        danger: 'exclamation-circle',
        info: 'exclamation-circle',
      }
      return icons[this.type]
    },
    iconBgClass() {
      const classes = {
        warning: 'bg-yellow-100',
        danger: 'bg-red-100',
        info: 'bg-blue-100',
      }
      return classes[this.type]
    },
    iconClass() {
      const classes = {
        warning: 'text-yellow-600 text-xl',
        danger: 'text-red-600 text-xl',
        info: 'text-blue-600 text-xl',
      }
      return classes[this.type]
    },
    confirmClass() {
      const classes = {
        warning: 'bg-yellow-600 hover:bg-yellow-700 focus:ring-yellow-500',
        danger: 'bg-red-600 hover:bg-red-700 focus:ring-red-500',
        info: 'bg-blue-600 hover:bg-blue-700 focus:ring-blue-500',
      }
      return classes[this.type]
    },
  },
  methods: {
    confirm() {
      this.$emit('confirm')
    },
    cancel() {
      this.$emit('cancel')
    },
  },
}
</script>
