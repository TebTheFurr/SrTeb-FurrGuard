<script setup lang="ts">
import IconScriptText from '~icons/pixelarticons/script-text'
import type { LogRow } from '@/api/types'
import { usePagedList } from '@/composables/usePagedList'
import { formatDateTime, timeAgo } from '@/lib/dates'
import { LOG_TYPES, logTypeLabel } from '@/lib/labels'
import IpText from '@/components/ui/IpText.vue'
import ListFrame from '@/components/ui/ListFrame.vue'
import PageHeader from '@/components/ui/PageHeader.vue'
import SearchBox from '@/components/ui/SearchBox.vue'
import StatusChip from '@/components/ui/StatusChip.vue'
import TextWithIps from '@/components/ui/TextWithIps.vue'

const list = usePagedList<LogRow, { type: string; search: string }>({
  action: 'get_logs',
  filters: { type: '', search: '' },
  allowed: { type: ['', ...LOG_TYPES.map((t) => t.value)] },
  perPage: 50,
})
</script>

<template>
  <div>
    <PageHeader title="Registro" :icon="IconScriptText" desc="Auditoría del panel: accesos, cambios de listas, ajustes, mensajes, módulos y acciones automáticas de seguridad." />

    <ListFrame :list="list" label="Registro de actividad" :empty-icon="IconScriptText" empty-title="No hay entradas con este filtro">
      <template #toolbar>
        <label class="sr-only" for="filtro-tipo-log">Tipo</label>
        <select id="filtro-tipo-log" v-model="list.filters.type" class="select">
          <option value="">Todos los tipos</option>
          <option v-for="type in LOG_TYPES" :key="type.value" :value="type.value">{{ type.label }}</option>
        </select>
        <SearchBox v-model="list.filters.search" label="Buscar en el registro" placeholder="Acción o detalle…" />
      </template>

      <table class="tabla">
        <thead>
          <tr>
            <th scope="col">Fecha</th>
            <th scope="col">Tipo</th>
            <th scope="col">Acción</th>
            <th scope="col">Detalles</th>
            <th scope="col">IP</th>
          </tr>
        </thead>
        <tbody>
          <tr v-for="row in list.items" :key="row.id">
            <td class="nowrap" :title="timeAgo(row.created_at)">{{ formatDateTime(row.created_at) }}</td>
            <td><StatusChip v-bind="logTypeLabel(row.type)" tone="tenue" /></td>
            <td>{{ row.action }}</td>
            <td class="detalles-log"><TextWithIps :text="row.details" /></td>
            <td><IpText :ip="row.ip_address" /></td>
          </tr>
        </tbody>
      </table>
    </ListFrame>
  </div>
</template>

<style scoped>
.detalles-log { min-width: 240px; max-width: 520px; color: var(--ink-2); overflow-wrap: anywhere; }
</style>
