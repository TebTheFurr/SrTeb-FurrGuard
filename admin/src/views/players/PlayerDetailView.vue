<script setup lang="ts">
import { computed, onBeforeUnmount, onMounted, ref, shallowRef } from 'vue'
import IconCancel from '~icons/pixelarticons/cancel'
import IconChecklist from '~icons/pixelarticons/checklist'
import IconCircleQuestion from '~icons/pixelarticons/circle-question'
import IconCrown from '~icons/pixelarticons/crown'
import IconGlobe from '~icons/pixelarticons/globe'
import IconLabel from '~icons/pixelarticons/label'
import IconPlug from '~icons/pixelarticons/plug'
import IconReload from '~icons/pixelarticons/reload'
import IconTrash from '~icons/pixelarticons/trash'
import IconUnlock from '~icons/pixelarticons/unlock'
import { api, ApiError, isAbortError } from '@/api/client'
import type { BlacklistRef, PlayerDetail, WhitelistRef } from '@/api/types'
import { useBusy } from '@/composables/useBusy'
import { banExpiry, banStatus } from '@/lib/bans'
import { confirmAction } from '@/lib/confirm'
import { detailCrumb } from '@/lib/crumb'
import { formatDateTime, timeAgo } from '@/lib/dates'
import { entryLabel } from '@/lib/entries'
import { formatNumber, isOn } from '@/lib/format'
import { reasonLabel } from '@/lib/labels'
import { useSession } from '@/stores/session'
import BanDialog, { type BanDraft } from '@/components/dialogs/BanDialog.vue'
import WhitelistDialog, { type WhitelistDraft } from '@/components/dialogs/WhitelistDialog.vue'
import ActiveSwitch from '@/components/ui/ActiveSwitch.vue'
import CopyField from '@/components/ui/CopyField.vue'
import CountryTag from '@/components/ui/CountryTag.vue'
import EmptyState from '@/components/ui/EmptyState.vue'
import IpText from '@/components/ui/IpText.vue'
import PlayerHead from '@/components/ui/PlayerHead.vue'
import StatusChip from '@/components/ui/StatusChip.vue'
import NameHistoryPanel from './NameHistoryPanel.vue'

const props = defineProps<{ uuid: string }>()
const session = useSession()
const { busy, run } = useBusy()

const detail = shallowRef<PlayerDetail | null>(null)
const loading = ref(true)
const error = shallowRef<ApiError | null>(null)
const whitelistDraft = shallowRef<WhitelistDraft | null>(null)
const banDraft = shallowRef<BanDraft | null>(null)
let controller: AbortController | null = null

async function load(): Promise<void> {
  controller?.abort()
  const current = new AbortController()
  controller = current
  loading.value = true
  error.value = null
  try {
    const result = await api<PlayerDetail>('get_player_detail', { uuid: props.uuid }, { signal: current.signal })
    detail.value = result
    detailCrumb.value = result.player.last_nick
  } catch (e) {
    if (isAbortError(e)) return
    detail.value = null
    error.value = e instanceof ApiError ? e : new ApiError(0, 'unexpected', 'No se pudo cargar el jugador.')
  } finally {
    if (controller === current) {
      controller = null
      loading.value = false
    }
  }
}

onMounted(load)
onBeforeUnmount(() => controller?.abort())

const player = computed(() => detail.value?.player ?? null)
const isPremium = computed(() => detail.value?.premium.status === 'premium')
const premium = computed(() => {
  switch (detail.value?.premium.status) {
    case 'premium': return { label: 'Premium', icon: IconCrown, tone: 'gold' as const }
    case 'not_found': return { label: 'No premium', icon: IconUnlock, tone: 'tenue' as const }
    default: return { label: 'Premium desconocido', icon: IconCircleQuestion, tone: 'tenue' as const }
  }
})

/** Premium → por UUID; no premium → por nick (su UUID offline cambia si cambia el nombre). */
function openWhitelist(): void {
  if (!player.value) return
  whitelistDraft.value = isPremium.value
    ? { type: 'uuid', value: player.value.uuid, reason: '' }
    : { type: 'nick', value: player.value.last_nick, reason: '' }
}

function openBan(): void {
  if (!player.value) return
  banDraft.value = isPremium.value ? { type: 'uuid', value: player.value.uuid } : { type: 'nick', value: player.value.last_nick }
}

async function afterSave(): Promise<void> {
  whitelistDraft.value = null
  banDraft.value = null
  await load()
}

async function removeWhitelist(entry: WhitelistRef): Promise<void> {
  const ok = await confirmAction({ title: 'Quitar de la whitelist', message: `Se eliminará la entrada ${entryLabel(entry.type)} «${entry.value}».`, confirmText: 'Quitar', danger: true })
  if (ok && (await run(`wl-${entry.id}`, () => api('remove_whitelist', { id: entry.id }), 'Entrada de whitelist eliminada.'))) await load()
}

async function toggleBan(entry: BlacklistRef, active: boolean): Promise<void> {
  if (await run(`bl-${entry.id}`, () => api('set_blacklist_active', { id: entry.id, active }), active ? 'Baneo activado.' : 'Baneo desactivado.')) await load()
}

