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
import { Gavel } from 'lucide-vue-next'

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
    uuid: 'bg-purple-500/15 text-purple-400 border-purple-500/20',
    nick: 'bg-blue-500/15 text-blue-400 border-blue-500/20',
    ip: 'bg-amber-500/15 text-amber-400 border-amber-500/20',
    asn: 'bg-pink-500/15 text-pink-400 border-pink-500/20',
    cidr: 'bg-cyan-500/15 text-cyan-400 border-cyan-500/20',
    ip_range: 'bg-cyan-500/15 text-cyan-400 border-cyan-500/20',
  }
  return map[type] ?? 'bg-gray-500/15 text-gray-400 border-gray-500/20'
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
  <div class="page-container">
    <!-- Page header -->
    <div class="section-header">
      <div class="flex items-center gap-3">
        <div class="flex items-center justify-center w-10 h-10 rounded-xl bg-amber-500/10 border border-amber-500/20">
          <Gavel :size="20" class="text-amber-400" />
        </div>
        <div>
          <h1 class="text-2xl font-display font-bold gradient-text">Sanciones</h1>
          <p class="text-sm text-text-muted mt-0.5">Historial completo de sanciones</p>
        </div>
      </div>
    </div>

    <!-- Stats cards -->
    <div v-if="store.stats" class="grid grid-cols-2 sm:grid-cols-3 lg:grid-cols-6 gap-3 stagger-children">
      <div class="glass-card-hover p-4">
        <StatCard title="Total" :value="store.stats.total" icon="Gavel" />
      </div>
      <div class="glass-card-hover p-4">
        <StatCard title="Activas" :value="store.stats.active" icon="CheckCircle" color="green" />
      </div>
      <div class="glass-card-hover p-4">
        <StatCard title="Permanentes" :value="store.stats.permanent" icon="Infinity" color="amber" />
      </div>
      <div class="glass-card-hover p-4">
        <StatCard title="Temporales" :value="store.stats.temporary" icon="Clock" color="blue" />
      </div>
      <div class="glass-card-hover p-4">
        <StatCard title="Expiradas" :value="store.stats.expired" icon="TimerOff" color="muted" />
      </div>
      <div class="glass-card-hover p-4">
        <StatCard title="Inactivas" :value="store.stats.inactive" icon="XCircle" color="red" />
      </div>
    </div>

    <!-- Filters and search -->
    <div class="glass-card p-4">
      <div class="flex flex-col sm:flex-row items-start sm:items-center gap-4">
        <FilterTabs
          :filters="SANCTION_FILTERS"
          :model-value="currentFilter"
          @update:model-value="onFilterChange"
        />
        <div class="w-full sm:w-72 sm:ml-auto">
          <SearchInput
            :model-value="currentSearch"
            placeholder="Buscar ban ID, valor, razon..."
            @update:model-value="onSearchChange"
          />
        </div>
      </div>
    </div>

    <!-- Sanctions table -->
    <div class="glass-card overflow-hidden">
      <DataTable
        :columns="columns"
        :rows="store.sanctions as unknown as Record<string, unknown>[]"
        :loading="store.sanctionsLoading"
        empty-message="No se encontraron sanciones"
        @row-click="() => {}"
      >
        <template #cell-ban_id="{ row }">
          <span class="inline-flex items-center px-2 py-0.5 rounded-md text-xs text-text-muted font-mono bg-dark-700/50 border border-glass-border-subtle">
            {{ (row as any).ban_id }}
          </span>
        </template>

        <template #cell-type="{ row }">
          <span
            class="inline-flex px-2.5 py-1 rounded-md text-xs font-bold uppercase tracking-wider border"
            :class="typeBadgeClass((row as any).type)"
          >
            {{ typeLabel((row as any).type) }}
          </span>
        </template>

        <template #cell-value="{ row }">
          <div>
            <span class="text-sm text-text-primary font-mono font-medium">{{ (row as any).value }}</span>
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
          <span v-if="!(row as any).expires_at" class="text-xs text-red-400 font-semibold">Permanente</span>
          <span v-else class="text-xs text-text-muted font-mono">{{ formatDate((row as any).expires_at) }}</span>
        </template>

        <template #cell-created_at="{ row }">
          <span class="text-xs text-text-muted font-mono">{{ formatDate((row as any).created_at) }}</span>
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
  </div>
</template>
