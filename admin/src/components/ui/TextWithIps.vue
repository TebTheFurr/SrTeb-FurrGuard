<script setup lang="ts">
/** Texto libre (detalles del registro) con sus IPs pintadas por IpText. */
import { computed } from 'vue'
import { splitIps } from '@/lib/ips'
import IpText from './IpText.vue'

const props = defineProps<{ text: string | null | undefined }>()
const parts = computed(() => splitIps(props.text ?? ''))
</script>

<template>
  <span v-if="!text" class="faint">—</span>
  <span v-else>
    <template v-for="(part, index) in parts" :key="index">
      <IpText v-if="part.ip" :ip="part.text" />
      <template v-else>{{ part.text }}</template>
    </template>
  </span>
</template>
