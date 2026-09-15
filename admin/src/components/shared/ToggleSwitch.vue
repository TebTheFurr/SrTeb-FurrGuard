<script setup lang="ts">
defineProps<{
  modelValue: boolean
  label?: string
  disabled?: boolean
}>()

const emit = defineEmits<{
  'update:modelValue': [value: boolean]
}>()
</script>

<template>
  <label class="flex items-center gap-3 cursor-pointer" :class="{ 'opacity-50 cursor-not-allowed': disabled }">
    <button
      type="button"
      role="switch"
      :aria-checked="modelValue"
      :disabled="disabled"
      class="relative inline-flex h-6 w-11 items-center rounded-full transition-all duration-300 focus-visible:outline-2 focus-visible:outline-purple-500"
      :class="modelValue ? 'bg-gradient-to-r from-purple-500 to-magenta-500 shadow-[0_0_12px_rgba(139,92,246,0.3)]' : 'bg-dark-500'"
      @click="!disabled && emit('update:modelValue', !modelValue)"
    >
      <span
        class="inline-block h-4 w-4 transform rounded-full bg-white shadow-sm transition-all duration-300"
        :class="modelValue ? 'translate-x-6' : 'translate-x-1'"
      />
    </button>
    <span v-if="label" class="text-sm text-text-secondary">{{ label }}</span>
  </label>
</template>
