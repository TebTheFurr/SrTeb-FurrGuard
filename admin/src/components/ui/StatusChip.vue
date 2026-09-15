<script setup lang="ts">
import type { Component } from 'vue'
import type { ChipTone } from '@/lib/labels'

withDefaults(defineProps<{ label: string; icon?: Component; tone?: ChipTone; title?: string }>(), {
  icon: undefined,
  tone: '',
  title: undefined,
})
</script>

<template>
  <span class="chip" :class="tone" :title="title">
    <component :is="icon" v-if="icon" aria-hidden="true" />{{ label }}
  </span>
</template>
