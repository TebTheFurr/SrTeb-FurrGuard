<script setup lang="ts">
import { computed } from 'vue'

const props = defineProps<{
  code: string
}>()

const flagUrl = computed(() => {
  if (!props.code) return ''
  return `https://flagcdn.com/w40/${props.code.toLowerCase()}.png`
})
</script>

<template>
  <img
    v-if="code"
    :src="flagUrl"
    :alt="code.toUpperCase()"
    class="inline-block w-6 h-4 rounded-sm object-cover"
    loading="lazy"
  />
  <span v-else class="inline-block w-6 h-4 rounded-sm bg-dark-600"></span>
</template>
