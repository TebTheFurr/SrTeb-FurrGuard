<script setup lang="ts">
import { ref, computed, onMounted } from 'vue'
import { useLogsStore } from '@/stores/logs'
import { LOG_TYPES } from '@/lib/constants'
import SearchInput from '@/components/shared/SearchInput.vue'
import FilterTabs from '@/components/shared/FilterTabs.vue'
import DataTable from '@/components/shared/DataTable.vue'
import LoadingSkeleton from '@/components/shared/LoadingSkeleton.vue'

const store = useLogsStore()

let currentFilter = 'all'
const currentSearch = ref('')

const PER_PAGE = 20
const currentPage = ref(1)

const columns = [
  { key: 'created_at', label: 'Fecha' },
  { key: 'type', label: 'Tipo' },
  { key: 'action', label: 'Accion' },
  { key: 'details', label: 'Detalles' },
  { key: 'ip_address', label: 'IP' },
]

const filteredLogs = computed(() => {
  let result = store.logs

  if (currentSearch.value) {
    const q = currentSearch.value.toLowerCase()
    result = result.filter(
      (log) =>
        log.action?.toLowerCase().includes(q) ||
        log.details?.toLowerCase().includes(q) ||
        log.type?.toLowerCase().includes(q),
    )
  }

  return result
})

const paginatedLogs = computed(() => {
  const start = (currentPage.value - 1) * PER_PAGE
  return filteredLogs.value.slice(start, start + PER_PAGE)
})

const totalPages = computed(() => Math.ceil(filteredLogs.value.length / PER_PAGE))

function fetchData() {
  store.fetch(currentFilter)
}

onMounted(fetchData)

function onFilterChange(filter: string) {
  currentFilter = filter
  currentPage.value = 1
  fetchData()
}

function onSearchChange(search: string) {
  currentSearch.value = search
  currentPage.value = 1
}

function onPageChange(page: number) {
  currentPage.value = page
}

function formatDate(dateStr: string): string {
  if (!dateStr) return '-'
  return new Date(dateStr).toLocaleString('es-ES', {
    day: '2-digit',
    month: '2-digit',
    year: 'numeric',
    hour: '2-digit',
    minute: '2-digit',
    second: '2-digit',
  })
}

function typeBadgeClass(type: string): string {
  const map: Record<string, string> = {
    auth: 'bg-blue-500/15 text-blue-400 border-blue-500/20',
    player: 'bg-green-500/15 text-green-400 border-green-500/20',
    whitelist: 'bg-emerald-500/15 text-emerald-400 border-emerald-500/20',
    blacklist: 'bg-red-500/15 text-red-400 border-red-500/20',
    settings: 'bg-amber-500/15 text-amber-400 border-amber-500/20',
    connection: 'bg-purple-500/15 text-purple-400 border-purple-500/20',
  }
  return map[type] ?? 'bg-gray-500/15 text-gray-400 border-gray-500/20'
}

function typeIcon(type: string): string {
  const map: Record<string, string> = {
    auth: '\u{1F511}',
    player: '\u{1F3AE}',
    whitelist: '\u{2705}',
    blacklist: '\u{1F6AB}',
    settings: '\u{2699}\u{FE0F}',
    connection: '\u{1F310}',
  }
  return map[type] ?? '\u{1F4CB}'
}
</script>

<template>
  <div class="page-container">
    <!-- Page header -->
    <div class="section-header">
      <div>
        <h1 class="text-2xl font-display font-bold gradient-text">Logs de Actividad</h1>
        <p class="text-sm text-text-muted mt-1">Registro de todas las acciones realizadas en el panel</p>
      </div>
    </div>

    <!-- Filters and search -->
    <div class="glass-card p-4">
      <div class="flex flex-col sm:flex-row items-start sm:items-center gap-4">
        <FilterTabs
          :filters="LOG_TYPES"
          :model-value="currentFilter"
          @update:model-value="onFilterChange"
        />
        <div class="w-full sm:w-72">
          <SearchInput
            :model-value="currentSearch"
            placeholder="Buscar en logs..."
            @update:model-value="onSearchChange"
          />
        </div>
        <span class="text-xs text-text-muted ml-auto whitespace-nowrap">
          {{ filteredLogs.length }} registro{{ filteredLogs.length !== 1 ? 's' : '' }}
        </span>
      </div>
    </div>

    <!-- Logs table -->
    <DataTable
      :columns="columns"
      :rows="paginatedLogs as unknown as Record<string, unknown>[]"
      :loading="store.loading"
      empty-message="No se encontraron logs"
      @row-click="() => {}"
    >
      <template #cell-created_at="{ row }">
        <span class="text-xs text-text-muted font-mono whitespace-nowrap">{{ formatDate((row as any).created_at) }}</span>
      </template>

      <template #cell-type="{ row }">
        <span
          class="inline-flex items-center gap-1.5 px-2.5 py-1 rounded-lg text-xs font-semibold uppercase border"
          :class="typeBadgeClass((row as any).type)"
        >
          <span class="text-[10px]">{{ typeIcon((row as any).type) }}</span>
          {{ (row as any).type }}
        </span>
      </template>

      <template #cell-action="{ row }">
        <span class="text-sm text-text-primary font-medium">{{ (row as any).action }}</span>
      </template>

      <template #cell-details="{ row }">
        <span class="text-sm text-text-secondary line-clamp-2">{{ (row as any).details ?? '-' }}</span>
      </template>

      <template #cell-ip_address="{ row }">
        <span class="text-xs text-text-muted font-mono bg-dark-800/60 px-2 py-0.5 rounded-md">{{ (row as any).ip_address ?? '-' }}</span>
      </template>
    </DataTable>

    <!-- Pagination -->
    <div v-if="totalPages > 1" class="glass-card p-4">
      <div class="flex items-center justify-between">
        <span class="text-xs text-text-muted">
          Pagina {{ currentPage }} de {{ totalPages }}
        </span>
        <div class="flex items-center gap-1">
          <button
            class="glass-button-secondary px-3 py-1.5 text-sm disabled:opacity-30 hover:text-text-primary"
            :disabled="currentPage <= 1"
            @click="onPageChange(currentPage - 1)"
          >
            Anterior
          </button>
          <div class="flex items-center gap-1 mx-1">
            <button
              v-for="page in totalPages"
              :key="page"
              class="w-8 h-8 rounded-lg text-sm font-medium transition-all duration-200"
              :class="page === currentPage
                ? 'gradient-primary text-white shadow-[0_0_12px_rgba(139,92,246,0.3)]'
                : 'text-text-muted hover:text-text-primary hover:bg-hover'"
              @click="onPageChange(page)"
            >
              {{ page }}
            </button>
          </div>
          <button
            class="glass-button-secondary px-3 py-1.5 text-sm disabled:opacity-30 hover:text-text-primary"
            :disabled="currentPage >= totalPages"
            @click="onPageChange(currentPage + 1)"
          >
            Siguiente
          </button>
        </div>
      </div>
    </div>

    <!-- Error display -->
    <p v-if="store.error && !store.loading" class="text-red-400 text-sm text-center py-2">
      {{ store.error }}
    </p>
  </div>
</template>
