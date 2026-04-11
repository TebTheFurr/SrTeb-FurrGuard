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
    :title="mode === 'add' ? 'Añadir a Whitelist' : 'Editar entrada'"
    size="md"
    @update:model-value="emit('update:modelValue', $event)"
  >
    <form class="space-y-4" @submit.prevent="handleSubmit">
      <!-- Type select -->
      <div>
        <label class="block text-xs text-text-muted uppercase tracking-wider mb-1">Tipo</label>
        <select
          v-model="formType"
          class="w-full px-3 py-2 rounded-lg bg-dark-800 border border-glass-border-subtle text-text-primary text-sm focus:outline-none focus:border-purple-500"
        >
          <option v-for="t in WHITELIST_TYPES" :key="t.id" :value="t.id">
            {{ t.label }}
          </option>
        </select>
      </div>

      <!-- Value input -->
      <div>
        <label class="block text-xs text-text-muted uppercase tracking-wider mb-1">Valor</label>
        <input
          v-model="formValue"
          type="text"
          required
          class="w-full px-3 py-2 rounded-lg bg-dark-800 border border-glass-border-subtle text-text-primary text-sm focus:outline-none focus:border-purple-500"
          placeholder="UUID, nickname, IP, rango IP o ASN..."
        />
      </div>

      <!-- Reason textarea -->
      <div>
        <label class="block text-xs text-text-muted uppercase tracking-wider mb-1">Razon</label>
        <textarea
          v-model="formReason"
          rows="3"
          class="w-full px-3 py-2 rounded-lg bg-dark-800 border border-glass-border-subtle text-text-primary text-sm focus:outline-none focus:border-purple-500 resize-none"
          placeholder="Razon de la entrada (opcional)..."
        />
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
          class="px-4 py-2 rounded-lg bg-purple-500 hover:bg-purple-600 text-white text-sm font-medium transition-colors disabled:opacity-50"
        >
          {{ submitting ? 'Guardando...' : mode === 'add' ? 'Añadir' : 'Guardar' }}
        </button>
      </div>
    </form>
  </BaseModal>
</template>
