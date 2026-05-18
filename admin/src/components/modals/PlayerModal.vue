<script setup lang="ts">
import { ref, watch } from 'vue'
import { useRouter } from 'vue-router'
import { usePlayersStore } from '@/stores/players'
import { useWhitelistStore } from '@/stores/whitelist'
import { useBlacklistStore } from '@/stores/blacklist'
import { useUIStore } from '@/stores/ui'
import type { Player } from '@/types'
import BaseModal from '@/components/shared/BaseModal.vue'
import PlayerAvatar from '@/components/shared/PlayerAvatar.vue'
import StatusBadge from '@/components/shared/StatusBadge.vue'
import CountryFlag from '@/components/shared/CountryFlag.vue'
import LoadingSkeleton from '@/components/shared/LoadingSkeleton.vue'

const props = defineProps<{
  modelValue: boolean
  uuid: string
}>()

const emit = defineEmits<{
  'update:modelValue': [value: boolean]
}>()

const router = useRouter()
const playersStore = usePlayersStore()
const whitelistStore = useWhitelistStore()
const blacklistStore = useBlacklistStore()
const uiStore = useUIStore()

const player = ref<Player | null>(null)
const loading = ref(false)

watch(
  () => props.modelValue,
  async (open) => {
    if (open && props.uuid) {
      loading.value = true
      try {
        await playersStore.fetchPlayer(props.uuid)
        player.value = playersStore.currentPlayer?.player ?? null
      } catch {
        player.value = null
      } finally {
        loading.value = false
      }
    }
  },
)

function viewFullDetail() {
  emit('update:modelValue', false)
  router.push({ name: 'player-detail', params: { uuid: props.uuid } })
}

async function addToWhitelist() {
  if (!player.value) return
  const success = await whitelistStore.add({
    type: 'uuid',
    value: player.value.uuid,
    reason: '',
  })
  if (success) {
    uiStore.showToast('success', 'Whitelist', 'Jugador anadido a whitelist')
    emit('update:modelValue', false)
  } else {
    uiStore.showToast('error', 'Error', whitelistStore.error ?? 'Error al anadir')
  }
}

async function addToBlacklist() {
  if (!player.value) return
  const success = await blacklistStore.add({
    type: 'uuid',
    value: player.value.uuid,
    reason: '',
  })
  if (success) {
    uiStore.showToast('success', 'Blacklist', 'Jugador anadido a blacklist')
    emit('update:modelValue', false)
  } else {
    uiStore.showToast('error', 'Error', blacklistStore.error ?? 'Error al anadir')
  }
}
</script>

<template>
  <BaseModal
    :model-value="modelValue"
    title="Vista Rapida del Jugador"
    size="sm"
    @update:model-value="emit('update:modelValue', $event)"
  >
    <LoadingSkeleton v-if="loading" :rows="4" />

    <div v-else-if="player" class="space-y-5">
      <!-- Player header -->
      <div class="flex items-center gap-4 p-4 rounded-xl bg-purple-500/5 border border-purple-500/10">
        <PlayerAvatar :uuid="uuid" :size="52" />
        <div class="flex-1 min-w-0">
          <div class="text-base font-semibold text-text-primary truncate">{{ player.last_nick }}</div>
          <div class="text-xs text-text-muted font-mono truncate mt-0.5">{{ uuid }}</div>
        </div>
      </div>

      <!-- Status badges -->
      <div class="flex flex-wrap items-center gap-2">
        <StatusBadge
          :status="player.is_online ? 'Online' : 'Offline'"
          :variant="player.is_online ? 'success' : 'neutral'"
        />
        <StatusBadge
          v-if="player.is_whitelisted"
          status="Whitelisted"
          variant="success"
        />
        <StatusBadge
          v-if="player.is_blacklisted"
          status="Blacklisted"
          variant="danger"
        />
      </div>

      <!-- Info grid -->
      <div class="grid grid-cols-2 gap-3 p-3.5 rounded-xl bg-dark-800/30 border border-glass-border-subtle">
        <div v-if="player.last_country" class="flex items-center gap-2 text-xs text-text-secondary">
          <CountryFlag :code="player.last_country_code ?? ''" />
          {{ player.last_country }}
        </div>
        <div v-if="player.last_ip" class="text-xs text-text-secondary font-mono col-span-2">
          IP: {{ player.last_ip }}
        </div>
        <div class="text-xs text-text-muted">
          Conexiones: <span class="text-text-secondary font-medium">{{ player.total_connections ?? 0 }}</span>
        </div>
      </div>

      <!-- Actions -->
      <div class="flex gap-2 pt-4 border-t border-glass-border-subtle">
        <button
          class="glass-button-secondary flex-1 px-3 py-2.5 text-xs font-medium hover:text-text-primary"
          @click="viewFullDetail"
        >
          Ver detalle completo
        </button>
        <button
          v-if="!player.is_whitelisted"
          class="px-3 py-2.5 rounded-xl text-xs font-semibold bg-green-500/10 text-green-400 border border-green-500/15 hover:bg-green-500/20 transition-all duration-200"
          @click="addToWhitelist"
        >
          Whitelist
        </button>
        <button
          v-if="!player.is_blacklisted"
          class="glass-button-danger px-3 py-2.5 text-xs"
          @click="addToBlacklist"
        >
          Blacklist
        </button>
      </div>
    </div>

    <!-- Not found -->
    <div v-else class="text-center py-8">
      <p class="text-text-muted text-sm">Jugador no encontrado</p>
    </div>
  </BaseModal>
</template>
