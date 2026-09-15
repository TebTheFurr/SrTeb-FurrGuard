<script setup lang="ts">
import IconScriptText from '~icons/pixelarticons/script-text'
import type { SecurityLogRow } from '@/api/types'
import { usePagedList } from '@/composables/usePagedList'
import { formatDateTime, timeAgo } from '@/lib/dates'
import { securityActionLabel } from '@/lib/labels'
import FilterTabs from '@/components/ui/FilterTabs.vue'
import IpText from '@/components/ui/IpText.vue'
import ListFrame from '@/components/ui/ListFrame.vue'
import SearchBox from '@/components/ui/SearchBox.vue'
import StatusChip from '@/components/ui/StatusChip.vue'
import TextWithIps from '@/components/ui/TextWithIps.vue'

const GROUPS = [
  { value: 'all', label: 'Todo' },
  { value: 'verification', label: 'Verificaciones' },
  { value: 'failed', label: 'Fallos' },
  { value: 'blacklist', label: 'Auto-baneos' },
  { value: 'session', label: 'Sesiones' },
] as const

const list = usePagedList<SecurityLogRow, { group: string; search: string }>({
  action: 'furrsecurity_get_logs',
  filters: { group: 'all', search: '' },
  allowed: { group: GROUPS.map((g) => g.value) },
  prefix: 'log_',
  perPage: 50,
  legacyKey: 'logs',
})
</script>

<template>
  <ListFrame :list="list" label="Registro de FurrSecurity" :empty-icon="IconScriptText" empty-title="No hay eventos con este filtro">
    <template #toolbar>
      <FilterTabs v-model="list.filters.group" label="Filtrar eventos" :options="GROUPS" />
      <SearchBox v-model="list.filters.search" label="Buscar en el registro de FurrSecurity" placeholder="Nick, UUID, Discord o detalle…" />
    </template>

    <table class="tabla">
      <thead>
        <tr>
          <th scope="col">Fecha</th>
          <th scope="col">Evento</th>
          <th scope="col">Jugador</th>
          <th scope="col">Discord ID</th>
          <th scope="col">Detalles</th>
          <th scope="col">IP</th>
        </tr>
      </thead>
      <tbody>
        <tr v-for="row in list.items" :key="row.id">
          <td class="nowrap" :title="timeAgo(row.created_at)">{{ formatDateTime(row.created_at) }}</td>
          <td><StatusChip v-bind="securityActionLabel(row.action)" /></td>
          <td>{{ row.minecraft_nick || '—' }}</td>
          <td class="mono">{{ row.discord_id || '—' }}</td>
          <td class="celda-texto"><TextWithIps :text="row.details" /></td>
          <td><IpText :ip="row.ip_address" /></td>
        </tr>
      </tbody>
    </table>
  </ListFrame>
</template>
