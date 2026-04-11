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
      class="relative inline-flex h-6 w-11 items-center rounded-full transition-colors duration-200 focus-visible:outline-2 focus-visible:outline-purple-500"
      :class="modelValue ? 'bg-purple-500' : 'bg-dark-500'"
      @click="!disabled && emit('update:modelValue', !modelValue)"
    >
      <span
        class="inline-block h-4 w-4 transform rounded-full bg-white transition-transform duration-200"
        :class="modelValue ? 'translate-x-6' : 'translate-x-1'"
      />
    </button>
    <span v-if="label" class="text-sm text-text-secondary">{{ label }}</span>
  </label>
</template>
