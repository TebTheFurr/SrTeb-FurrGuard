<script setup lang="ts">
import { computed, onBeforeUnmount, onMounted, ref, shallowRef } from 'vue'
import IconCancel from '~icons/pixelarticons/cancel'
import IconCellularOff from '~icons/pixelarticons/cellular-signal-off'
import IconChecklist from '~icons/pixelarticons/checklist'
import IconDashboard from '~icons/pixelarticons/dashboard'
import IconGamepad from '~icons/pixelarticons/gamepad'
import IconKey from '~icons/pixelarticons/key'
import IconMap from '~icons/pixelarticons/map'
import IconPlug from '~icons/pixelarticons/plug'
import IconRadioSignal from '~icons/pixelarticons/radio-signal'
import IconReload from '~icons/pixelarticons/reload'
import IconBuildings from '~icons/pixelarticons/buildings'
import IconEarth from '~icons/pixelarticons/earth'
import { api, ApiError, isAbortError } from '@/api/client'
import type { Overview } from '@/api/types'
import { formatDateTime, timeAgo } from '@/lib/dates'
import { entryLabel } from '@/lib/entries'
import { isOn } from '@/lib/format'
import { reasonLabel } from '@/lib/labels'
import { useSession } from '@/stores/session'
import CountryTag from '@/components/ui/CountryTag.vue'
import EmptyState from '@/components/ui/EmptyState.vue'
import IpText from '@/components/ui/IpText.vue'
import PageHeader from '@/components/ui/PageHeader.vue'
import PlayerHead from '@/components/ui/PlayerHead.vue'
import StatCard from '@/components/ui/StatCard.vue'
import StatusChip from '@/components/ui/StatusChip.vue'

const session = useSession()
const data = shallowRef<Overview | null>(null)
const loading = ref(true)
const error = shallowRef<ApiError | null>(null)
let controller: AbortController | null = null

async function load(): Promise<void> {
  controller?.abort()
  const current = new AbortController()
  controller = current
  loading.value = true
  error.value = null
  try {
    const result = await api<Overview>('get_overview', {}, { signal: current.signal })
    data.value = result
    session.setHealth(result.health)
  } catch (e) {
    if (!isAbortError(e)) error.value = e instanceof ApiError ? e : new ApiError(0, 'unexpected', 'No se pudo cargar el resumen.')
  } finally {
    if (controller === current) {
      controller = null
      loading.value = false
    }
  }
}

onMounted(load)
onBeforeUnmount(() => controller?.abort())

const link = (section: 'whitelist' | 'blacklist' | 'providers' | 'countries' | 'continents' | 'connections' | 'players') =>
  session.can(section) ? { name: section } : undefined

const notices = computed(() => {
  const health = data.value?.health
  if (!health) return []
  const list: { tone: 'down' | 'warn'; icon: typeof IconKey; title: string; text: string; settings?: boolean }[] = []
  if (!health.api_key_configured) {
    list.push({ tone: 'down', icon: IconKey, title: 'Falta la API key', text: 'Los plugins no pueden conectarse hasta que se genere una en Ajustes.', settings: true })
  }
  if (health.ip_api === 'down') {
    list.push({
      tone: 'warn', icon: IconCellularOff, title: 'ip-api no responde',
      text: health.geo_mirror === 'ok'
        ? 'Se usa solo el espejo MaxMind: país, continente y ASN siguen funcionando, pero no se detectan proxy, hosting ni redes móviles.'
        : 'Y el espejo MaxMind no está disponible: las conexiones nuevas no tienen datos de geolocalización.',
    })
  } else if (health.ip_api === 'limited') {
    list.push({ tone: 'warn', icon: IconCellularOff, title: 'ip-api limitada', text: 'Se ha agotado el presupuesto por minuto: algunas comprobaciones usan solo caché y MaxMind.' })
  }
  if (health.geo_mirror === 'missing') {
    list.push({ tone: 'warn', icon: IconMap, title: 'Falta el espejo MaxMind', text: 'Configura GEOIP_COUNTRY_DB y GEOIP_ASN_DB o ejecuta bin/geoip-update.php.' })
  } else if (health.geo_mirror === 'disabled') {
    list.push({ tone: 'warn', icon: IconMap, title: 'Espejo MaxMind desactivado', text: 'Falta el lector de MaxMind: ejecuta composer install --no-dev en el servidor.' })
  }
  return list
})
</script>

