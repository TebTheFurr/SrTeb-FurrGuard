<script setup lang="ts">
import { onMounted } from 'vue'
import { useRouter } from 'vue-router'
import { useOverviewStore } from '@/stores/overview'
import StatCard from '@/components/shared/StatCard.vue'
import DataTable from '@/components/shared/DataTable.vue'
import LoadingSkeleton from '@/components/shared/LoadingSkeleton.vue'
import PlayerCell from '@/components/shared/PlayerCell.vue'
import IPCell from '@/components/shared/IPCell.vue'
import StatusBadge from '@/components/shared/StatusBadge.vue'
import CountryFlag from '@/components/shared/CountryFlag.vue'
import { ShieldPlus, ShieldOff } from 'lucide-vue-next'

const router = useRouter()
const store = useOverviewStore()

onMounted(() => {
  store.fetchOverview()
  store.fetchCounts()
})

const statCards = [
  { title: 'Jugadores Totales', icon: 'Users', color: 'purple', key: 'total_players' as const },
  { title: 'Conexiones 24h', icon: 'Link', color: 'blue', key: 'connections_24h' as const },
  { title: 'Bloqueos 24h', icon: 'ShieldOff', color: 'red', key: 'blocked_24h' as const },
  { title: 'Jugadores Online', icon: 'Activity', color: 'green', key: 'online_players' as const },
]

const connectionColumns = [
  { key: 'nick', label: 'Jugador' },
  { key: 'ip', label: 'IP' },
  { key: 'country', label: 'Pais' },
  { key: 'blocked', label: 'Estado' },
  { key: 'created_at', label: 'Fecha' },
]

const blockColumns = [
  { key: 'type', label: 'Tipo' },
  { key: 'value', label: 'Valor' },
  { key: 'reason', label: 'Razon' },
  { key: 'created_at', label: 'Fecha' },
]

function formatTime(dateStr: string): string {
  if (!dateStr) return '-'
  const d = new Date(dateStr)
  return d.toLocaleString('es-ES', {
    day: '2-digit',
    month: '2-digit',
    hour: '2-digit',
    minute: '2-digit',
  })
}

function onConnectionRowClick(row: Record<string, unknown>) {
  router.push({ name: 'connections' })
}

function onBlockRowClick(_row: Record<string, unknown>) {
  router.push({ name: 'blacklist' })
}
</script>

<template>
  <div class="page-container animate-fade-in">
    <!-- Page header -->
    <header class="section-header">
      <div>
        <h1 class="text-3xl font-display font-bold gradient-text tracking-tight">Dashboard</h1>
        <p class="text-sm text-text-muted mt-1.5">Vista general del sistema FurrGuard</p>
      </div>
      <div class="flex items-center gap-2">
        <div class="w-2 h-2 rounded-full bg-success animate-glow" />
        <span class="text-xs text-text-muted font-medium">Sistema activo</span>
      </div>
    </header>

    <div class="gradient-line h-px opacity-40" />

    <!-- Stat cards — compact 4-column grid -->
    <LoadingSkeleton v-if="store.loading" :rows="1" />

    <div v-else class="grid grid-cols-2 sm:grid-cols-4 gap-3 stagger-children">
      <div v-for="card in statCards" :key="card.key" class="glass-card-hover p-4">
        <StatCard
          :title="card.title"
          :icon="card.icon"
          :color="card.color"
          :value="store.stats?.[card.key] ?? 0"
        />
      </div>
    </div>

    <!-- Quick actions -->
    <div class="flex flex-wrap gap-3">
      <button
        class="glass-button inline-flex items-center gap-2.5 px-5 py-2.5 text-sm"
        @click="router.push({ name: 'whitelist' })"
      >
        <ShieldPlus :size="16" />
        Agregar Whitelist
      </button>
      <button
        class="glass-button-danger inline-flex items-center gap-2.5 px-5 py-2.5 text-sm"
        @click="router.push({ name: 'blacklist' })"
      >
        <ShieldOff :size="16" />
        Agregar Blacklist
      </button>
    </div>

    <!-- Tables — 2-column layout -->
    <div class="grid grid-cols-1 xl:grid-cols-2 gap-6">
      <!-- Recent connections -->
      <div class="glass-card p-5">
        <div class="flex items-center justify-between mb-4">
          <h2 class="text-base font-display font-semibold text-text-primary">
            Conexiones Recientes
          </h2>
          <button
            class="glass-button-secondary px-3 py-1.5 text-xs font-medium hover:text-text-primary"
            @click="router.push({ name: 'connections' })"
          >
            Ver todo
          </button>
        </div>
        <DataTable
          :columns="connectionColumns"
          :rows="(store.stats?.recent_connections ?? []) as Record<string, unknown>[]"
          :loading="store.loading"
          empty-message="No hay conexiones recientes"
          @row-click="onConnectionRowClick"
        >
          <template #cell-nick="{ row }">
            <PlayerCell :uuid="(row as any).uuid" :nick="(row as any).nick" />
          </template>
          <template #cell-ip="{ row }">
            <IPCell :ip="(row as any).ip" :country-code="(row as any).country_code" />
          </template>
          <template #cell-country="{ row }">
            <div class="flex items-center gap-2">
              <CountryFlag :code="(row as any).country_code ?? ''" />
              <span class="text-sm text-text-secondary">{{ (row as any).country ?? '-' }}</span>
            </div>
          </template>
          <template #cell-blocked="{ row }">
            <StatusBadge
              :status="(row as any).blocked ? 'Bloqueado' : 'Permitido'"
              :variant="(row as any).blocked ? 'danger' : 'success'"
            />
          </template>
          <template #cell-created_at="{ row }">
            <span class="text-xs text-text-muted font-mono">
              {{ formatTime((row as any).created_at) }}
            </span>
          </template>
        </DataTable>
      </div>

      <!-- Recent blocks -->
      <div class="glass-card p-5">
        <div class="flex items-center justify-between mb-4">
          <h2 class="text-base font-display font-semibold text-text-primary">
            Bloqueos Recientes
          </h2>
          <button
            class="glass-button-secondary px-3 py-1.5 text-xs font-medium hover:text-text-primary"
            @click="router.push({ name: 'blacklist' })"
          >
            Ver todo
          </button>
        </div>
        <DataTable
          :columns="blockColumns"
          :rows="(store.stats?.recent_blocks ?? []) as Record<string, unknown>[]"
          :loading="store.loading"
          empty-message="No hay bloqueos recientes"
          @row-click="onBlockRowClick"
        >
          <template #cell-type="{ row }">
            <span
              class="inline-flex px-2 py-0.5 rounded-full text-xs font-medium bg-dark-600 text-text-secondary uppercase"
            >
              {{ (row as any).type }}
            </span>
          </template>
          <template #cell-value="{ row }">
            <span class="text-sm text-text-primary font-mono">
              {{ (row as any).minecraft_name ?? (row as any).value }}
            </span>
          </template>
          <template #cell-reason="{ row }">
            <span class="text-sm text-text-muted truncate max-w-[200px] inline-block">
              {{ (row as any).reason ?? '-' }}
            </span>
          </template>
          <template #cell-created_at="{ row }">
            <span class="text-xs text-text-muted font-mono">
              {{ formatTime((row as any).created_at) }}
            </span>
          </template>
        </DataTable>
      </div>
    </div>
  </div>
</template>
