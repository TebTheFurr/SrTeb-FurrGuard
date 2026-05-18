<script setup lang="ts">
import { ref, onMounted } from 'vue'
import { useCountriesStore } from '@/stores/countries'
import SearchInput from '@/components/shared/SearchInput.vue'
import DataTable from '@/components/shared/DataTable.vue'
import PaginationBar from '@/components/shared/PaginationBar.vue'
import CountryFlag from '@/components/shared/CountryFlag.vue'
import CountryModal from '@/components/modals/CountryModal.vue'
import { Plus, ToggleLeft, ToggleRight, Pencil, Trash2 } from 'lucide-vue-next'
import type { Country } from '@/types'

const store = useCountriesStore()

let currentPage = 1
let currentSearch = ''

const showModal = ref(false)
const modalMode = ref<'add' | 'edit'>('add')
const editingEntry = ref<Country | undefined>(undefined)

const columns = [
  { key: 'country_code', label: 'Pais' },
  { key: 'kick_message', label: 'Mensaje de kick' },
  { key: 'block_count', label: 'Bloqueos' },
  { key: 'active', label: 'Estado' },
  { key: 'added_by', label: 'Añadido por' },
  { key: 'created_at', label: 'Fecha' },
  { key: 'actions', label: '' },
]

function fetchData() {
  store.fetch(currentPage, currentSearch)
}

onMounted(fetchData)

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
  modalMode.value = 'add'
  editingEntry.value = undefined
  showModal.value = true
}

function openEditModal(entry: Country) {
  modalMode.value = 'edit'
  editingEntry.value = entry
  showModal.value = true
}

function onModalClose() {
  showModal.value = false
}

async function onModalSubmit() {
  showModal.value = false
}

async function toggleCountry(id: number, currentActive: number) {
  await store.toggle(id, !currentActive)
}

async function deleteCountry(id: number) {
  if (confirm('¿Desbloquear este pais?')) {
    await store.remove(id)
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
  <div class="space-y-6">
    <!-- Section header -->
    <div class="section-header">
      <div>
        <h1 class="text-2xl font-display font-bold gradient-text">Paises bloqueados</h1>
        <p class="text-sm text-text-muted mt-1">Gestion de paises bloqueados por geolocalizacion</p>
      </div>
      <button
        class="glass-button inline-flex items-center gap-2 px-4 py-2.5 text-sm"
        @click="openAddModal"
      >
        <Plus :size="16" />
        Bloquear pais
      </button>
    </div>

    <!-- Compact stats bar -->
    <div v-if="store.stats" class="glass-card p-3 flex items-center gap-6 overflow-x-auto">
      <div class="flex items-center gap-2.5 shrink-0">
        <div class="w-8 h-8 rounded-lg bg-purple-500/15 flex items-center justify-center">
          <svg xmlns="http://www.w3.org/2000/svg" :width="16" :height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round" class="text-purple-400"><path d="M20 10c0 6-8 12-8 12s-8-6-8-12a8 8 0 0 1 16 0Z"/><circle cx="12" cy="10" r="3"/></svg>
        </div>
        <div>
          <div class="text-xs text-text-muted">Total bloqueados</div>
          <div class="text-lg font-display font-bold text-text-primary leading-tight">{{ store.stats.total }}</div>
        </div>
      </div>
      <div class="w-px h-8 bg-glass-border-subtle shrink-0"></div>
      <div class="flex items-center gap-2.5 shrink-0">
        <div class="w-8 h-8 rounded-lg bg-success-dim flex items-center justify-center">
          <svg xmlns="http://www.w3.org/2000/svg" :width="16" :height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round" class="text-green-400"><path d="M22 11.08V12a10 10 0 1 1-5.93-9.14"/><path d="m9 11 3 3L22 4"/></svg>
        </div>
        <div>
          <div class="text-xs text-text-muted">Activos</div>
          <div class="text-lg font-display font-bold text-text-primary leading-tight">{{ store.stats.active }}</div>
        </div>
      </div>
      <div class="w-px h-8 bg-glass-border-subtle shrink-0"></div>
      <div class="flex items-center gap-2.5 shrink-0">
        <div class="w-8 h-8 rounded-lg bg-error-dim flex items-center justify-center">
          <svg xmlns="http://www.w3.org/2000/svg" :width="16" :height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round" class="text-red-400"><path d="M20 13c0 5-3.5 7.5-7.66 8.95a1 1 0 0 1-.67-.01C7.5 20.5 4 18 4 13V6a1 1 0 0 1 1-1c2 0 4.5-1.2 6.24-2.72a1.17 1.17 0 0 1 1.52 0C14.51 3.81 17 5 19 5a1 1 0 0 1 1 1z"/></svg>
        </div>
        <div>
          <div class="text-xs text-text-muted">Bloqueos totales</div>
          <div class="text-lg font-display font-bold text-text-primary leading-tight">{{ store.stats.total_blocks }}</div>
        </div>
      </div>
    </div>

    <!-- Search bar -->
    <div class="glass-card p-3 flex items-center gap-3">
      <div class="w-full sm:w-72">
        <SearchInput
          :model-value="currentSearch"
          placeholder="Buscar pais..."
          @update:model-value="onSearchChange"
        />
      </div>
    </div>

    <!-- Countries table -->
    <DataTable
      :columns="columns"
      :rows="store.countries as unknown as Record<string, unknown>[]"
      :loading="store.loading"
      empty-message="No se encontraron paises bloqueados"
      @row-click="() => {}"
    >
      <template #cell-country_code="{ row }">
        <div class="flex items-center gap-2">
          <CountryFlag :code="(row as any).country_code" />
          <span class="text-sm text-text-primary font-medium">{{ (row as any).country_name }}</span>
          <span class="text-xs text-text-muted font-mono">({{ (row as any).country_code }})</span>
        </div>
      </template>

      <template #cell-kick_message="{ row }">
        <span class="text-sm text-text-secondary truncate max-w-xs block">
          {{ (row as any).kick_message || '-' }}
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
          @click.stop="toggleCountry((row as any).id, (row as any).active)"
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

      <template #cell-actions="{ row }">
        <div class="flex items-center gap-1" @click.stop>
          <button
            class="p-1.5 rounded-lg hover:bg-hover text-text-muted hover:text-blue-400 transition-colors"
            title="Editar"
            @click="openEditModal(row as unknown as Country)"
          >
            <Pencil :size="14" />
          </button>
          <button
            class="p-1.5 rounded-lg hover:bg-hover text-text-muted hover:text-red-400 transition-colors"
            title="Desbloquear"
            @click="deleteCountry((row as any).id)"
          >
            <Trash2 :size="14" />
          </button>
        </div>
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

    <!-- Country modal -->
    <CountryModal
      v-model="showModal"
      :mode="modalMode"
      :entry="editingEntry"
      @close="onModalClose"
      @submit="onModalSubmit"
    />
  </div>
</template>
