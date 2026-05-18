<script setup lang="ts">
import PlayerAvatar from './PlayerAvatar.vue'

defineProps<{
  uuid: string
  nick?: string
  lastNick?: string
  isOnline?: number | boolean
}>()
</script>

<template>
  <div class="flex items-center gap-3 group">
    <div class="relative">
      <PlayerAvatar :uuid="uuid" :size="32" />
      <!-- Online status dot with animated pulse -->
      <span
        v-if="isOnline"
        class="absolute -bottom-0.5 -right-0.5 w-3 h-3 rounded-full bg-success border-2 border-dark-800"
      >
        <span class="absolute inset-0 rounded-full bg-success animate-[status-pulse_2s_ease-in-out_infinite]"></span>
      </span>
    </div>
    <span class="text-sm font-medium text-text-primary group-hover:text-purple-400 transition-colors">
      {{ nick || lastNick || 'Unknown' }}
    </span>
  </div>
</template>
