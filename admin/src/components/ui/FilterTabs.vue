<script setup lang="ts" generic="V extends string">
import type { Component } from 'vue'
import { formatNumber } from '@/lib/format'

defineProps<{
  label: string
  options: readonly { value: V; label: string; icon?: Component; count?: unknown }[]
}>()
const model = defineModel<V>({ required: true })
</script>

<template>
  <div class="pestanas" role="group" :aria-label="label">
    <button
      v-for="option in options"
      :key="option.value"
      type="button"
      class="pestana"
      :aria-pressed="model === option.value"
      @click="model = option.value"
    >
      <component :is="option.icon" v-if="option.icon" aria-hidden="true" />
      {{ option.label }}
      <span v-if="option.count !== undefined && option.count !== null" class="cuenta">{{ formatNumber(option.count) }}</span>
    </button>
  </div>
</template>
