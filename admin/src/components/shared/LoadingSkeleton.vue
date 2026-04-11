<script setup lang="ts">
withDefaults(defineProps<{
  rows?: number
}>(), {
  rows: 5,
})
</script>

<template>
  <div class="p-4 space-y-3">
    <div
      v-for="i in rows"
      :key="i"
      class="h-10 rounded-lg bg-dark-700"
      :style="{
        background: 'linear-gradient(90deg, var(--color-dark-700) 25%, var(--color-dark-600) 50%, var(--color-dark-700) 75%)',
        backgroundSize: '200% 100%',
        animation: 'shimmer 2s linear infinite',
      }"
    ></div>
  </div>
</template>
