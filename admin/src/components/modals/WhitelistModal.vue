<script setup lang="ts">
import { ref, watch } from 'vue'
import { useWhitelistStore } from '@/stores/whitelist'
import { WHITELIST_TYPES } from '@/lib/constants'
import type { WhitelistEntry } from '@/types'
import BaseModal from '@/components/shared/BaseModal.vue'

const props = defineProps<{
  modelValue: boolean
  mode: 'add' | 'edit'
  entry?: WhitelistEntry
}>()

const emit = defineEmits<{
  'update:modelValue': [value: boolean]
  close: []
  submit: []
}>()

const store = useWhitelistStore()

const formType = ref('uuid')
const formValue = ref('')
const formReason = ref('')
const submitting = ref(false)

watch(
  () => props.modelValue,
  (open) => {
    if (open && props.mode === 'edit' && props.entry) {
      formType.value = props.entry.type
      formValue.value = props.entry.value
      formReason.value = props.entry.reason ?? ''
    } else if (open && props.mode === 'add') {
      formType.value = 'uuid'
      formValue.value = ''
      formReason.value = ''
    }
  },
)

async function handleSubmit() {
  if (!formValue.value.trim()) return

  submitting.value = true
  const data = {
    type: formType.value,
    value: formValue.value.trim(),
    reason: formReason.value.trim(),
  }

  let success: boolean
  if (props.mode === 'edit' && props.entry) {
    success = await store.edit(props.entry.id, data)
  } else {
    success = await store.add(data)
  }

  submitting.value = false
  if (success) {
    emit('submit')
  }
}
</script>

<template>
  <BaseModal
    :model-value="modelValue"
    :title="mode === 'add' ? 'Anadir a Whitelist' : 'Editar entrada'"
    size="md"
    @update:model-value="emit('update:modelValue', $event)"
  >
    <form class="space-y-5" @submit.prevent="handleSubmit">
      <!-- Type select -->
      <div>
        <label class="block text-sm font-medium text-text-secondary mb-1.5">Tipo</label>
        <select
          v-model="formType"
          class="glass-input w-full px-3 py-2 text-sm text-text-primary focus:outline-none focus:border-purple-500/40"
        >
          <option v-for="t in WHITELIST_TYPES" :key="t.id" :value="t.id">
            {{ t.label }}
          </option>
        </select>
      </div>

      <!-- Value input -->
      <div>
        <label class="block text-sm font-medium text-text-secondary mb-1.5">Valor</label>
        <input
          v-model="formValue"
          type="text"
          required
          class="glass-input w-full px-3 py-2 text-sm text-text-primary placeholder-text-muted focus:outline-none focus:border-purple-500/40"
          placeholder="UUID, nickname, IP, rango IP o ASN..."
        />
      </div>

      <!-- Reason textarea -->
      <div>
        <label class="block text-sm font-medium text-text-secondary mb-1.5">Razon</label>
        <textarea
          v-model="formReason"
          rows="3"
          class="glass-input w-full px-3 py-2 text-sm text-text-primary placeholder-text-muted focus:outline-none focus:border-purple-500/40 resize-none"
          placeholder="Razon de la entrada (opcional)..."
        />
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
          :disabled="submitting || !formValue.trim()"
          class="glass-button px-4 py-2.5 text-sm disabled:opacity-50"
        >
          {{ submitting ? 'Guardando...' : mode === 'add' ? 'Anadir' : 'Guardar' }}
        </button>
      </div>
    </form>
  </BaseModal>
</template>
