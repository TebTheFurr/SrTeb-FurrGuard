<script setup lang="ts">
import { ref, onMounted } from 'vue'
import { useContinentsStore } from '@/stores/continents'
import SearchInput from '@/components/shared/SearchInput.vue'
import DataTable from '@/components/shared/DataTable.vue'
import ContinentModal from '@/components/modals/ContinentModal.vue'
import { Plus, ToggleLeft, ToggleRight, Pencil, Trash2 } from 'lucide-vue-next'
import type { Continent } from '@/types'

const store = useContinentsStore()

let currentSearch = ''

const showModal = ref(false)
const modalMode = ref<'add' | 'edit'>('add')
const editingEntry = ref<Continent | undefined>(undefined)

const columns = [
  { key: 'continent_code', label: 'Continente' },
  { key: 'kick_message', label: 'Mensaje de kick' },
  { key: 'block_count', label: 'Bloqueos' },
  { key: 'active', label: 'Estado' },
  { key: 'added_by', label: 'Añadido por' },
  { key: 'created_at', label: 'Fecha' },
  { key: 'actions', label: '' },
]

function fetchData() {
  store.fetch(currentSearch)
}

onMounted(fetchData)

function onSearchChange(search: string) {
  currentSearch = search
  fetchData()
}

function openAddModal() {
  modalMode.value = 'add'
  editingEntry.value = undefined
  showModal.value = true
}

function openEditModal(entry: Continent) {
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

async function toggleContinent(id: number, currentActive: number) {
  await store.toggle(id, !currentActive)
}

async function deleteContinent(id: number) {
  if (confirm('Desbloquear este continente?')) {
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
        <h1 class="text-2xl font-display font-bold gradient-text">Continentes bloqueados</h1>
        <p class="text-sm text-text-muted mt-1">Gestion de continentes bloqueados por geolocalizacion</p>
      </div>
      <button
        class="glass-button inline-flex items-center gap-2 px-4 py-2.5 text-sm"
        @click="openAddModal"
      >
        <Plus :size="16" />
        Bloquear continente
      </button>
    </div>

    <!-- Compact stats bar -->
    <div v-if="store.stats" class="glass-card p-3 flex items-center gap-6 overflow-x-auto">
      <div class="flex items-center gap-2.5 shrink-0">
        <div class="w-8 h-8 rounded-lg bg-purple-500/15 flex items-center justify-center">
          <svg xmlns="http://www.w3.org/2000/svg" :width="16" :height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round" class="text-purple-400"><circle cx="12" cy="12" r="10"/><path d="M12 2a14.5 14.5 0 0 0 0 20 14.5 14.5 0 0 0 0-20"/><path d="M2 12h20"/></svg>
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
          placeholder="Buscar continente..."
          @update:model-value="onSearchChange"
        />
      </div>
    </div>

    <!-- Continents table -->
    <DataTable
      :columns="columns"
      :rows="store.continents as unknown as Record<string, unknown>[]"
      :loading="store.loading"
      empty-message="No se encontraron continentes bloqueados"
      @row-click="() => {}"
    >
      <template #cell-continent_code="{ row }">
        <div class="flex items-center gap-2">
          <span class="text-sm text-text-primary font-medium">{{ (row as any).continent_name }}</span>
          <span class="text-xs text-text-muted font-mono">({{ (row as any).continent_code }})</span>
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
          @click.stop="toggleContinent((row as any).id, (row as any).active)"
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
            @click="openEditModal(row as unknown as Continent)"
          >
            <Pencil :size="14" />
          </button>
          <button
            class="p-1.5 rounded-lg hover:bg-hover text-text-muted hover:text-red-400 transition-colors"
            title="Desbloquear"
            @click="deleteContinent((row as any).id)"
          >
            <Trash2 :size="14" />
          </button>
        </div>
      </template>
    </DataTable>

    <!-- Continent modal -->
    <ContinentModal
      v-model="showModal"
      :mode="modalMode"
      :entry="editingEntry"
      @close="onModalClose"
      @submit="onModalSubmit"
    />
  </div>
</template>
