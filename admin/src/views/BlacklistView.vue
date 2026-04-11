<script setup lang="ts">
import { ref, onMounted } from 'vue'
import { useBlacklistStore } from '@/stores/blacklist'
import { BLACKLIST_TYPES } from '@/lib/constants'
import type { BlacklistEntry } from '@/types'
import FilterTabs from '@/components/shared/FilterTabs.vue'
import SearchInput from '@/components/shared/SearchInput.vue'
import DataTable from '@/components/shared/DataTable.vue'
import StatusBadge from '@/components/shared/StatusBadge.vue'
import BlacklistModal from '@/components/modals/BlacklistModal.vue'
import { Plus, Pencil, Trash2, ToggleLeft, ToggleRight, ChevronDown, ChevronRight } from 'lucide-vue-next'

const store = useBlacklistStore()

let currentFilter = 'all'
let currentSearch = ''

const showModal = ref(false)
const modalMode = ref<'add' | 'edit'>('add')
const modalVariant = ref<'player' | 'ip' | 'unified'>('unified')
const modalEntry = ref<BlacklistEntry | undefined>(undefined)
const expandedRows = ref<Set<number>>(new Set())

const allFilterTabs = [
  { id: 'all', label: 'Todos' },
  ...BLACKLIST_TYPES,
]

