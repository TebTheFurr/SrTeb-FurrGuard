<script setup lang="ts">
import { computed, ref, watch, onMounted } from 'vue'
import * as icons from 'lucide-vue-next'

const props = defineProps<{
  title: string
  value: number | string
  icon: string
  color?: string
}>()

const iconComponent = computed(() => {
  return (icons as Record<string, unknown>)[props.icon] ?? icons.Activity
})

const colorClasses: Record<string, string> = {
  purple: 'text-purple-400 bg-purple-500/15',
  green: 'text-green-400 bg-success-dim',
  red: 'text-red-400 bg-error-dim',
  blue: 'text-blue-400 bg-info-dim',
  amber: 'text-amber-400 bg-warning-dim',
  pink: 'text-pink-400 bg-pink-500/15',
}

const iconBgGradients: Record<string, string> = {
  purple: 'bg-purple-500/10',
  green: 'bg-success-dim',
  red: 'bg-error-dim',
  blue: 'bg-info-dim',
  amber: 'bg-warning-dim',
  pink: 'bg-pink-500/10',
}

// Counter animation for numeric values
const displayValue = ref<string>(String(props.value))
const numberRef = ref<HTMLElement | null>(null)

onMounted(() => {
  if (typeof props.value === 'number' && numberRef.value) {
    const target = props.value
    const duration = 1200
    const start = performance.now()

    function animate(now: number) {
      const elapsed = now - start
      const progress = Math.min(elapsed / duration, 1)
      const eased = 1 - Math.pow(1 - progress, 3)
      displayValue.value = Math.round(target * eased).toLocaleString()
      if (progress < 1) requestAnimationFrame(animate)
    }
    requestAnimationFrame(animate)
  }
})
</script>

<template>
  <div class="flex flex-col items-center justify-center text-center gap-2">
    <div
      class="w-8 h-8 rounded-lg flex items-center justify-center shrink-0"
      :class="colorClasses[color ?? 'purple']"
    >
      <component :is="iconComponent" :size="16" />
    </div>
    <div
      ref="numberRef"
      class="text-xl font-display font-bold text-text-primary leading-none tabular-nums"
    >
      {{ displayValue }}
    </div>
    <div class="text-[11px] text-text-muted leading-tight">{{ title }}</div>
  </div>
</template>
