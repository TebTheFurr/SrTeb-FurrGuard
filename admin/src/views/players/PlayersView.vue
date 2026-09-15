<script setup lang="ts">
import IconCancel from '~icons/pixelarticons/cancel'
import IconChecklist from '~icons/pixelarticons/checklist'
import IconGamepad from '~icons/pixelarticons/gamepad'
import type { PlayerRow } from '@/api/types'
import { usePagedList } from '@/composables/usePagedList'
import { formatDateTime, timeAgo } from '@/lib/dates'
import { formatNumber, isOn } from '@/lib/format'
import { useSession } from '@/stores/session'
import CountryTag from '@/components/ui/CountryTag.vue'
import FilterTabs from '@/components/ui/FilterTabs.vue'
import IpText from '@/components/ui/IpText.vue'
import ListFrame from '@/components/ui/ListFrame.vue'
import PageHeader from '@/components/ui/PageHeader.vue'
import PlayerHead from '@/components/ui/PlayerHead.vue'
import SearchBox from '@/components/ui/SearchBox.vue'

const FILTERS = [
  { value: 'all', label: 'Todos' },
  { value: 'online', label: 'Online' },
  { value: 'whitelisted', label: 'En whitelist' },
  { value: 'blacklisted', label: 'En blacklist' },
] as const

const session = useSession()
const list = usePagedList<PlayerRow, { filter: string; search: string }>({
  action: 'get_players',
  filters: { filter: 'all', search: '' },
  allowed: { filter: FILTERS.map((f) => f.value) },
})
</script>

<template>
  <div>
    <PageHeader title="Jugadores" :icon="IconGamepad" desc="Todos los jugadores que han pasado por la red. Busca por nick, UUID o IP." />

    <ListFrame
      :list="list"
      label="Lista de jugadores"
      :empty-icon="IconGamepad"
      :empty-title="list.filters.search ? 'Ningún jugador coincide' : 'Aún no hay jugadores'"
      :empty-text="list.filters.search ? `No hay resultados para «${list.filters.search}» con este filtro.` : ''"
    >
      <template #toolbar>
        <FilterTabs v-model="list.filters.filter" label="Filtrar jugadores" :options="FILTERS" />
        <SearchBox v-model="list.filters.search" label="Buscar jugadores" placeholder="Nick, UUID o IP…" />
      </template>

      <table class="tabla">
        <thead>
          <tr>
            <th scope="col">Jugador</th>
            <th scope="col">UUID</th>
            <th v-if="session.canSeeIps" scope="col">Última IP</th>
            <th scope="col">País</th>
            <th scope="col">Estado</th>
            <th scope="col" class="der">Conexiones</th>
            <th scope="col">Última vez</th>
          </tr>
        </thead>
        <tbody>
          <tr v-for="player in list.items" :key="player.uuid">
            <td>
              <div class="celda-jugador">
                <PlayerHead :id="player.uuid" :name="player.last_nick" />
                <div class="quien">
                  <RouterLink class="enlace-fila" :to="{ name: 'player', params: { uuid: player.uuid } }">{{ player.last_nick }}</RouterLink>
                  <span v-if="player.first_nick && player.first_nick !== player.last_nick" class="sub-celda">antes {{ player.first_nick }}</span>
                </div>
              </div>
            </td>
            <td class="mono uuid" :title="player.uuid">{{ player.uuid }}</td>
            <td v-if="session.canSeeIps"><IpText :ip="player.last_ip" /></td>
            <td><CountryTag :code="player.last_country_code" :name="player.last_country" /></td>
            <td>
              <span class="chips">
                <span v-if="isOn(player.is_online)" class="chip ok"><span class="baliza viva" />Online</span>
                <span v-if="isOn(player.is_whitelisted)" class="chip accent"><IconChecklist aria-hidden="true" />WL</span>
                <span v-if="isOn(player.is_blacklisted)" class="chip down"><IconCancel aria-hidden="true" />BL</span>
                <span v-if="!isOn(player.is_online) && !isOn(player.is_whitelisted) && !isOn(player.is_blacklisted)" class="faint">—</span>
              </span>
            </td>
            <td class="der num">{{ formatNumber(player.total_connections) }}</td>
            <td class="nowrap" :title="formatDateTime(player.last_seen)">{{ timeAgo(player.last_seen) }}</td>
          </tr>
        </tbody>
      </table>
    </ListFrame>
  </div>
</template>

<style scoped>
.celda-jugador { display: flex; align-items: center; gap: 10px; min-width: 0; }
.quien { display: grid; min-width: 0; line-height: 1.3; }
.uuid { max-width: 170px; overflow: hidden; text-overflow: ellipsis; white-space: nowrap; }
.chip .baliza { width: 6px; height: 6px; color: var(--ok); margin-right: 2px; }
</style>
