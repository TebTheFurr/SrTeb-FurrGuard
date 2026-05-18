<script setup lang="ts">
import { X, CheckCircle, AlertTriangle, AlertCircle, Info } from 'lucide-vue-next'
import type { Toast, ToastType } from '@/stores/ui'

defineProps<{
  toast: Toast
}>()

const emit = defineEmits<{
  close: []
}>()

const iconMap: Record<ToastType, typeof CheckCircle> = {
  success: CheckCircle,
  error: AlertCircle,
  warning: AlertTriangle,
  info: Info,
}

const colorMap: Record<ToastType, string> = {
  success: 'border-l-2 border-l-success bg-dark-800/90',
  error: 'border-l-2 border-l-error bg-dark-800/90',
  warning: 'border-l-2 border-l-warning bg-dark-800/90',
  info: 'border-l-2 border-l-info bg-dark-800/90',
}

const iconColorMap: Record<ToastType, string> = {
  success: 'text-success',
  error: 'text-error',
  warning: 'text-warning',
  info: 'text-info',
}

const iconBgMap: Record<ToastType, string> = {
  success: 'bg-success-dim',
  error: 'bg-error-dim',
  warning: 'bg-warning-dim',
  info: 'bg-info-dim',
}
</script>

<template>
  <div
    class="flex items-start gap-3 px-4 py-3 rounded-lg border border-glass-border-subtle backdrop-blur-md shadow-lg min-w-[300px] max-w-[420px] animate-[slide-up_0.3s_var(--ease-out-expo)]"
    :class="colorMap[toast.type]"
  >
    <div class="w-7 h-7 rounded-lg flex items-center justify-center shrink-0 mt-0.5" :class="iconBgMap[toast.type]">
      <component :is="iconMap[toast.type]" :size="14" :class="iconColorMap[toast.type]" />
    </div>
    <div class="flex-1 min-w-0">
      <div class="text-sm font-medium text-text-primary">{{ toast.title }}</div>
      <div v-if="toast.message" class="text-xs text-text-secondary mt-0.5">{{ toast.message }}</div>
    </div>
    <button
      class="p-1 rounded text-text-muted hover:text-text-primary transition-colors shrink-0"
      @click="emit('close')"
    >
      <X :size="14" />
    </button>
  </div>
</template>
