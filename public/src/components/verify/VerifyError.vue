<script setup lang="ts">
defineProps<{
  title: string
  message: string
}>()
</script>

<template>
  <div class="glass-card p-10 text-center border-t-3 border-t-error" style="border-top: 3px solid var(--color-error)">
    <div class="w-16 h-16 rounded-full bg-error-dim flex items-center justify-center mx-auto mb-6">
      <svg width="32" height="32" viewBox="0 0 24 24" fill="none" stroke="var(--color-error)" stroke-width="2">
        <circle cx="12" cy="12" r="10" />
        <line x1="15" y1="9" x2="9" y2="15" />
        <line x1="9" y1="9" x2="15" y2="15" />
      </svg>
    </div>
    <h1 class="text-xl font-bold text-text-primary mb-2">{{ title }}</h1>
    <p v-if="message" class="text-text-muted text-sm leading-relaxed">{{ message }}</p>
  </div>
</template>
