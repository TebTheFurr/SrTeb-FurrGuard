<script setup lang="ts">
import { ref } from 'vue'
import IconCancel from '~icons/pixelarticons/cancel'
import IconCheck from '~icons/pixelarticons/check'
import IconTerminal from '~icons/pixelarticons/terminal'
import IconTrash from '~icons/pixelarticons/trash'
import { api } from '@/api/client'
import type { FurrPermsLog } from '@/api/types'
import { usePagedList } from '@/composables/usePagedList'
import { confirmAction } from '@/lib/confirm'
import { formatDateTime, timeAgo } from '@/lib/dates'
import { formatNumber, isOn } from '@/lib/format'
import { toast, toastError } from '@/lib/toast'
import FilterTabs from '@/components/ui/FilterTabs.vue'
import IpText from '@/components/ui/IpText.vue'
import ListFrame from '@/components/ui/ListFrame.vue'
import SearchBox from '@/components/ui/SearchBox.vue'

const FILTERS = [
  { value: 'all', label: 'Todos' },
  { value: 'allowed', label: 'Permitidos', icon: IconCheck },
  { value: 'blocked', label: 'Bloqueados', icon: IconCancel },
] as const

const list = usePagedList<FurrPermsLog, { filter: string; search: string }>({
  action: 'get_furr_perms_logs',
  filters: { filter: 'all', search: '' },
  allowed: { filter: FILTERS.map((f) => f.value) },
  prefix: 'log_',
  perPage: 50,
  legacyKey: 'logs',
})
const clearing = ref(false)

async function clearOld(): Promise<void> {
  const ok = await confirmAction({ title: 'Limpiar registro antiguo', message: 'Se borrarán los registros de comandos de más de 30 días.', confirmText: 'Limpiar', danger: true })
  if (!ok) return
  clearing.value = true
  try {
    const result = await api<{ deleted_count?: number } | null>('clear_furr_perms_logs')
    toast(`Registro limpiado: ${formatNumber(result?.deleted_count ?? 0)} entradas borradas.`, 'ok')
    await list.reload()
  } catch (e) {
    toastError(e)
  } finally {
    clearing.value = false
  }
}
</script>

<template>
  <ListFrame :list="list" label="Registro de comandos" :empty-icon="IconTerminal" empty-title="No hay comandos registrados con este filtro">
    <template #toolbar>
      <FilterTabs v-model="list.filters.filter" label="Filtrar por resultado" :options="FILTERS" />
      <SearchBox v-model="list.filters.search" label="Buscar en el registro de comandos" placeholder="Jugador o comando…" />
      <span class="spacer" />
      <button type="button" class="btn" :aria-busy="clearing" :disabled="clearing" @click="clearOld"><IconTrash aria-hidden="true" /> Limpiar antiguos</button>
    </template>

    <table class="tabla">
      <thead>
        <tr>
          <th scope="col">Fecha</th>
          <th scope="col">Jugador</th>
          <th scope="col">Comando</th>
          <th scope="col">Servidor</th>
          <th scope="col">Resultado</th>
          <th scope="col">IP</th>
        </tr>
      </thead>
      <tbody>
        <tr v-for="row in list.items" :key="row.id" :class="{ bloqueada: !isOn(row.allowed) }">
          <td class="nowrap" :title="formatDateTime(row.created_at)">{{ timeAgo(row.created_at) }}</td>
          <td>{{ row.player_nick }}</td>
          <td class="mono comando">{{ row.command }}</td>
          <td>{{ row.server_name || '—' }}</td>
          <td>
            <span v-if="isOn(row.allowed)" class="chip ok"><IconCheck aria-hidden="true" />Permitido</span>
            <span v-else class="chip down" :title="row.reason ?? undefined"><IconCancel aria-hidden="true" />Bloqueado</span>
          </td>
          <td><IpText :ip="row.ip_address" /></td>
        </tr>
      </tbody>
    </table>
  </ListFrame>
</template>

<style scoped>
.comando { max-width: 320px; overflow-wrap: anywhere; }
</style>