async function removeBan(entry: BlacklistRef): Promise<void> {
  const ok = await confirmAction({ title: 'Eliminar baneo', message: `Se borrará el baneo ${entry.ban_id} y sus IPs hijas. No se puede deshacer.`, confirmText: 'Eliminar', danger: true })
  if (ok && (await run(`bl-${entry.id}`, () => api('remove_blacklist', { id: entry.id }), 'Baneo eliminado.'))) await load()
}
</script>

<template>
  <div>
    <EmptyState v-if="error" tone="error" :title="error.status === 404 ? 'Jugador no encontrado' : 'No se pudo cargar el jugador'" :text="error.message">
      <RouterLink class="btn" :to="{ name: 'players' }">Volver a jugadores</RouterLink>
      <button v-if="error.status !== 404" type="button" class="btn" @click="load"><IconReload aria-hidden="true" /> Reintentar</button>
    </EmptyState>

    <div v-else-if="!detail || !player" class="panel ficha" aria-busy="true">
      <span class="sr-only">Cargando…</span>
      <span class="esqueleto" /><span class="esqueleto" />
    </div>

    <template v-else>
      <section class="panel ficha">
        <PlayerHead :id="player.uuid" :name="player.last_nick" size="lg" />
        <div class="ficha-datos">
          <div class="ficha-nombre">
            <h1>{{ player.last_nick }}</h1>
            <span v-if="isOn(player.is_online)" class="chip ok"><span class="baliza viva" />Online</span>
            <StatusChip v-bind="premium" />
            <span v-if="isOn(player.is_whitelisted)" class="chip accent"><IconChecklist aria-hidden="true" />Whitelist</span>
            <span v-if="isOn(player.is_blacklisted)" class="chip down"><IconCancel aria-hidden="true" />Blacklist</span>
          </div>
          <CopyField :value="player.uuid" label="UUID" />
          <div class="ficha-meta">
            <span>Primera vez <b :title="formatDateTime(player.first_seen)">{{ timeAgo(player.first_seen) }}</b></span>
            <span>Última vez <b :title="formatDateTime(player.last_seen)">{{ timeAgo(player.last_seen) }}</b></span>
            <span>Conexiones <b>{{ formatNumber(player.total_connections) }}</b></span>
            <span v-if="session.canSeeIps">Última IP <b><IpText :ip="player.last_ip" :hidden-by-server="detail.ip_hidden" /></b></span>
            <span>País <b><CountryTag :code="player.last_country_code" :name="player.last_country" show-name /></b></span>
          </div>
        </div>
        <div class="ficha-acciones">
          <button v-if="session.can('whitelist')" type="button" class="btn" @click="openWhitelist"><IconChecklist aria-hidden="true" /> Whitelist</button>
          <button v-if="session.can('blacklist')" type="button" class="btn danger" @click="openBan"><IconCancel aria-hidden="true" /> Banear</button>
        </div>
      </section>

      <div class="rejilla dos seccion">
        <section class="panel">
          <header class="panel-cab"><div class="titulo"><IconChecklist aria-hidden="true" /><h2>Whitelist</h2></div></header>
          <p v-if="!detail.whitelist_entries.length" class="panel-cuerpo faint">No tiene entradas de whitelist.</p>
          <ul v-else class="entradas">
            <li v-for="entry in detail.whitelist_entries" :key="entry.id">
              <span class="chip tenue">{{ entryLabel(entry.type) }}</span>
              <span class="mono valor">{{ entry.value }}</span>
              <button v-if="session.can('whitelist')" type="button" class="btn ghost icono sm" :aria-label="`Quitar ${entry.value} de la whitelist`" :aria-busy="busy === `wl-${entry.id}`" @click="removeWhitelist(entry)">
                <IconTrash aria-hidden="true" />
              </button>
            </li>
          </ul>
        </section>

        <section class="panel">
          <header class="panel-cab"><div class="titulo"><IconCancel aria-hidden="true" /><h2>Baneos</h2></div></header>
          <p v-if="!detail.blacklist_entries.length" class="panel-cuerpo faint">No tiene baneos.</p>
          <ul v-else class="entradas">
            <li v-for="entry in detail.blacklist_entries" :key="entry.id">
              <span class="mono faint">{{ entry.ban_id }}</span>
              <span class="valor">
                <span class="mono">{{ entryLabel(entry.type) }} · {{ entry.value }}</span>
                <span class="sub-celda">{{ entry.reason || 'Sin motivo' }}</span>
              </span>
              <StatusChip v-bind="banStatus(entry.active, entry.expires_at)" />
              <StatusChip v-bind="banExpiry(entry.expires_at)" />
              <template v-if="session.can('blacklist')">
                <ActiveSwitch :active="isOn(entry.active)" :busy="busy === `bl-${entry.id}`" :label="`Baneo ${entry.ban_id} activo`" @change="toggleBan(entry, $event)" />
                <button type="button" class="btn ghost icono sm" :aria-label="`Eliminar baneo ${entry.ban_id}`" @click="removeBan(entry)"><IconTrash aria-hidden="true" /></button>
              </template>
            </li>
          </ul>
        </section>

        <section class="panel">
          <header class="panel-cab"><div class="titulo"><IconLabel aria-hidden="true" /><h2>Nicks usados</h2></div></header>
          <p v-if="!detail.nicks.length" class="panel-cuerpo faint">Sin nicks registrados.</p>
          <ul v-else class="entradas">
            <li v-for="nick in detail.nicks" :key="nick.nick">
              <b class="mono valor">{{ nick.nick }}</b>
              <span class="faint" :title="formatDateTime(nick.last_used)">{{ formatDateTime(nick.first_used) }} → {{ timeAgo(nick.last_used) }}</span>
            </li>
          </ul>
        </section>

        <NameHistoryPanel :player-name="player.last_nick" />
      </div>

      <section v-if="session.canSeeIps" class="panel seccion">
        <header class="panel-cab"><div class="titulo"><IconGlobe aria-hidden="true" /><h2>IPs</h2></div></header>
        <p v-if="detail.ip_hidden || !detail.ips.length" class="panel-cuerpo faint">{{ detail.ip_hidden ? 'Tu rol no puede ver las IPs.' : 'Sin IPs registradas.' }}</p>
        <div v-else class="tabla-marco">
          <table class="tabla">
            <thead><tr><th scope="col">IP</th><th scope="col">País</th><th scope="col">ISP</th><th scope="col">Primera vez</th><th scope="col">Última vez</th></tr></thead>
            <tbody>
              <tr v-for="(ip, index) in detail.ips" :key="ip.ip ?? index">
                <td><IpText :ip="ip.ip" /></td>
                <td><CountryTag :code="ip.country_code" :name="ip.country" show-name /></td>
                <td class="celda-texto truncate">{{ ip.isp || '—' }}</td>
                <td class="nowrap">{{ formatDateTime(ip.first_used) }}</td>
                <td class="nowrap" :title="formatDateTime(ip.last_used)">{{ timeAgo(ip.last_used) }}</td>
              </tr>
            </tbody>
          </table>
        </div>
      </section>

      <section class="panel seccion">
        <header class="panel-cab"><div class="titulo"><IconPlug aria-hidden="true" /><h2>Conexiones recientes</h2></div></header>
        <p v-if="!detail.recent_connections.length" class="panel-cuerpo faint">Sin conexiones registradas.</p>
        <div v-else class="tabla-marco">
          <table class="tabla">
            <thead><tr><th scope="col">Fecha</th><th v-if="session.canSeeIps" scope="col">IP</th><th scope="col">País</th><th scope="col">Nick</th><th scope="col">Resultado</th></tr></thead>
            <tbody>
              <tr v-for="connection in detail.recent_connections" :key="connection.id" :class="{ bloqueada: isOn(connection.blocked) }">
                <td class="nowrap">{{ formatDateTime(connection.created_at) }}</td>
                <td v-if="session.canSeeIps"><IpText :ip="connection.ip" /></td>
                <td><CountryTag :code="connection.country_code" :name="connection.country" /></td>
                <td class="mono">{{ connection.nick }}</td>
                <td><StatusChip v-bind="reasonLabel(isOn(connection.blocked) ? connection.block_reason : 'allowed')" /></td>
              </tr>
            </tbody>
          </table>
        </div>
      </section>

      <WhitelistDialog :open="whitelistDraft !== null" :draft="whitelistDraft" @close="whitelistDraft = null" @saved="afterSave" />
      <BanDialog :open="banDraft !== null" :draft="banDraft" @close="banDraft = null" @saved="afterSave" />
    </template>

    <p class="sr-only" aria-live="polite">{{ loading ? 'Cargando jugador…' : '' }}</p>
  </div>
</template>

<style scoped>
.ficha { display: flex; align-items: flex-start; gap: 18px; flex-wrap: wrap; padding: 20px; }
.ficha .esqueleto { width: 40%; }
.ficha-datos { display: grid; gap: 10px; flex: 1 1 320px; min-width: 0; }
.ficha-nombre { display: flex; align-items: center; gap: 10px; flex-wrap: wrap; }
.ficha-nombre h1 { font-size: 24px; overflow-wrap: anywhere; }
.ficha-datos .copiable { width: max-content; max-width: 100%; }
.ficha-meta { display: flex; flex-wrap: wrap; gap: 6px 18px; color: var(--ink-3); font-size: var(--text-sm); }
.ficha-meta b { color: var(--ink-2); font-weight: 500; }
.ficha-acciones { display: flex; gap: 8px; flex-wrap: wrap; }
.entradas { list-style: none; margin: 0; padding: 0; }
.entradas li { display: flex; align-items: center; gap: 10px; flex-wrap: wrap; padding: 10px 18px; border-bottom: 1px solid var(--rule); font-size: var(--text-sm); }
.entradas li:last-child { border-bottom: 0; }
.entradas .valor { flex: 1; min-width: 0; overflow-wrap: anywhere; }
</style>
