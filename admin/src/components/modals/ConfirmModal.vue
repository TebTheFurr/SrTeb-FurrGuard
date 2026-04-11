<script setup lang="ts">
import BaseModal from '@/components/shared/BaseModal.vue'
import { computed } from 'vue'

const props = withDefaults(defineProps<{
  modelValue: boolean
  title: string
  message: string
  confirmText?: string
  cancelText?: string
  variant?: 'danger' | 'warning' | 'info'
}>(), {
  confirmText: 'Confirmar',
  cancelText: 'Cancelar',
  variant: 'danger',
})

const emit = defineEmits<{
  'update:modelValue': [value: boolean]
  confirm: []
  cancel: []
}>()

const variantClasses = computed(() => {
  const map: Record<string, string> = {
    danger: 'bg-red-500 hover:bg-red-600 text-white',
    warning: 'bg-amber-500 hover:bg-amber-600 text-white',
    info: 'bg-purple-500 hover:bg-purple-600 text-white',
  }
  return map[props.variant] ?? map.danger
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
        class="px-4 py-2 rounded-lg text-sm text-text-muted hover:text-text-primary transition-colors"
        @click="emit('cancel'); emit('update:modelValue', false)"
      >
        {{ cancelText }}
      </button>
      <button
        class="px-4 py-2 rounded-lg text-sm font-medium transition-colors"
        :class="variantClasses"
        @click="emit('confirm'); emit('update:modelValue', false)"
      >
        {{ confirmText }}
      </button>
    </div>
  </BaseModal>
</template>
