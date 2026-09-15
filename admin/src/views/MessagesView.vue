<script setup lang="ts">
import { computed, nextTick, onBeforeUnmount, onMounted, reactive, ref, shallowRef } from 'vue'
import { onBeforeRouteLeave } from 'vue-router'
import IconBraces from '~icons/pixelarticons/braces'
import IconColors from '~icons/pixelarticons/colors-swatch'
import IconMessageText from '~icons/pixelarticons/message-text'
import IconReload from '~icons/pixelarticons/reload'
import IconSave from '~icons/pixelarticons/save'
import { api, isAbortError } from '@/api/client'
import { confirmAction } from '@/lib/confirm'
import { MC_COLOR_NAMES, MC_COLORS, MC_FORMATS } from '@/lib/mc'
import { toast, toastError } from '@/lib/toast'
import EmptyState from '@/components/ui/EmptyState.vue'
import FilterTabs from '@/components/ui/FilterTabs.vue'
import McText from '@/components/ui/McText.vue'
import PageHeader from '@/components/ui/PageHeader.vue'
import SearchBox from '@/components/ui/SearchBox.vue'

type Group = 'furrguard' | 'furrperms' | 'furrsecurity'

/** Prefijos de docs/API.md §2: los mensajes de FurrSecurity usan `furr_security_` (con guion bajo). */
const groupOf = (key: string): Group => (key.startsWith('fur_perms_') ? 'furrperms' : key.startsWith('furr_security_') ? 'furrsecurity' : 'furrguard')

/** Variables orientativas por módulo: no se valida qué clave admite cuál. */
const VARIABLES: Record<Group, string[]> = {
  furrguard: ['{player}', '{reason}', '{id}', '{ban_id}', '{time_remaining}', '{server_name}', '{discord}', '{ip}', '{country}',
    '{country_code}', '{continent}', '{isp}', '{type}', '{value}', '{usage}', '{historical_country}', '{current_country}'],
  furrperms: ['{player}', '{command}', '{reason}'],
  furrsecurity: ['{player}', '{url}', '{verify_url}', '{time}', '{time_remaining}', '{discord}', '{key}', '{value}'],
}

const original = shallowRef<Record<string, string>>({})
const draft = reactive<Record<string, string>>({})
const status = ref<'loading' | 'error' | 'ready'>('loading')
const loadError = ref('')
const saving = ref(false)
const group = ref<Group>('furrguard')
const filter = ref('')
const focus = ref<{ key: string; start: number; end: number } | null>(null)
let controller: AbortController | null = null

async function load(): Promise<void> {
  controller?.abort()
  const current = new AbortController()
  controller = current
  status.value = 'loading'
  try {
    const data = await api<{ messages: Record<string, string> }>('get_messages', {}, { signal: current.signal })
    const messages = Object.fromEntries(Object.entries(data?.messages ?? {}).map(([k, v]) => [k, String(v ?? '')]))
    original.value = messages
    for (const key of Object.keys(draft)) delete draft[key]
    Object.assign(draft, messages)
    status.value = 'ready'
  } catch (e) {
    if (isAbortError(e)) return
    loadError.value = e instanceof Error ? e.message : 'No se pudieron cargar los mensajes.'
    status.value = 'error'
  }
}

onMounted(load)
onBeforeUnmount(() => controller?.abort())

const changedKeys = computed(() => Object.keys(original.value).filter((key) => draft[key] !== original.value[key]))

const groups = computed(() => {
  const counts: Record<Group, number> = { furrguard: 0, furrperms: 0, furrsecurity: 0 }
  for (const key of Object.keys(original.value)) counts[groupOf(key)]++
  return [
    { value: 'furrguard' as const, label: 'FurrGuard', count: counts.furrguard },
    { value: 'furrperms' as const, label: 'FurrPerms', count: counts.furrperms },
    { value: 'furrsecurity' as const, label: 'FurrSecurity', count: counts.furrsecurity },
  ]
})

const visibleKeys = computed(() => {
  const term = filter.value.trim().toLowerCase()
  return Object.keys(original.value)
    .filter((key) => groupOf(key) === group.value)
    .filter((key) => !term || key.includes(term) || (draft[key] ?? '').toLowerCase().includes(term))
    .sort()
})

