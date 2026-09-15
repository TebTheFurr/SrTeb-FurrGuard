<script setup lang="ts">
import { computed, ref } from 'vue'
import IconCancel from '~icons/pixelarticons/cancel'
import IconChecklist from '~icons/pixelarticons/checklist'
import IconGlobe from '~icons/pixelarticons/globe'
import IconReload from '~icons/pixelarticons/reload'
import type { IpDetail, IpRow } from '@/api/types'
import { useDetail } from '@/composables/useDetail'
import { usePagedList } from '@/composables/usePagedList'
import { formatDateTime, timeAgo } from '@/lib/dates'
import { formatNumber, isOn } from '@/lib/format'
import { useSession } from '@/stores/session'
import AppDialog from '@/components/ui/AppDialog.vue'
import CountryTag from '@/components/ui/CountryTag.vue'
import IpText from '@/components/ui/IpText.vue'
import ListFrame from '@/components/ui/ListFrame.vue'
import PageHeader from '@/components/ui/PageHeader.vue'
import PlayerHead from '@/components/ui/PlayerHead.vue'
import SearchBox from '@/components/ui/SearchBox.vue'

const session = useSession()
const list = usePagedList<IpRow, { search: string }>({ action: 'get_ips', filters: { search: '' } })

const selected = ref<IpRow | null>(null)
const detail = useDetail<IpDetail>()
/** `ip` puede venir como objeto con los datos o solo como texto: se completa con la fila. */
const info = computed<IpRow | null>(() => {
  const raw = detail.data.value?.ip
  return raw && typeof raw === 'object' ? { ...selected.value, ...raw } : selected.value
})

function open(row: IpRow): void {
  selected.value = row
  void detail.load('get_ip_detail', { ip: row.ip })
}

function close(): void {
  detail.cancel()
  selected.value = null
}
</script>

<template>
  <div>
    <PageHeader title="IPs" :icon="IconGlobe" desc="Direcciones vistas en la red, con cuántos jugadores y conexiones comparten cada una." />

    <ListFrame :list="list" label="Lista de IPs" :empty-icon="IconGlobe" empty-title="No hay IPs que mostrar">
      <template #toolbar>
        <SearchBox v-model="list.filters.search" label="Buscar IPs" placeholder="IP o parte de ella…" />
      </template>

      <table class="tabla">
        <thead>
          <tr>
            <th scope="col">IP</th>
            <th scope="col">País</th>
            <th scope="col">ISP</th>
            <th scope="col">AS</th>
            <th scope="col" class="der">Jugadores</th>
            <th scope="col" class="der">Conexiones</th>
            <th scope="col">Listas</th>
            <th scope="col">Primera vez</th>
          </tr>
        </thead>
        <tbody>
          <tr v-for="(row, index) in list.items" :key="row.ip ?? index">
            <td>
              <button type="button" class="enlace-fila" aria-label="Ver jugadores de esta IP" @click="open(row)"><IpText :ip="row.ip" /></button>
            </td>
            <td><CountryTag :code="row.country_code" :name="row.country" /></td>
            <td class="celda-texto truncate">{{ row.isp || '—' }}</td>
            <td class="mono">{{ row.asn || '—' }}</td>
            <td class="der num">{{ formatNumber(row.player_count) }}</td>
            <td class="der num">{{ formatNumber(row.connection_count) }}</td>
            <td>
              <span class="chips">
                <span v-if="isOn(row.is_whitelisted)" class="chip accent"><IconChecklist aria-hidden="true" />WL</span>
                <span v-if="isOn(row.is_blacklisted)" class="chip down"><IconCancel aria-hidden="true" />BL</span>
                <span v-if="!isOn(row.is_whitelisted) && !isOn(row.is_blacklisted)" class="faint">—</span>
              </span>
            </td>
            <td class="nowrap" :title="formatDateTime(row.first_seen)">{{ timeAgo(row.first_seen) }}</td>
          </tr>
        </tbody>
      </table>
    </ListFrame>

    <AppDialog :open="selected !== null" :icon="IconGlobe" title="Detalle de la IP" @close="close">
      <div class="modal-cuerpo">
        <dl v-if="info" class="detalles">
          <div class="detalle"><dt class="label">IP</dt><dd class="valor"><IpText :ip="info.ip" /></dd></div>
          <div class="detalle"><dt class="label">País</dt><dd class="valor"><CountryTag :code="info.country_code" :name="info.country" show-name /></dd></div>
          <div class="detalle"><dt class="label">ISP</dt><dd class="valor">{{ info.isp || '—' }}</dd></div>
          <div class="detalle"><dt class="label">AS</dt><dd class="valor mono">{{ info.asn || '—' }}</dd></div>
        </dl>
        <p v-if="detail.loading.value" class="faint" aria-busy="true">Cargando jugadores…</p>
        <div v-else-if="detail.error.value" class="aviso down" role="alert">
          <span class="texto">{{ detail.error.value }}</span>
          <button v-if="selected" type="button" class="btn sm" @click="open(selected)"><IconReload aria-hidden="true" /> Reintentar</button>
        </div>
        <template v-else-if="detail.data.value">
          <h3>Jugadores que la han usado</h3>
          <p v-if="!detail.data.value.players.length" class="faint">Ningún jugador registrado.</p>
          <ul v-else class="jugadores">
            <li v-for="player in detail.data.value.players" :key="player.uuid">
              <PlayerHead :id="player.uuid" :name="player.nick" />
              <RouterLink v-if="session.can('players')" class="enlace-fila" :to="{ name: 'player', params: { uuid: player.uuid } }">{{ player.nick }}</RouterLink>
              <span v-else>{{ player.nick }}</span>
              <span class="faint">{{ timeAgo(player.last_used) }}</span>
            </li>
          </ul>
        </template>
      </div>
      <footer class="modal-pie">
        <button type="button" class="btn primary" @click="close">Cerrar</button>
      </footer>
    </AppDialog>
  </div>
</template>

<style scoped>
dl, dd { margin: 0; }
.jugadores { list-style: none; margin: 0; padding: 0; display: grid; gap: 8px; }
.jugadores li { display: flex; align-items: center; gap: 10px; font-size: var(--text-sm); }
.jugadores .faint { margin-left: auto; font-size: var(--text-xs); }
</style>
