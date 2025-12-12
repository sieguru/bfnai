<template>
  <div>
    <div v-if="showLabel" class="flex justify-between mb-1">
      <span class="text-sm font-medium text-gray-700">{{ label }}</span>
      <span class="text-sm text-gray-500">{{ percentage }}%</span>
    </div>
    <div class="w-full bg-gray-200 rounded-full" :class="heightClass">
      <div
        class="bg-blue-600 rounded-full transition-all duration-300"
        :class="heightClass"
        :style="{ width: percentage + '%' }"
      ></div>
    </div>
  </div>
</template>

<script>
export default {
  name: 'ProgressBar',
  props: {
    value: {
      type: Number,
      default: 0,
    },
    max: {
      type: Number,
      default: 100,
    },
    label: {
      type: String,
      default: 'Progress',
    },
    showLabel: {
      type: Boolean,
      default: true,
    },
    size: {
      type: String,
      default: 'md',
      validator: (v) => ['sm', 'md', 'lg'].includes(v),
    },
  },
  computed: {
    percentage() {
      if (this.max === 0) return 0
      return Math.min(100, Math.round((this.value / this.max) * 100))
    },
    heightClass() {
      const heights = {
        sm: 'h-1.5',
        md: 'h-2.5',
        lg: 'h-4',
      }
      return heights[this.size]
    },
  },
}
</script>
