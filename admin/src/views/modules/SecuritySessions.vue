<script setup lang="ts">
import IconCheck from '~icons/pixelarticons/check'
import IconClock from '~icons/pixelarticons/clock'
import IconHourglass from '~icons/pixelarticons/hourglass'
import IconLogout from '~icons/pixelarticons/logout'
import IconShield from '~icons/pixelarticons/shield'
import { api } from '@/api/client'
import type { VerificationRow } from '@/api/types'
import { useBusy } from '@/composables/useBusy'
import { usePagedList } from '@/composables/usePagedList'
import { confirmAction } from '@/lib/confirm'
import { formatDateTime, isPast, timeAgo } from '@/lib/dates'
import FilterTabs from '@/components/ui/FilterTabs.vue'
import IpText from '@/components/ui/IpText.vue'
import ListFrame from '@/components/ui/ListFrame.vue'
import SearchBox from '@/components/ui/SearchBox.vue'
import StatusChip from '@/components/ui/StatusChip.vue'

const emit = defineEmits<{ changed: [] }>()

const FILTERS = [
  { value: 'active', label: 'Activas' },
  { value: 'pending', label: 'Pendientes' },
  { value: 'all', label: 'Todas' },
] as const

const list = usePagedList<VerificationRow, { status: string; search: string }>({
  action: 'furrsecurity_get_sessions',
  filters: { status: 'active', search: '' },
  allowed: { status: FILTERS.map((f) => f.value) },
  prefix: 'ses_',
})
const { busy, run } = useBusy()

function statusOf(row: VerificationRow) {
  if (row.status === 'pending') return { label: 'Pendiente', icon: IconHourglass, tone: 'warn' as const }
  if (row.status === 'verified' && !isPast(row.expires_at)) return { label: 'Verificada', icon: IconCheck, tone: 'ok' as const }
  return { label: 'Caducada', icon: IconClock, tone: 'tenue' as const }
}

async function revoke(row: VerificationRow): Promise<void> {
  const ok = await confirmAction({ title: 'Revocar sesión', message: `${row.minecraft_nick} tendrá que volver a verificarse para seguir jugando.`, confirmText: 'Revocar', danger: true })
  if (ok && (await run(row.id, () => api('furrsecurity_revoke_session', { id: row.id }), 'Sesión revocada.'))) {
    emit('changed')
    await list.reload()
  }
}
</script>

<template>
  <ListFrame :list="list" label="Sesiones de verificación" :empty-icon="IconShield" empty-title="No hay sesiones con este filtro">
    <template #toolbar>
      <FilterTabs v-model="list.filters.status" label="Filtrar sesiones" :options="FILTERS" />
      <SearchBox v-model="list.filters.search" label="Buscar sesiones" placeholder="Nick, UUID o Discord ID…" />
    </template>

    <table class="tabla">
      <thead>
        <tr>
          <th scope="col">Jugador</th>
          <th scope="col">Discord ID</th>
          <th scope="col">Estado</th>
          <th scope="col">Verificada</th>
          <th scope="col">Expira</th>
          <th scope="col">IP</th>
          <th scope="col" class="acciones"><span class="sr-only">Acciones</span></th>
        </tr>
      </thead>
      <tbody>
        <tr v-for="row in list.items" :key="row.id">
          <td>{{ row.minecraft_nick }}<span class="sub-celda mono">{{ row.uuid }}</span></td>
          <td class="mono">{{ row.discord_id || '—' }}</td>
          <td><StatusChip v-bind="statusOf(row)" /></td>
          <td class="nowrap">{{ formatDateTime(row.verified_at) }}</td>
          <td class="nowrap" :title="formatDateTime(row.expires_at)">{{ timeAgo(row.expires_at) }}</td>
          <td><IpText :ip="row.ip_address" /></td>
          <td class="acciones">
            <button
              v-if="statusOf(row).tone !== 'tenue'"
              type="button"
              class="btn sm"
              :aria-label="`Revocar la sesión de ${row.minecraft_nick}`"
              :aria-busy="busy === row.id"
              @click="revoke(row)"
            >
              <IconLogout aria-hidden="true" /> Revocar
            </button>
          </td>
        </tr>
      </tbody>
    </table>
  </ListFrame>
</template>
