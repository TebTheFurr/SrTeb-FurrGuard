<script setup lang="ts">
import IconLock from '~icons/pixelarticons/lock'
import { useQueryTab } from '@/composables/useQueryTab'
import FilterTabs from '@/components/ui/FilterTabs.vue'
import PageHeader from '@/components/ui/PageHeader.vue'
import FurrPermsLogs from './FurrPermsLogs.vue'
import FurrPermsWhitelist from './FurrPermsWhitelist.vue'

const TABS = [
  { value: 'whitelist', label: 'Whitelist de comandos' },
  { value: 'logs', label: 'Registro de comandos' },
] as const

const tab = useQueryTab(TABS.map((t) => t.value), 'whitelist')
</script>

<template>
  <div>
    <PageHeader title="FurrPerms" :icon="IconLock" desc="Solo los jugadores de esta lista pueden usar los comandos sensibles de la red." />
    <FilterTabs v-model="tab" class="seccion pestanas-modulo" label="Secciones de FurrPerms" :options="TABS" />
    <!-- cada pestaña monta su propia lista: búsquedas y filtros independientes (prefijos wl_ y log_ en la URL) -->
    <FurrPermsWhitelist v-if="tab === 'whitelist'" />
    <FurrPermsLogs v-else />
  </div>
</template>

<style scoped>
.pestanas-modulo { margin-bottom: 16px; }
</style>
