<script setup lang="ts">
import { ref, onMounted, computed } from 'vue'
import { useFurrPermsStore } from '@/stores/furrperms'
import { FURRPERMS_LOG_FILTERS } from '@/lib/constants'
import SearchInput from '@/components/shared/SearchInput.vue'
import FilterTabs from '@/components/shared/FilterTabs.vue'
import DataTable from '@/components/shared/DataTable.vue'
import PaginationBar from '@/components/shared/PaginationBar.vue'
import StatCard from '@/components/shared/StatCard.vue'
import FurrPermsModal from '@/components/modals/FurrPermsModal.vue'
import { Plus, Trash2, Trash } from 'lucide-vue-next'

const store = useFurrPermsStore()

const activeTab = ref<'whitelist' | 'logs'>('whitelist')

let currentSearch = ''
let currentFilter = 'all'
let currentLogPage = 1

const showModal = ref(false)

const whitelistColumns = [
  { key: 'nick', label: 'Nickname' },
  { key: 'uuid', label: 'UUID' },
  { key: 'added_by', label: 'Añadido por' },
  { key: 'created_at', label: 'Fecha' },
  { key: 'actions', label: '' },
]

const logColumns = [
  { key: 'player_nick', label: 'Jugador' },
  { key: 'command', label: 'Comando' },
  { key: 'server_name', label: 'Servidor' },
  { key: 'allowed', label: 'Estado' },
  { key: 'reason', label: 'Razon' },
  { key: 'created_at', label: 'Fecha' },
]

onMounted(() => {
  store.fetchWhitelist()
})

function onSearchChange(search: string) {
  currentSearch = search
  if (activeTab.value === 'whitelist') {
    store.fetchWhitelist(search)
  } else {
    currentLogPage = 1
    store.fetchLogs(1, currentFilter, search)
  }
}

function onFilterChange(filter: string) {
  currentFilter = filter
  currentLogPage = 1
  store.fetchLogs(1, filter, currentSearch)
}

function onPageChange(page: number) {
  currentLogPage = page
  store.fetchLogs(page, currentFilter, currentSearch)
}

