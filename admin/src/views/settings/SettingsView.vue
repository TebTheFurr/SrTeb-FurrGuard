<script setup lang="ts">
import { computed, onBeforeUnmount, onMounted, reactive, ref, shallowRef } from 'vue'
import { onBeforeRouteLeave } from 'vue-router'
import IconDownload from '~icons/pixelarticons/download'
import IconReload from '~icons/pixelarticons/reload'
import IconSave from '~icons/pixelarticons/save'
import IconSettings from '~icons/pixelarticons/settings-cog'
import { api, isAbortError } from '@/api/client'
import type { SettingsPayload } from '@/api/types'
import { confirmAction } from '@/lib/confirm'
import { secondsLabel } from '@/lib/format'
import { toast, toastError } from '@/lib/toast'
import EmptyState from '@/components/ui/EmptyState.vue'
import PageHeader from '@/components/ui/PageHeader.vue'
import ApiKeyPanel from './ApiKeyPanel.vue'
import MigrationsPanel from './MigrationsPanel.vue'
import { ALL_FIELDS, SETTING_GROUPS, toPayload, toText, validateSetting } from './schema'

const status = ref<'loading' | 'error' | 'ready'>('loading')
const loadError = ref('')
const baseline = shallowRef<Record<string, string>>({})
/** v-model en <input type="number"> guarda números: todo se lee a través de valueOf(). */
const form = reactive<Record<string, string | number>>({})
const valueOf = (key: string): string => String(form[key] ?? '').trim()
const apiKey = shallowRef<SettingsPayload['api_key'] | null>(null)
const saving = ref(false)
const exporting = ref(false)
let controller: AbortController | null = null

async function load(): Promise<void> {
  controller?.abort()
  const current = new AbortController()
  controller = current
  status.value = 'loading'
  try {
    const data = await api<SettingsPayload>('get_settings', {}, { signal: current.signal })
    const values = Object.fromEntries(ALL_FIELDS.map((field) => [field.key, toText(data.settings?.[field.key], field)]))
    baseline.value = values
    Object.assign(form, values)
    apiKey.value = data.api_key ?? null
    status.value = 'ready'
  } catch (e) {
    if (isAbortError(e)) return
    loadError.value = e instanceof Error ? e.message : 'No se pudieron cargar los ajustes.'
    status.value = 'error'
  }
}

onMounted(load)
onBeforeUnmount(() => controller?.abort())

const changed = computed(() => ALL_FIELDS.filter((field) => valueOf(field.key) !== (baseline.value[field.key] ?? '').trim()))
const errors = computed(() => Object.fromEntries(ALL_FIELDS.map((field) => [field.key, validateSetting(field, valueOf(field.key))])))
const invalid = computed(() => changed.value.filter((field) => errors.value[field.key]))

async function save(): Promise<void> {
  // Nada se envía si la carga no terminó bien: así nunca se pisan ajustes con valores vacíos
  if (status.value !== 'ready' || !changed.value.length || invalid.value.length) return
  saving.value = true
  try {
    const fields = changed.value
    const settings = Object.fromEntries(fields.map((field) => [field.key, toPayload(field, valueOf(field.key))]))
    await api('save_settings', { settings })
    baseline.value = { ...baseline.value, ...Object.fromEntries(fields.map((field) => [field.key, valueOf(field.key)])) }
    toast('Ajustes guardados. Los plugins los recogerán en unos segundos.', 'ok')
  } catch (e) {
    toastError(e, 'No se pudieron guardar los ajustes.')
  } finally {
    saving.value = false
  }
}

function discard(): void {
  Object.assign(form, baseline.value)
}

async function exportData(): Promise<void> {
  exporting.value = true
  try {
    const data = await api<unknown>('export_data')
    const blob = new Blob([JSON.stringify(data, null, 2)], { type: 'application/json' })
    const url = URL.createObjectURL(blob)
    const link = document.createElement('a')
    link.href = url
    link.download = `furrguard-export-${new Date().toISOString().slice(0, 16).replace(/[:T]/g, '')}.json`
    link.click()
    setTimeout(() => URL.revokeObjectURL(url), 1000)
    toast('Exportación descargada.', 'ok')
  } catch (e) {
    toastError(e, 'No se pudo exportar.')
  } finally {
    exporting.value = false
  }
}

onBeforeRouteLeave(async () => {
  if (!changed.value.length) return true
  return confirmAction({ title: 'Cambios sin guardar', message: 'Hay ajustes modificados. Si sales ahora se perderán.', confirmText: 'Salir sin guardar', danger: true })
})
</script>

