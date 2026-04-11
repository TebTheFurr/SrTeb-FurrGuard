<script setup lang="ts">
import { computed } from 'vue'
import BaseModal from '@/components/shared/BaseModal.vue'

const props = withDefaults(defineProps<{
  modelValue: boolean
  title: string
  message: string
  variant?: 'info' | 'success' | 'warning' | 'error'
}>(), {
  variant: 'info',
})

const emit = defineEmits<{
  'update:modelValue': [value: boolean]
}>()

const okClasses = computed(() => {
  const map: Record<string, string> = {
    info: 'bg-purple-500 hover:bg-purple-600 text-white',
    success: 'bg-green-500 hover:bg-green-600 text-white',
    warning: 'bg-amber-500 hover:bg-amber-600 text-white',
    error: 'bg-red-500 hover:bg-red-600 text-white',
  }
  return map[props.variant] ?? map.info
})
</script>

<template>
  <BaseModal
    :model-value="modelValue"
    :title="title"
    size="sm"
    @update:model-value="emit('update:modelValue', $event)"
  >
    <p class="text-sm text-text-secondary leading-relaxed">{{ message }}</p>

    <div class="flex items-center justify-end gap-3 mt-6 pt-4 border-t border-glass-border-subtle">
      <button
        class="px-4 py-2 rounded-lg text-sm font-medium transition-colors"
        :class="okClasses"
        @click="emit('update:modelValue', false)"
      >
        OK
      </button>
    </div>
  </BaseModal>
</template>
