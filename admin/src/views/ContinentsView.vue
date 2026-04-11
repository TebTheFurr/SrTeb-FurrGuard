<script setup lang="ts">
import { ref, onMounted } from 'vue'
import { useContinentsStore } from '@/stores/continents'
import SearchInput from '@/components/shared/SearchInput.vue'
import DataTable from '@/components/shared/DataTable.vue'
import StatCard from '@/components/shared/StatCard.vue'
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
    <!-- Page header -->
    <div class="flex flex-col sm:flex-row items-start sm:items-center justify-between gap-4">
      <div>
        <h1 class="text-2xl font-display font-bold gradient-text">Continentes bloqueados</h1>
        <p class="text-sm text-text-muted mt-1">Gestion de continentes bloqueados por geolocalizacion</p>
      </div>
      <button
        class="inline-flex items-center gap-2 px-4 py-2 rounded-lg bg-purple-500 hover:bg-purple-600 text-white text-sm font-medium transition-colors"
        @click="openAddModal"
      >
        <Plus :size="16" />
        Bloquear continente
      </button>
    </div>

    <!-- Stats cards -->
    <div v-if="store.stats" class="grid grid-cols-3 gap-3">
      <StatCard label="Total bloqueados" :value="store.stats.total" icon="Globe2" color="purple" />
      <StatCard label="Activos" :value="store.stats.active" icon="CheckCircle" color="green" />
      <StatCard label="Bloqueos totales" :value="store.stats.total_blocks" icon="ShieldAlert" color="red" />
    </div>

    <!-- Search -->
    <div class="flex flex-col sm:flex-row items-start sm:items-center gap-4">
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
        <div class="flex items-center gap-1">
          <button
            class="p-1.5 rounded-lg text-text-muted hover:text-blue-400 hover:bg-blue-500/10 transition-colors"
            title="Editar"
            @click.stop="openEditModal(row as unknown as Continent)"
          >
            <Pencil :size="14" />
          </button>
          <button
            class="p-1.5 rounded-lg text-text-muted hover:text-red-400 hover:bg-red-500/10 transition-colors"
            title="Desbloquear"
            @click.stop="deleteContinent((row as any).id)"
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
