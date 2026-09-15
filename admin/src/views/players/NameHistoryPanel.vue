<script setup lang="ts">
import { computed, onBeforeUnmount, ref, shallowRef } from 'vue'
import IconAlert from '~icons/pixelarticons/alert'
import IconTimeline from '~icons/pixelarticons/timeline'
import { api, ApiError, isAbortError } from '@/api/client'
import type { NameHistory, NameHistorySource } from '@/api/types'
import { formatDateTime } from '@/lib/dates'

const props = defineProps<{ playerName: string }>()

const SOURCE_LABELS: Record<NameHistorySource, string> = { mojang: 'Mojang', laby: 'Laby', namemc: 'NameMC' }

const history = shallowRef<NameHistory | null>(null)
/** Fuentes que no se pudieron consultar, en texto («Mojang, Laby y NameMC»); vacío si la consulta fue completa. */
const failedSources = computed(() => {
  if (!history.value || history.value.complete !== false) return ''
  const names = history.value.failed_sources.map((source) => SOURCE_LABELS[source] ?? source)
  return new Intl.ListFormat('es', { type: 'conjunction' }).format(names)
})
const loading = ref(false)
const error = ref('')
let controller: AbortController | null = null

async function load(): Promise<void> {
  controller?.abort()
  const current = new AbortController()
  controller = current
  history.value = null
  error.value = ''
  loading.value = true
  try {
    history.value = await api<NameHistory>('get_name_history', { player_name: props.playerName }, { signal: current.signal })
  } catch (e) {
    if (!isAbortError(e)) error.value = e instanceof ApiError ? e.message : 'No se pudo consultar el historial.'
  } finally {
    if (controller === current) {
      controller = null
      loading.value = false
    }
  }
}

onBeforeUnmount(() => controller?.abort())
</script>

<template>
  <section class="panel">
    <header class="panel-cab">
      <div class="titulo"><IconTimeline aria-hidden="true" /><h2>Historial de nombres</h2></div>
      <div class="acciones">
        <button type="button" class="btn sm" :aria-busy="loading" :disabled="loading" @click="load">
          {{ history ? 'Volver a consultar' : 'Consultar' }}
        </button>
      </div>
    </header>
    <div class="panel-cuerpo">
      <p v-if="error" class="form-error" role="alert">{{ error }}</p>
      <p v-else-if="!history && !loading" class="faint">Se consulta a servicios externos (Mojang, Laby, NameMC) solo cuando lo pides.</p>
      <p v-else-if="loading" class="faint" aria-busy="true">Consultando…</p>
      <template v-else-if="history">
        <div v-if="failedSources" class="aviso historial-aviso" role="status">
          <IconAlert aria-hidden="true" />
          <span class="texto">Historial posiblemente incompleto<small>No se pudo consultar {{ failedSources }}: puede faltar algún nombre anterior. Vuelve a consultar más tarde.</small></span>
        </div>
        <ol v-if="history.history.length" class="historial">
          <li v-for="(entry, index) in history.history" :key="`${entry.name}-${index}`">
            <b class="mono">{{ entry.name }}</b>
            <span class="faint">{{ entry.changed_at ? formatDateTime(entry.changed_at) : 'Original' }}</span>
          </li>
        </ol>
        <p v-else class="faint">No hay cambios de nombre registrados.</p>
      </template>
    </div>
  </section>
</template>

<style scoped>
.historial-aviso { margin-bottom: 12px; }
.historial { list-style: none; margin: 0; padding: 0; display: grid; gap: 8px; }
.historial li { display: flex; justify-content: space-between; gap: 12px; font-size: var(--text-sm); }
</style>
