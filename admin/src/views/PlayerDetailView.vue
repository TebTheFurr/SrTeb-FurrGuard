<script setup lang="ts">
import { ref, computed, onMounted, watch } from 'vue'
import { useRoute, useRouter } from 'vue-router'
import { usePlayersStore } from '@/stores/players'
import { useConnectionsStore } from '@/stores/connections'
import { useWhitelistStore } from '@/stores/whitelist'
import { useBlacklistStore } from '@/stores/blacklist'
import { useUIStore } from '@/stores/ui'
import type { Connection, PlayerLookup, NameHistoryEntry } from '@/types'

import SkinViewer from '@/components/shared/SkinViewer.vue'
import PlayerAvatar from '@/components/shared/PlayerAvatar.vue'
import StatusBadge from '@/components/shared/StatusBadge.vue'
import CountryFlag from '@/components/shared/CountryFlag.vue'
import LoadingSkeleton from '@/components/shared/LoadingSkeleton.vue'
import ConnectionModal from '@/components/modals/ConnectionModal.vue'
import BlacklistModal from '@/components/modals/BlacklistModal.vue'
import WhitelistModal from '@/components/modals/WhitelistModal.vue'

import {
  ArrowLeft,
  Copy,
  CheckCircle2,
  XCircle,
  User,
  ShieldCheck,
  ShieldOff,
  Clock,
  Globe,
  Building2,
  Hash,
  Server,
  History,
  Link,
  ShieldAlert,
} from 'lucide-vue-next'

const route = useRoute()
const router = useRouter()
const playersStore = usePlayersStore()
const connectionsStore = useConnectionsStore()
const whitelistStore = useWhitelistStore()
const blacklistStore = useBlacklistStore()
const uiStore = useUIStore()

const uuid = route.params.uuid as string

// Local state
const premiumInfo = ref<PlayerLookup | null>(null)
const nameHistory = ref<NameHistoryEntry[]>([])
const nameHistoryLoading = ref(false)
const connections = ref<Connection[]>([])
const connectionsLoading = ref(false)
const uuidCopied = ref(false)
const activeConnectionId = ref<number | null>(null)
const showConnectionModal = ref(false)
const showBlacklistModal = ref(false)
const showWhitelistModal = ref(false)
const whitelistPresetType = ref('uuid')
const whitelistPresetValue = ref('')

// Computed
const player = computed(() => playersStore.currentPlayer?.player ?? null)
const ips = computed(() => playersStore.currentPlayer?.ips ?? [])
const nicks = computed(() => playersStore.currentPlayer?.nicks ?? [])
const isPremium = computed(() => premiumInfo.value?.is_premium ?? false)
const loading = computed(() => playersStore.detailLoading)

// Determine ban type based on premium status
const banInfo = computed(() => {
  if (isPremium.value && premiumInfo.value?.uuid) {
    return { type: 'uuid', value: premiumInfo.value.uuid }
  }
  return { type: 'nick', value: player.value?.last_nick ?? '' }
})

// Detect premium/offline by UUID format (offline UUIDs start without dashes in a specific pattern)
function isOfflineUuid(uuidStr: string): boolean {
  // Offline mode UUIDs don't follow the v4 pattern; they're typically generated
  // from playerName.hashCode(). A quick heuristic: if lookup says not premium
  return !isPremium.value
}

function formatDate(dateStr: string | null | undefined): string {
  if (!dateStr) return 'N/A'
  return new Date(dateStr).toLocaleDateString('es-ES', {
    day: '2-digit',
    month: 'short',
    year: 'numeric',
    hour: '2-digit',
    minute: '2-digit',
  })
}

function formatDateShort(dateStr: string | null | undefined): string {
  if (!dateStr) return 'N/A'
  return new Date(dateStr).toLocaleString('es-ES', {
    day: '2-digit',
    month: '2-digit',
    year: 'numeric',
    hour: '2-digit',
    minute: '2-digit',
    second: '2-digit',
  })
}