function labelOf(key: string): string {
  const text = key.replace(/^(fur_perms_|furr_security_)/, '').replace(/^kick_/, 'expulsión · ').replace(/^notify_/, 'aviso · ').replace(/_/g, ' ')
  return text.charAt(0).toUpperCase() + text.slice(1)
}

function remember(key: string, event: Event): void {
  const el = event.target as HTMLTextAreaElement
  focus.value = { key, start: el.selectionStart, end: el.selectionEnd }
}

/** Inserta en el mensaje que tenía el foco, en la posición del cursor. */
async function insert(snippet: string): Promise<void> {
  const target = focus.value
  if (!target || !visibleKeys.value.includes(target.key)) {
    toast('Pulsa primero dentro del mensaje donde quieres insertar.', 'info')
    return
  }
  const value = draft[target.key] ?? ''
  draft[target.key] = value.slice(0, target.start) + snippet + value.slice(target.end)
  const caret = target.start + snippet.length
  focus.value = { key: target.key, start: caret, end: caret }
  await nextTick()
  const el = document.getElementById(`msg-${target.key}`) as HTMLTextAreaElement | null
  el?.focus()
  el?.setSelectionRange(caret, caret)
}

async function save(): Promise<void> {
  const keys = changedKeys.value
  if (!keys.length) return
  saving.value = true
  try {
    await api('save_messages', { messages: Object.fromEntries(keys.map((key) => [key, draft[key] ?? ''])) })
    original.value = { ...original.value, ...Object.fromEntries(keys.map((key) => [key, draft[key] ?? ''])) }
    toast(keys.length === 1 ? 'Mensaje guardado.' : `${keys.length} mensajes guardados.`, 'ok')
  } catch (e) {
    toastError(e, 'No se pudieron guardar los mensajes.')
  } finally {
    saving.value = false
  }
}

function discard(): void {
  Object.assign(draft, original.value)
}

onBeforeRouteLeave(async () => {
  if (!changedKeys.value.length) return true
  return confirmAction({ title: 'Cambios sin guardar', message: 'Hay mensajes modificados. Si sales ahora se perderán.', confirmText: 'Salir sin guardar', danger: true })
})
</script>

<template>
  <div>
    <PageHeader title="Mensajes" :icon="IconMessageText" desc="Textos que muestran el plugin y los módulos. Admiten códigos de color & y §." />

    <EmptyState v-if="status === 'error'" tone="error" title="No se pudieron cargar los mensajes" :text="loadError">
      <button type="button" class="btn" @click="load"><IconReload aria-hidden="true" /> Reintentar</button>
    </EmptyState>
    <div v-else-if="status === 'loading'" class="panel carga" aria-busy="true">
      <span class="sr-only">Cargando…</span><span v-for="n in 4" :key="n" class="esqueleto" />
    </div>

    <template v-else>
      <div class="panel barra-mensajes">
        <div class="filtros-mensajes">
          <FilterTabs v-model="group" label="Módulo" :options="groups" />
          <SearchBox v-model="filter" label="Filtrar mensajes" placeholder="Clave o texto…" />
        </div>
        <div class="herramientas" role="toolbar" aria-label="Insertar en el mensaje seleccionado">
          <span class="grupo-herramientas">
            <IconColors aria-hidden="true" class="tenue" />
            <button
              v-for="code in Object.keys(MC_COLORS)"
              :key="code"
              type="button"
              class="muestra"
              :class="`mc-${code}`"
              :title="`${MC_COLOR_NAMES[code]} (&${code})`"
              :aria-label="`Color ${MC_COLOR_NAMES[code]}, código &${code}`"
              @mousedown.prevent
              @click="insert(`&${code}`)"
            />
          </span>
          <span class="grupo-herramientas">
            <button v-for="format in MC_FORMATS" :key="format.code" type="button" class="btn sm" :title="`${format.label} (&${format.code})`" @mousedown.prevent @click="insert(`&${format.code}`)">
              &amp;{{ format.code }}<span class="sr-only"> {{ format.label }}</span>
            </button>
          </span>
          <span class="grupo-herramientas">
            <IconBraces aria-hidden="true" class="tenue" />
            <button v-for="variable in VARIABLES[group]" :key="variable" type="button" class="btn sm mono" @mousedown.prevent @click="insert(variable)">{{ variable }}</button>
          </span>
        </div>
        <p class="faint pista">{{ focus ? `Insertando en ${focus.key}` : 'Pulsa dentro de un mensaje y usa los botones para insertar colores o variables.' }}</p>
      </div>

      <EmptyState v-if="!visibleKeys.length" :icon="IconMessageText" title="Ningún mensaje coincide" />
      <div v-else class="mensajes">
        <section v-for="key in visibleKeys" :key="key" class="panel mensaje" :class="{ cambiado: draft[key] !== original[key] }">
          <div class="mensaje-cab">
            <label :for="`msg-${key}`"><b>{{ labelOf(key) }}</b> <code>{{ key }}</code></label>
            <button v-if="draft[key] !== original[key]" type="button" class="btn ghost sm" @click="draft[key] = original[key] ?? ''">Restaurar</button>
          </div>
          <div class="mensaje-cuerpo">
            <textarea
              :id="`msg-${key}`"
              v-model="draft[key]"
              class="textarea mono"
              rows="3"
              spellcheck="false"
              @focus="remember(key, $event)"
              @select="remember(key, $event)"
              @keyup="remember(key, $event)"
              @click="remember(key, $event)"
              @input="remember(key, $event)"
            />
            <McText :text="draft[key] ?? ''" aria-label="Vista previa" />
          </div>
        </section>
      </div>

      <div v-if="changedKeys.length" class="barra-guardar" role="region" aria-label="Cambios sin guardar">
        <span class="texto">{{ changedKeys.length === 1 ? '1 mensaje modificado' : `${changedKeys.length} mensajes modificados` }}</span>
        <button type="button" class="btn ghost" :disabled="saving" @click="discard">Descartar</button>
        <button type="button" class="btn primary" :aria-busy="saving" :disabled="saving" @click="save"><IconSave aria-hidden="true" /> Guardar</button>
      </div>
    </template>
  </div>
