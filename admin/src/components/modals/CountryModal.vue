<script setup lang="ts">
import { ref, watch } from 'vue'
import { useCountriesStore } from '@/stores/countries'
import type { Country } from '@/types'
import BaseModal from '@/components/shared/BaseModal.vue'

const props = defineProps<{
  modelValue: boolean
  mode: 'add' | 'edit'
  entry?: Country
}>()

const emit = defineEmits<{
  'update:modelValue': [value: boolean]
  close: []
  submit: []
}>()

const store = useCountriesStore()

const formCode = ref('')
const formName = ref('')
const formKickMessage = ref('')
const submitting = ref(false)

watch(
  () => props.modelValue,
  (open) => {
    if (open && props.mode === 'edit' && props.entry) {
      formCode.value = props.entry.country_code
      formName.value = props.entry.country_name
      formKickMessage.value = props.entry.kick_message ?? ''
    } else if (open && props.mode === 'add') {
      formCode.value = ''
      formName.value = ''
      formKickMessage.value = ''
    }
  },
)

async function handleSubmit() {
  if (props.mode === 'add' && (!formCode.value.trim() || !formName.value.trim())) return
  if (props.mode === 'edit' && !formName.value.trim()) return

  submitting.value = true
  let success: boolean

  if (props.mode === 'edit' && props.entry) {
    success = await store.edit(props.entry.id, {
      country_name: formName.value.trim(),
      kick_message: formKickMessage.value.trim(),
    })
  } else {
    success = await store.add({
      country_code: formCode.value.trim().toUpperCase(),
      country_name: formName.value.trim(),
      kick_message: formKickMessage.value.trim(),
    })
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
    :title="mode === 'add' ? 'Bloquear pais' : 'Editar pais'"
    size="md"
    @update:model-value="emit('update:modelValue', $event)"
  >
    <form class="space-y-5" @submit.prevent="handleSubmit">
      <!-- Country code input -->
      <div>
        <label class="block text-sm font-medium text-text-secondary mb-1.5">Codigo de pais</label>
        <input
          v-model="formCode"
          type="text"
          :required="mode === 'add'"
          :disabled="mode === 'edit'"
          maxlength="2"
          class="glass-input w-full px-3 py-2 text-sm text-text-primary placeholder-text-muted focus:outline-none focus:border-purple-500/40 uppercase disabled:opacity-50"
          placeholder="ES, MX, AR..."
        />
        <p v-if="mode === 'add'" class="text-xs text-text-muted mt-1.5">Codigo ISO 3166-1 alpha-2 (2 letras)</p>
      </div>

      <!-- Country name input -->
      <div>
        <label class="block text-sm font-medium text-text-secondary mb-1.5">Nombre</label>
        <input
          v-model="formName"
          type="text"
          required
          class="glass-input w-full px-3 py-2 text-sm text-text-primary placeholder-text-muted focus:outline-none focus:border-purple-500/40"
          placeholder="Nombre del pais..."
        />
      </div>

      <!-- Kick message textarea -->
      <div>
        <label class="block text-sm font-medium text-text-secondary mb-1.5">Mensaje de kick</label>
        <textarea
          v-model="formKickMessage"
          rows="3"
          class="glass-input w-full px-3 py-2 text-sm text-text-primary placeholder-text-muted focus:outline-none focus:border-purple-500/40 resize-none"
          placeholder="Mensaje personalizado al expulsar (opcional)..."
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
          :disabled="submitting"
          class="glass-button px-4 py-2.5 text-sm disabled:opacity-50"
        >
          {{ submitting ? 'Guardando...' : mode === 'add' ? 'Bloquear' : 'Guardar' }}
        </button>
      </div>
    </form>
  </BaseModal>
</template>
