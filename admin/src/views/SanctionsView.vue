<script setup lang="ts">
import { computed } from 'vue'
import IconCancel from '~icons/pixelarticons/cancel'
import IconClock from '~icons/pixelarticons/clock'
import IconHourglass from '~icons/pixelarticons/hourglass'
import IconInfinity from '~icons/pixelarticons/infinity'
import IconPause from '~icons/pixelarticons/pause'
import IconArchive from '~icons/pixelarticons/archive'
import IconTrash from '~icons/pixelarticons/trash'
import { api } from '@/api/client'
import type { SanctionFilter, SanctionRow } from '@/api/types'
import { useBusy } from '@/composables/useBusy'
import { usePagedList } from '@/composables/usePagedList'
import { banExpiry, banStatus } from '@/lib/bans'
import { confirmAction } from '@/lib/confirm'
import { formatDateTime, timeAgo } from '@/lib/dates'
import { entryLabel } from '@/lib/entries'
import { isOn, toNum } from '@/lib/format'
import { useSession } from '@/stores/session'
import ActiveSwitch from '@/components/ui/ActiveSwitch.vue'
import FilterTabs from '@/components/ui/FilterTabs.vue'
import IpText from '@/components/ui/IpText.vue'
import ListFrame from '@/components/ui/ListFrame.vue'
import PageHeader from '@/components/ui/PageHeader.vue'
import SearchBox from '@/components/ui/SearchBox.vue'
import StatCard from '@/components/ui/StatCard.vue'
import StatusChip from '@/components/ui/StatusChip.vue'

const FILTER_VALUES: SanctionFilter[] = ['all', 'active', 'temporary', 'permanent', 'expired', 'inactive']

const session = useSession()
const list = usePagedList<SanctionRow, { filter: string; search: string }>({
  action: 'get_sanctions',
  filters: { filter: 'all', search: '' },
  allowed: { filter: FILTER_VALUES },
})
const { busy, run } = useBusy()

/** Las estadísticas llegan con cada página: las tarjetas y las pestañas se actualizan solas. */
const stats = computed(() => {
  const raw = (list.data.stats ?? {}) as Record<string, unknown>
  const get = (key: string): number | null => (raw[key] === undefined ? null : toNum(raw[key]))
  return { all: get('all') ?? get('total'), active: get('active'), temporary: get('temporary'), permanent: get('permanent'), expired: get('expired'), inactive: get('inactive') }
})

const tabs = computed(() => [
  { value: 'all', label: 'Todas', count: stats.value.all },
  { value: 'active', label: 'Activas', count: stats.value.active },
  { value: 'temporary', label: 'Temporales', count: stats.value.temporary },
  { value: 'permanent', label: 'Permanentes', count: stats.value.permanent },
  { value: 'expired', label: 'Expiradas', count: stats.value.expired },
  { value: 'inactive', label: 'Inactivas', count: stats.value.inactive },
])

async function setActive(row: SanctionRow, active: boolean): Promise<void> {
  if (await run(row.id, () => api('set_blacklist_active', { id: row.id, active }), active ? 'Sanción activada.' : 'Sanción desactivada.')) await list.reload()
}

async function remove(row: SanctionRow): Promise<void> {
  const ok = await confirmAction({ title: 'Eliminar sanción', message: `Se borrará ${row.ban_id} (${row.value}) y sus IPs hijas.`, confirmText: 'Eliminar', danger: true })
  if (ok && (await run(row.id, () => api('remove_blacklist', { id: row.id }), 'Sanción eliminada.'))) await list.reload()
}
</script>

<template>
  <div>
    <PageHeader title="Sanciones" :icon="IconArchive" desc="Historial de todos los baneos, incluidos los temporales ya expirados y los desactivados." />

    <div class="metricas seccion">
      <StatCard label="Activas" :value="stats.active ?? '—'" :icon="IconCancel" tone="down" />
      <StatCard label="Temporales" :value="stats.temporary ?? '—'" :icon="IconHourglass" />
      <StatCard label="Permanentes" :value="stats.permanent ?? '—'" :icon="IconInfinity" />
      <StatCard label="Expiradas" :value="stats.expired ?? '—'" :icon="IconClock" tone="warn" />
      <StatCard label="Inactivas" :value="stats.inactive ?? '—'" :icon="IconPause" />
    </div>

    <ListFrame :list="list" label="Sanciones" :empty-icon="IconArchive" empty-title="No hay sanciones con este filtro">
      <template #toolbar>
        <FilterTabs v-model="list.filters.filter" label="Filtrar sanciones" :options="tabs" />
        <SearchBox v-model="list.filters.search" label="Buscar sanciones" placeholder="ID, valor, motivo o autor…" />
      </template>

      <table class="tabla">
        <thead>
          <tr>
            <th scope="col">ID</th>
            <th scope="col">Tipo</th>
            <th scope="col">Valor</th>
            <th scope="col">Motivo</th>
            <th scope="col">Autor</th>
            <th scope="col">Creada</th>
            <th scope="col">Expira</th>
            <th scope="col">Estado</th>
            <th v-if="session.can('blacklist')" scope="col" class="acciones"><span class="sr-only">Acciones</span></th>
          </tr>
        </thead>
        <tbody>
          <tr v-for="row in list.items" :key="row.id">
            <td class="mono">{{ row.ban_id }}</td>
            <td><span class="chip tenue">{{ entryLabel(row.type) }}</span></td>
            <td>
              <IpText v-if="row.type === 'ip' || row.type === 'ip_range'" :ip="row.value" />
              <span v-else class="mono">{{ row.minecraft_name || row.value }}</span>
            </td>
            <td class="celda-texto">{{ row.reason || '—' }}</td>
            <td>{{ row.added_by || '—' }}</td>
            <td class="nowrap" :title="formatDateTime(row.created_at)">{{ timeAgo(row.created_at) }}</td>
            <td><StatusChip v-bind="banExpiry(row.expires_at)" /></td>
            <td><StatusChip v-bind="banStatus(row.active, row.expires_at)" /></td>
            <td v-if="session.can('blacklist')" class="acciones">
              <span class="fila-acciones">
                <ActiveSwitch :active="isOn(row.active)" :busy="busy === row.id" :label="`Sanción ${row.ban_id} activa`" @change="setActive(row, $event)" />
                <button type="button" class="btn ghost icono sm" :aria-label="`Eliminar sanción ${row.ban_id}`" @click="remove(row)"><IconTrash aria-hidden="true" /></button>
              </span>
            </td>
          </tr>
        </tbody>
      </table>
    </ListFrame>
  </div>
</template>
