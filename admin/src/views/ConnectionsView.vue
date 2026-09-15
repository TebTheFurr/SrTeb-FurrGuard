<script setup lang="ts">
import { computed, ref } from 'vue'
import IconPlug from '~icons/pixelarticons/plug'
import IconReload from '~icons/pixelarticons/reload'
import type { ConnectionRow } from '@/api/types'
import { useDetail } from '@/composables/useDetail'
import { usePagedList } from '@/composables/usePagedList'
import { formatDateTime, timeAgo } from '@/lib/dates'
import { isOn } from '@/lib/format'
import { DETECTIONS, reasonLabel } from '@/lib/labels'
import { useSession } from '@/stores/session'
import AppDialog from '@/components/ui/AppDialog.vue'
import CountryTag from '@/components/ui/CountryTag.vue'
import FilterTabs from '@/components/ui/FilterTabs.vue'
import IpText from '@/components/ui/IpText.vue'
import ListFrame from '@/components/ui/ListFrame.vue'
import PageHeader from '@/components/ui/PageHeader.vue'
import SearchBox from '@/components/ui/SearchBox.vue'
import StatusChip from '@/components/ui/StatusChip.vue'

const FILTERS = [
  { value: 'all', label: 'Todas' },
  { value: 'allowed', label: 'Permitidas' },
  { value: 'blocked', label: 'Bloqueadas' },
  { value: 'proxy', label: 'Proxy' },
  { value: 'vpn', label: 'VPN' },
  { value: 'hosting', label: 'Hosting' },
  { value: 'mobile', label: 'Móvil' },
] as const

const session = useSession()
const list = usePagedList<ConnectionRow, { filter: string; search: string }>({
  action: 'get_connections',
  filters: { filter: 'all', search: '' },
  allowed: { filter: FILTERS.map((f) => f.value) },
})

const selected = ref<ConnectionRow | null>(null)
const detail = useDetail<{ connection: ConnectionRow }>()
const connection = computed(() => detail.data.value?.connection ?? null)

function open(row: ConnectionRow): void {
  selected.value = row
  void detail.load('get_connection_detail', { id: row.id })
}

function close(): void {
  detail.cancel()
  selected.value = null
}

const detectionsOf = (row: ConnectionRow) => DETECTIONS.filter((d) => isOn(row[d.key]))
</script>