</template>

<style scoped>
.carga { display: grid; gap: 14px; padding: 22px; }
.barra-mensajes { position: sticky; top: calc(var(--topbar) + 8px); z-index: 10; padding: 12px 16px; display: grid; gap: 10px; background: color-mix(in srgb, var(--surface) 96%, transparent); backdrop-filter: blur(8px); }
.filtros-mensajes { display: flex; flex-wrap: wrap; gap: 10px; align-items: center; justify-content: space-between; }
.filtros-mensajes :deep(.pestanas) { border-bottom: 0; }
.filtros-mensajes :deep(.buscador) { flex: 0 1 280px; }
.herramientas { display: flex; flex-wrap: wrap; gap: 10px 18px; align-items: center; }
.grupo-herramientas { display: inline-flex; flex-wrap: wrap; gap: 5px; align-items: center; }
.tenue { color: var(--ink-3); }
.muestra { width: 20px; height: 20px; border-radius: 4px; border: 1px solid var(--rule-3); }
.muestra:hover { transform: scale(1.12); }
.pista { font-size: var(--text-xs); }
.mc-0 { background: #000000; } .mc-1 { background: #0000aa; } .mc-2 { background: #00aa00; } .mc-3 { background: #00aaaa; }
.mc-4 { background: #aa0000; } .mc-5 { background: #aa00aa; } .mc-6 { background: #ffaa00; } .mc-7 { background: #aaaaaa; }
.mc-8 { background: #555555; } .mc-9 { background: #5555ff; } .mc-a { background: #55ff55; } .mc-b { background: #55ffff; }
.mc-c { background: #ff5555; } .mc-d { background: #ff55ff; } .mc-e { background: #ffff55; } .mc-f { background: #ffffff; }
.mensajes { display: grid; gap: 12px; margin-top: 14px; }
.mensaje { padding: 12px 16px; }
.mensaje.cambiado { box-shadow: inset 3px 0 0 var(--accent); }
.mensaje-cab { display: flex; align-items: center; gap: 10px; justify-content: space-between; margin-bottom: 8px; font-size: var(--text-sm); }
.mensaje-cab code { font-size: 10.5px; }
.mensaje-cuerpo { display: grid; grid-template-columns: repeat(2, minmax(0, 1fr)); gap: 10px; }
@media (max-width: 900px) { .mensaje-cuerpo { grid-template-columns: minmax(0, 1fr); } }
</style>
