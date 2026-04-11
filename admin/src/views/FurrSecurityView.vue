<script setup lang="ts">
import { ref, onMounted } from 'vue'
import { useFurrSecurityStore } from '@/stores/furrsecurity'
import { FURRSECURITY_LOG_FILTERS } from '@/lib/constants'
import SearchInput from '@/components/shared/SearchInput.vue'
import FilterTabs from '@/components/shared/FilterTabs.vue'
import DataTable from '@/components/shared/DataTable.vue'
import PaginationBar from '@/components/shared/PaginationBar.vue'
import StatCard from '@/components/shared/StatCard.vue'
import FurrSecurityModal from '@/components/modals/FurrSecurityModal.vue'
import { Plus, Trash2, Ban } from 'lucide-vue-next'

const store = useFurrSecurityStore()

const activeTab = ref<'staff' | 'sessions' | 'logs'>('staff')

let currentLogPage = 1
let currentLogFilter = 'all'

const showModal = ref(false)

const staffColumns = [
  { key: 'minecraft_nick', label: 'Nick' },
  { key: 'discord_id', label: 'Discord ID' },
  { key: 'added_by', label: 'Añadido por' },
  { key: 'added_at', label: 'Fecha' },
  { key: 'actions', label: '' },
]

const sessionColumns = [
  { key: 'minecraft_nick', label: 'Nick' },
  { key: 'status', label: 'Estado' },
  { key: 'ip_address', label: 'IP' },
  { key: 'verified_at', label: 'Verificado' },
  { key: 'expires_at', label: 'Expira' },
  { key: 'actions', label: '' },
]

const logColumns = [
  { key: 'minecraft_nick', label: 'Nick' },
  { key: 'action', label: 'Accion' },
  { key: 'details', label: 'Detalles' },
  { key: 'ip_address', label: 'IP' },
  { key: 'created_at', label: 'Fecha' },
]

onMounted(() => {
  store.fetchStaff()
  store.fetchStats()
})

function switchTab(tab: 'staff' | 'sessions' | 'logs') {
  activeTab.value = tab
  if (tab === 'staff') {
    store.fetchStaff()
  } else if (tab === 'sessions') {
    store.fetchSessions()
  } else {
    store.fetchLogs(1, currentLogFilter)
  }
}

// Staff search
function onStaffSearch(search: string) {
  store.fetchStaff(search)
}

// Session search
function onSessionSearch(search: string) {
  store.fetchSessions(search)
}

// Log search / filter / page
function onLogSearch(search: string) {
  currentLogPage = 1
  store.fetchLogs(1, currentLogFilter, search)
}

function onLogFilterChange(filter: string) {
  currentLogFilter = filter
  currentLogPage = 1
  store.fetchLogs(1, filter)
}

function onLogPageChange(page: number) {
  currentLogPage = page
  store.fetchLogs(page, currentLogFilter)
}

// Modal
function openAddModal() {
  showModal.value = true
}

function onModalClose() {
  showModal.value = false
}

async function onModalSubmit() {
  showModal.value = false
  store.fetchStats()
}

// Actions
async function removeStaff(id: number) {
  if (confirm('Eliminar este miembro del staff?')) {
    await store.removeStaff(id)
    store.fetchStats()
  }
}

