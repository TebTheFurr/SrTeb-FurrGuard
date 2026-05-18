<script setup lang="ts">
import { onMounted } from 'vue'
import { useRouter, useRoute } from 'vue-router'
import { usePlayersStore } from '@/stores/players'
import { PLAYER_FILTERS } from '@/lib/constants'
import FilterTabs from '@/components/shared/FilterTabs.vue'
import SearchInput from '@/components/shared/SearchInput.vue'
import DataTable from '@/components/shared/DataTable.vue'
import PaginationBar from '@/components/shared/PaginationBar.vue'
import PlayerCell from '@/components/shared/PlayerCell.vue'
import IPCell from '@/components/shared/IPCell.vue'
import StatusBadge from '@/components/shared/StatusBadge.vue'
import CountryFlag from '@/components/shared/CountryFlag.vue'
import { Eye, Users } from 'lucide-vue-next'

const router = useRouter()
const route = useRoute()
const store = usePlayersStore()

let currentPage = 1
let currentFilter = 'all'
let currentSearch = (route.query.search as string) || ''

const columns = [
  { key: 'nick', label: 'Jugador' },
  { key: 'ip', label: 'IP' },
  { key: 'country', label: 'Pais' },
  { key: 'status', label: 'Estado' },
  { key: 'last_seen', label: 'Ultima vez' },
  { key: 'actions', label: '' },
]

function fetchData() {
  store.fetchPlayers(currentPage, currentFilter, currentSearch)
}

onMounted(fetchData)

function onFilterChange(filter: string) {
  currentFilter = filter
  currentPage = 1
  fetchData()
}

function onSearchChange(search: string) {
  currentSearch = search
  currentPage = 1
  fetchData()
}

function onPageChange(page: number) {
  currentPage = page
  fetchData()
}

function onRowClick(row: Record<string, unknown>) {
  const player = row as Record<string, unknown>
  if (player.uuid) {
    router.push({ name: 'player-detail', params: { uuid: String(player.uuid) } })
  }
}

function formatDate(dateStr: string): string {
  if (!dateStr) return '-'
  return new Date(dateStr).toLocaleString('es-ES', {
    day: '2-digit',
    month: '2-digit',
    year: 'numeric',
    hour: '2-digit',
    minute: '2-digit',
  })
}
</script>

<template>
  <div class="page-container animate-fade-in-up">
    <!-- Section header with player count -->
    <div class="section-header">
      <div class="flex items-center gap-3">
        <div class="flex items-center justify-center w-10 h-10 rounded-xl gradient-primary shadow-glow">
          <Users :size="20" class="text-white" />
        </div>
        <div>
          <h1 class="text-2xl font-display font-bold gradient-text">Jugadores</h1>
          <p class="text-sm text-text-muted mt-0.5">Gestion y busqueda de jugadores</p>
        </div>
      </div>
      <div
        v-if="store.pagination"
        class="glass-card px-4 py-2 flex items-center gap-2"
      >
        <Users :size="16" class="text-purple-400" />
        <span class="text-sm text-text-secondary">Total</span>
        <span class="text-lg font-display font-bold gradient-text tabular-nums">
          {{ store.pagination.total }}
        </span>
      </div>
    </div>

    <!-- Unified filter/search bar -->
    <div class="glass-card p-3 flex flex-col sm:flex-row items-stretch sm:items-center gap-3">
      <FilterTabs
        :filters="PLAYER_FILTERS"
        :model-value="currentFilter"
        @update:model-value="onFilterChange"
      />
      <div class="flex-1 sm:max-w-xs">
        <SearchInput
          :model-value="currentSearch"
          placeholder="Buscar jugador, UUID, IP..."
          @update:model-value="onSearchChange"
        />
      </div>
    </div>

    <!-- Players table with row-enter animation -->
    <DataTable
      :columns="columns"
      :rows="store.players as unknown as Record<string, unknown>[]"
      :loading="store.loading"
      empty-message="No se encontraron jugadores"
      @row-click="onRowClick"
    >
      <template #cell-nick="{ row }">
        <PlayerCell
          :uuid="(row as any).uuid"
          :nick="(row as any).last_nick"
          :is-online="(row as any).is_online"
        />
      </template>

      <template #cell-ip="{ row }">
        <IPCell
          :ip="(row as any).last_ip ?? '-'"
          :country-code="(row as any).last_country_code"
        />
      </template>

      <template #cell-country="{ row }">
        <div class="flex items-center gap-2">
          <CountryFlag :code="(row as any).last_country_code ?? ''" />
          <span class="text-sm text-text-secondary">{{ (row as any).last_country ?? '-' }}</span>
        </div>
      </template>

      <template #cell-status="{ row }">
        <div class="flex items-center gap-1.5">
          <StatusBadge
            v-if="(row as any).is_online"
            status="Online"
            variant="success"
          />
          <StatusBadge
            v-if="(row as any).is_whitelisted"
            status="Whitelist"
            variant="info"
          />
          <StatusBadge
            v-if="(row as any).is_blacklisted"
            status="Blacklist"
            variant="danger"
          />
        </div>
      </template>

      <template #cell-last_seen="{ row }">
        <span class="text-xs text-text-muted font-mono">
          {{ formatDate((row as any).last_seen) }}
        </span>
      </template>

      <template #cell-actions="{ row }">
        <button
          class="glass-button-secondary px-3 py-1.5 text-xs flex items-center gap-1.5 hover:text-white hover:border-purple-500 hover:bg-purple-500/20 transition-all duration-300"
          @click.stop="onRowClick(row as Record<string, unknown>)"
        >
          <Eye :size="14" />
          Ver
        </button>
      </template>
    </DataTable>

    <!-- Pagination -->
    <PaginationBar
      v-if="store.pagination"
      :current-page="store.pagination.current_page"
      :total-pages="store.pagination.total_pages"
      :total="store.pagination.total"
      @page-change="onPageChange"
    />
  </div>
</template>
