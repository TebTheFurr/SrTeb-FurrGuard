<script setup lang="ts">
import { ref, onMounted } from 'vue'
import { useProvidersStore } from '@/stores/providers'
import { PROVIDER_TYPE_FILTERS } from '@/lib/constants'
import SearchInput from '@/components/shared/SearchInput.vue'
import FilterTabs from '@/components/shared/FilterTabs.vue'
import DataTable from '@/components/shared/DataTable.vue'
import PaginationBar from '@/components/shared/PaginationBar.vue'
import StatCard from '@/components/shared/StatCard.vue'
import ProviderModal from '@/components/modals/ProviderModal.vue'
import { Plus, ToggleLeft, ToggleRight } from 'lucide-vue-next'

const store = useProvidersStore()

let currentPage = 1
let currentFilter = 'all'
let currentSearch = ''

const showModal = ref(false)

const columns = [
  { key: 'name', label: 'Nombre' },
  { key: 'pattern', label: 'Patron' },
  { key: 'type', label: 'Tipo' },
  { key: 'block_count', label: 'Bloqueos' },
  { key: 'active', label: 'Estado' },
  { key: 'added_by', label: 'Añadido por' },
  { key: 'created_at', label: 'Fecha' },
]

function fetchData() {
  store.fetch(currentPage, currentFilter, currentSearch)
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

function openAddModal() {
  showModal.value = true
}

function onModalClose() {
  showModal.value = false
}

async function onModalSubmit() {
  showModal.value = false
}

async function toggleProvider(id: number, currentActive: number) {
  await store.toggle(id, !currentActive)
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

function typeBadgeClass(type: string): string {
  const map: Record<string, string> = {
    vpn: 'bg-red-500/15 text-red-400',
    proxy: 'bg-amber-500/15 text-amber-400',
    hosting: 'bg-pink-500/15 text-pink-400',
  }
  return map[type] ?? 'bg-gray-500/15 text-gray-400'
}

function typeLabel(type: string): string {
  const map: Record<string, string> = {
    vpn: 'VPN',
    proxy: 'Proxy',
    hosting: 'Hosting',
  }
  return map[type] ?? type
}
</script>

<template>
  <div class="space-y-6">
    <!-- Section header -->
    <div class="section-header">
      <div>
        <h1 class="text-2xl font-display font-bold gradient-text">Proveedores VPN</h1>
        <p class="text-sm text-text-muted mt-1">Proveedores de VPN, proxy y hosting bloqueados</p>
      </div>
      <button
        class="glass-button inline-flex items-center gap-2 px-4 py-2.5 text-sm"
        @click="openAddModal"
      >
        <Plus :size="16" />
        Añadir proveedor
      </button>
    </div>

    <!-- Compact stats bar -->
    <div v-if="store.stats" class="glass-card p-3 flex items-center gap-6 overflow-x-auto">
      <div class="flex items-center gap-2.5 shrink-0">
        <div class="w-8 h-8 rounded-lg bg-pink-500/15 flex items-center justify-center">
          <svg xmlns="http://www.w3.org/2000/svg" :width="16" :height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round" class="text-pink-400"><rect width="20" height="8" x="2" y="2" rx="2" ry="2"/><rect width="20" height="8" x="2" y="14" rx="2" ry="2"/><line x1="6" x2="6.01" y1="6" y2="6"/><line x1="6" x2="6.01" y1="18" y2="18"/></svg>
        </div>
        <div>
          <div class="text-xs text-text-muted">Hosting</div>
          <div class="text-lg font-display font-bold text-text-primary leading-tight">{{ store.stats.hosting }}</div>
        </div>
      </div>
      <div class="w-px h-8 bg-glass-border-subtle shrink-0"></div>
      <div class="flex items-center gap-2.5 shrink-0">
        <div class="w-8 h-8 rounded-lg bg-red-500/15 flex items-center justify-center">
          <svg xmlns="http://www.w3.org/2000/svg" :width="16" :height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round" class="text-red-400"><path d="M20 13c0 5-3.5 7.5-7.66 8.95a1 1 0 0 1-.67-.01C7.5 20.5 4 18 4 13V6a1 1 0 0 1 1-1c2 0 4.5-1.2 6.24-2.72a1.17 1.17 0 0 1 1.52 0C14.51 3.81 17 5 19 5a1 1 0 0 1 1 1z"/></svg>
        </div>
        <div>
          <div class="text-xs text-text-muted">VPN</div>
          <div class="text-lg font-display font-bold text-text-primary leading-tight">{{ store.stats.vpn }}</div>
        </div>
      </div>
      <div class="w-px h-8 bg-glass-border-subtle shrink-0"></div>
      <div class="flex items-center gap-2.5 shrink-0">
        <div class="w-8 h-8 rounded-lg bg-amber-500/15 flex items-center justify-center">
          <svg xmlns="http://www.w3.org/2000/svg" :width="16" :height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round" class="text-amber-400"><path d="M20 13c0 5-3.5 7.5-7.66 8.95a1 1 0 0 1-.67-.01C7.5 20.5 4 18 4 13V6a1 1 0 0 1 1-1c2 0 4.5-1.2 6.24-2.72a1.17 1.17 0 0 1 1.52 0C14.51 3.81 17 5 19 5a1 1 0 0 1 1 1z"/><path d="m9.1 13 2.9-2.9 2.9 2.9"/></svg>
        </div>
        <div>
          <div class="text-xs text-text-muted">Proxy</div>
          <div class="text-lg font-display font-bold text-text-primary leading-tight">{{ store.stats.proxy }}</div>
        </div>
      </div>
    </div>

    <!-- Filters and search -->
    <div class="glass-card p-3 flex flex-col sm:flex-row items-start sm:items-center gap-3">
      <FilterTabs
        :filters="PROVIDER_TYPE_FILTERS"
        :model-value="currentFilter"
        @update:model-value="onFilterChange"
      />
      <div class="w-full sm:w-72 sm:ml-auto">
        <SearchInput
          :model-value="currentSearch"
          placeholder="Buscar proveedor..."
          @update:model-value="onSearchChange"
        />
      </div>
    </div>

    <!-- Providers table -->
    <DataTable
      :columns="columns"
      :rows="store.providers as unknown as Record<string, unknown>[]"
      :loading="store.loading"
      empty-message="No se encontraron proveedores"
      @row-click="() => {}"
    >
      <template #cell-name="{ row }">
        <span class="text-sm text-text-primary font-medium">{{ (row as any).name }}</span>
      </template>

      <template #cell-pattern="{ row }">
        <span class="text-sm text-text-secondary font-mono">{{ (row as any).pattern }}</span>
      </template>

      <template #cell-type="{ row }">
        <span
          class="inline-flex px-2 py-0.5 rounded text-xs font-semibold uppercase"
          :class="typeBadgeClass((row as any).type)"
        >
          {{ typeLabel((row as any).type) }}
        </span>
      </template>

      <template #cell-block_count="{ row }">
        <span class="text-sm text-text-secondary font-mono">{{ (row as any).block_count ?? 0 }}</span>
      </template>

      <template #cell-active="{ row }">
        <button
          class="p-1 rounded transition-colors"
          :class="(row as any).active ? 'text-green-400 hover:text-green-300' : 'text-red-400 hover:text-red-300'"
          :title="(row as any).active ? 'Desactivar' : 'Activar'"
          @click.stop="toggleProvider((row as any).id, (row as any).active)"
        >
          <ToggleRight v-if="(row as any).active" :size="20" />
          <ToggleLeft v-else :size="20" />
        </button>
      </template>

      <template #cell-added_by="{ row }">
        <span class="text-sm text-text-secondary">{{ (row as any).added_by }}</span>
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

    <!-- Provider modal -->
    <ProviderModal
      v-model="showModal"
      @close="onModalClose"
      @submit="onModalSubmit"
    />
  </div>
</template>
