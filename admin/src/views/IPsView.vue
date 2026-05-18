<script setup lang="ts">
import { ref, onMounted } from 'vue'
import { useIPsStore } from '@/stores/ips'
import SearchInput from '@/components/shared/SearchInput.vue'
import DataTable from '@/components/shared/DataTable.vue'
import PaginationBar from '@/components/shared/PaginationBar.vue'
import CountryFlag from '@/components/shared/CountryFlag.vue'
import StatusBadge from '@/components/shared/StatusBadge.vue'
import IPModal from '@/components/modals/IPModal.vue'
import { Globe } from 'lucide-vue-next'

const store = useIPsStore()

let currentPage = 1
let currentSearch = ''

const showDetailModal = ref(false)
const selectedIP = ref('')

const columns = [
  { key: 'ip', label: 'IP' },
  { key: 'country', label: 'Pais' },
  { key: 'isp', label: 'ISP' },
  { key: 'connection_count', label: 'Conexiones' },
  { key: 'player_count', label: 'Jugadores' },
  { key: 'status', label: 'Estado' },
  { key: 'first_seen', label: 'Primera vista' },
]

function fetchData() {
  store.fetchIPs(currentPage, currentSearch)
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

function onRowClick(row: Record<string, unknown>) {
  selectedIP.value = (row as any).ip as string
  showDetailModal.value = true
}

function onModalClose() {
  showDetailModal.value = false
  selectedIP.value = ''
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
  <div class="page-container">
    <!-- Page header -->
    <div class="section-header">
      <div class="flex items-center gap-3">
        <div class="flex items-center justify-center w-10 h-10 rounded-xl bg-cyan-500/10 border border-cyan-500/20">
          <Globe :size="20" class="text-cyan-400" />
        </div>
        <div>
          <h1 class="text-2xl font-display font-bold gradient-text">Direcciones IP</h1>
          <p class="text-sm text-text-muted mt-0.5">Historial de direcciones IP vistas en el servidor</p>
        </div>
      </div>
      <div class="w-full sm:w-72">
        <SearchInput
          :model-value="currentSearch"
          placeholder="Buscar IP..."
          @update:model-value="onSearchChange"
        />
      </div>
    </div>

    <!-- IPs table -->
    <div class="glass-card overflow-hidden">
      <DataTable
        :columns="columns"
        :rows="store.ips as unknown as Record<string, unknown>[]"
        :loading="store.loading"
        empty-message="No se encontraron IPs"
        @row-click="onRowClick"
      >
        <template #cell-ip="{ row }">
          <span class="text-sm text-text-primary font-mono font-medium">{{ (row as any).ip }}</span>
        </template>

        <template #cell-country="{ row }">
          <div class="flex items-center gap-2">
            <CountryFlag :code="(row as any).country_code ?? ''" />
            <span class="text-sm text-text-secondary">{{ (row as any).country ?? '-' }}</span>
          </div>
        </template>

        <template #cell-isp="{ row }">
          <span class="text-sm text-text-secondary">{{ (row as any).isp ?? '-' }}</span>
        </template>

        <template #cell-connection_count="{ row }">
          <span class="inline-flex items-center justify-center min-w-[2rem] px-2 py-0.5 rounded-md text-sm text-text-secondary font-mono bg-dark-700/50">
            {{ (row as any).connection_count ?? 0 }}
          </span>
        </template>

        <template #cell-player_count="{ row }">
          <span class="inline-flex items-center justify-center min-w-[2rem] px-2 py-0.5 rounded-md text-sm text-text-secondary font-mono bg-dark-700/50">
            {{ (row as any).player_count ?? 0 }}
          </span>
        </template>

        <template #cell-status="{ row }">
          <div class="flex items-center gap-1.5">
            <StatusBadge
              v-if="(row as any).is_blacklisted"
              status="Blacklist"
              variant="danger"
            />
            <StatusBadge
              v-else-if="(row as any).is_whitelisted"
              status="Whitelist"
              variant="success"
            />
            <span v-else class="text-xs text-text-tertiary">-</span>
          </div>
        </template>

        <template #cell-first_seen="{ row }">
          <span class="text-xs text-text-muted font-mono">
            {{ formatDate((row as any).first_seen) }}
          </span>
        </template>
      </DataTable>
    </div>

    <!-- Pagination -->
    <PaginationBar
      v-if="store.pagination"
      :current-page="store.pagination.current_page"
      :total-pages="store.pagination.total_pages"
      :total="store.pagination.total"
      @page-change="onPageChange"
    />

    <!-- IP detail modal -->
    <IPModal
      v-model="showDetailModal"
      :ip="selectedIP"
      @close="onModalClose"
    />
  </div>
</template>
