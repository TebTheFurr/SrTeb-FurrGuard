<script setup lang="ts">
import CountryFlag from './CountryFlag.vue'

defineProps<{
  ip: string
  country?: string | null
  countryCode?: string | null
  isp?: string | null
}>()
</script>

<template>
  <div class="flex items-center gap-2">
    <CountryFlag v-if="countryCode" :code="countryCode" />
    <span class="text-sm font-mono text-text-primary">{{ ip }}</span>
    <span v-if="isp" class="text-xs text-text-muted hidden lg:inline">({{ isp }})</span>
  </div>
</template>
