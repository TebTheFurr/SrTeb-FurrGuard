<script setup lang="ts">
/** Cabeza 2D del jugador (mc-heads.net, permitido por la CSP). Sin 3D: nada de WebGL que liberar. */
import { computed, ref, watch } from 'vue'
import { initials } from '@/lib/format'

const props = withDefaults(defineProps<{ id: string; name?: string; size?: 'sm' | 'md' | 'lg' }>(), { name: '', size: 'sm' })
const failed = ref(false)
watch(() => props.id, () => {
  failed.value = false
})
const src = computed(() => `https://mc-heads.net/avatar/${encodeURIComponent(props.id)}/64`)
</script>

<template>
  <span class="cabeza" :class="size" aria-hidden="true">
    <img v-if="id && !failed" :src="src" alt="" width="64" height="64" loading="lazy" referrerpolicy="no-referrer" @error="failed = true">
    <template v-else>{{ initials(name || id) }}</template>
  </span>
</template>

<style scoped>
.cabeza.sm { width: 26px; height: 26px; font-size: 11px; }
.cabeza.md { width: 36px; height: 36px; font-size: 14px; }
.cabeza.lg { width: 72px; height: 72px; font-size: 26px; border-radius: 10px; }
</style>