<template>
  <div class="pagina-estrecha">
    <PageHeader title="Ajustes" :icon="IconSettings" desc="Configuración global de FurrGuard. Solo se envían los valores que cambies.">
      <button type="button" class="btn" :aria-busy="exporting" :disabled="exporting" @click="exportData"><IconDownload aria-hidden="true" /> Exportar datos</button>
    </PageHeader>

    <EmptyState v-if="status === 'error'" tone="error" title="No se pudieron cargar los ajustes" :text="`${loadError} Hasta que carguen no se puede guardar nada.`">
      <button type="button" class="btn" @click="load"><IconReload aria-hidden="true" /> Reintentar</button>
    </EmptyState>

    <form v-else novalidate @submit.prevent="save">
      <fieldset class="sin-marco" :disabled="status !== 'ready' || saving" :aria-busy="status === 'loading'">
        <legend class="sr-only">Ajustes</legend>
        <section v-for="group in SETTING_GROUPS" :key="group.id" class="panel seccion">
          <header class="panel-cab">
            <div class="titulo">
              <div><h2>{{ group.title }}</h2><p class="sub">{{ group.desc }}</p></div>
            </div>
          </header>
          <div v-for="field in group.fields" :key="field.key" class="ajuste" :class="{ cambiado: changed.includes(field) }">
            <div class="ajuste-texto">
              <label :for="`ajuste-${field.key}`">{{ field.label }}</label>
              <p class="ajuste-meta">
                <code>{{ field.key }}</code>
                <span v-if="field.min !== undefined">{{ field.min }}–{{ field.max }}{{ field.unit === 's' ? ' s' : field.unit ? ` ${field.unit}` : '' }}</span>
                <span v-if="field.unit === 's' && !errors[field.key]">= {{ secondsLabel(Number(form[field.key])) }}</span>
                <span v-if="field.help">{{ field.help }}</span>
              </p>
            </div>
            <div class="ajuste-control">
              <input
                v-if="field.kind === 'bool'"
                :id="`ajuste-${field.key}`"
                type="checkbox"
                role="switch"
                class="interruptor"
                :checked="form[field.key] === '1'"
                @change="form[field.key] = ($event.target as HTMLInputElement).checked ? '1' : '0'"
              >
              <input
                v-else
                :id="`ajuste-${field.key}`"
                v-model="form[field.key]"
                class="input"
                :class="{ mono: field.kind !== 'text' }"
                :type="field.kind === 'int' || field.kind === 'float' ? 'number' : 'text'"
                :inputmode="field.kind === 'int' ? 'numeric' : field.kind === 'float' ? 'decimal' : undefined"
                :min="field.min"
                :max="field.max"
                :step="field.kind === 'float' ? '0.1' : undefined"
                :maxlength="field.maxLength"
                :aria-invalid="errors[field.key] ? 'true' : undefined"
                :aria-describedby="errors[field.key] ? `error-${field.key}` : undefined"
              >
            </div>
            <p v-if="errors[field.key] && status === 'ready'" :id="`error-${field.key}`" class="error" role="alert">{{ errors[field.key] }}</p>
          </div>
        </section>
      </fieldset>

      <div v-if="changed.length" class="barra-guardar" role="region" aria-label="Cambios sin guardar">
        <span class="texto">
          {{ changed.length === 1 ? '1 ajuste modificado' : `${changed.length} ajustes modificados` }}
          <template v-if="invalid.length"> · corrige {{ invalid.length === 1 ? 'el valor marcado' : 'los valores marcados' }}</template>
        </span>
        <button type="button" class="btn ghost" :disabled="saving" @click="discard">Descartar</button>
        <button type="submit" class="btn primary" :aria-busy="saving" :disabled="saving || invalid.length > 0 || status !== 'ready'">
          <IconSave aria-hidden="true" /> Guardar
        </button>
      </div>
    </form>

    <template v-if="status === 'ready'">
      <ApiKeyPanel v-model:api-key="apiKey" class="seccion" />
      <MigrationsPanel class="seccion" />
    </template>
  </div>
</template>

<style scoped>
.pagina-estrecha { max-width: 1080px; }
.sin-marco { border: 0; margin: 0; padding: 0; min-width: 0; }
.sin-marco:disabled { opacity: .6; }
.ajuste {
  display: grid;
  grid-template-columns: minmax(0, 1fr) minmax(160px, 240px);
  gap: 6px 24px;
  align-items: center;
  padding: 13px 18px;
  border-bottom: 1px solid var(--rule);
}
.ajuste:last-child { border-bottom: 0; }
.ajuste.cambiado { box-shadow: inset 3px 0 0 var(--accent); }
.ajuste-texto label { color: var(--ink); font-size: var(--text-sm); font-weight: 500; }
.ajuste-meta { display: flex; flex-wrap: wrap; align-items: center; gap: 4px 10px; margin-top: 4px; color: var(--ink-3); font-size: var(--text-xs); }
.ajuste-meta code { font-size: 10px; }
.ajuste-control { display: flex; justify-content: flex-end; }
.ajuste .error { grid-column: 1 / -1; color: var(--down); font-size: var(--text-xs); }
@media (max-width: 700px) {
  .ajuste { grid-template-columns: minmax(0, 1fr); }
  .ajuste-control { justify-content: flex-start; }
}
</style>