async function revokeSession(id: number) {
  if (confirm('Revocar esta sesion?')) {
    await store.revokeSession(id)
    store.fetchStats()
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

function statusBadgeClass(status: string): string {
  const map: Record<string, string> = {
    verified: 'bg-green-500/15 text-green-400',
    pending: 'bg-amber-500/15 text-amber-400',
    expired: 'bg-red-500/15 text-red-400',
    token_expired: 'bg-red-500/15 text-red-400',
  }
  return map[status] ?? 'bg-gray-500/15 text-gray-400'
}

function statusLabel(status: string): string {
  const map: Record<string, string> = {
    verified: 'Verificado',
    pending: 'Pendiente',
    expired: 'Expirada',
    token_expired: 'Token expirado',
  }
  return map[status] ?? status
}

function actionLabel(action: string): string {
  const map: Record<string, string> = {
    token_generated: 'Token generado',
    session_extended: 'Sesion extendida',
    verification_failed: 'Verificacion fallida',
    auto_blacklisted: 'Auto-baneado',
    player_disconnect: 'Desconexion',
    session_reset: 'Sesion reiniciada',
    add_staff: 'Staff añadido',
    remove_staff: 'Staff eliminado',
  }
  return map[action] ?? action
}
</script>

<template>
  <div class="space-y-6">
    <!-- Page header -->
    <div class="flex flex-col sm:flex-row items-start sm:items-center justify-between gap-4">
      <div>
        <h1 class="text-2xl font-display font-bold gradient-text">FurrSecurity</h1>
        <p class="text-sm text-text-muted mt-1">Verificacion de identidad de staff</p>
      </div>
      <button
        v-if="activeTab === 'staff'"
        class="inline-flex items-center gap-2 px-4 py-2 rounded-lg bg-purple-500 hover:bg-purple-600 text-white text-sm font-medium transition-colors"
        @click="openAddModal"
      >
        <Plus :size="16" />
        Añadir staff
      </button>
    </div>

    <!-- Stats bar -->
    <div v-if="store.stats" class="grid grid-cols-4 gap-3">
      <StatCard label="Staff" :value="store.stats.total_staff" icon="Users" color="purple" />
      <StatCard label="Sesiones activas" :value="store.stats.active_sessions" icon="ShieldCheck" color="green" />
      <StatCard label="Pendientes" :value="store.stats.pending_verifications" icon="Clock" color="amber" />
      <StatCard label="Verificados hoy" :value="store.stats.verified_today" icon="CheckCircle" color="blue" />
    </div>

    <!-- Tab navigation -->
    <div class="flex items-center gap-1 p-1 bg-dark-800/50 rounded-lg w-fit">
      <button
        class="px-4 py-2 rounded-md text-sm font-medium transition-colors"
        :class="activeTab === 'staff' ? 'bg-purple-500 text-white' : 'text-text-muted hover:text-text-primary'"
        @click="switchTab('staff')"
      >
        Staff
      </button>
      <button
        class="px-4 py-2 rounded-md text-sm font-medium transition-colors"
        :class="activeTab === 'sessions' ? 'bg-purple-500 text-white' : 'text-text-muted hover:text-text-primary'"
        @click="switchTab('sessions')"
      >
        Sesiones
      </button>
      <button
        class="px-4 py-2 rounded-md text-sm font-medium transition-colors"
        :class="activeTab === 'logs' ? 'bg-purple-500 text-white' : 'text-text-muted hover:text-text-primary'"
        @click="switchTab('logs')"
      >
        Logs
      </button>
    </div>

    <!-- Staff tab -->
    <template v-if="activeTab === 'staff'">
      <div class="w-full sm:w-72">
        <SearchInput
          placeholder="Buscar staff..."
          @update:model-value="onStaffSearch"
        />
      </div>

      <DataTable
        :columns="staffColumns"
        :rows="store.staff as unknown as Record<string, unknown>[]"
        :loading="store.loading"
        empty-message="No hay miembros de staff"
        @row-click="() => {}"
      >
        <template #cell-minecraft_nick="{ row }">
          <span class="text-sm text-text-primary font-medium">{{ (row as any).minecraft_nick }}</span>
        </template>

        <template #cell-discord_id="{ row }">
          <span class="text-sm text-text-secondary font-mono">{{ (row as any).discord_id }}</span>
        </template>

        <template #cell-added_by="{ row }">
          <span class="text-sm text-text-secondary">{{ (row as any).added_by }}</span>
        </template>

        <template #cell-added_at="{ row }">
          <span class="text-xs text-text-muted font-mono">{{ formatDate((row as any).added_at) }}</span>
        </template>

        <template #cell-actions="{ row }">
          <button
            class="p-1.5 rounded-lg text-text-muted hover:text-red-400 hover:bg-red-500/10 transition-colors"
            title="Eliminar"
            @click.stop="removeStaff((row as any).id)"
          >
            <Trash2 :size="14" />
          </button>
        </template>
      </DataTable>
    </template>

    <!-- Sessions tab -->
    <template v-if="activeTab === 'sessions'">
      <div class="w-full sm:w-72">
        <SearchInput
          placeholder="Buscar sesion..."
          @update:model-value="onSessionSearch"
        />
      </div>

      <DataTable
        :columns="sessionColumns"
        :rows="store.sessions as unknown as Record<string, unknown>[]"
        :loading="store.loading"
        empty-message="No hay sesiones de verificacion"
        @row-click="() => {}"
      >
        <template #cell-minecraft_nick="{ row }">
          <span class="text-sm text-text-primary font-medium">{{ (row as any).minecraft_nick }}</span>
        </template>

        <template #cell-status="{ row }">
          <span
            class="inline-flex px-2 py-0.5 rounded text-xs font-semibold uppercase"
            :class="statusBadgeClass((row as any).status)"
          >
            {{ statusLabel((row as any).status) }}
          </span>
        </template>

        <template #cell-ip_address="{ row }">
          <span class="text-xs text-text-secondary font-mono">{{ (row as any).ip_address || '-' }}</span>
        </template>

        <template #cell-verified_at="{ row }">
          <span class="text-xs text-text-muted font-mono">{{ formatDate((row as any).verified_at) }}</span>
        </template>

        <template #cell-expires_at="{ row }">
          <span class="text-xs text-text-muted font-mono">{{ formatDate((row as any).expires_at) }}</span>
        </template>

        <template #cell-actions="{ row }">
          <button
            v-if="(row as any).status === 'verified' || (row as any).status === 'pending'"
            class="p-1.5 rounded-lg text-text-muted hover:text-red-400 hover:bg-red-500/10 transition-colors"
            title="Revocar sesion"
            @click.stop="revokeSession((row as any).id)"
          >
            <Ban :size="14" />
          </button>
        </template>
      </DataTable>
    </template>

    <!-- Logs tab -->
    <template v-if="activeTab === 'logs'">
      <div class="flex flex-col sm:flex-row items-start sm:items-center gap-4">
        <FilterTabs
          :filters="FURRSECURITY_LOG_FILTERS"
          :model-value="currentLogFilter"
          @update:model-value="onLogFilterChange"
        />
        <div class="w-full sm:w-72">
          <SearchInput
            placeholder="Buscar en logs..."
            @update:model-value="onLogSearch"
          />
        </div>
      </div>

      <DataTable
        :columns="logColumns"
        :rows="store.logs as unknown as Record<string, unknown>[]"
        :loading="store.loading"
        empty-message="No se encontraron logs"
        @row-click="() => {}"
      >
        <template #cell-minecraft_nick="{ row }">
          <span class="text-sm text-text-primary font-medium">{{ (row as any).minecraft_nick || '-' }}</span>
        </template>

        <template #cell-action="{ row }">
          <span class="text-sm text-text-secondary">{{ actionLabel((row as any).action) }}</span>
        </template>

        <template #cell-details="{ row }">
          <span class="text-sm text-text-secondary truncate max-w-xs block">
            {{ (row as any).details || '-' }}
          </span>
        </template>

        <template #cell-ip_address="{ row }">
          <span class="text-xs text-text-secondary font-mono">{{ (row as any).ip_address || '-' }}</span>
        </template>

        <template #cell-created_at="{ row }">
          <span class="text-xs text-text-muted font-mono">{{ formatDate((row as any).created_at) }}</span>
        </template>
      </DataTable>

      <PaginationBar
        v-if="store.logPagination"
        :current-page="store.logPagination.current_page"
        :total-pages="store.logPagination.total_pages"
        :total="store.logPagination.total"
        @page-change="onLogPageChange"
      />
    </template>

    <!-- FurrSecurity modal -->
    <FurrSecurityModal
      v-model="showModal"
      @close="onModalClose"
      @submit="onModalSubmit"
    />
  </div>
</template>
