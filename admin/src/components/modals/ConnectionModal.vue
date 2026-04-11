<script setup lang="ts">
import { watch } from 'vue'
import { useConnectionsStore } from '@/stores/connections'
import BaseModal from '@/components/shared/BaseModal.vue'
import LoadingSkeleton from '@/components/shared/LoadingSkeleton.vue'
import PlayerCell from '@/components/shared/PlayerCell.vue'
import IPCell from '@/components/shared/IPCell.vue'
import StatusBadge from '@/components/shared/StatusBadge.vue'
import CountryFlag from '@/components/shared/CountryFlag.vue'
import { MapPin, Building2, Hash, Clock, AlertTriangle } from 'lucide-vue-next'

const props = defineProps<{
  modelValue: boolean
  connectionId: number | null
}>()

const emit = defineEmits<{
  'update:modelValue': [value: boolean]
  close: []
}>()

const store = useConnectionsStore()

watch(
  () => props.connectionId,
  (id) => {
    if (id !== null) {
      store.fetchConnection(id)
    }
  },
)

function formatDate(dateStr: string | null): string {
  if (!dateStr) return '-'
  return new Date(dateStr).toLocaleString('es-ES', {
    day: '2-digit',
    month: '2-digit',
    year: 'numeric',
    hour: '2-digit',
    minute: '2-digit',
    second: '2-digit',
  })
}
</script>

<template>
  <BaseModal
    :model-value="modelValue"
    title="Detalle de Conexion"
    size="lg"
    @update:model-value="emit('update:modelValue', $event)"
  >
    <LoadingSkeleton v-if="store.detailLoading" :rows="6" />

    <div v-else-if="store.currentConnection" class="space-y-4">
      <!-- Player & IP row -->
      <div class="grid grid-cols-1 sm:grid-cols-2 gap-4">
        <div>
          <label class="text-xs text-text-muted uppercase tracking-wider">Jugador</label>
          <div class="mt-1">
            <PlayerCell
              :uuid="store.currentConnection.uuid"
              :nick="store.currentConnection.nick"
            />
          </div>
        </div>
        <div>
          <label class="text-xs text-text-muted uppercase tracking-wider">IP</label>
          <div class="mt-1">
            <IPCell
              :ip="store.currentConnection.ip"
              :country-code="store.currentConnection.country_code"
              :isp="store.currentConnection.isp"
            />
          </div>
        </div>
      </div>

      <!-- Location row -->
      <div class="grid grid-cols-1 sm:grid-cols-2 gap-4">
        <div>
          <label class="text-xs text-text-muted uppercase tracking-wider flex items-center gap-1">
            <MapPin :size="12" />
            Ubicacion
          </label>
          <div class="mt-1 flex items-center gap-2">
            <CountryFlag :code="store.currentConnection.country_code ?? ''" />
            <span class="text-sm text-text-primary">
              {{ [store.currentConnection.city, store.currentConnection.region, store.currentConnection.country].filter(Boolean).join(', ') || '-' }}
            </span>
          </div>
        </div>
        <div>
          <label class="text-xs text-text-muted uppercase tracking-wider flex items-center gap-1">
            <Building2 :size="12" />
            ISP / Organizacion
          </label>
          <div class="mt-1 text-sm text-text-primary">
            {{ store.currentConnection.isp ?? '-' }}
          </div>
          <div v-if="store.currentConnection.org" class="text-xs text-text-muted mt-0.5">
            {{ store.currentConnection.org }}
          </div>
        </div>
      </div>

      <!-- ASN row -->
      <div class="grid grid-cols-1 sm:grid-cols-2 gap-4">
        <div>
          <label class="text-xs text-text-muted uppercase tracking-wider flex items-center gap-1">
            <Hash :size="12" />
            ASN
          </label>
          <div class="mt-1 text-sm text-text-primary font-mono">
            {{ store.currentConnection.asn ?? '-' }}
            <span v-if="store.currentConnection.asname" class="text-text-muted font-sans">
              ({{ store.currentConnection.asname }})
            </span>
          </div>
        </div>
        <div>
          <label class="text-xs text-text-muted uppercase tracking-wider flex items-center gap-1">
            <Clock :size="12" />
            Fecha / Hora
          </label>
          <div class="mt-1 text-sm text-text-primary font-mono">
            {{ formatDate(store.currentConnection.created_at) }}
          </div>
        </div>
      </div>

      <!-- Status & flags -->
      <div class="border-t border-glass-border-subtle pt-4">
        <label class="text-xs text-text-muted uppercase tracking-wider">Estado</label>
        <div class="mt-2 flex flex-wrap items-center gap-2">
          <StatusBadge
            :status="store.currentConnection.blocked ? 'Bloqueado' : 'Permitido'"
            :variant="store.currentConnection.blocked ? 'danger' : 'success'"
          />
          <span
            v-if="store.currentConnection.is_proxy"
            class="inline-flex px-2 py-0.5 rounded text-xs font-semibold bg-amber-500/15 text-amber-400"
          >
            PROXY
          </span>
          <span
            v-if="store.currentConnection.is_vpn"
            class="inline-flex px-2 py-0.5 rounded text-xs font-semibold bg-red-500/15 text-red-400"
          >
            VPN
          </span>
          <span
            v-if="store.currentConnection.is_hosting"
            class="inline-flex px-2 py-0.5 rounded text-xs font-semibold bg-pink-500/15 text-pink-400"
          >
            HOSTING
          </span>
          <span
            v-if="store.currentConnection.is_mobile"
            class="inline-flex px-2 py-0.5 rounded text-xs font-semibold bg-blue-500/15 text-blue-400"
          >
            MOBILE
          </span>
        </div>
      </div>

      <!-- Block reason -->
      <div v-if="store.currentConnection.blocked && store.currentConnection.block_reason" class="border-t border-glass-border-subtle pt-4">
        <label class="text-xs text-text-muted uppercase tracking-wider flex items-center gap-1">
          <AlertTriangle :size="12" />
          Razon del bloqueo
        </label>
        <div class="mt-1 text-sm text-red-400 bg-error-dim rounded-lg p-3">
          {{ store.currentConnection.block_reason }}
        </div>
      </div>

      <!-- Extra info -->
      <div class="border-t border-glass-border-subtle pt-4">
        <div class="grid grid-cols-2 sm:grid-cols-4 gap-3 text-xs">
          <div v-if="store.currentConnection.game_version">
            <span class="text-text-muted">Version:</span>
            <span class="text-text-secondary ml-1">{{ store.currentConnection.game_version }}</span>
          </div>
          <div v-if="store.currentConnection.ip_version">
            <span class="text-text-muted">IP Ver:</span>
            <span class="text-text-secondary ml-1 uppercase">{{ store.currentConnection.ip_version }}</span>
          </div>
          <div v-if="store.currentConnection.timezone">
            <span class="text-text-muted">Zona:</span>
            <span class="text-text-secondary ml-1">{{ store.currentConnection.timezone }}</span>
          </div>
          <div v-if="store.currentConnection.latitude && store.currentConnection.longitude">
            <span class="text-text-muted">Coords:</span>
            <span class="text-text-secondary ml-1 font-mono">
              {{ store.currentConnection.latitude }}, {{ store.currentConnection.longitude }}
            </span>
          </div>
        </div>
      </div>
    </div>

    <!-- Error state -->
    <div v-else-if="store.error" class="text-center py-8">
      <p class="text-red-400 text-sm">{{ store.error }}</p>
    </div>
  </BaseModal>
</template>
