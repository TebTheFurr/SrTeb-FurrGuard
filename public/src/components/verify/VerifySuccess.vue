<script setup lang="ts">
defineProps<{
  title: string
  message: string
}>()
</script>

<template>
  <div class="glass-card p-10 text-center" style="border-top: 3px solid var(--color-success)">
    <div class="w-16 h-16 rounded-full bg-success-dim flex items-center justify-center mx-auto mb-6">
      <svg width="32" height="32" viewBox="0 0 24 24" fill="none" stroke="var(--color-success)" stroke-width="2">
        <path d="M22 11.08V12a10 10 0 1 1-5.93-9.14" />
        <polyline points="22 4 12 14.01 9 11.01" />
      </svg>
    </div>
    <h1 class="text-xl font-bold text-text-primary mb-2">{{ title }}</h1>
    <p v-if="message" class="text-text-muted text-sm leading-relaxed">{{ message }}</p>
  </div>
</template>
