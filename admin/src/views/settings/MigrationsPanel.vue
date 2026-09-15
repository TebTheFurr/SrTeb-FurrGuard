<script setup lang="ts">
/** Migraciones por lotes con cursor (§4.4): avanzan hasta next_cursor = null y se pueden cancelar. */
import { onBeforeUnmount, reactive } from 'vue'
import IconSync from '~icons/pixelarticons/sync'
import { api, isAbortError } from '@/api/client'
import type { MigrationBatch } from '@/api/types'
import { confirmAction } from '@/lib/confirm'
import { formatNumber, toNum } from '@/lib/format'
import { toast, toastError } from '@/lib/toast'

type MigrationId = 'migrate_blacklist' | 'migrate_players'

interface MigrationState {
  running: boolean
  done: boolean
  processed: number
  changed: number
  skipped: number
  log: string[]
}

const BATCH_SIZE = 25
const MAX_LOG = 200

const MIGRATIONS: { id: MigrationId; title: string; desc: string }[] = [
  { id: 'migrate_blacklist', title: 'Blacklist unificada', desc: 'Revisa los baneos por UUID y nick contra Mojang: premium → UUID, no premium → nick, y elimina duplicados.' },
  { id: 'migrate_players', title: 'Jugadores premium', desc: 'Comprueba en Mojang qué jugadores son premium y corrige su UUID si era offline.' },
]

const blank = (): MigrationState => ({ running: false, done: false, processed: 0, changed: 0, skipped: 0, log: [] })
const state = reactive<Record<MigrationId, MigrationState>>({ migrate_blacklist: blank(), migrate_players: blank() })
/** Fuera del estado reactivo: un Proxy rompe los métodos nativos de AbortController. */
const controllers: Partial<Record<MigrationId, AbortController>> = {}

async function start(id: MigrationId, title: string): Promise<void> {
  const ok = await confirmAction({ title: `Ejecutar «${title}»`, message: 'Consulta a Mojang en lotes de 25. Puede tardar varios minutos; puedes cancelarla cuando quieras.', confirmText: 'Empezar' })
  if (!ok) return
  const current = state[id]
  const controller = new AbortController()
  controllers[id] = controller
  Object.assign(current, blank(), { running: true })
  let cursor: string | number | null | undefined
  try {
    do {
      const params: Record<string, unknown> = { batch_size: BATCH_SIZE }
      if (cursor !== undefined && cursor !== null) params.cursor = cursor
      const batch = await api<MigrationBatch>(id, params, { signal: controller.signal })
      current.processed += toNum(batch.processed)
      current.changed += toNum(batch.changed)
      current.skipped += toNum(batch.skipped)
      current.log = [...current.log, ...(batch.details ?? []).map(String)].slice(-MAX_LOG)
      cursor = batch.next_cursor
    } while (cursor !== null && cursor !== undefined && current.running)
    current.done = cursor === null || cursor === undefined
    if (current.done) toast(`«${title}» terminada: ${current.processed} procesados, ${current.changed} cambiados.`, 'ok')
  } catch (e) {
    if (!isAbortError(e)) toastError(e, 'La migración se ha detenido por un error.')
  } finally {
    current.running = false
    if (controllers[id] === controller) delete controllers[id]
  }
}

function cancel(id: MigrationId): void {
  state[id].running = false
  controllers[id]?.abort()
  toast('Migración cancelada. Lo ya procesado se conserva.', 'warn')
}

onBeforeUnmount(() => {
  for (const controller of Object.values(controllers)) controller?.abort()
})
</script>

<template>
  <section class="panel">
    <header class="panel-cab">
      <div class="titulo"><IconSync aria-hidden="true" /><div><h2>Migraciones</h2><p class="sub">Tareas de mantenimiento que consultan a Mojang. Quedan en el registro.</p></div></div>
    </header>
    <div v-for="migration in MIGRATIONS" :key="migration.id" class="migracion">
      <div class="cab">
        <div>
          <h3>{{ migration.title }}</h3>
          <p class="faint">{{ migration.desc }}</p>
        </div>
        <button v-if="state[migration.id].running" type="button" class="btn danger" @click="cancel(migration.id)">Cancelar</button>
        <button v-else type="button" class="btn" @click="start(migration.id, migration.title)"><IconSync aria-hidden="true" /> Ejecutar</button>
      </div>
      <template v-if="state[migration.id].running || state[migration.id].processed || state[migration.id].done">
        <progress
          class="progreso"
          :aria-label="`Progreso de ${migration.title}`"
          :value="state[migration.id].running ? undefined : 1"
          max="1"
        />
        <p class="contadores" aria-live="polite">
          {{ state[migration.id].done ? 'Terminada' : state[migration.id].running ? 'En curso' : 'Detenida' }} ·
          procesados <b>{{ formatNumber(state[migration.id].processed) }}</b> ·
          cambiados <b>{{ formatNumber(state[migration.id].changed) }}</b> ·
          omitidos <b>{{ formatNumber(state[migration.id].skipped) }}</b>
        </p>
        <pre v-if="state[migration.id].log.length" class="log" tabindex="0" :aria-label="`Detalles de ${migration.title}`">{{ state[migration.id].log.join('\n') }}</pre>
      </template>
    </div>
  </section>
</template>

<style scoped>
.migracion { display: grid; gap: 10px; padding: 16px 18px; border-bottom: 1px solid var(--rule); }
.migracion:last-child { border-bottom: 0; }
.cab { display: flex; align-items: flex-start; justify-content: space-between; gap: 16px; flex-wrap: wrap; }
.cab p { font-size: var(--text-sm); max-width: 620px; }
.contadores { font-size: var(--text-xs); color: var(--ink-3); }
.contadores b { color: var(--ink-2); font-weight: 500; }
.log { max-height: 180px; overflow: auto; margin: 0; padding: 10px 12px; border: 1px solid var(--rule); border-radius: var(--radius-sm); background: var(--bg); font-family: var(--mono); font-size: 11px; color: var(--ink-2); white-space: pre-wrap; }
</style>