<template>
  <div>
    <PageHeader title="Resumen" :icon="IconDashboard" desc="Estado de la red en las últimas 24 horas.">
      <button type="button" class="btn" :aria-busy="loading && !!data" :disabled="loading" @click="load">
        <IconReload aria-hidden="true" /> Actualizar
      </button>
    </PageHeader>

    <EmptyState v-if="error && !data" tone="error" title="No se pudo cargar el resumen" :text="error.message">
      <button type="button" class="btn" @click="load"><IconReload aria-hidden="true" /> Reintentar</button>
    </EmptyState>

    <div v-else-if="!data" class="metricas" aria-busy="true">
      <span class="sr-only">Cargando…</span>
      <div v-for="n in 4" :key="n" class="metrica"><span class="esqueleto" /><span class="esqueleto alto" /></div>
    </div>

    <template v-else>
      <div v-if="notices.length" class="avisos seccion">
        <div v-for="notice in notices" :key="notice.title" class="aviso" :class="notice.tone" role="status">
          <component :is="notice.icon" aria-hidden="true" />
          <span class="texto">{{ notice.title }}<small>{{ notice.text }}</small></span>
          <RouterLink v-if="notice.settings && session.can('settings')" class="btn sm" :to="{ name: 'settings' }">Ir a Ajustes</RouterLink>
        </div>
      </div>

      <div class="metricas seccion">
        <StatCard label="Jugadores online" :value="data.online_players" :icon="IconRadioSignal" tone="ok" :to="session.can('players') ? { name: 'players', query: { filter: 'online' } } : undefined" />
        <StatCard label="Jugadores registrados" :value="data.total_players" :icon="IconGamepad" :to="link('players')" />
        <StatCard label="Conexiones 24 h" :value="data.connections_24h" :icon="IconPlug" :to="link('connections')" />
        <StatCard label="Bloqueos 24 h" :value="data.blocked_24h" :icon="IconCancel" tone="down" :to="session.can('connections') ? { name: 'connections', query: { filter: 'blocked' } } : undefined" />
      </div>

      <div class="metricas seccion contadores">
        <StatCard label="Whitelist" :value="data.counts.whitelist" :icon="IconChecklist" :to="link('whitelist')" />
        <StatCard label="Blacklist" :value="data.counts.blacklist" :icon="IconCancel" :to="link('blacklist')" />
        <StatCard label="Proveedores" :value="data.counts.providers" :icon="IconBuildings" :to="link('providers')" />
        <StatCard label="Países" :value="data.counts.countries" :icon="IconMap" :to="link('countries')" />
        <StatCard label="Continentes" :value="data.counts.continents" :icon="IconEarth" :to="link('continents')" />
      </div>

      <div class="rejilla dos seccion">
        <section class="panel">
          <header class="panel-cab">
            <div class="titulo"><IconPlug aria-hidden="true" /><h2>Conexiones recientes</h2></div>
          </header>
          <EmptyState v-if="!data.recent_connections.length" :icon="IconPlug" title="Sin conexiones recientes" />
          <ul v-else class="eventos">
            <li v-for="(item, index) in data.recent_connections" :key="item.id ?? index" :class="{ bloqueada: isOn(item.blocked) }">
              <PlayerHead :id="item.uuid ?? ''" :name="item.nick" />
              <div class="evento-texto">
                <RouterLink v-if="item.uuid && session.can('players')" class="enlace-fila" :to="{ name: 'player', params: { uuid: item.uuid } }">{{ item.nick }}</RouterLink>
                <b v-else>{{ item.nick }}</b>
                <span class="sub"><IpText :ip="item.ip" /> · <CountryTag :code="item.country_code" :name="item.country" /></span>
              </div>
              <StatusChip v-if="isOn(item.blocked)" v-bind="reasonLabel(item.block_reason)" />
              <StatusChip v-else v-bind="reasonLabel('allowed')" />
              <time class="faint" :datetime="item.created_at" :title="formatDateTime(item.created_at)">{{ timeAgo(item.created_at) }}</time>
            </li>
          </ul>
        </section>

        <section class="panel">
          <header class="panel-cab">
            <div class="titulo"><IconCancel aria-hidden="true" /><h2>Baneos recientes</h2></div>
          </header>
          <EmptyState v-if="!data.recent_blocks.length" :icon="IconCancel" title="Sin baneos recientes" />
          <ul v-else class="eventos">
            <li v-for="(item, index) in data.recent_blocks" :key="item.id ?? index">
              <span class="chip tenue">{{ entryLabel(item.type) }}</span>
              <div class="evento-texto">
                <IpText v-if="item.type === 'ip' || item.type === 'ip_range'" :ip="item.value" />
                <b v-else class="mono valor">{{ item.minecraft_name || item.value }}</b>
                <span class="sub">{{ item.reason || 'Sin motivo' }}</span>
              </div>
              <time class="faint" :datetime="item.created_at" :title="formatDateTime(item.created_at)">{{ timeAgo(item.created_at) }}</time>
            </li>
          </ul>
        </section>
      </div>
    </template>
  </div>
</template>

<style scoped>
.contadores { grid-template-columns: repeat(auto-fit, minmax(150px, 1fr)); }
.esqueleto.alto { height: 22px; margin-top: 12px; width: 60%; }
.eventos { list-style: none; margin: 0; padding: 0; }
.eventos li {
  display: flex;
  align-items: center;
  gap: 12px;
  padding: 10px 18px;
  border-bottom: 1px solid var(--rule);
  font-size: var(--text-sm);
}
.eventos li:last-child { border-bottom: 0; }
.eventos li.bloqueada { box-shadow: inset 2px 0 0 var(--down); }
.evento-texto { display: grid; flex: 1; min-width: 0; line-height: 1.35; }
.evento-texto .sub { display: flex; align-items: center; gap: 6px; flex-wrap: wrap; color: var(--ink-3); font-size: var(--text-xs); }
.evento-texto .valor { overflow: hidden; text-overflow: ellipsis; white-space: nowrap; font-weight: 500; }
.eventos time { font-size: var(--text-xs); white-space: nowrap; }
@media (max-width: 600px) {
  .eventos li { flex-wrap: wrap; }
}
</style>
