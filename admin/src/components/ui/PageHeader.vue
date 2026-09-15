<script setup lang="ts">
import type { Component } from 'vue'

withDefaults(defineProps<{ title: string; icon: Component; desc?: string }>(), { desc: '' })
</script>

<template>
  <header class="cabecera-pagina">
    <div class="textos">
      <h1><component :is="icon" aria-hidden="true" />{{ title }}</h1>
      <p v-if="desc || $slots.desc" class="desc"><slot name="desc">{{ desc }}</slot></p>
    </div>
    <div v-if="$slots.default" class="acciones"><slot /></div>
  </header>
</template>
