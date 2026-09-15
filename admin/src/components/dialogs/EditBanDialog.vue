<script setup lang="ts">
import { reactive, ref, useId, watch } from 'vue'
import IconEdit from '~icons/pixelarticons/edit'
import IconSave from '~icons/pixelarticons/save'
import { api } from '@/api/client'
import { formatDateTime } from '@/lib/dates'
import { toast } from '@/lib/toast'
import AppDialog from '../ui/AppDialog.vue'
import DurationField from '../ui/DurationField.vue'

export interface BanEditTarget {
  id: number
  ban_id: string
  value: string
  reason: string | null
  expires_at: string | null
}

const props = defineProps<{ open: boolean; ban: BanEditTarget | null }>()
const emit = defineEmits<{ close: []; saved: [] }>()

const form = reactive({ reason: '', duration: null as number | null })
const saving = ref(false)
const error = ref('')
const reasonId = useId()
const durationId = useId()

watch(
  () => props.open,
  (open) => {
    if (!open) return
    form.reason = props.ban?.reason ?? ''
    form.duration = null
    error.value = ''
  },
  { immediate: true },
)

async function submit(): Promise<void> {
  if (!props.ban) return
  saving.value = true
  error.value = ''
  try {
    // duration_minutes null = conservar la expiración actual (se propaga a las hijas si cambia)
    await api('edit_blacklist', { id: props.ban.id, reason: form.reason.trim(), duration_minutes: form.duration })
    toast(`Baneo ${props.ban.ban_id} actualizado.`, 'ok')
    emit('saved')
  } catch (e) {
    error.value = e instanceof Error ? e.message : 'No se pudo guardar.'
  } finally {
    saving.value = false
  }
}
</script>

<template>
  <AppDialog :open="open" :icon="IconEdit" title="Editar baneo" :sub="ban ? `${ban.ban_id} · ${ban.value}` : ''" @close="emit('close')">
    <form class="modal-form" novalidate @submit.prevent="submit">
      <div class="modal-cuerpo">
        <div class="campo">
          <label :for="reasonId">Motivo</label>
          <textarea :id="reasonId" v-model="form.reason" class="textarea" maxlength="500" rows="3" autofocus />
        </div>
        <div class="campo">
          <label :for="durationId">Nueva duración</label>
          <DurationField :id="durationId" v-model="form.duration" allow-unchanged />
          <p class="ayuda">
            Expira ahora: {{ ban?.expires_at ? formatDateTime(ban.expires_at) : 'nunca (permanente)' }}.
            La nueva duración cuenta desde este momento.
          </p>
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