<template>
  <div>
    <PageHeader title="Conexiones" :icon="IconPlug" desc="Cada intento de entrada con su geolocalización y el resultado de las reglas." />

    <ListFrame :list="list" label="Lista de conexiones" :empty-icon="IconPlug" empty-title="No hay conexiones con este filtro">
      <template #toolbar>
        <FilterTabs v-model="list.filters.filter" label="Filtrar conexiones" :options="FILTERS" />
        <SearchBox v-model="list.filters.search" label="Buscar conexiones" placeholder="Nick, UUID o IP…" />
      </template>

      <table class="tabla">
        <thead>
          <tr>
            <th scope="col">Fecha</th>
            <th scope="col">Jugador</th>
            <th v-if="session.canSeeIps" scope="col">IP</th>
            <th scope="col">País</th>
            <th scope="col">Detección</th>
            <th scope="col">Resultado</th>
            <th scope="col" class="acciones"><span class="sr-only">Acciones</span></th>
          </tr>
        </thead>
        <tbody>
          <tr v-for="row in list.items" :key="row.id" :class="{ bloqueada: isOn(row.blocked) }">
            <td class="nowrap" :title="formatDateTime(row.created_at)">{{ timeAgo(row.created_at) }}</td>
            <td>
              <!-- Conexiones antiguas sin UUID: no hay ficha a la que enlazar (el nick no identifica) -->
              <RouterLink v-if="row.uuid && session.can('players')" class="enlace-fila" :to="{ name: 'player', params: { uuid: row.uuid } }">{{ row.nick }}</RouterLink>
              <span v-else>{{ row.nick }}</span>
            </td>
            <td v-if="session.canSeeIps"><IpText :ip="row.ip" /></td>
            <td><CountryTag :code="row.country_code" :name="row.country" /></td>
            <td>
              <span class="chips">
                <StatusChip v-for="d in detectionsOf(row)" :key="d.key" :label="d.label" :icon="d.icon" tone="warn" />
                <span v-if="!detectionsOf(row).length" class="faint">—</span>
              </span>
            </td>
            <td><StatusChip v-bind="reasonLabel(isOn(row.blocked) ? row.block_reason : 'allowed')" /></td>
            <td class="acciones">
              <button type="button" class="btn sm" :aria-label="`Ver detalle de la conexión de ${row.nick}`" @click="open(row)">Detalle</button>
            </td>
          </tr>
        </tbody>
      </table>
    </ListFrame>

    <AppDialog :open="selected !== null" :icon="IconPlug" wide title="Detalle de la conexión" :sub="selected ? `${selected.nick} · ${formatDateTime(selected.created_at)}` : ''" @close="close">
      <div class="modal-cuerpo">
        <p v-if="detail.loading.value" class="faint" aria-busy="true">Cargando…</p>
        <div v-else-if="detail.error.value" class="aviso down" role="alert">
          <span class="texto">{{ detail.error.value }}</span>
          <button v-if="selected" type="button" class="btn sm" @click="open(selected)"><IconReload aria-hidden="true" /> Reintentar</button>
        </div>
        <dl v-else-if="connection" class="detalles">
          <div class="detalle"><dt class="label">Jugador</dt><dd class="valor">{{ connection.nick }}</dd></div>
          <div class="detalle"><dt class="label">UUID</dt><dd class="valor mono">{{ connection.uuid ?? '—' }}</dd></div>
          <div v-if="session.canSeeIps" class="detalle"><dt class="label">IP</dt><dd class="valor"><IpText :ip="connection.ip" /></dd></div>
          <div class="detalle"><dt class="label">País</dt><dd class="valor"><CountryTag :code="connection.country_code" :name="connection.country" show-name /></dd></div>
          <div class="detalle"><dt class="label">Región / ciudad</dt><dd class="valor">{{ [connection.region, connection.city].filter(Boolean).join(' · ') || '—' }}</dd></div>
          <div class="detalle"><dt class="label">ISP</dt><dd class="valor">{{ connection.isp || '—' }}</dd></div>
          <div class="detalle"><dt class="label">Organización</dt><dd class="valor">{{ connection.org || '—' }}</dd></div>
          <div class="detalle"><dt class="label">AS</dt><dd class="valor mono">{{ connection.asn || '—' }} {{ connection.asname || '' }}</dd></div>
          <div class="detalle"><dt class="label">Versión</dt><dd class="valor mono">{{ connection.game_version || '—' }}</dd></div>
          <div class="detalle"><dt class="label">Zona horaria</dt><dd class="valor">{{ connection.timezone || '—' }}</dd></div>
          <div class="detalle"><dt class="label">Detección</dt><dd class="valor chips">
            <StatusChip v-for="d in detectionsOf(connection)" :key="d.key" :label="d.label" :icon="d.icon" tone="warn" />
            <span v-if="!detectionsOf(connection).length" class="faint">Nada sospechoso</span>
          </dd></div>
          <div class="detalle"><dt class="label">Resultado</dt><dd class="valor"><StatusChip v-bind="reasonLabel(isOn(connection.blocked) ? connection.block_reason : 'allowed')" /></dd></div>
        </dl>
      </div>
      <footer class="modal-pie">
        <RouterLink v-if="connection?.uuid && session.can('players')" class="btn" :to="{ name: 'player', params: { uuid: connection.uuid } }">Ver jugador</RouterLink>
        <button type="button" class="btn primary" @click="close">Cerrar</button>
      </footer>
    </AppDialog>
  </div>
</template>

<style scoped>
dl, dd { margin: 0; }
</style>
