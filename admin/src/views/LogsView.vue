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
    auth: 'bg-blue-500/15 text-blue-400',
    player: 'bg-green-500/15 text-green-400',
    whitelist: 'bg-emerald-500/15 text-emerald-400',
    blacklist: 'bg-red-500/15 text-red-400',
    settings: 'bg-amber-500/15 text-amber-400',
    connection: 'bg-purple-500/15 text-purple-400',
  }
  return map[type] ?? 'bg-gray-500/15 text-gray-400'
}
</script>

<template>
  <div class="space-y-6">
    <!-- Page header -->
    <div>
      <h1 class="text-2xl font-display font-bold gradient-text">Logs de Actividad</h1>
      <p class="text-sm text-text-muted mt-1">Registro de todas las acciones realizadas en el panel</p>
    </div>

    <!-- Filters and search -->
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
      <span class="text-xs text-text-muted">
        {{ filteredLogs.length }} registro{{ filteredLogs.length !== 1 ? 's' : '' }}
      </span>
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
          class="inline-flex px-2 py-0.5 rounded text-xs font-semibold uppercase"
          :class="typeBadgeClass((row as any).type)"
        >
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
        <span class="text-xs text-text-muted font-mono">{{ (row as any).ip_address ?? '-' }}</span>
      </template>
    </DataTable>

    <!-- Pagination -->
    <div v-if="totalPages > 1" class="flex items-center justify-between">
      <span class="text-xs text-text-muted">
        Pagina {{ currentPage }} de {{ totalPages }}
      </span>
      <div class="flex items-center gap-2">
        <button
          class="px-3 py-1.5 rounded-lg text-sm text-text-muted hover:text-text-primary hover:bg-dark-600 transition-colors disabled:opacity-30"
          :disabled="currentPage <= 1"
          @click="onPageChange(currentPage - 1)"
        >
          Anterior
        </button>
        <button
          v-for="page in totalPages"
          :key="page"
          class="w-8 h-8 rounded-lg text-sm font-medium transition-colors"
          :class="page === currentPage
            ? 'bg-purple-500/20 text-purple-400'
            : 'text-text-muted hover:text-text-primary hover:bg-dark-600'"
          @click="onPageChange(page)"
        >
          {{ page }}
        </button>
        <button
          class="px-3 py-1.5 rounded-lg text-sm text-text-muted hover:text-text-primary hover:bg-dark-600 transition-colors disabled:opacity-30"
          :disabled="currentPage >= totalPages"
          @click="onPageChange(currentPage + 1)"
        >
          Siguiente
        </button>
      </div>
    </div>

    <!-- Error display -->
    <p v-if="store.error && !store.loading" class="text-red-400 text-sm text-center">
      {{ store.error }}
    </p>
  </div>
</template>
