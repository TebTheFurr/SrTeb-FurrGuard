<script setup lang="ts">
/**
 * Baneo por nombre: se envía solo `player_name` y el servidor resuelve si es premium (UUID) o no (nick).
 * «Verificar» es solo informativo y su resultado se borra en cuanto cambia el nombre, para no
 * enseñar el UUID de otro jugador.
 */
import { reactive, ref, shallowRef, useId, watch } from 'vue'
import IconCancel from '~icons/pixelarticons/cancel'
import IconCrown from '~icons/pixelarticons/crown'
import IconSearch from '~icons/lucide/search'
import IconUnlock from '~icons/pixelarticons/unlock'
import { api, isAbortError } from '@/api/client'
import type { LookupResult } from '@/api/types'
import { isNick } from '@/lib/entries'
import { toast } from '@/lib/toast'
import AppDialog from '../ui/AppDialog.vue'
import DurationField from '../ui/DurationField.vue'

const props = defineProps<{ open: boolean }>()
const emit = defineEmits<{ close: []; saved: [] }>()

const form = reactive({ name: '', reason: '', duration: 0 as number | null, stainIp: true })
const lookup = shallowRef<(LookupResult & { query: string }) | null>(null)
const lookupError = ref('')
const checking = ref(false)
const saving = ref(false)
const error = ref('')
const nameId = useId()
const reasonId = useId()
const durationId = useId()
let lookupController: AbortController | null = null

watch(
  () => props.open,
  (open) => {
    lookupController?.abort()
    if (!open) return
    Object.assign(form, { name: '', reason: '', duration: 0, stainIp: true })
    lookup.value = null
    lookupError.value = ''
    error.value = ''
  },
  { immediate: true },
)

watch(
  () => form.name,
  () => {
    lookupController?.abort()
    lookup.value = null
    lookupError.value = ''
    checking.value = false
  },
)

async function verify(): Promise<void> {
  const query = form.name.trim()
  if (!isNick(query)) return
  lookupController?.abort()
  const controller = new AbortController()
  lookupController = controller
  checking.value = true
  lookupError.value = ''
  try {
    const result = await api<LookupResult>('lookup_player', { player_name: query }, { signal: controller.signal })
    if (form.name.trim() === query) lookup.value = { ...result, query }
  } catch (e) {
    if (!isAbortError(e)) lookupError.value = e instanceof Error ? e.message : 'No se pudo consultar Mojang.'
  } finally {
    if (lookupController === controller) checking.value = false
  }
}

async function submit(): Promise<void> {
  const name = form.name.trim()
  if (!isNick(name)) {
    error.value = 'Escribe un nick válido (1-16 caracteres: letras, números y _).'
    return
  }
  saving.value = true
  error.value = ''
  try {
    const result = await api<{ ban_id: string; type: string; player_name: string; is_premium: boolean }>('add_blacklist_unified', {
      player_name: name,
      reason: form.reason.trim(),
      duration_minutes: form.duration ?? 0,
      stain_ip: form.stainIp,
    })
    toast(`${result.player_name} baneado por ${result.is_premium ? 'UUID (premium)' : 'nick (no premium)'} · ID ${result.ban_id}.`, 'ok')
    emit('saved')
  } catch (e) {
    error.value = e instanceof Error ? e.message : 'No se pudo banear.'
  } finally {
    saving.value = false
  }
}
</script>

<template>
  <AppDialog :open="open" :icon="IconCancel" title="Banear jugador" sub="Por nombre: el servidor decide si banea el UUID premium o el nick." danger @close="emit('close')">
    <form class="modal-form" novalidate @submit.prevent="submit">
      <div class="modal-cuerpo">
        <div class="campo">
          <label :for="nameId">Nombre del jugador</label>
          <div class="fila-verificar">
            <input :id="nameId" v-model="form.name" class="input mono" maxlength="17" autocomplete="off" spellcheck="false" required autofocus>
            <button type="button" class="btn" :aria-busy="checking" :disabled="checking || !isNick(form.name.trim())" @click="verify">
              <IconSearch aria-hidden="true" /> Verificar
            </button>
          </div>
          <p v-if="lookup" class="resultado" role="status">
            <template v-if="lookup.status === 'premium'">
              <span class="chip gold"><IconCrown aria-hidden="true" />Premium</span>
              <span class="mono">{{ lookup.name }} · {{ lookup.uuid }}</span>
            </template>
            <template v-else-if="lookup.status === 'not_found'">
              <span class="chip tenue"><IconUnlock aria-hidden="true" />No premium</span>
              <span>Se baneará el nick.</span>
            </template>
            <template v-else>Mojang no responde: el servidor lo resolverá al banear.</template>
          </p>
          <p v-if="lookupError" class="error" role="alert">{{ lookupError }}</p>
        </div>
        <div class="campo">
          <label :for="reasonId">Motivo</label>
          <textarea :id="reasonId" v-model="form.reason" class="textarea" maxlength="500" rows="3" />
        </div>
        <div class="campo">
          <label :for="durationId">Duración</label>
          <DurationField :id="durationId" v-model="form.duration" />
        </div>
        <label class="check-campo">
          <input v-model="form.stainIp" type="checkbox" class="check">
          Manchar sus IPs conocidas
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

<style scoped>
.fila-verificar { display: flex; gap: 8px; }
.resultado { display: flex; flex-wrap: wrap; align-items: center; gap: 8px; font-size: var(--text-xs); color: var(--ink-2); }
.resultado .mono { word-break: break-all; }
</style>
