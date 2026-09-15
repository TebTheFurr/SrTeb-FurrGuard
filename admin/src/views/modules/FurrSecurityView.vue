<script setup lang="ts">
import { onBeforeUnmount, onMounted, shallowRef } from 'vue'
import IconCheckDouble from '~icons/pixelarticons/check-double'
import IconHourglass from '~icons/pixelarticons/hourglass'
import IconShield from '~icons/pixelarticons/shield'
import IconUsers from '~icons/pixelarticons/users'
import { api, isAbortError } from '@/api/client'
import type { SecurityStats } from '@/api/types'
import { useQueryTab } from '@/composables/useQueryTab'
import FilterTabs from '@/components/ui/FilterTabs.vue'
import PageHeader from '@/components/ui/PageHeader.vue'
import StatCard from '@/components/ui/StatCard.vue'
import SecurityLogs from './SecurityLogs.vue'
import SecuritySessions from './SecuritySessions.vue'
import SecurityStaff from './SecurityStaff.vue'

const TABS = [
  { value: 'staff', label: 'Staff' },
  { value: 'sessions', label: 'Sesiones' },
  { value: 'logs', label: 'Registro' },
] as const

const tab = useQueryTab(TABS.map((t) => t.value), 'staff')
const stats = shallowRef<SecurityStats | null>(null)
let controller: AbortController | null = null

/** Las estadísticas son secundarias: si fallan, las tarjetas muestran «—» y la vista sigue siendo usable. */
async function loadStats(): Promise<void> {
  controller?.abort()
  const current = new AbortController()
  controller = current
  try {
    stats.value = await api<SecurityStats>('furrsecurity_get_stats', {}, { signal: current.signal })
  } catch (e) {
    if (!isAbortError(e)) stats.value = null
  }
}

onMounted(loadStats)
onBeforeUnmount(() => controller?.abort())
</script>

<template>
  <div>
    <PageHeader title="FurrSecurity" :icon="IconShield" desc="El staff debe verificar con su Discord desde la misma IP antes de jugar. La sesión queda atada a esa IP." />

    <div class="metricas seccion">
      <StatCard label="Staff" :value="stats?.total_staff ?? '—'" :icon="IconUsers" />
      <StatCard label="Sesiones activas" :value="stats?.active_sessions ?? '—'" :icon="IconShield" tone="ok" />
      <StatCard label="Pendientes" :value="stats?.pending_verifications ?? '—'" :icon="IconHourglass" tone="warn" />
      <StatCard label="Verificados hoy" :value="stats?.verified_today ?? '—'" :icon="IconCheckDouble" />
    </div>

    <FilterTabs v-model="tab" class="seccion pestanas-modulo" label="Secciones de FurrSecurity" :options="TABS" />
    <SecurityStaff v-if="tab === 'staff'" @changed="loadStats" />
    <SecuritySessions v-else-if="tab === 'sessions'" @changed="loadStats" />
    <SecurityLogs v-else />
  </div>
</template>

<style scoped>
.pestanas-modulo { margin-bottom: 16px; }
</style>
