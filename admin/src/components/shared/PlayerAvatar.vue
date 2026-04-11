<script setup lang="ts">
import { computed } from 'vue'

const props = withDefaults(defineProps<{
  uuid: string
  size?: number
}>(), {
  size: 32,
})

const avatarUrl = computed(() => {
  return `https://mc-heads.net/avatar/${props.uuid}/${props.size}`
})
</script>

<template>
  <img
    :src="avatarUrl"
    :alt="uuid"
    class="rounded-md"
    :style="{ width: `${size}px`, height: `${size}px` }"
    loading="lazy"
  />
</template>
