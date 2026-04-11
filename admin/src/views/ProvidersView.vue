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
    <!-- Page header -->
    <div class="flex flex-col sm:flex-row items-start sm:items-center justify-between gap-4">
      <div>
        <h1 class="text-2xl font-display font-bold gradient-text">Proveedores VPN</h1>
        <p class="text-sm text-text-muted mt-1">Proveedores de VPN, proxy y hosting bloqueados</p>
      </div>
      <button
        class="inline-flex items-center gap-2 px-4 py-2 rounded-lg bg-purple-500 hover:bg-purple-600 text-white text-sm font-medium transition-colors"
        @click="openAddModal"
      >
        <Plus :size="16" />
        Añadir proveedor
      </button>
    </div>

    <!-- Stats cards -->
    <div v-if="store.stats" class="grid grid-cols-3 gap-3">
      <StatCard label="Hosting" :value="store.stats.hosting" icon="Server" color="pink" />
      <StatCard label="VPN" :value="store.stats.vpn" icon="ShieldAlert" color="red" />
      <StatCard label="Proxy" :value="store.stats.proxy" icon="ShieldOff" color="amber" />
    </div>

    <!-- Filters and search -->
    <div class="flex flex-col sm:flex-row items-start sm:items-center gap-4">
      <FilterTabs
        :filters="PROVIDER_TYPE_FILTERS"
        :model-value="currentFilter"
        @update:model-value="onFilterChange"
      />
      <div class="w-full sm:w-72">
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
