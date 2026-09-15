<script setup lang="ts">
import { computed, ref, useId, watch } from 'vue'
import IconPlus from '~icons/pixelarticons/plus'
import { api } from '@/api/client'
import { validateEntry } from '@/lib/entries'
import { toast } from '@/lib/toast'
import AppDialog from '../ui/AppDialog.vue'

const props = defineProps<{ open: boolean; parent: { id: number; ban_id: string; value: string } | null }>()
const emit = defineEmits<{ close: []; saved: [] }>()

const ip = ref('')
const touched = ref(false)
const saving = ref(false)
const error = ref('')
const ipId = useId()
const problem = computed(() => (touched.value || ip.value ? validateEntry('ip', ip.value) : null))

watch(
  () => props.open,
  (open) => {
    if (!open) return
    ip.value = ''
    touched.value = false
    error.value = ''
  },
  { immediate: true },
)

async function submit(): Promise<void> {
  touched.value = true
  if (!props.parent || problem.value) return
  saving.value = true
  error.value = ''
  try {
    await api('add_blacklist_ip', { parent_id: props.parent.id, ip: ip.value.trim() })
    toast('IP añadida al baneo.', 'ok')
    emit('saved')
  } catch (e) {
    error.value = e instanceof Error ? e.message : 'No se pudo añadir la IP.'
  } finally {
    saving.value = false
  }
}
</script>

<template>
  <AppDialog :open="open" :icon="IconPlus" title="Añadir IP al baneo" :sub="parent ? `Hija de ${parent.ban_id} (${parent.value})` : ''" @close="emit('close')">
    <form class="modal-form" novalidate @submit.prevent="submit">
      <div class="modal-cuerpo">
        <div class="campo">
          <label :for="ipId">IP</label>
          <input :id="ipId" v-model.trim="ip" class="input mono" placeholder="203.0.113.7" :aria-invalid="problem ? 'true' : undefined" autocomplete="off" required autofocus>
          <p class="ayuda">Hereda la expiración del baneo padre y se desactiva con él.</p>
          <p v-if="problem" class="error" role="alert">{{ problem }}</p>
        </div>
        <p v-if="error" class="form-error" role="alert">{{ error }}</p>
      </div>
      <footer class="modal-pie">
        <button type="button" class="btn ghost" @click="emit('close')">Cancelar</button>
        <button type="submit" class="btn primary" :aria-busy="saving" :disabled="saving">Añadir</button>
      </footer>
    </form>
  </AppDialog>
</template>