async function copyUuid() {
  if (!player.value) return
  try {
    await navigator.clipboard.writeText(player.value.uuid)
    uuidCopied.value = true
    setTimeout(() => { uuidCopied.value = false }, 2000)
    uiStore.showToast('success', 'Copiado', 'UUID copiado al portapapeles')
  } catch {
    uiStore.showToast('error', 'Error', 'No se pudo copiar')
  }
}

function openConnectionDetail(id: number) {
  activeConnectionId.value = id
  showConnectionModal.value = true
}

function openWhitelistAdd() {
  whitelistPresetType.value = banInfo.value.type
  whitelistPresetValue.value = banInfo.value.value
  showWhitelistModal.value = true
}

function openBlacklistAdd() {
  showBlacklistModal.value = true
}

async function removeFromWhitelist() {
  if (!player.value) return
  const success = await whitelistStore.removeByValue(banInfo.value.type, banInfo.value.value)
  if (success) {
    uiStore.showToast('success', 'Eliminado', 'Eliminado de whitelist')
    await loadPlayerData()
  }
}

async function removeFromBlacklist() {
  if (!player.value) return
  const success = await blacklistStore.removeByValue(banInfo.value.type, banInfo.value.value)
  if (success) {
    uiStore.showToast('success', 'Eliminado', 'Eliminado de blacklist')
    await loadPlayerData()
  }
}

async function loadPlayerData() {
  await playersStore.fetchPlayer(uuid)

  if (player.value) {
    // Lookup premium status
    try {
      await playersStore.lookupPlayer(player.value.last_nick)
      premiumInfo.value = playersStore.lookupResult
    } catch {
      premiumInfo.value = { is_premium: false, uuid: player.value.uuid, name: player.value.last_nick, error: null }
    }
    if (!premiumInfo.value) {
      premiumInfo.value = { is_premium: false, uuid: player.value.uuid, name: player.value.last_nick, error: null }
    }

    // Load name history (only for premium)
    if (premiumInfo.value.is_premium) {
      nameHistoryLoading.value = true
      try {
        await playersStore.getNameHistory(player.value.last_nick)
        nameHistory.value = playersStore.nameHistory
      } catch {
        nameHistory.value = []
      } finally {
        nameHistoryLoading.value = false
      }
    }

    // Load recent connections for this player
    connectionsLoading.value = true
    try {
      await connectionsStore.fetchConnections(1, 'all', player.value.last_nick)
      connections.value = connectionsStore.connections.filter(
        c => c.uuid === uuid || c.nick === player.value!.last_nick
      )
    } catch {
      connections.value = []
    } finally {
      connectionsLoading.value = false
    }
  }
}

function goBack() {
  router.push({ name: 'players' })
}

onMounted(() => {
  loadPlayerData()
})
</script>

