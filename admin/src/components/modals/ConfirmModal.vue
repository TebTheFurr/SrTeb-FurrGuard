<script setup lang="ts">
import BaseModal from '@/components/shared/BaseModal.vue'
import { computed } from 'vue'
import { AlertTriangle, AlertCircle, Info } from 'lucide-vue-next'

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

const confirmClasses = computed(() => {
  const map: Record<string, string> = {
    danger: 'glass-button-danger',
    warning: 'bg-amber-500 hover:bg-amber-600 text-white px-4 py-2.5 rounded-xl text-sm font-semibold transition-all duration-200 shadow-[0_4px_20px_rgba(245,158,11,0.3)]',
    info: 'glass-button',
  }
  return map[props.variant] ?? map.danger
})

const iconColorClasses = computed(() => {
  const map: Record<string, string> = {
    danger: 'text-red-400 bg-red-500/10 border-red-500/20',
    warning: 'text-amber-400 bg-amber-500/10 border-amber-500/20',
    info: 'text-purple-400 bg-purple-500/10 border-purple-500/20',
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
    <div class="space-y-5">
      <!-- Animated icon -->
      <div class="flex justify-center">
        <div
          class="w-14 h-14 rounded-2xl flex items-center justify-center border backdrop-blur-sm"
          :class="iconColorClasses"
        >
          <AlertTriangle v-if="variant === 'danger'" :size="28" class="animate-pulse" />
          <AlertCircle v-else-if="variant === 'warning'" :size="28" class="animate-pulse" />
          <Info v-else :size="28" />
        </div>
      </div>

      <!-- Message -->
      <p class="text-sm text-text-secondary leading-relaxed text-center">{{ message }}</p>

      <!-- Actions -->
      <div class="flex items-center justify-center gap-3 pt-4 border-t border-glass-border-subtle">
        <button
          class="glass-button-secondary px-5 py-2.5 text-sm hover:text-text-primary"
          @click="emit('cancel'); emit('update:modelValue', false)"
        >
          {{ cancelText }}
        </button>
        <button
          class="px-5 py-2.5 rounded-xl text-sm font-semibold transition-all duration-200 disabled:opacity-50"
          :class="confirmClasses"
          @click="emit('confirm'); emit('update:modelValue', false)"
        >
          {{ confirmText }}
        </button>
      </div>
    </div>
  </BaseModal>
</template>
