<script setup lang="ts">
import { ref, onMounted } from 'vue'
import { useConnectionsStore } from '@/stores/connections'
import { CONNECTION_FILTERS } from '@/lib/constants'
import FilterTabs from '@/components/shared/FilterTabs.vue'
import SearchInput from '@/components/shared/SearchInput.vue'
import DataTable from '@/components/shared/DataTable.vue'
import PaginationBar from '@/components/shared/PaginationBar.vue'
import PlayerCell from '@/components/shared/PlayerCell.vue'
import IPCell from '@/components/shared/IPCell.vue'
import StatusBadge from '@/components/shared/StatusBadge.vue'
import ConnectionModal from '@/components/modals/ConnectionModal.vue'
import { Activity } from 'lucide-vue-next'

const store = useConnectionsStore()

let currentPage = 1
let currentFilter = 'all'
let currentSearch = ''

const showDetailModal = ref(false)
const selectedConnectionId = ref<number | null>(null)

const columns = [
  { key: 'nick', label: 'Jugador' },
  { key: 'ip', label: 'IP' },
  { key: 'status', label: 'Estado' },
  { key: 'flags', label: 'Flags' },
  { key: 'created_at', label: 'Fecha' },
]

function fetchData() {
  store.fetchConnections(currentPage, currentFilter, currentSearch)
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
  selectedConnectionId.value = (row as any).id as number
  showDetailModal.value = true
}

function onModalClose() {
  showDetailModal.value = false
  selectedConnectionId.value = null
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
  <div class="page-container">
    <!-- Page header -->
    <div class="section-header">
      <div class="flex items-center gap-3">
        <div class="flex items-center justify-center w-10 h-10 rounded-xl bg-purple-500/10 border border-purple-500/20">
          <Activity :size="20" class="text-purple-400" />
        </div>
        <div>
          <h1 class="text-2xl font-display font-bold gradient-text">Conexiones</h1>
          <p class="text-sm text-text-muted mt-0.5">Historial de conexiones al servidor</p>
        </div>
      </div>
    </div>

    <!-- Filters and search -->
    <div class="glass-card p-4">
      <div class="flex flex-col sm:flex-row items-start sm:items-center gap-4">
        <FilterTabs
          :filters="CONNECTION_FILTERS"
          :model-value="currentFilter"
          @update:model-value="onFilterChange"
        />
        <div class="w-full sm:w-72 sm:ml-auto">
          <SearchInput
            :model-value="currentSearch"
            placeholder="Buscar jugador, UUID, IP..."
            @update:model-value="onSearchChange"
          />
        </div>
      </div>
    </div>

    <!-- Connections table -->
    <div class="glass-card overflow-hidden">
      <DataTable
        :columns="columns"
        :rows="store.connections as unknown as Record<string, unknown>[]"
        :loading="store.loading"
        empty-message="No se encontraron conexiones"
        @row-click="onRowClick"
      >
        <template #cell-nick="{ row }">
          <PlayerCell :uuid="(row as any).uuid" :nick="(row as any).nick" />
        </template>

        <template #cell-ip="{ row }">
          <IPCell
            :ip="(row as any).ip"
            :country-code="(row as any).country_code"
            :isp="(row as any).isp"
          />
        </template>

        <template #cell-status="{ row }">
          <StatusBadge
            :status="(row as any).blocked ? 'Bloqueado' : 'Permitido'"
            :variant="(row as any).blocked ? 'danger' : 'success'"
          />
        </template>

        <template #cell-flags="{ row }">
          <div class="flex items-center gap-1.5">
            <span
              v-if="(row as any).is_proxy"
              class="inline-flex px-2 py-0.5 rounded-md text-[10px] font-bold uppercase tracking-wider bg-amber-500/15 text-amber-400 border border-amber-500/20"
            >
              Proxy
            </span>
            <span
              v-if="(row as any).is_vpn"
              class="inline-flex px-2 py-0.5 rounded-md text-[10px] font-bold uppercase tracking-wider bg-red-500/15 text-red-400 border border-red-500/20"
            >
              VPN
            </span>
            <span
              v-if="(row as any).is_hosting"
              class="inline-flex px-2 py-0.5 rounded-md text-[10px] font-bold uppercase tracking-wider bg-pink-500/15 text-pink-400 border border-pink-500/20"
            >
              Hosting
            </span>
            <span
              v-if="!(row as any).is_proxy && !(row as any).is_vpn && !(row as any).is_hosting"
              class="text-text-tertiary text-xs"
            >
              -
            </span>
          </div>
        </template>

        <template #cell-created_at="{ row }">
          <span class="text-xs text-text-muted font-mono">
            {{ formatDate((row as any).created_at) }}
          </span>
        </template>
      </DataTable>
    </div>

    <!-- Pagination -->
    <PaginationBar
      v-if="store.pagination"
      :current-page="store.pagination.current_page"
      :total-pages="store.pagination.total_pages"
      :total="store.pagination.total"
      @page-change="onPageChange"
    />

    <!-- Connection detail modal -->
    <ConnectionModal
      v-model="showDetailModal"
      :connection-id="selectedConnectionId"
      @close="onModalClose"
    />
  </div>
</template>
