<script setup lang="ts">
import { computed } from 'vue'
import { Inbox } from 'lucide-vue-next'

defineProps<{
  title: string
  description?: string
  icon?: string
}>()

// For now just use Inbox icon; can be expanded later for dynamic icons
</script>

<template>
  <div class="flex flex-col items-center justify-center py-12 px-4 text-center">
    <div class="w-14 h-14 rounded-full bg-dark-600 flex items-center justify-center mb-4">
      <Inbox :size="24" class="text-text-muted" />
    </div>
    <h3 class="text-base font-medium text-text-primary mb-1">{{ title }}</h3>
    <p v-if="description" class="text-sm text-text-muted max-w-xs">{{ description }}</p>
  </div>
</template>
