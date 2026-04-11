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
    <form class="space-y-4" @submit.prevent="handleSubmit">
      <!-- Country code input -->
      <div>
        <label class="block text-xs text-text-muted uppercase tracking-wider mb-1">Codigo de pais</label>
        <input
          v-model="formCode"
          type="text"
          :required="mode === 'add'"
          :disabled="mode === 'edit'"
          maxlength="2"
          class="w-full px-3 py-2 rounded-lg bg-dark-800 border border-glass-border-subtle text-text-primary text-sm focus:outline-none focus:border-purple-500 uppercase disabled:opacity-50"
          placeholder="ES, MX, AR..."
        />
        <p v-if="mode === 'add'" class="text-xs text-text-muted mt-1">Codigo ISO 3166-1 alpha-2 (2 letras)</p>
      </div>

      <!-- Country name input -->
      <div>
        <label class="block text-xs text-text-muted uppercase tracking-wider mb-1">Nombre</label>
        <input
          v-model="formName"
          type="text"
          required
          class="w-full px-3 py-2 rounded-lg bg-dark-800 border border-glass-border-subtle text-text-primary text-sm focus:outline-none focus:border-purple-500"
          placeholder="Nombre del pais..."
        />
      </div>

      <!-- Kick message textarea -->
      <div>
        <label class="block text-xs text-text-muted uppercase tracking-wider mb-1">Mensaje de kick</label>
        <textarea
          v-model="formKickMessage"
          rows="3"
          class="w-full px-3 py-2 rounded-lg bg-dark-800 border border-glass-border-subtle text-text-primary text-sm focus:outline-none focus:border-purple-500 resize-none"
          placeholder="Mensaje personalizado al expulsar (opcional)..."
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
          :disabled="submitting"
          class="px-4 py-2 rounded-lg bg-purple-500 hover:bg-purple-600 text-white text-sm font-medium transition-colors disabled:opacity-50"
        >
          {{ submitting ? 'Guardando...' : mode === 'add' ? 'Bloquear' : 'Guardar' }}
        </button>
      </div>
    </form>
  </BaseModal>
</template>
