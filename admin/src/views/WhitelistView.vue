<script setup lang="ts">
import { ref, onMounted } from 'vue'
import { useWhitelistStore } from '@/stores/whitelist'
import { WHITELIST_TYPES } from '@/lib/constants'
import type { WhitelistEntry } from '@/types'
import FilterTabs from '@/components/shared/FilterTabs.vue'
import SearchInput from '@/components/shared/SearchInput.vue'
import DataTable from '@/components/shared/DataTable.vue'
import WhitelistModal from '@/components/modals/WhitelistModal.vue'
import { Plus, Pencil, Trash2, ShieldCheck } from 'lucide-vue-next'

const store = useWhitelistStore()

let currentFilter = 'all'
let currentSearch = ''

const showModal = ref(false)
const modalMode = ref<'add' | 'edit'>('add')
const modalEntry = ref<WhitelistEntry | undefined>(undefined)

const allFilterTabs = [
  { id: 'all', label: 'Todos' },
  ...WHITELIST_TYPES,
]

const columns = [
  { key: 'type', label: 'Tipo' },
  { key: 'value', label: 'Valor' },
  { key: 'reason', label: 'Razon' },
  { key: 'added_by', label: 'Anadido por' },
  { key: 'created_at', label: 'Fecha' },
  { key: 'actions', label: '' },
]

onMounted(() => store.fetch())

function onFilterChange(filter: string) {
  currentFilter = filter
  store.fetch(filter, currentSearch)
}

function onSearchChange(search: string) {
  currentSearch = search
  store.fetch(currentFilter, search)
}

function openAddModal() {
  modalMode.value = 'add'
  modalEntry.value = undefined
  showModal.value = true
}

function openEditModal(entry: WhitelistEntry) {
  modalMode.value = 'edit'
  modalEntry.value = entry
  showModal.value = true
}

function onModalClose() {
  showModal.value = false
  modalEntry.value = undefined
}

async function onModalSubmit() {
  showModal.value = false
}

async function deleteEntry(id: number) {
  if (!confirm('Eliminar esta entrada de la whitelist?')) return
  await store.remove(id)
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

function typeLabel(type: string): string {
  const found = WHITELIST_TYPES.find(t => t.id === type)
  return found ? found.label : type
}

function typeBadgeClass(type: string): string {
  const map: Record<string, string> = {
    uuid: 'bg-purple-500/15 text-purple-400 border-purple-500/20',
    nick: 'bg-blue-500/15 text-blue-400 border-blue-500/20',
    ip: 'bg-amber-500/15 text-amber-400 border-amber-500/20',
    ip_range: 'bg-cyan-500/15 text-cyan-400 border-cyan-500/20',
    as: 'bg-pink-500/15 text-pink-400 border-pink-500/20',
  }
  return map[type] ?? 'bg-gray-500/15 text-gray-400 border-gray-500/20'
}
</script>

<template>
  <div class="page-container">
    <!-- Page header -->
    <div class="section-header">
      <div class="flex items-center gap-3">
        <div class="flex items-center justify-center w-10 h-10 rounded-xl bg-green-500/10 border border-green-500/20">
          <ShieldCheck :size="20" class="text-green-400" />
        </div>
        <div>
          <h1 class="text-2xl font-display font-bold gradient-text">Whitelist</h1>
          <p class="text-sm text-text-muted mt-0.5">Entradas permitidas en el servidor</p>
        </div>
      </div>
      <button
        class="glass-button inline-flex items-center gap-2 px-5 py-2.5 text-sm font-semibold"
        @click="openAddModal"
      >
        <Plus :size="16" />
        Anadir entrada
      </button>
    </div>

    <!-- Filters and search -->
    <div class="glass-card p-4">
      <div class="flex flex-col sm:flex-row items-start sm:items-center gap-4">
        <FilterTabs
          :filters="allFilterTabs"
          :model-value="currentFilter"
          @update:model-value="onFilterChange"
        />
        <div class="w-full sm:w-72 sm:ml-auto">
          <SearchInput
            :model-value="currentSearch"
            placeholder="Buscar valor..."
            @update:model-value="onSearchChange"
          />
        </div>
      </div>
    </div>

    <!-- Whitelist table -->
    <div class="glass-card overflow-hidden">
      <DataTable
        :columns="columns"
        :rows="store.entries as unknown as Record<string, unknown>[]"
        :loading="store.loading"
        empty-message="No se encontraron entradas en la whitelist"
        @row-click="() => {}"
      >
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
          <span class="text-sm text-text-secondary">{{ (row as any).reason || '-' }}</span>
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
              class="p-2 rounded-lg glass-button-secondary text-text-muted hover:text-blue-400 hover:border-blue-500/30 transition-all"
              title="Editar"
              @click="openEditModal(row as unknown as WhitelistEntry)"
            >
              <Pencil :size="14" />
            </button>
            <button
              class="p-2 rounded-lg glass-button-secondary text-text-muted hover:text-red-400 hover:border-red-500/30 transition-all"
              title="Eliminar"
              @click="deleteEntry((row as any).id)"
            >
              <Trash2 :size="14" />
            </button>
          </div>
        </template>
      </DataTable>
    </div>

    <!-- Whitelist modal (add/edit) -->
    <WhitelistModal
      v-model="showModal"
      :mode="modalMode"
      :entry="modalEntry"
      @close="onModalClose"
      @submit="onModalSubmit"
    />
  </div>
</template>
