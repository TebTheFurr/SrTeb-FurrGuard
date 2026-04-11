<script setup lang="ts">
import { computed } from 'vue'
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
</script>

<template>
  <div class="glass-card p-5 flex items-start gap-4 hover:shadow-card-hover transition-shadow duration-300">
    <div
      class="w-12 h-12 rounded-xl flex items-center justify-center shrink-0"
      :class="colorClasses[color ?? 'purple']"
    >
      <component :is="iconComponent" :size="22" />
    </div>
    <div class="min-w-0">
      <div class="text-sm text-text-muted mb-1">{{ title }}</div>
      <div class="text-2xl font-display font-bold text-text-primary leading-tight">
        {{ value }}
      </div>
    </div>
  </div>
</template>