function switchTab(tab: 'whitelist' | 'logs') {
  activeTab.value = tab
  currentSearch = ''
  if (tab === 'whitelist') {
    store.fetchWhitelist()
  } else {
    store.fetchLogs(1, currentFilter)
  }
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

async function removeEntry(id: number) {
  if (confirm('Eliminar este jugador de la whitelist?')) {
    await store.removeFromWhitelist(id)
  }
}

async function clearLogs() {
  if (confirm('Limpiar logs antiguos (mas de 30 dias)?')) {
    await store.clearLogs()
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

const statsAllowed = computed(() => store.logStats?.allowed ?? 0)
const statsBlocked = computed(() => store.logStats?.blocked ?? 0)
</script>

<template>
  <div class="space-y-6">
    <!-- Page header -->
    <div class="flex flex-col sm:flex-row items-start sm:items-center justify-between gap-4">
      <div>
        <h1 class="text-2xl font-display font-bold gradient-text">FurrPerms</h1>
        <p class="text-sm text-text-muted mt-1">Gestion de permisos de comandos</p>
      </div>
      <div class="flex items-center gap-2">
        <button
          v-if="activeTab === 'logs'"
          class="inline-flex items-center gap-2 px-4 py-2 rounded-lg bg-red-500/15 hover:bg-red-500/25 text-red-400 text-sm font-medium transition-colors"
          @click="clearLogs"
        >
          <Trash :size="16" />
          Limpiar logs
        </button>
        <button
          v-if="activeTab === 'whitelist'"
          class="inline-flex items-center gap-2 px-4 py-2 rounded-lg bg-purple-500 hover:bg-purple-600 text-white text-sm font-medium transition-colors"
          @click="openAddModal"
        >
          <Plus :size="16" />
          Añadir jugador
        </button>
      </div>
    </div>

    <!-- Stats bar -->
    <div v-if="activeTab === 'logs' && store.logStats" class="grid grid-cols-3 gap-3">
      <StatCard label="Total logs" :value="store.logStats.total" icon="FileText" color="purple" />
      <StatCard label="Permitidos" :value="statsAllowed" icon="CheckCircle" color="green" />
      <StatCard label="Bloqueados" :value="statsBlocked" icon="XCircle" color="red" />
    </div>

    <!-- Tab navigation -->
    <div class="flex items-center gap-1 p-1 bg-dark-800/50 rounded-lg w-fit">
      <button
        class="px-4 py-2 rounded-md text-sm font-medium transition-colors"
        :class="activeTab === 'whitelist' ? 'bg-purple-500 text-white' : 'text-text-muted hover:text-text-primary'"
        @click="switchTab('whitelist')"
      >
        Whitelist ({{ store.whitelistTotal }})
      </button>
      <button
        class="px-4 py-2 rounded-md text-sm font-medium transition-colors"
        :class="activeTab === 'logs' ? 'bg-purple-500 text-white' : 'text-text-muted hover:text-text-primary'"
        @click="switchTab('logs')"
      >
        Logs
      </button>
    </div>

    <!-- Filters and search (logs tab) -->
    <div v-if="activeTab === 'logs'" class="flex flex-col sm:flex-row items-start sm:items-center gap-4">
      <FilterTabs
        :filters="FURRPERMS_LOG_FILTERS"
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
    </div>

    <!-- Search (whitelist tab) -->
    <div v-if="activeTab === 'whitelist'" class="flex flex-col sm:flex-row items-start sm:items-center gap-4">
      <div class="w-full sm:w-72">
        <SearchInput
          :model-value="currentSearch"
          placeholder="Buscar jugador..."
          @update:model-value="onSearchChange"
        />
      </div>
    </div>

    <!-- Whitelist table -->
    <DataTable
      v-if="activeTab === 'whitelist'"
      :columns="whitelistColumns"
      :rows="store.whitelist as unknown as Record<string, unknown>[]"
      :loading="store.loading"
      empty-message="No hay jugadores en la whitelist"
      @row-click="() => {}"
    >
      <template #cell-nick="{ row }">
        <span class="text-sm text-text-primary font-medium">{{ (row as any).nick }}</span>
      </template>

      <template #cell-uuid="{ row }">
        <span class="text-xs text-text-secondary font-mono">{{ (row as any).uuid || '-' }}</span>
      </template>

      <template #cell-added_by="{ row }">
        <span class="text-sm text-text-secondary">{{ (row as any).added_by }}</span>
      </template>

      <template #cell-created_at="{ row }">
        <span class="text-xs text-text-muted font-mono">{{ formatDate((row as any).created_at) }}</span>
      </template>

      <template #cell-actions="{ row }">
        <button
          class="p-1.5 rounded-lg text-text-muted hover:text-red-400 hover:bg-red-500/10 transition-colors"
          title="Eliminar"
          @click.stop="removeEntry((row as any).id)"
        >
          <Trash2 :size="14" />
        </button>
      </template>
    </DataTable>

    <!-- Logs table -->
    <DataTable
      v-if="activeTab === 'logs'"
      :columns="logColumns"
      :rows="store.logs as unknown as Record<string, unknown>[]"
      :loading="store.loading"
      empty-message="No se encontraron logs"
      @row-click="() => {}"
    >
      <template #cell-player_nick="{ row }">
        <span class="text-sm text-text-primary font-medium">{{ (row as any).player_nick }}</span>
      </template>

      <template #cell-command="{ row }">
        <span class="text-sm text-text-secondary font-mono">{{ (row as any).command }}</span>
      </template>

      <template #cell-server_name="{ row }">
        <span class="text-sm text-text-secondary">{{ (row as any).server_name || '-' }}</span>
      </template>

      <template #cell-allowed="{ row }">
        <span
          class="inline-flex px-2 py-0.5 rounded text-xs font-semibold uppercase"
          :class="(row as any).allowed ? 'bg-green-500/15 text-green-400' : 'bg-red-500/15 text-red-400'"
        >
          {{ (row as any).allowed ? 'Permitido' : 'Bloqueado' }}
        </span>
      </template>

      <template #cell-reason="{ row }">
        <span class="text-sm text-text-secondary truncate max-w-xs block">
          {{ (row as any).reason || '-' }}
        </span>
      </template>

      <template #cell-created_at="{ row }">
        <span class="text-xs text-text-muted font-mono">{{ formatDate((row as any).created_at) }}</span>
      </template>
    </DataTable>

    <!-- Pagination (logs only) -->
    <PaginationBar
      v-if="activeTab === 'logs' && store.logPagination"
      :current-page="store.logPagination.current_page"
      :total-pages="store.logPagination.total_pages"
      :total="store.logPagination.total"
      @page-change="onPageChange"
    />

    <!-- FurrPerms modal -->
    <FurrPermsModal
      v-model="showModal"
      @close="onModalClose"
      @submit="onModalSubmit"
    />
  </div>
</template>
