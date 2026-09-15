<script setup lang="ts">
import { ref, watch, nextTick } from 'vue'
import { useBlacklistStore } from '@/stores/blacklist'
import { usePlayersStore } from '@/stores/players'
import { BLACKLIST_TYPES, DURATION_PRESETS } from '@/lib/constants'
import type { BlacklistEntry, PlayerLookup } from '@/types'
import BaseModal from '@/components/shared/BaseModal.vue'
import PlayerAvatar from '@/components/shared/PlayerAvatar.vue'
import { CheckCircle2, XCircle, Search, Loader2 } from 'lucide-vue-next'

const props = defineProps<{
  modelValue: boolean
  mode: 'add' | 'edit'
  variant: 'player' | 'ip' | 'unified'
  entry?: BlacklistEntry
  prefillPlayerName?: string
}>()

const emit = defineEmits<{
  'update:modelValue': [value: boolean]
  close: []
  submit: []
}>()

const store = useBlacklistStore()
const playersStore = usePlayersStore()

const formType = ref('uuid')
const formValue = ref('')
const formReason = ref('')
const formDuration = ref(0)
const formStainIp = ref(true)
const submitting = ref(false)

// Player lookup state
const lookupQuery = ref('')
const lookupLoading = ref(false)
const lookupResult = ref<PlayerLookup | null>(null)

const ipTypes = [
  { id: 'ip', label: 'IP' },
  { id: 'asn', label: 'ASN' },
  { id: 'cidr', label: 'CIDR' },
]

watch(
  () => props.modelValue,
  async (open) => {
    if (open && props.mode === 'edit' && props.entry) {
      formType.value = props.entry.type
      formValue.value = props.entry.value
      formReason.value = props.entry.reason ?? ''
      formDuration.value = -1
      lookupResult.value = null
      lookupQuery.value = props.entry.minecraft_name ?? props.entry.value
    } else if (open && props.mode === 'add') {
      formType.value = props.variant === 'ip' ? 'ip' : 'uuid'
      formValue.value = ''
      formReason.value = ''
      formDuration.value = 0
      formStainIp.value = true
      lookupResult.value = null

      if (props.prefillPlayerName) {
        lookupQuery.value = props.prefillPlayerName
        await nextTick()
        doLookup()
      } else {
        lookupQuery.value = ''
      }
    }
  },
)

async function doLookup() {
  const name = lookupQuery.value.trim()
  if (!name) return

  lookupLoading.value = true
  lookupResult.value = null

  try {
    await playersStore.lookupPlayer(name)
    lookupResult.value = playersStore.lookupResult
  } catch {
    lookupResult.value = { is_premium: false, uuid: null, name, error: 'Error de conexion' }
  } finally {
    lookupLoading.value = false
  }
}

function onLookupKeydown(e: KeyboardEvent) {
  if (e.key === 'Enter') {
    e.preventDefault()
    doLookup()
  }
}

async function handleSubmit() {
  submitting.value = true

  let success: boolean

  if (props.mode === 'edit' && props.entry) {
    success = await store.edit(props.entry.id, {
      type: formType.value,
      value: formValue.value.trim(),
      reason: formReason.value.trim(),
      duration: formDuration.value,
    })
  } else if (props.variant === 'unified') {
    const data: Record<string, unknown> = {
      player_name: lookupQuery.value.trim(),
      reason: formReason.value.trim(),
      duration: formDuration.value,
      stain_ip: formStainIp.value ? 1 : 0,
    }
    // Pass lookup result so backend skips re-querying Mojang
    if (lookupResult.value) {
      data.is_premium = lookupResult.value.is_premium
      data.uuid = lookupResult.value.uuid
    }
    success = await store.addUnified(data as Parameters<typeof store.addUnified>[0])
  } else if (props.variant === 'player') {
    success = await store.add({
      type: formType.value,
      value: formValue.value.trim(),
      reason: formReason.value.trim(),
      duration: formDuration.value,
      stain_ip: formStainIp.value ? 1 : 0,
    })
  } else {
    success = await store.addIP({
      value: formValue.value.trim(),
      reason: formReason.value.trim(),
    })
  }

  submitting.value = false
  if (success) {
    emit('submit')
  }
}

