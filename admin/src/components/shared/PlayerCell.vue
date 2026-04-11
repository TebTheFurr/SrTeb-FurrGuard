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
  <div class="flex items-center gap-3">
    <div class="relative">
      <PlayerAvatar :uuid="uuid" :size="32" />
      <!-- Online status dot -->
      <span
        v-if="isOnline"
        class="absolute -bottom-0.5 -right-0.5 w-2.5 h-2.5 rounded-full bg-success border-2 border-dark-800 animate-[status-pulse_2s_ease-in-out_infinite]"
      ></span>
    </div>
    <span class="text-sm font-medium text-text-primary">
      {{ nick || lastNick || 'Unknown' }}
    </span>
  </div>
</template>
