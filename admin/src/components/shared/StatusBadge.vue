<script setup lang="ts">
withDefaults(defineProps<{
  status: string
  variant?: 'success' | 'warning' | 'danger' | 'info' | 'neutral'
}>(), {
  variant: 'neutral',
})

const variantClasses: Record<string, string> = {
  success: 'bg-success-dim text-green-400',
  warning: 'bg-warning-dim text-amber-400',
  danger: 'bg-error-dim text-red-400',
  info: 'bg-info-dim text-blue-400',
  neutral: 'bg-dark-600 text-text-secondary',
}

const dotClasses: Record<string, string> = {
  success: 'bg-success',
  warning: 'bg-warning',
  danger: 'bg-error',
  info: 'bg-info',
  neutral: 'bg-text-muted',
}
</script>

<template>
  <span
    class="inline-flex items-center gap-1.5 px-2.5 py-0.5 rounded-full text-xs font-medium"
    :class="variantClasses[variant]"
  >
    <span
      class="w-1.5 h-1.5 rounded-full animate-[status-pulse_2s_ease-in-out_infinite]"
      :class="dotClasses[variant]"
    ></span>
    {{ status }}
  </span>
</template>