const modalTitle = () => {
  if (props.mode === 'edit') return 'Editar entrada'
  if (props.variant === 'player') return 'Bloquear jugador'
  if (props.variant === 'ip') return 'Bloquear IP/ASN/CIDR'
  return 'Anadir a Blacklist'
}
</script>

<template>
  <BaseModal
    :model-value="modelValue"
    :title="modalTitle()"
    size="md"
    @update:model-value="emit('update:modelValue', $event)"
  >
    <form class="space-y-5" @submit.prevent="handleSubmit">
      <!-- Unified mode: player lookup -->
      <div v-if="variant === 'unified' && mode === 'add'">
        <label class="block text-sm font-medium text-text-secondary mb-1.5">Jugador</label>
        <div class="flex gap-2">
          <input
            v-model="lookupQuery"
            type="text"
            required
            class="glass-input flex-1 px-3 py-2 text-sm text-text-primary placeholder-text-muted focus:outline-none focus:border-purple-500/40"
            placeholder="Nombre del jugador..."
            @keydown="onLookupKeydown"
          />
          <button
            type="button"
            class="glass-button px-3 py-2 text-sm flex items-center gap-1.5 shrink-0 disabled:opacity-50"
            :disabled="lookupLoading || !lookupQuery.trim()"
            @click="doLookup"
          >
            <Loader2 v-if="lookupLoading" :size="14" class="animate-spin" />
            <Search v-else :size="14" />
            Verificar
          </button>
        </div>

        <!-- Lookup result -->
        <div v-if="lookupResult" class="mt-3 p-3.5 rounded-xl border backdrop-blur-sm" :class="lookupResult.is_premium ? 'bg-green-500/5 border-green-500/20' : 'bg-red-500/5 border-red-500/20'">
          <div class="flex items-center gap-3">
            <PlayerAvatar
              v-if="lookupResult.is_premium && lookupResult.uuid"
              :uuid="lookupResult.uuid"
              :size="40"
            />
            <div
              v-else
              class="w-10 h-10 rounded-lg bg-dark-700/60 flex items-center justify-center text-purple-400 font-semibold text-lg"
            >
              {{ (lookupResult.name ?? lookupQuery).charAt(0).toUpperCase() }}
            </div>
            <div class="flex-1 min-w-0">
              <div class="text-sm font-medium text-text-primary">{{ lookupResult.name ?? lookupQuery }}</div>
              <div class="flex items-center gap-1.5 mt-0.5">
                <span
                  v-if="lookupResult.is_premium"
                  class="inline-flex items-center gap-1 px-2 py-0.5 rounded-full text-[11px] font-semibold bg-green-500/15 text-green-400"
                >
                  <CheckCircle2 :size="11" />
                  Premium
                </span>
                <span
                  v-else
                  class="inline-flex items-center gap-1 px-2 py-0.5 rounded-full text-[11px] font-semibold bg-red-500/15 text-red-400"
                >
                  <XCircle :size="11" />
                  No Premium
                </span>
                <span v-if="lookupResult.uuid" class="text-[11px] text-text-muted font-mono truncate">
                  {{ lookupResult.uuid }}
                </span>
              </div>
            </div>
          </div>
        </div>
        <p v-else class="text-xs text-text-muted mt-1.5">Escribe un nombre y pulsa Verificar para detectar si es premium</p>
      </div>

      <!-- Player mode: type select + value -->
      <template v-else-if="variant === 'player' || mode === 'edit'">
        <div>
          <label class="block text-sm font-medium text-text-secondary mb-1.5">Tipo</label>
          <select
            v-model="formType"
            class="glass-input w-full px-3 py-2 text-sm text-text-primary focus:outline-none focus:border-purple-500/40"
          >
            <option v-for="t in BLACKLIST_TYPES.filter(t => t.id === 'uuid' || t.id === 'nick')" :key="t.id" :value="t.id">
              {{ t.label }}
            </option>
          </select>
        </div>
        <div>
          <label class="block text-sm font-medium text-text-secondary mb-1.5">Valor</label>
          <input
            v-model="formValue"
            type="text"
            required
            class="glass-input w-full px-3 py-2 text-sm text-text-primary placeholder-text-muted focus:outline-none focus:border-purple-500/40"
            placeholder="UUID o nickname..."
          />
        </div>
      </template>

      <!-- IP mode: type select + value -->
      <template v-else-if="variant === 'ip'">
        <div>
          <label class="block text-sm font-medium text-text-secondary mb-1.5">Tipo</label>
          <select
            v-model="formType"
            class="glass-input w-full px-3 py-2 text-sm text-text-primary focus:outline-none focus:border-purple-500/40"
          >
            <option v-for="t in ipTypes" :key="t.id" :value="t.id">
              {{ t.label }}
            </option>
          </select>
        </div>
        <div>
          <label class="block text-sm font-medium text-text-secondary mb-1.5">Valor</label>
          <input
            v-model="formValue"
            type="text"
            required
            class="glass-input w-full px-3 py-2 text-sm text-text-primary placeholder-text-muted focus:outline-none focus:border-purple-500/40"
            placeholder="IP, ASN o rango CIDR..."
          />
        </div>
      </template>

      <!-- Reason textarea -->
      <div>
        <label class="block text-sm font-medium text-text-secondary mb-1.5">Razon</label>
        <textarea
          v-model="formReason"
          rows="3"
          class="glass-input w-full px-3 py-2 text-sm text-text-primary placeholder-text-muted focus:outline-none focus:border-purple-500/40 resize-none"
          placeholder="Razon del bloqueo..."
        />
      </div>

      <!-- Duration select (not for IP-only variant in add mode) -->
      <div v-if="variant !== 'ip' || mode === 'edit'">
        <label class="block text-sm font-medium text-text-secondary mb-1.5">Duracion</label>
        <select
          v-model="formDuration"
          class="glass-input w-full px-3 py-2 text-sm text-text-primary focus:outline-none focus:border-purple-500/40"
        >
          <option v-for="d in DURATION_PRESETS" :key="d.value" :value="d.value">
            {{ d.label }}
          </option>
        </select>
      </div>

      <!-- Stain IP toggle (only for player/unified variants in add mode) -->
      <div v-if="(variant === 'player' || variant === 'unified') && mode === 'add'" class="flex items-center gap-3 p-3 rounded-xl bg-purple-500/5 border border-purple-500/10">
        <input
          id="stain-ip"
          v-model="formStainIp"
          type="checkbox"
          class="w-4 h-4 rounded border-glass-border-subtle bg-dark-800 text-purple-500 focus:ring-purple-500"
        />
        <label for="stain-ip" class="text-sm text-text-secondary">
          Marcar IPs asociadas (IP manchada)
        </label>
      </div>

      <!-- Error display -->
      <div v-if="store.error" class="flex items-center gap-2 p-3 rounded-xl bg-error-dim border border-red-500/15">
        <div class="w-1.5 h-1.5 rounded-full bg-red-400 animate-pulse"></div>
        <p class="text-red-400 text-sm">{{ store.error }}</p>
      </div>

      <!-- Actions -->
      <div class="flex items-center justify-end gap-3 pt-3 border-t border-glass-border-subtle">
        <button
          type="button"
          class="glass-button-secondary px-4 py-2.5 text-sm hover:text-text-primary"
          @click="emit('close')"
        >
          Cancelar
        </button>
        <button
          type="submit"
          :disabled="submitting || (variant === 'unified' && mode === 'add' && !lookupQuery.trim())"
          class="glass-button-danger px-4 py-2.5 text-sm disabled:opacity-50"
        >
          {{ submitting ? 'Guardando...' : mode === 'add' ? 'Bloquear' : 'Guardar' }}
        </button>
      </div>
    </form>
  </BaseModal>
</template>
