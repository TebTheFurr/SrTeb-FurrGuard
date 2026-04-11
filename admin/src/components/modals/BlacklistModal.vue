<script setup lang="ts">
import { ref, watch } from 'vue'
import { useBlacklistStore } from '@/stores/blacklist'
import { BLACKLIST_TYPES, DURATION_PRESETS } from '@/lib/constants'
import type { BlacklistEntry } from '@/types'
import BaseModal from '@/components/shared/BaseModal.vue'

const props = defineProps<{
  modelValue: boolean
  mode: 'add' | 'edit'
  variant: 'player' | 'ip' | 'unified'
  entry?: BlacklistEntry
}>()

const emit = defineEmits<{
  'update:modelValue': [value: boolean]
  close: []
  submit: []
}>()

const store = useBlacklistStore()

const formType = ref('uuid')
const formValue = ref('')
const formReason = ref('')
const formDuration = ref(0)
const formStainIp = ref(true)
const formPlayerName = ref('')
const submitting = ref(false)

const ipTypes = [
  { id: 'ip', label: 'IP' },
  { id: 'asn', label: 'ASN' },
  { id: 'cidr', label: 'CIDR' },
]

watch(
  () => props.modelValue,
  (open) => {
    if (open && props.mode === 'edit' && props.entry) {
      formType.value = props.entry.type
      formValue.value = props.entry.value
      formReason.value = props.entry.reason ?? ''
      formDuration.value = -1
      formPlayerName.value = props.entry.minecraft_name ?? props.entry.value
    } else if (open && props.mode === 'add') {
      formType.value = props.variant === 'ip' ? 'ip' : 'uuid'
      formValue.value = ''
      formReason.value = ''
      formDuration.value = 0
      formStainIp.value = true
      formPlayerName.value = ''
    }
  },
)

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
    success = await store.addUnified({
      player_name: formValue.value.trim(),
      reason: formReason.value.trim(),
      duration: formDuration.value,
      stain_ip: formStainIp.value ? 1 : 0,
    })
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
  if (props.variant === 'ip') return 'Bloquear IP/ASN'
  return 'Añadir a Blacklist'
}
</script>

<template>
  <BaseModal
    :model-value="modelValue"
    :title="modalTitle()"
    size="md"
    @update:model-value="emit('update:modelValue', $event)"
  >
    <form class="space-y-4" @submit.prevent="handleSubmit">
      <!-- Unified mode: single input -->
      <div v-if="variant === 'unified' && mode === 'add'">
        <label class="block text-xs text-text-muted uppercase tracking-wider mb-1">Jugador</label>
        <input
          v-model="formValue"
          type="text"
          required
          class="w-full px-3 py-2 rounded-lg bg-dark-800 border border-glass-border-subtle text-text-primary text-sm focus:outline-none focus:border-purple-500"
          placeholder="Nombre del jugador..."
        />
        <p class="text-xs text-text-muted mt-1">Se detectara automaticamente si es premium o no premium</p>
      </div>

      <!-- Player mode: type select + value -->
      <template v-else-if="variant === 'player' || mode === 'edit'">
        <div>
          <label class="block text-xs text-text-muted uppercase tracking-wider mb-1">Tipo</label>
          <select
            v-model="formType"
            class="w-full px-3 py-2 rounded-lg bg-dark-800 border border-glass-border-subtle text-text-primary text-sm focus:outline-none focus:border-purple-500"
          >
            <option v-for="t in BLACKLIST_TYPES.filter(t => t.id === 'uuid' || t.id === 'nick')" :key="t.id" :value="t.id">
              {{ t.label }}
            </option>
          </select>
        </div>
        <div>
          <label class="block text-xs text-text-muted uppercase tracking-wider mb-1">Valor</label>
          <input
            v-model="formValue"
            type="text"
            required
            class="w-full px-3 py-2 rounded-lg bg-dark-800 border border-glass-border-subtle text-text-primary text-sm focus:outline-none focus:border-purple-500"
            placeholder="UUID o nickname..."
          />
        </div>
      </template>

      <!-- IP mode: type select + value -->
      <template v-else-if="variant === 'ip'">
        <div>
          <label class="block text-xs text-text-muted uppercase tracking-wider mb-1">Tipo</label>
          <select
            v-model="formType"
            class="w-full px-3 py-2 rounded-lg bg-dark-800 border border-glass-border-subtle text-text-primary text-sm focus:outline-none focus:border-purple-500"
          >
            <option v-for="t in ipTypes" :key="t.id" :value="t.id">
              {{ t.label }}
            </option>
          </select>
        </div>
        <div>
          <label class="block text-xs text-text-muted uppercase tracking-wider mb-1">Valor</label>
          <input
            v-model="formValue"
            type="text"
            required
            class="w-full px-3 py-2 rounded-lg bg-dark-800 border border-glass-border-subtle text-text-primary text-sm focus:outline-none focus:border-purple-500"
            placeholder="IP, ASN o rango CIDR..."
          />
        </div>
      </template>

      <!-- Reason textarea -->
      <div>
        <label class="block text-xs text-text-muted uppercase tracking-wider mb-1">Razon</label>
        <textarea
          v-model="formReason"
          rows="3"
          class="w-full px-3 py-2 rounded-lg bg-dark-800 border border-glass-border-subtle text-text-primary text-sm focus:outline-none focus:border-purple-500 resize-none"
          placeholder="Razon del bloqueo..."
        />
      </div>

      <!-- Duration select (not for IP-only variant in add mode) -->
      <div v-if="variant !== 'ip' || mode === 'edit'">
        <label class="block text-xs text-text-muted uppercase tracking-wider mb-1">Duracion</label>
        <select
          v-model="formDuration"
          class="w-full px-3 py-2 rounded-lg bg-dark-800 border border-glass-border-subtle text-text-primary text-sm focus:outline-none focus:border-purple-500"
        >
          <option v-for="d in DURATION_PRESETS" :key="d.value" :value="d.value">
            {{ d.label }}
          </option>
        </select>
      </div>

      <!-- Stain IP toggle (only for player/unified variants in add mode) -->
      <div v-if="(variant === 'player' || variant === 'unified') && mode === 'add'" class="flex items-center gap-3">
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
      <p v-if="store.error" class="text-red-400 text-sm">{{ store.error }}</p>

      <!-- Actions -->
      <div class="flex items-center justify-end gap-3 pt-2">
        <button
          type="button"
          class="px-4 py-2 rounded-lg text-sm text-text-muted hover:text-text-primary transition-colors"
          @click="emit('close')"
        >
          Cancelar
        </button>
        <button
          type="submit"
          :disabled="submitting || !formValue.trim()"
          class="px-4 py-2 rounded-lg bg-red-500 hover:bg-red-600 text-white text-sm font-medium transition-colors disabled:opacity-50"
        >
          {{ submitting ? 'Guardando...' : mode === 'add' ? 'Bloquear' : 'Guardar' }}
        </button>
      </div>
    </form>
  </BaseModal>
</template>
