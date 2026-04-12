<script setup lang="ts">
import { ref, onMounted } from 'vue'
import { useBlacklistStore } from '@/stores/blacklist'
import { SANCTION_FILTERS } from '@/lib/constants'
import StatCard from '@/components/shared/StatCard.vue'
import FilterTabs from '@/components/shared/FilterTabs.vue'
import SearchInput from '@/components/shared/SearchInput.vue'
import DataTable from '@/components/shared/DataTable.vue'
import PaginationBar from '@/components/shared/PaginationBar.vue'
import StatusBadge from '@/components/shared/StatusBadge.vue'

const store = useBlacklistStore()

let currentPage = 1
let currentFilter = 'all'
let currentSearch = ''

const columns = [
  { key: 'ban_id', label: 'Ban ID' },
  { key: 'type', label: 'Tipo' },
  { key: 'value', label: 'Valor' },
  { key: 'reason', label: 'Razon' },
  { key: 'status', label: 'Estado' },
  { key: 'expires_at', label: 'Expira' },
  { key: 'created_at', label: 'Fecha' },
]

onMounted(() => store.fetchSanctions())

function fetchData() {
  store.fetchSanctions(currentPage, currentFilter, currentSearch)
}

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

function formatDate(dateStr: string | null): string {
  if (!dateStr) return '-'
  return new Date(dateStr).toLocaleString('es-ES', {
    day: '2-digit',
    month: '2-digit',
    year: 'numeric',
    hour: '2-digit',
    minute: '2-digit',
  })
}

function getSanctionStatus(entry: Record<string, unknown>): { label: string; variant: 'success' | 'warning' | 'danger' | 'info' | 'neutral' } {
  const active = entry.active as number
  const expiresAt = entry.expires_at as string | null

  if (!active) return { label: 'Inactiva', variant: 'danger' }
  if (!expiresAt) return { label: 'Permanente', variant: 'warning' }

  const expired = new Date(expiresAt).getTime() < Date.now()
  if (expired) return { label: 'Expirada', variant: 'neutral' }
  return { label: 'Activa', variant: 'success' }
}

function typeBadgeClass(type: string): string {
  const map: Record<string, string> = {
    uuid: 'bg-purple-500/15 text-purple-400',
    nick: 'bg-blue-500/15 text-blue-400',
    ip: 'bg-amber-500/15 text-amber-400',
    asn: 'bg-pink-500/15 text-pink-400',
    cidr: 'bg-cyan-500/15 text-cyan-400',
    ip_range: 'bg-cyan-500/15 text-cyan-400',
  }
  return map[type] ?? 'bg-gray-500/15 text-gray-400'
}

function typeLabel(type: string): string {
  const found = [
    { id: 'uuid', label: 'UUID' },
    { id: 'nick', label: 'Nickname' },
    { id: 'ip', label: 'IP' },
    { id: 'asn', label: 'ASN' },
    { id: 'cidr', label: 'CIDR' },
    { id: 'ip_range', label: 'Rango IP' },
  ].find(t => t.id === type)
  return found ? found.label : type
}
</script>

<template>
  <div class="space-y-6">
    <!-- Page header -->
    <div>
      <h1 class="text-2xl font-display font-bold gradient-text">Sanciones</h1>
      <p class="text-sm text-text-muted mt-1">Historial completo de sanciones</p>
    </div>

    <!-- Stats cards -->
    <div v-if="store.stats" class="grid grid-cols-2 sm:grid-cols-3 lg:grid-cols-6 gap-3">
      <StatCard title="Total" :value="store.stats.total" icon="Gavel" />
      <StatCard title="Activas" :value="store.stats.active" icon="CheckCircle" color="green" />
      <StatCard title="Permanentes" :value="store.stats.permanent" icon="Infinity" color="amber" />
      <StatCard title="Temporales" :value="store.stats.temporary" icon="Clock" color="blue" />
      <StatCard title="Expiradas" :value="store.stats.expired" icon="TimerOff" color="muted" />
      <StatCard title="Inactivas" :value="store.stats.inactive" icon="XCircle" color="red" />
    </div>

    <!-- Filters and search -->
    <div class="flex flex-col sm:flex-row items-start sm:items-center gap-4">
      <FilterTabs
        :filters="SANCTION_FILTERS"
        :model-value="currentFilter"
        @update:model-value="onFilterChange"
      />
      <div class="w-full sm:w-72">
        <SearchInput
          :model-value="currentSearch"
          placeholder="Buscar ban ID, valor, razon..."
          @update:model-value="onSearchChange"
        />
      </div>
    </div>

    <!-- Sanctions table -->
    <DataTable
      :columns="columns"
      :rows="store.sanctions as unknown as Record<string, unknown>[]"
      :loading="store.sanctionsLoading"
      empty-message="No se encontraron sanciones"
      @row-click="() => {}"
    >
      <template #cell-ban_id="{ row }">
        <span class="text-xs text-text-muted font-mono">{{ (row as any).ban_id }}</span>
      </template>

      <template #cell-type="{ row }">
        <span
          class="inline-flex px-2 py-0.5 rounded text-xs font-semibold uppercase"
          :class="typeBadgeClass((row as any).type)"
        >
          {{ typeLabel((row as any).type) }}
        </span>
      </template>

      <template #cell-value="{ row }">
        <div>
          <span class="text-sm text-text-primary font-mono">{{ (row as any).value }}</span>
          <span v-if="(row as any).minecraft_name" class="text-xs text-text-muted ml-2">
            ({{ (row as any).minecraft_name }})
          </span>
        </div>
      </template>

      <template #cell-reason="{ row }">
        <span class="text-sm text-text-secondary line-clamp-2">{{ (row as any).reason || '-' }}</span>
      </template>

      <template #cell-status="{ row }">
        <StatusBadge
          :status="getSanctionStatus(row).label"
          :variant="getSanctionStatus(row).variant"
        />
      </template>

      <template #cell-expires_at="{ row }">
        <span v-if="!(row as any).expires_at" class="text-xs text-red-400 font-medium">Permanente</span>
        <span v-else class="text-xs text-text-muted font-mono">{{ formatDate((row as any).expires_at) }}</span>
      </template>

      <template #cell-created_at="{ row }">
        <span class="text-xs text-text-muted font-mono">{{ formatDate((row as any).created_at) }}</span>
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
