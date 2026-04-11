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
  success: 'border-success/30 bg-success-dim',
  error: 'border-error/30 bg-error-dim',
  warning: 'border-warning/30 bg-warning-dim',
  info: 'border-info/30 bg-info-dim',
}

const iconColorMap: Record<ToastType, string> = {
  success: 'text-success',
  error: 'text-error',
  warning: 'text-warning',
  info: 'text-info',
}
</script>

<template>
  <div
    class="flex items-start gap-3 px-4 py-3 rounded-lg border backdrop-blur-md shadow-lg min-w-[300px] max-w-[420px] animate-[fade-in-up_0.3s_ease-out]"
    :class="colorMap[toast.type]"
  >
    <component :is="iconMap[toast.type]" :size="18" :class="iconColorMap[toast.type]" class="mt-0.5 shrink-0" />
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
