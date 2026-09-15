<script setup lang="ts">
import type { Component } from 'vue'
import IconInbox from '~icons/pixelarticons/inbox'
import IconWarningBox from '~icons/pixelarticons/warning-box'

withDefaults(defineProps<{ title: string; icon?: Component; text?: string; tone?: '' | 'error' }>(), {
  icon: undefined,
  text: '',
  tone: '',
})
</script>

<template>
  <div class="vacio" :class="tone" :role="tone === 'error' ? 'alert' : undefined">
    <component :is="icon ?? (tone === 'error' ? IconWarningBox : IconInbox)" class="x2" aria-hidden="true" />
    <h3>{{ title }}</h3>
    <p v-if="text">{{ text }}</p>
    <slot />
  </div>
</template>
