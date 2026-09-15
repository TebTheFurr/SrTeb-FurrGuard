<script setup lang="ts">
import { computed } from 'vue'
import { Inbox } from 'lucide-vue-next'
import * as icons from 'lucide-vue-next'

const props = defineProps<{
  title: string
  description?: string
  icon?: string
}>()

const iconComponent = computed(() => {
  if (!props.icon) return Inbox
  return (icons as Record<string, unknown>)[props.icon] ?? Inbox
})
</script>

<template>
  <div class="flex flex-col items-center justify-center py-14 px-4 text-center">
    <div class="w-16 h-16 rounded-2xl bg-dark-700/50 border border-glass-border-subtle flex items-center justify-center mb-5 animate-[float_4s_ease-in-out_infinite]">
      <component :is="iconComponent" :size="28" class="text-text-muted" />
    </div>
    <h3 class="text-base font-display font-semibold text-text-primary mb-1.5">{{ title }}</h3>
    <p v-if="description" class="text-sm text-text-muted max-w-xs leading-relaxed">{{ description }}</p>
  </div>
</template>
