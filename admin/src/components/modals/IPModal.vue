<script setup lang="ts">
import { watch } from 'vue'
import { useIPsStore } from '@/stores/ips'
import BaseModal from '@/components/shared/BaseModal.vue'
import LoadingSkeleton from '@/components/shared/LoadingSkeleton.vue'
import CountryFlag from '@/components/shared/CountryFlag.vue'
import StatusBadge from '@/components/shared/StatusBadge.vue'
import PlayerCell from '@/components/shared/PlayerCell.vue'
import { MapPin, Building2, Hash, Users, Link } from 'lucide-vue-next'

const props = defineProps<{
  modelValue: boolean
  ip: string
}>()

const emit = defineEmits<{
  'update:modelValue': [value: boolean]
  close: []
}>()

const store = useIPsStore()

watch(
  () => props.ip,
  (ip) => {
    if (ip) {
      store.fetchIPDetail(ip)
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
  })
}
</script>

<template>
  <BaseModal
    :model-value="modelValue"
    title="Detalle de IP"
    size="lg"
    @update:model-value="emit('update:modelValue', $event)"
  >
    <LoadingSkeleton v-if="store.detailLoading" :rows="6" />

    <div v-else-if="store.currentIP" class="space-y-5">
      <!-- IP & Country row -->
      <div class="grid grid-cols-1 sm:grid-cols-2 gap-4">
        <div class="p-3.5 rounded-xl bg-dark-800/30 border border-glass-border-subtle">
          <label class="text-xs text-text-muted uppercase tracking-wider font-medium">Direccion IP</label>
          <div class="mt-2 text-sm text-text-primary font-mono">{{ store.currentIP.ip }}</div>
        </div>
        <div class="p-3.5 rounded-xl bg-dark-800/30 border border-glass-border-subtle">
          <label class="text-xs text-text-muted uppercase tracking-wider font-medium flex items-center gap-1.5">
            <MapPin :size="12" />
            Ubicacion
          </label>
          <div class="mt-2 flex items-center gap-2">
            <CountryFlag :code="store.currentIP.country_code ?? ''" />
            <span class="text-sm text-text-primary">{{ store.currentIP.country ?? '-' }}</span>
          </div>
        </div>
      </div>

      <!-- ISP & ASN row -->
      <div class="grid grid-cols-1 sm:grid-cols-2 gap-4">
        <div class="p-3.5 rounded-xl bg-dark-800/30 border border-glass-border-subtle">
          <label class="text-xs text-text-muted uppercase tracking-wider font-medium flex items-center gap-1.5">
            <Building2 :size="12" />
            ISP
          </label>
          <div class="mt-2 text-sm text-text-primary">{{ store.currentIP.isp ?? '-' }}</div>
        </div>
        <div class="p-3.5 rounded-xl bg-dark-800/30 border border-glass-border-subtle">
          <label class="text-xs text-text-muted uppercase tracking-wider font-medium flex items-center gap-1.5">
            <Hash :size="12" />
            ASN
          </label>
          <div class="mt-2 text-sm text-text-primary font-mono">{{ store.currentIP.asn ?? '-' }}</div>
        </div>
      </div>

      <!-- Status row -->
      <div class="border-t border-glass-border-subtle pt-4">
        <label class="text-xs text-text-muted uppercase tracking-wider font-medium">Estado</label>
        <div class="mt-2 flex items-center gap-2">
          <StatusBadge
            v-if="store.currentIP.is_blacklisted"
            status="En Blacklist"
            variant="danger"
          />
          <StatusBadge
            v-if="store.currentIP.is_whitelisted"
            status="En Whitelist"
            variant="success"
          />
          <span
            v-if="!store.currentIP.is_blacklisted && !store.currentIP.is_whitelisted"
            class="text-sm text-text-muted"
          >
            Sin restricciones
          </span>
        </div>
      </div>

      <!-- Stats row -->
      <div class="border-t border-glass-border-subtle pt-4">
        <div class="grid grid-cols-2 gap-4">
          <div class="p-3.5 rounded-xl bg-purple-500/5 border border-purple-500/10 text-center">
            <label class="text-xs text-text-muted uppercase tracking-wider font-medium flex items-center justify-center gap-1.5">
              <Link :size="12" />
              Conexiones
            </label>
            <div class="mt-2 text-2xl font-semibold text-text-primary gradient-text">{{ store.currentIP.connection_count ?? 0 }}</div>
          </div>
          <div class="p-3.5 rounded-xl bg-purple-500/5 border border-purple-500/10 text-center">
            <label class="text-xs text-text-muted uppercase tracking-wider font-medium flex items-center justify-center gap-1.5">
              <Users :size="12" />
              Jugadores
            </label>
            <div class="mt-2 text-2xl font-semibold text-text-primary gradient-text">{{ store.currentIPPlayers.length }}</div>
          </div>
        </div>
      </div>

      <!-- Associated players -->
      <div v-if="store.currentIPPlayers.length > 0" class="border-t border-glass-border-subtle pt-4">
        <label class="text-xs text-text-muted uppercase tracking-wider font-medium mb-3 block">Jugadores asociados</label>
        <div class="space-y-2 max-h-48 overflow-y-auto">
          <div
            v-for="player in store.currentIPPlayers"
            :key="player.uuid"
            class="flex items-center justify-between px-3.5 py-2.5 rounded-xl bg-dark-800/30 border border-glass-border-subtle hover:bg-dark-700/40 transition-colors"
          >
            <PlayerCell :uuid="player.uuid" :nick="player.nick" />
            <span class="text-xs text-text-muted font-mono">{{ formatDate(player.last_used) }}</span>
          </div>
        </div>
      </div>
    </div>

    <!-- Error state -->
    <div v-else-if="store.error" class="text-center py-8">
      <div class="w-12 h-12 mx-auto mb-3 rounded-2xl bg-error-dim border border-red-500/15 flex items-center justify-center">
        <Hash :size="24" class="text-red-400" />
      </div>
      <p class="text-red-400 text-sm">{{ store.error }}</p>
    </div>
  </BaseModal>
</template>