const columns = [
  { key: 'type', label: 'Tipo' },
  { key: 'value', label: 'Valor' },
  { key: 'reason', label: 'Razon' },
  { key: 'active', label: 'Estado' },
  { key: 'expires_at', label: 'Expira' },
  { key: 'added_by', label: 'Añadido por' },
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

function openAddModal(variant: 'player' | 'ip' | 'unified' = 'unified') {
  modalMode.value = 'add'
  modalVariant.value = variant
  modalEntry.value = undefined
  showModal.value = true
}

function openEditModal(entry: BlacklistEntry) {
  modalMode.value = 'edit'
  modalVariant.value = ['uuid', 'nick'].includes(entry.type) ? 'player' : 'ip'
  modalEntry.value = entry
  showModal.value = true
}

function onModalClose() {
  showModal.value = false
  modalEntry.value = undefined
}

function onModalSubmit() {
  showModal.value = false
}

async function deleteEntry(id: number) {
  if (!confirm('Eliminar esta entrada de la blacklist? Se eliminaran tambien las IPs vinculadas.')) return
  await store.remove(id)
}

async function toggleEntry(id: number, currentActive: number) {
  await store.toggle(id, !currentActive)
}

function toggleExpand(id: number) {
  if (expandedRows.value.has(id)) {
    expandedRows.value.delete(id)
  } else {
    expandedRows.value.add(id)
  }
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

function typeLabel(type: string): string {
  const found = BLACKLIST_TYPES.find(t => t.id === type)
  return found ? found.label : type
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
</script>

<template>
  <div class="space-y-6">
    <!-- Page header -->
    <div class="flex flex-col sm:flex-row items-start sm:items-center justify-between gap-4">
      <div>
        <h1 class="text-2xl font-display font-bold gradient-text">Blacklist</h1>
        <p class="text-sm text-text-muted mt-1">Entradas bloqueadas del servidor</p>
      </div>
      <div class="flex items-center gap-2">
        <button
          class="inline-flex items-center gap-2 px-3 py-2 rounded-lg bg-blue-500/15 hover:bg-blue-500/25 text-blue-400 text-sm font-medium transition-colors"
          @click="openAddModal('player')"
        >
          <Plus :size="14" />
          Jugador
        </button>
        <button
          class="inline-flex items-center gap-2 px-3 py-2 rounded-lg bg-amber-500/15 hover:bg-amber-500/25 text-amber-400 text-sm font-medium transition-colors"
          @click="openAddModal('ip')"
        >
          <Plus :size="14" />
          IP/ASN
        </button>
        <button
          class="inline-flex items-center gap-2 px-4 py-2 rounded-lg bg-red-500 hover:bg-red-600 text-white text-sm font-medium transition-colors"
          @click="openAddModal('unified')"
        >
          <Plus :size="16" />
          Añadir
        </button>
      </div>
    </div>

    <!-- Filters and search -->
    <div class="flex flex-col sm:flex-row items-start sm:items-center gap-4">
      <FilterTabs
        :filters="allFilterTabs"
        :model-value="currentFilter"
        @update:model-value="onFilterChange"
      />
      <div class="w-full sm:w-72">
        <SearchInput
          :model-value="currentSearch"
          placeholder="Buscar valor, ban ID, razon..."
          @update:model-value="onSearchChange"
        />
      </div>
    </div>

    <!-- Blacklist table -->
    <DataTable
      :columns="columns"
      :rows="store.entries as unknown as Record<string, unknown>[]"
      :loading="store.loading"
      empty-message="No se encontraron entradas en la blacklist"
      @row-click="() => {}"
    >
      <template #cell-type="{ row }">
        <div class="flex items-center gap-2">
          <button
            v-if="(row as any).child_count > 0"
            class="p-0.5 rounded hover:bg-hover text-text-muted"
            @click.stop="toggleExpand((row as any).id)"
          >
            <ChevronDown v-if="expandedRows.has((row as any).id)" :size="14" />
            <ChevronRight v-else :size="14" />
          </button>
          <span
            class="inline-flex px-2 py-0.5 rounded text-xs font-semibold uppercase"
            :class="typeBadgeClass((row as any).type)"
          >
            {{ typeLabel((row as any).type) }}
          </span>
        </div>
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

      <template #cell-active="{ row }">
        <button
          class="p-1 rounded transition-colors"
          :class="(row as any).active ? 'text-green-400 hover:text-green-300' : 'text-red-400 hover:text-red-300'"
          :title="(row as any).active ? 'Desactivar' : 'Activar'"
          @click.stop="toggleEntry((row as any).id, (row as any).active)"
        >
          <ToggleRight v-if="(row as any).active" :size="20" />
          <ToggleLeft v-else :size="20" />
        </button>
      </template>

      <template #cell-expires_at="{ row }">
        <span v-if="!(row as any).expires_at" class="text-xs text-red-400 font-medium">Permanente</span>
        <span v-else class="text-xs text-text-muted font-mono">{{ formatDate((row as any).expires_at) }}</span>
      </template>

      <template #cell-added_by="{ row }">
        <span class="text-sm text-text-secondary">{{ (row as any).added_by }}</span>
      </template>

      <template #cell-actions="{ row }">
        <div class="flex items-center gap-1" @click.stop>
          <button
            class="p-1.5 rounded-lg hover:bg-hover text-text-muted hover:text-blue-400 transition-colors"
            title="Editar"
            @click="openEditModal(row as unknown as BlacklistEntry)"
          >
            <Pencil :size="14" />
          </button>
          <button
            class="p-1.5 rounded-lg hover:bg-hover text-text-muted hover:text-red-400 transition-colors"
            title="Eliminar"
            @click="deleteEntry((row as any).id)"
          >
            <Trash2 :size="14" />
          </button>
        </div>
      </template>
    </DataTable>

    <!-- Expanded children rows -->
    <div v-for="entry in store.entries.filter(e => e.child_count && e.child_count > 0 && expandedRows.has(e.id))" :key="'children-' + entry.id" class="glass-card p-3 space-y-1">
      <div class="text-xs text-text-muted uppercase tracking-wider mb-2">IPs vinculadas ({{ entry.child_count }})</div>
      <div
        v-for="child in entry.children"
        :key="child.id"
        class="flex items-center justify-between px-3 py-1.5 rounded bg-dark-800/50"
      >
        <span class="text-sm text-text-primary font-mono">{{ child.display_value }}</span>
        <div class="flex items-center gap-2">
          <StatusBadge
            :status="child.active ? 'Activa' : 'Inactiva'"
            :variant="child.active ? 'success' : 'danger'"
          />
          <span v-if="child.expires_at" class="text-xs text-text-muted font-mono">
            {{ formatDate(child.expires_at) }}
          </span>
          <span v-else class="text-xs text-red-400">Permanente</span>
        </div>
      </div>
    </div>

    <!-- Blacklist modal -->
    <BlacklistModal
      v-model="showModal"
      :mode="modalMode"
      :variant="modalVariant"
      :entry="modalEntry"
      @close="onModalClose"
      @submit="onModalSubmit"
    />
  </div>
</template>
