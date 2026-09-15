<script setup lang="ts">
import { computed, type Component } from 'vue'
import { RouterLink, type RouteLocationRaw } from 'vue-router'
import { formatNumber } from '@/lib/format'

const props = withDefaults(
  defineProps<{ label: string; value: unknown; icon: Component; sub?: string; tone?: '' | 'ok' | 'warn' | 'down' | 'accent'; to?: RouteLocationRaw }>(),
  { sub: '', tone: '', to: undefined },
)

/** MySQL puede mandar los contadores como texto: "1234" se formatea igual que 1234; «—» se deja tal cual. */
const display = computed(() => {
  const { value } = props
  if (typeof value === 'number' || (typeof value === 'string' && /^-?\d+(\.\d+)?$/.test(value.trim()))) return formatNumber(value)
  return value === null || value === undefined ? '—' : String(value)
})
</script>

<template>
  <component :is="to ? RouterLink : 'div'" :to="to" class="metrica" :class="tone">
    <div class="cab">
      <component :is="icon" aria-hidden="true" />
      <span class="label">{{ label }}</span>
    </div>
    <div class="valor num">{{ display }}</div>
    <div v-if="sub" class="sub">{{ sub }}</div>
  </component>
</template>

<style scoped>
.metrica .cab svg { color: var(--ink-3); margin: -3px 0; }
</style>
