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
      class="h-10 rounded-lg"
      :style="{
        background: 'linear-gradient(110deg, var(--color-dark-750) 25%, var(--color-dark-600) 37%, var(--color-dark-750) 50%)',
        backgroundSize: '200% 100%',
        animation: 'shimmer 1.8s linear infinite',
      }"
    ></div>
  </div>
</template>
