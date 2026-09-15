<script setup lang="ts">
import { reactive, ref, useId, watch } from 'vue'
import IconChecklist from '~icons/pixelarticons/checklist'
import IconSave from '~icons/pixelarticons/save'
import { api } from '@/api/client'
import type { EntryType } from '@/api/types'
import { validateEntry } from '@/lib/entries'
import { toast } from '@/lib/toast'
import AppDialog from '../ui/AppDialog.vue'
import EntryFields from './EntryFields.vue'

export interface WhitelistDraft {
  id?: number
  type: EntryType
  value: string
  reason?: string | null
}

const props = defineProps<{ open: boolean; draft: WhitelistDraft | null }>()
const emit = defineEmits<{ close: []; saved: [] }>()

const form = reactive({ type: 'uuid' as EntryType, value: '', reason: '' })
const touched = ref(false)
const saving = ref(false)
const error = ref('')
const reasonId = useId()

// Cada apertura carga los valores de quien la abre (edición o ficha del jugador)
watch(
  () => props.open,
  (open) => {
    if (!open) return
    form.type = props.draft?.type ?? 'uuid'
    form.value = props.draft?.value ?? ''
    form.reason = props.draft?.reason ?? ''
    touched.value = false
    error.value = ''
  },
  { immediate: true },
)

async function submit(): Promise<void> {
  touched.value = true
  if (validateEntry(form.type, form.value)) return
  saving.value = true
  error.value = ''
  try {
    const params = { type: form.type, value: form.value, reason: form.reason.trim() }
    if (props.draft?.id) await api('edit_whitelist', { id: props.draft.id, ...params })
    else await api('add_whitelist', params)
    toast(props.draft?.id ? 'Entrada de whitelist actualizada.' : 'Añadido a la whitelist.', 'ok')
    emit('saved')
  } catch (e) {
    error.value = e instanceof Error ? e.message : 'No se pudo guardar.'
  } finally {
    saving.value = false
  }
}
</script>

<template>
  <AppDialog :open="open" :icon="IconChecklist" :title="draft?.id ? 'Editar entrada de whitelist' : 'Añadir a la whitelist'" @close="emit('close')">
    <form class="modal-form" novalidate @submit.prevent="submit">
      <div class="modal-cuerpo">
        <EntryFields v-model:type="form.type" v-model:value="form.value" :touched="touched" />
        <div class="campo">
          <label :for="reasonId">Motivo <span class="faint">(opcional)</span></label>
          <textarea :id="reasonId" v-model="form.reason" class="textarea" maxlength="500" rows="3" />
        </div>
        <p v-if="error" class="form-error" role="alert">{{ error }}</p>
      </div>
      <footer class="modal-pie">
        <button type="button" class="btn ghost" @click="emit('close')">Cancelar</button>
        <button type="submit" class="btn primary" :aria-busy="saving" :disabled="saving">
          <IconSave aria-hidden="true" /> Guardar
        </button>
      </footer>
    </form>
  </AppDialog>
</template>
