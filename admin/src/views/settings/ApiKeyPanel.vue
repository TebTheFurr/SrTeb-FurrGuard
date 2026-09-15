<script setup lang="ts">
import { ref } from 'vue'
import IconAlert from '~icons/pixelarticons/alert'
import IconKey from '~icons/pixelarticons/key'
import IconReload from '~icons/pixelarticons/reload'
import { api } from '@/api/client'
import type { SettingsPayload } from '@/api/types'
import { confirmAction } from '@/lib/confirm'
import { formatDateTime } from '@/lib/dates'
import { toastError } from '@/lib/toast'
import AppDialog from '@/components/ui/AppDialog.vue'
import CopyField from '@/components/ui/CopyField.vue'

const apiKey = defineModel<SettingsPayload['api_key'] | null>('apiKey', { required: true })
const regenerating = ref(false)
/** La clave nueva solo vive en memoria mientras el diálogo está abierto. */
const revealed = ref<string | null>(null)

async function regenerate(): Promise<void> {
  const ok = await confirmAction({
    title: 'Regenerar la API key',
    message: 'La clave actual dejará de funcionar al momento: todos los plugins y módulos quedarán desconectados hasta que pongas la nueva en su configuración.',
    confirmText: 'Regenerar',
    danger: true,
    icon: IconKey,
  })
  if (!ok) return
  regenerating.value = true
  try {
    const result = await api<{ api_key: string; prefix: string }>('regenerate_api_key')
    revealed.value = result.api_key
    apiKey.value = { configured: true, prefix: result.prefix, created_at: new Date().toISOString().slice(0, 19).replace('T', ' ') }
  } catch (e) {
    toastError(e, 'No se pudo regenerar la clave.')
  } finally {
    regenerating.value = false
  }
}
</script>

<template>
  <section class="panel" :class="{ peligro: !apiKey?.configured }">
    <header class="panel-cab">
      <div class="titulo"><IconKey aria-hidden="true" /><div><h2>API key de los plugins</h2><p class="sub">Autentica al plugin de Velocity y a los módulos. Se guarda cifrada (hash): no se puede volver a mostrar.</p></div></div>
    </header>
    <div class="panel-cuerpo clave">
      <div class="estado">
        <span v-if="apiKey?.configured" class="chip ok">Configurada</span>
        <span v-else class="chip down"><IconAlert aria-hidden="true" />Sin configurar</span>
        <span v-if="apiKey?.prefix" class="mono">{{ apiKey.prefix }}…</span>
        <span v-if="apiKey?.created_at" class="faint">creada {{ formatDateTime(apiKey.created_at) }}</span>
      </div>
      <button type="button" class="btn" :class="apiKey?.configured ? 'danger' : 'primary'" :aria-busy="regenerating" :disabled="regenerating" @click="regenerate">
        <IconReload aria-hidden="true" /> {{ apiKey?.configured ? 'Regenerar' : 'Generar clave' }}
      </button>
    </div>

    <AppDialog :open="revealed !== null" :icon="IconKey" title="Tu nueva API key" @close="revealed = null">
      <div class="modal-cuerpo">
        <div class="aviso warn" role="alert">
          <IconAlert aria-hidden="true" />
          <span class="texto">Cópiala ahora: es la única vez que se muestra. Si la pierdes tendrás que regenerarla.</span>
        </div>
        <CopyField v-if="revealed" :value="revealed" label="la API key" />
        <p class="faint">Ponla en la configuración del plugin (<code>api-key</code>) y de los módulos, y reinícialos.</p>
      </div>
      <footer class="modal-pie">
        <button type="button" class="btn primary" autofocus @click="revealed = null">Ya la he guardado</button>
      </footer>
    </AppDialog>
  </section>
</template>

<style scoped>
.clave { display: flex; align-items: center; justify-content: space-between; gap: 14px; flex-wrap: wrap; }
.estado { display: flex; align-items: center; gap: 10px; flex-wrap: wrap; font-size: var(--text-sm); }
</style>