<template>
  <div class="min-h-screen p-6 pb-0 relative z-10 flex flex-col">
    <!-- Header -->
    <div class="flex items-center gap-4 mb-8">
      <button
        class="flex items-center gap-2 px-4 py-2.5 glass-card text-text-secondary text-sm font-medium transition-all hover:text-text-primary hover:border-purple-500 cursor-pointer"
        @click="goBack"
      >
        <ArrowLeft :size="18" />
        Volver al Panel
      </button>
      <h1 class="text-2xl font-display font-semibold text-text-primary">Visor de Jugador</h1>
    </div>

    <!-- Loading state -->
    <div v-if="loading" class="flex-1">
      <LoadingSkeleton :rows="8" />
    </div>

    <!-- Player not found -->
    <div v-else-if="!player" class="flex-1 flex items-center justify-center">
      <div class="text-center">
        <p class="text-text-muted text-lg mb-4">Jugador no encontrado</p>
        <button
          class="px-6 py-2.5 gradient-primary text-white rounded-lg text-sm font-medium"
          @click="goBack"
        >
          Volver al Panel
        </button>
      </div>
    </div>

    <!-- Main content -->
    <div v-else class="grid grid-cols-1 lg:grid-cols-[520px_1fr] gap-6 max-w-[1600px] mx-auto w-full flex-1">
      <!-- Left sidebar: Skin + quick info -->
      <div class="glass-card p-6 lg:sticky lg:top-6 self-start min-w-[320px]">
        <!-- Skin viewer title -->
        <div class="flex items-center gap-2 text-text-secondary text-sm font-semibold uppercase tracking-wider mb-4">
          <User :size="16" class="text-purple-400" />
          Skin del Jugador
        </div>

        <!-- Skin viewer -->
        <div class="flex items-center justify-center w-full rounded-lg mb-5 bg-[radial-gradient(ellipse_at_center,rgba(139,92,246,0.1)_0%,transparent_70%)]">
          <SkinViewer :uuid="uuid" :width="350" :height="450" />
        </div>

        <!-- Player name -->
        <div class="text-center text-2xl font-semibold text-text-primary mb-2">
          {{ player.last_nick }}
        </div>

        <!-- UUID (copyable) -->
        <div
          class="flex items-center justify-center gap-2 text-xs text-text-muted font-mono cursor-pointer hover:text-purple-400 transition-colors group"
          @click="copyUuid"
        >
          <span class="break-all">{{ player.uuid }}</span>
          <component :is="uuidCopied ? CheckCircle2 : Copy" :size="14" class="shrink-0 group-hover:text-purple-400" />
        </div>

        <!-- Action buttons -->
        <div class="flex gap-3 mt-5 flex-wrap">
          <!-- Whitelist -->
          <button
            v-if="!player.is_whitelisted"
            class="flex-1 min-w-[140px] flex items-center justify-center gap-2 px-4 py-2.5 rounded-lg text-sm font-medium text-white bg-gradient-to-br from-green-500 to-emerald-600 hover:opacity-90 transition-all"
            @click="openWhitelistAdd"
          >
            <ShieldCheck :size="16" />
            Anadir a Whitelist
          </button>
          <button
            v-else
            class="flex-1 min-w-[140px] flex items-center justify-center gap-2 px-4 py-2.5 rounded-lg text-sm font-medium border border-glass-border-subtle text-text-secondary hover:text-text-primary hover:bg-dark-600 transition-all"
            @click="removeFromWhitelist"
          >
            <ShieldCheck :size="16" />
            Quitar de Whitelist
          </button>

          <!-- Blacklist -->
          <button
            v-if="!player.is_blacklisted"
            class="flex-1 min-w-[140px] flex items-center justify-center gap-2 px-4 py-2.5 rounded-lg text-sm font-medium text-white bg-gradient-to-br from-red-500 to-red-600 hover:opacity-90 transition-all"
            @click="openBlacklistAdd"
          >
            <ShieldOff :size="16" />
            Anadir a Blacklist
          </button>
          <button
            v-else
            class="flex-1 min-w-[140px] flex items-center justify-center gap-2 px-4 py-2.5 rounded-lg text-sm font-medium border border-glass-border-subtle text-text-secondary hover:text-text-primary hover:bg-dark-600 transition-all"
            @click="removeFromBlacklist"
          >
            <ShieldOff :size="16" />
            Quitar de Blacklist
          </button>
        </div>
      </div>

      <!-- Right main content: data sections -->
      <div class="glass-card p-6 space-y-6">

        <!-- Section 1: Account Status -->
        <section>
          <div class="flex items-center gap-2 text-text-secondary text-sm font-semibold uppercase tracking-wider mb-4 pb-3 border-b border-glass-border-subtle">
            <CheckCircle2 :size="16" class="text-purple-400" />
            Estado de Cuenta
          </div>

          <!-- Premium status box -->
          <div
            v-if="premiumInfo"
            class="flex items-center gap-4 p-4 rounded-lg border"
            :class="isPremium
              ? 'bg-gradient-to-br from-green-500/10 to-green-500/5 border-green-500/25'
              : 'bg-gradient-to-br from-red-500/10 to-red-500/5 border-red-500/25'"
          >
            <PlayerAvatar
              v-if="isPremium && premiumInfo.name"
              :uuid="premiumInfo.uuid ?? uuid"
              :size="56"
            />
            <div
              v-else
              class="w-14 h-14 rounded-lg gradient-primary flex items-center justify-center text-white font-semibold text-2xl"
            >
              {{ player.last_nick.charAt(0).toUpperCase() }}
            </div>
            <div class="flex-1 min-w-0">
              <div class="text-lg font-semibold text-text-primary">
                {{ premiumInfo.name ?? player.last_nick }}
              </div>
              <div class="flex items-center gap-1 mt-1">
                <span
                  v-if="isPremium"
                  class="inline-flex items-center gap-1 px-2.5 py-0.5 rounded-full text-xs font-semibold bg-green-500/15 text-green-400"
                >
                  <CheckCircle2 :size="12" />
                  Premium Verificado
                </span>
                <span
                  v-else
                  class="inline-flex items-center gap-1 px-2.5 py-0.5 rounded-full text-xs font-semibold bg-red-500/15 text-red-400"
                >
                  <XCircle :size="12" />
                  No Premium (Offline)
                </span>
              </div>
              <div class="text-xs text-text-muted font-mono mt-1">
                {{ isPremium ? `UUID: ${premiumInfo.uuid ?? player.uuid}` : 'Bloquear por Nick, no por UUID' }}
              </div>
            </div>
          </div>
        </section>

        <!-- Section 2: General Info -->
        <section>
          <div class="flex items-center gap-2 text-text-secondary text-sm font-semibold uppercase tracking-wider mb-4 pb-3 border-b border-glass-border-subtle">
            <Server :size="16" class="text-purple-400" />
            Informacion General
          </div>

          <div class="grid grid-cols-2 sm:grid-cols-3 lg:grid-cols-4 gap-3">
            <!-- Status -->
            <div class="bg-white/[0.02] border border-glass-border-subtle rounded-lg p-3">
              <div class="text-xs font-medium text-text-muted uppercase tracking-wider mb-1">Estado</div>
              <div class="text-sm font-medium" :class="player.is_online ? 'text-success' : 'text-text-muted'">
                {{ player.is_online ? 'Online' : 'Offline' }}
              </div>
            </div>

            <!-- Whitelisted -->
            <div class="bg-white/[0.02] border border-glass-border-subtle rounded-lg p-3">
              <div class="text-xs font-medium text-text-muted uppercase tracking-wider mb-1">Whitelisted</div>
              <div class="text-sm font-medium" :class="player.is_whitelisted ? 'text-success' : ''">
                {{ player.is_whitelisted ? 'Si' : 'No' }}
              </div>
            </div>

            <!-- Blacklisted -->
            <div class="bg-white/[0.02] border border-glass-border-subtle rounded-lg p-3">
              <div class="text-xs font-medium text-text-muted uppercase tracking-wider mb-1">Blacklisted</div>
              <div class="text-sm font-medium" :class="player.is_blacklisted ? 'text-error' : ''">
                {{ player.is_blacklisted ? 'Si' : 'No' }}
              </div>
            </div>

            <!-- Total Connections -->
            <div class="bg-white/[0.02] border border-glass-border-subtle rounded-lg p-3">
              <div class="text-xs font-medium text-text-muted uppercase tracking-wider mb-1">Conexiones</div>
              <div class="text-sm font-medium text-text-primary">{{ player.total_connections ?? 0 }}</div>
            </div>

            <!-- First Seen -->
            <div class="bg-white/[0.02] border border-glass-border-subtle rounded-lg p-3">
              <div class="text-xs font-medium text-text-muted uppercase tracking-wider mb-1">Primera vez</div>
              <div class="text-sm font-medium text-text-primary">{{ formatDate(player.first_seen) }}</div>
            </div>

            <!-- Last Seen -->
            <div class="bg-white/[0.02] border border-glass-border-subtle rounded-lg p-3">
              <div class="text-xs font-medium text-text-muted uppercase tracking-wider mb-1">Ultima vez</div>
              <div class="text-sm font-medium text-text-primary">{{ formatDate(player.last_seen) }}</div>
            </div>

            <!-- Last IP -->
            <div class="bg-white/[0.02] border border-glass-border-subtle rounded-lg p-3">
              <div class="text-xs font-medium text-text-muted uppercase tracking-wider mb-1">Ultima IP</div>
              <div class="text-sm font-medium text-text-primary font-mono">{{ player.last_ip ?? 'N/A' }}</div>
            </div>

            <!-- Last Country -->
            <div class="bg-white/[0.02] border border-glass-border-subtle rounded-lg p-3">
              <div class="text-xs font-medium text-text-muted uppercase tracking-wider mb-1">Ultimo Pais</div>
              <div class="text-sm font-medium text-text-primary flex items-center gap-1.5">
                <CountryFlag :code="player.last_country_code ?? ''" />
                {{ player.last_country ?? 'Desconocido' }}
              </div>
            </div>
          </div>
        </section>

        <!-- Section 3: Name History (Premium only) -->
        <section>
          <div class="flex items-center gap-2 text-text-secondary text-sm font-semibold uppercase tracking-wider mb-4 pb-3 border-b border-glass-border-subtle">
            <History :size="16" class="text-purple-400" />
            Historial de Nombres
          </div>

          <!-- Not available for offline players -->
          <div v-if="!isPremium" class="text-center py-8 text-text-muted text-sm">
            No disponible para jugadores offline
          </div>

          <!-- Loading -->
          <div v-else-if="nameHistoryLoading" class="flex justify-center py-8">
            <div class="w-8 h-8 border-3 border-dark-600 border-t-purple-500 rounded-full animate-spin" />
          </div>

          <!-- Empty -->
          <div v-else-if="nameHistory.length === 0" class="text-center py-8 text-text-muted text-sm">
            Sin historial de cambios
          </div>

          <!-- History list -->
          <div v-else class="max-h-[200px] overflow-y-auto space-y-2">
            <div
              v-for="entry in [...nameHistory].sort((a, b) => {
                if (a.name === player!.last_nick && b.name !== player!.last_nick) return -1
                if (b.name === player!.last_nick && a.name !== player!.last_nick) return 1
                const dateA = a.changedToAt ?? 0
                const dateB = b.changedToAt ?? 0
                return dateB - dateA
              })"
              :key="entry.name + (entry.changedToAt ?? '')"
              class="flex items-center gap-3 p-3 bg-white/[0.02] border border-glass-border-subtle rounded-lg hover:bg-hover hover:border-purple-500 transition-all"
              :class="entry.name === player!.last_nick ? 'border-purple-500/40 bg-purple-500/5' : ''"
            >
              <PlayerAvatar :uuid="uuid" :size="28" />
              <div class="flex-1 min-w-0">
                <div class="text-sm font-medium text-text-primary truncate">
                  {{ entry.name }}
                  <span v-if="entry.name === player!.last_nick" class="text-success text-xs ml-2">(Actual)</span>
                </div>
                <div class="text-xs text-text-muted">
                  {{ entry.changedToAt ? formatDate(new Date(entry.changedToAt).toISOString()) : 'Original' }}
                </div>
              </div>
            </div>
          </div>
        </section>

        <!-- Section 4: IP History -->
        <section>
          <div class="flex items-center gap-2 text-text-secondary text-sm font-semibold uppercase tracking-wider mb-4 pb-3 border-b border-glass-border-subtle">
            <Globe :size="16" class="text-purple-400" />
            Historial de IPs ({{ ips.length }})
          </div>

          <div v-if="ips.length === 0" class="text-center py-8 text-text-muted text-sm">
            Sin historial de IPs
          </div>

          <div v-else class="max-h-[200px] overflow-y-auto space-y-2">
            <div
              v-for="ip in ips"
              :key="ip.ip"
              class="flex items-center gap-3 p-3 bg-white/[0.02] border border-glass-border-subtle rounded-lg hover:bg-hover hover:border-purple-500 transition-all"
            >
              <div class="flex-1 min-w-0">
                <div class="text-sm font-medium text-text-primary font-mono">{{ ip.ip }}</div>
                <div class="flex items-center gap-2 text-xs text-text-muted mt-0.5">
                  <span v-if="ip.country" class="flex items-center gap-1">
                    <CountryFlag :code="ip.country_code ?? ''" />
                    {{ ip.country }}
                  </span>
                </div>
              </div>
              <div class="text-xs text-text-muted whitespace-nowrap">
                {{ formatDate(ip.first_used) }}
              </div>
            </div>
          </div>
        </section>

        <!-- Section 5: Recent Connections -->
        <section>
          <div class="flex items-center gap-2 text-text-secondary text-sm font-semibold uppercase tracking-wider mb-4 pb-3 border-b border-glass-border-subtle">
            <Link :size="16" class="text-purple-400" />
            Ultimas Conexiones
          </div>

          <!-- Loading -->
          <div v-if="connectionsLoading" class="flex justify-center py-8">
            <div class="w-8 h-8 border-3 border-dark-600 border-t-purple-500 rounded-full animate-spin" />
          </div>

          <!-- Empty -->
          <div v-else-if="connections.length === 0" class="text-center py-8 text-text-muted text-sm">
            Sin conexiones recientes
          </div>

          <!-- Connections table -->
          <div v-else class="overflow-x-auto">
            <table class="w-full">
              <thead>
                <tr>
                  <th class="text-left p-3 text-xs font-semibold text-text-muted uppercase tracking-wider border-b border-glass-border-subtle">Fecha</th>
                  <th class="text-left p-3 text-xs font-semibold text-text-muted uppercase tracking-wider border-b border-glass-border-subtle">IP</th>
                  <th class="text-left p-3 text-xs font-semibold text-text-muted uppercase tracking-wider border-b border-glass-border-subtle">Pais</th>
                  <th class="text-left p-3 text-xs font-semibold text-text-muted uppercase tracking-wider border-b border-glass-border-subtle">Estado</th>
                  <th class="text-left p-3 text-xs font-semibold text-text-muted uppercase tracking-wider border-b border-glass-border-subtle">Acciones</th>
                </tr>
              </thead>
              <tbody>
                <tr
                  v-for="c in connections"
                  :key="c.id"
                  class="hover:bg-hover transition-colors"
                >
                  <td class="p-3 text-sm text-text-primary">{{ formatDateShort(c.created_at) }}</td>
                  <td class="p-3 text-sm text-text-primary font-mono">{{ c.ip }}</td>
                  <td class="p-3 text-sm">
                    <span v-if="c.country" class="flex items-center gap-1.5">
                      <CountryFlag :code="c.country_code ?? ''" />
                      {{ c.country }}
                    </span>
                    <span v-else class="text-text-muted">N/A</span>
                  </td>
                  <td class="p-3">
                    <StatusBadge
                      :status="c.blocked ? 'Bloqueado' : 'Permitido'"
                      :variant="c.blocked ? 'danger' : 'success'"
                    />
                  </td>
                  <td class="p-3">
                    <button
                      class="px-3 py-1.5 bg-dark-700 border border-glass-border-subtle rounded text-xs text-text-secondary hover:bg-purple-500 hover:border-purple-500 hover:text-white transition-all"
                      @click="openConnectionDetail(c.id)"
                    >
                      Ver
                    </button>
                  </td>
                </tr>
              </tbody>
            </table>
          </div>
        </section>
      </div>
    </div>

    <!-- Modals -->
    <ConnectionModal
      v-model="showConnectionModal"
      :connection-id="activeConnectionId"
      @close="showConnectionModal = false"
    />

    <BlacklistModal
      v-model="showBlacklistModal"
      mode="add"
      variant="player"
      @close="showBlacklistModal = false"
      @submit="showBlacklistModal = false; loadPlayerData()"
    />

    <WhitelistModal
      v-model="showWhitelistModal"
      mode="add"
      @close="showWhitelistModal = false"
      @submit="showWhitelistModal = false; loadPlayerData()"
    />
  </div>
</template>
