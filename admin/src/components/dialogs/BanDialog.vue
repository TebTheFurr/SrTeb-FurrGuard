<script setup lang="ts">
/** Baneo avanzado por tipo (uuid, nick, ip, ip_range, as). */
import { computed, reactive, ref, useId, watch } from 'vue'
import IconCancel from '~icons/pixelarticons/cancel'
import { api } from '@/api/client'
import type { EntryType } from '@/api/types'
import { validateEntry } from '@/lib/entries'
import { toast } from '@/lib/toast'
import AppDialog from '../ui/AppDialog.vue'
import DurationField from '../ui/DurationField.vue'
import EntryFields from './EntryFields.vue'

export interface BanDraft {
  type: EntryType
  value: string
}

const props = defineProps<{ open: boolean; draft: BanDraft | null }>()
const emit = defineEmits<{ close: []; saved: [] }>()

const form = reactive({ type: 'uuid' as EntryType, value: '', reason: '', duration: 0 as number | null, stainIp: true })
const touched = ref(false)
const saving = ref(false)
const error = ref('')
const reasonId = useId()
const durationId = useId()
const stainsIps = computed(() => form.type === 'uuid' || form.type === 'nick')

watch(
  () => props.open,
  (open) => {
    if (!open) return
    Object.assign(form, { type: props.draft?.type ?? 'uuid', value: props.draft?.value ?? '', reason: '', duration: 0, stainIp: true })
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
    const result = await api<{ ban_id: string; reactivated?: boolean }>('add_blacklist', {
      type: form.type,
      value: form.value,
      reason: form.reason.trim(),
      duration_minutes: form.duration ?? 0,
      stain_ip: stainsIps.value && form.stainIp,
    })
    toast(result?.reactivated ? `Baneo reactivado (ID ${result.ban_id}).` : `Baneo creado (ID ${result?.ban_id ?? '—'}).`, 'ok')
    emit('saved')
  } catch (e) {
    error.value = e instanceof Error ? e.message : 'No se pudo banear.'
  } finally {
    saving.value = false
  }
}
</script>

<template>
  <AppDialog :open="open" :icon="IconCancel" title="Baneo avanzado" sub="UUID, nick, IP, rango o sistema autónomo." danger @close="emit('close')">
    <form class="modal-form" novalidate @submit.prevent="submit">
      <div class="modal-cuerpo">
        <EntryFields v-model:type="form.type" v-model:value="form.value" :touched="touched" />
        <div class="campo">
          <label :for="reasonId">Motivo</label>
          <textarea :id="reasonId" v-model="form.reason" class="textarea" maxlength="500" rows="3" placeholder="Se muestra al jugador en el mensaje de expulsión" />
        </div>
        <div class="campo">
          <label :for="durationId">Duración</label>
          <DurationField :id="durationId" v-model="form.duration" />
        </div>
        <label v-if="stainsIps" class="check-campo">
          <input v-model="form.stainIp" type="checkbox" class="check">
          Manchar sus IPs conocidas (se banean como hijas de este baneo)
        </label>
        <p v-if="error" class="form-error" role="alert">{{ error }}</p>
      </div>
      <footer class="modal-pie">
        <button type="button" class="btn ghost" @click="emit('close')">Cancelar</button>
        <button type="submit" class="btn danger" :aria-busy="saving" :disabled="saving">
          <IconCancel aria-hidden="true" /> Banear
        </button>
      </footer>
    </form>
  </AppDialog>
</template>
