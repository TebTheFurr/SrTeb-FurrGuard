<script setup lang="ts">
/** Vista previa de un texto con códigos & / § como spans con estilo. Nunca v-html. */
import { computed } from 'vue'
import { parseMc } from '@/lib/mc'

const props = defineProps<{ text: string }>()
const segments = computed(() => parseMc(props.text))
</script>

<template>
  <div class="mc"><span
    v-for="(segment, index) in segments"
    :key="index"
    :class="{ b: segment.bold, i: segment.italic, u: segment.underline, s: segment.strike, k: segment.obfuscated }"
    :style="segment.color ? { color: segment.color } : undefined"
  >{{ segment.text }}</span></div>
</template>
