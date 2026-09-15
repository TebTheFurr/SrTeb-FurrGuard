<script setup lang="ts">
import { ref, reactive, onMounted } from 'vue'
import { useSettingsStore } from '@/stores/settings'
import { usePermissions } from '@/composables/usePermissions'
import { useToast } from '@/composables/useToast'
import ToggleSwitch from '@/components/shared/ToggleSwitch.vue'
import LoadingSkeleton from '@/components/shared/LoadingSkeleton.vue'
import { Save, Key, Download, Database, RefreshCw, Eye, EyeOff, Copy, Check } from 'lucide-vue-next'

const store = useSettingsStore()
const { isFounder } = usePermissions()
const toast = useToast()

const showApiKey = ref(false)
const confirmRegenerate = ref(false)
const confirmMigrateBlacklist = ref(false)
const confirmMigratePlayers = ref(false)
const copiedKey = ref(false)

const form = reactive({
  block_proxy: false,
  block_vpn: false,
  block_hosting: false,
  block_mobile: false,
  notify_connections: false,
  notify_hispanic: false,
  notify_blocks: false,
  country_change_detection_enabled: false,
  country_change_continent_only: false,
  webhook_url: '',
  server_name: '',
  discord_url: '',
  country_change_min_connections: '3',
  country_change_min_percentage: '70.0',
})

function loadFormFromSettings() {
  form.block_proxy = store.settings.block_proxy === '1'
  form.block_vpn = store.settings.block_vpn === '1'
  form.block_hosting = store.settings.block_hosting === '1'
  form.block_mobile = store.settings.block_mobile === '1'
  form.notify_connections = store.settings.notify_connections === '1'
  form.notify_hispanic = store.settings.notify_hispanic === '1'
  form.notify_blocks = store.settings.notify_blocks === '1'
  form.country_change_detection_enabled = store.settings.country_change_detection_enabled === '1'
  form.country_change_continent_only = store.settings.country_change_continent_only === '1'
  form.webhook_url = store.settings.webhook_url ?? ''
  form.server_name = store.settings.server_name ?? ''
  form.discord_url = store.settings.discord_url ?? ''
  form.country_change_min_connections = store.settings.country_change_min_connections ?? '3'
  form.country_change_min_percentage = store.settings.country_change_min_percentage ?? '70.0'
}

function buildSettingsPayload(): Record<string, string> {
  return {
    block_proxy: form.block_proxy ? '1' : '0',
    block_vpn: form.block_vpn ? '1' : '0',
    block_hosting: form.block_hosting ? '1' : '0',
    block_mobile: form.block_mobile ? '1' : '0',
    notify_connections: form.notify_connections ? '1' : '0',
    notify_hispanic: form.notify_hispanic ? '1' : '0',
    notify_blocks: form.notify_blocks ? '1' : '0',
    country_change_detection_enabled: form.country_change_detection_enabled ? '1' : '0',
    country_change_continent_only: form.country_change_continent_only ? '1' : '0',
    webhook_url: form.webhook_url,
    server_name: form.server_name,
    discord_url: form.discord_url,
    country_change_min_connections: form.country_change_min_connections,
    country_change_min_percentage: form.country_change_min_percentage,
  }
}

async function handleSave() {
  const success = await store.save(buildSettingsPayload())
  if (success) {
    toast.success('Configuracion guardada', 'Los ajustes se han actualizado correctamente')
  } else {
    toast.error('Error al guardar', store.error ?? 'No se pudo guardar la configuracion')
  }
}

async function handleRegenerateApiKey() {
  if (!confirmRegenerate.value) {
    confirmRegenerate.value = true
    return
  }
  confirmRegenerate.value = false
  const newKey = await store.regenerateApiKey()
  if (newKey) {
    toast.success('API Key regenerada', 'Se ha generado una nueva API key')
  } else {
    toast.error('Error', store.error ?? 'No se pudo regenerar la API key')
  }
}

function maskApiKey(key: string): string {
  if (!key || key.length < 10) return key
  return key.slice(0, 7) + '...' + key.slice(-5)
}

async function copyApiKey() {
  const key = store.settings.api_key ?? ''
  if (!key) return
  try {
    await navigator.clipboard.writeText(key)
    copiedKey.value = true
    setTimeout(() => { copiedKey.value = false }, 2000)
  } catch {
    toast.error('Error', 'No se pudo copiar al portapapeles')
  }
}

async function handleExportData() {
  const data = await store.exportData()
  if (data) {
    const blob = new Blob([JSON.stringify(data, null, 2)], { type: 'application/json' })
    const url = URL.createObjectURL(blob)
    const a = document.createElement('a')
    a.href = url
    a.download = `furrguard-export-${new Date().toISOString().split('T')[0]}.json`
    a.click()
    URL.revokeObjectURL(url)
    toast.success('Exportacion completada', 'Los datos se han exportado correctamente')
  } else {
    toast.error('Error al exportar', store.error ?? 'No se pudieron exportar los datos')
  }
}

async function handleMigrateBlacklist() {
  if (!confirmMigrateBlacklist.value) {
    confirmMigrateBlacklist.value = true
    return
  }
  confirmMigrateBlacklist.value = false
  const result = await store.migrateBlacklist()
  if (result) {
    toast.success(
      'Migracion completada',
      `Procesados: ${result.total_processed}, Migrados: ${result.migrated}, Eliminados: ${result.removed}`,
    )
  } else {
    toast.error('Error en la migracion', store.error ?? 'No se pudo completar la migracion')
  }
}

async function handleMigratePlayers() {
  if (!confirmMigratePlayers.value) {
    confirmMigratePlayers.value = true
    return
  }
  confirmMigratePlayers.value = false
  const result = await store.migratePlayers()
  if (result) {
    toast.success(
      'Migracion completada',
      `Procesados: ${result.total_processed}, Premium: ${result.premium}, Actualizados: ${result.updated}`,
    )
  } else {
    toast.error('Error en la migracion', store.error ?? 'No se pudo completar la migracion')
  }
}

onMounted(async () => {
  await store.fetch()
  loadFormFromSettings()
})
</script>

<template>
  <div class="page-container">
    <!-- Page header -->
    <div class="section-header">
      <div>
        <h1 class="text-2xl font-display font-bold gradient-text">Configuracion</h1>
        <p class="text-sm text-text-muted mt-1">Ajustes generales del sistema FurrGuard</p>
      </div>
      <button
        class="glass-button inline-flex items-center gap-2 px-5 py-2.5 text-sm disabled:opacity-40 hover:shadow-[0_8px_30px_rgba(139,92,246,0.5)]"
        :disabled="store.loading"
        @click="handleSave"
      >
        <Save :size="16" />
        {{ store.loading ? 'Guardando...' : 'Guardar cambios' }}
      </button>
    </div>

    <!-- Loading state -->
    <LoadingSkeleton v-if="store.loading && Object.keys(store.settings).length === 0" :rows="5" />

    <template v-else>
      <div class="grid grid-cols-1 lg:grid-cols-2 gap-4 stagger-children">
        <!-- Blocking settings -->
        <div class="glass-card p-5 space-y-4">
          <div class="flex items-center gap-3 mb-1">
            <div class="w-8 h-8 rounded-lg bg-red-500/15 flex items-center justify-center">
              <span class="text-red-400 text-sm">&#x1F6E1;</span>
            </div>
            <div>
              <h2 class="text-base font-display font-semibold text-text-primary">Bloqueo de conexiones</h2>
              <p class="text-xs text-text-muted">Tipos de conexiones sospechosas a bloquear</p>
            </div>
          </div>

          <div class="space-y-2">
            <div class="px-3 py-2.5 rounded-xl bg-dark-800/40 border border-glass-border-subtle hover:border-glass-border transition-colors">
              <ToggleSwitch
                v-model="form.block_proxy"
                label="Bloquear conexiones Proxy"
              />
            </div>
            <div class="px-3 py-2.5 rounded-xl bg-dark-800/40 border border-glass-border-subtle hover:border-glass-border transition-colors">
              <ToggleSwitch
                v-model="form.block_vpn"
                label="Bloquear conexiones VPN"
              />
            </div>
            <div class="px-3 py-2.5 rounded-xl bg-dark-800/40 border border-glass-border-subtle hover:border-glass-border transition-colors">
              <ToggleSwitch
                v-model="form.block_hosting"
                label="Bloquear conexiones desde Hosting/Datacenter"
              />
            </div>
            <div class="px-3 py-2.5 rounded-xl bg-dark-800/40 border border-glass-border-subtle hover:border-glass-border transition-colors">
              <ToggleSwitch
                v-model="form.block_mobile"
                label="Bloquear conexiones desde redes moviles"
              />
            </div>
          </div>
        </div>

        <!-- Notifications -->
        <div class="glass-card p-5 space-y-4">
          <div class="flex items-center gap-3 mb-1">
            <div class="w-8 h-8 rounded-lg bg-purple-500/15 flex items-center justify-center">
              <span class="text-purple-400 text-sm">&#x1F514;</span>
            </div>
            <div>
              <h2 class="text-base font-display font-semibold text-text-primary">Notificaciones</h2>
              <p class="text-xs text-text-muted">Configura las notificaciones via Discord Webhook</p>
            </div>
          </div>

          <div class="space-y-2">
            <div class="px-3 py-2.5 rounded-xl bg-dark-800/40 border border-glass-border-subtle hover:border-glass-border transition-colors">
              <ToggleSwitch
                v-model="form.notify_blocks"
                label="Notificar bloqueos"
              />
            </div>
            <div class="px-3 py-2.5 rounded-xl bg-dark-800/40 border border-glass-border-subtle hover:border-glass-border transition-colors">
              <ToggleSwitch
                v-model="form.notify_connections"
                label="Notificar conexiones"
              />
            </div>
            <div class="px-3 py-2.5 rounded-xl bg-dark-800/40 border border-glass-border-subtle hover:border-glass-border transition-colors">
              <ToggleSwitch
                v-model="form.notify_hispanic"
                label="Notificar conexiones hispanas"
              />
            </div>
          </div>

          <div class="pt-2">
            <label class="block text-xs text-text-muted uppercase tracking-wider mb-1.5 font-semibold">Webhook URL</label>
            <input
              v-model="form.webhook_url"
              type="text"
              class="w-full px-3 py-2.5 rounded-xl bg-dark-800/60 border border-glass-border-subtle text-text-primary text-sm font-mono focus:outline-none focus:border-purple-500/50 focus:shadow-[0_0_12px_rgba(139,92,246,0.1)] transition-all duration-200 placeholder:text-text-tertiary"
              placeholder="https://discord.com/api/webhooks/..."
            />
          </div>
        </div>

        <!-- Country change detection -->
        <div class="glass-card p-5 space-y-4">
          <div class="flex items-center gap-3 mb-1">
            <div class="w-8 h-8 rounded-lg bg-amber-500/15 flex items-center justify-center">
              <span class="text-amber-400 text-sm">&#x1F30D;</span>
            </div>
            <div>
              <h2 class="text-base font-display font-semibold text-text-primary">Deteccion de cambio de pais</h2>
              <p class="text-xs text-text-muted">Detecta cuentas comprometidas por cambios de ubicacion</p>
            </div>
          </div>

          <div class="space-y-2">
            <div class="px-3 py-2.5 rounded-xl bg-dark-800/40 border border-glass-border-subtle hover:border-glass-border transition-colors">
              <ToggleSwitch
                v-model="form.country_change_detection_enabled"
                label="Activar deteccion de cambio de pais"
              />
            </div>
            <div class="px-3 py-2.5 rounded-xl bg-dark-800/40 border border-glass-border-subtle hover:border-glass-border transition-colors">
              <ToggleSwitch
                v-model="form.country_change_continent_only"
                label="Solo detectar cambios entre continentes"
              />
            </div>
          </div>

          <div class="grid grid-cols-2 gap-3 mt-2">
            <div>
              <label class="block text-xs text-text-muted uppercase tracking-wider mb-1.5 font-semibold">Conexiones minimas</label>
              <input
                v-model="form.country_change_min_connections"
                type="number"
                min="1"
                max="100"
                class="w-full px-3 py-2.5 rounded-xl bg-dark-800/60 border border-glass-border-subtle text-text-primary text-sm focus:outline-none focus:border-purple-500/50 focus:shadow-[0_0_12px_rgba(139,92,246,0.1)] transition-all duration-200"
              />
            </div>
            <div>
              <label class="block text-xs text-text-muted uppercase tracking-wider mb-1.5 font-semibold">Porcentaje minimo (%)</label>
              <input
                v-model="form.country_change_min_percentage"
                type="number"
                min="0"
                max="100"
                step="0.1"
                class="w-full px-3 py-2.5 rounded-xl bg-dark-800/60 border border-glass-border-subtle text-text-primary text-sm focus:outline-none focus:border-purple-500/50 focus:shadow-[0_0_12px_rgba(139,92,246,0.1)] transition-all duration-200"
              />
            </div>
          </div>
        </div>

        <!-- General settings -->
        <div class="glass-card p-5 space-y-4">
          <div class="flex items-center gap-3 mb-1">
            <div class="w-8 h-8 rounded-lg bg-blue-500/15 flex items-center justify-center">
              <span class="text-blue-400 text-sm">&#x2699;</span>
            </div>
            <div>
              <h2 class="text-base font-display font-semibold text-text-primary">General</h2>
              <p class="text-xs text-text-muted">Informacion basica del servidor</p>
            </div>
          </div>

          <div class="space-y-3">
            <div>
              <label class="block text-xs text-text-muted uppercase tracking-wider mb-1.5 font-semibold">Nombre del servidor</label>
              <input
                v-model="form.server_name"
                type="text"
                class="w-full px-3 py-2.5 rounded-xl bg-dark-800/60 border border-glass-border-subtle text-text-primary text-sm focus:outline-none focus:border-purple-500/50 focus:shadow-[0_0_12px_rgba(139,92,246,0.1)] transition-all duration-200 placeholder:text-text-tertiary"
                placeholder="MI SERVIDOR"
              />
            </div>
            <div>
              <label class="block text-xs text-text-muted uppercase tracking-wider mb-1.5 font-semibold">Discord URL</label>
              <input
                v-model="form.discord_url"
                type="text"
                class="w-full px-3 py-2.5 rounded-xl bg-dark-800/60 border border-glass-border-subtle text-text-primary text-sm font-mono focus:outline-none focus:border-purple-500/50 focus:shadow-[0_0_12px_rgba(139,92,246,0.1)] transition-all duration-200 placeholder:text-text-tertiary"
                placeholder="discord.gg/tuservidor"
              />
            </div>
          </div>
        </div>
      </div>

      <!-- API Key section -->
      <div class="glass-card overflow-hidden">
        <div class="p-5">
          <div class="flex items-center gap-3 mb-4">
            <div class="w-8 h-8 rounded-lg gradient-primary flex items-center justify-center">
              <Key :size="14" class="text-white" />
            </div>
            <div>
              <h2 class="text-base font-display font-semibold text-text-primary">API Key</h2>
              <p class="text-xs text-text-muted">Clave utilizada por el plugin de Minecraft para autenticarse</p>
            </div>
          </div>

          <!-- API Key display with security styling -->
          <div class="rounded-xl bg-dark-950/60 border border-glass-border-subtle p-4">
            <div class="flex items-center gap-2 mb-3">
              <div class="flex-1 flex items-center gap-2 px-4 py-3 rounded-xl bg-dark-800/80 border border-glass-border-subtle">
                <Key :size="14" class="text-purple-400 shrink-0" />
                <span class="text-sm font-mono text-text-primary flex-1 truncate">
                  {{ showApiKey ? (store.settings.api_key ?? '') : maskApiKey(store.settings.api_key ?? '') }}
                </span>
                <div class="flex items-center gap-1 shrink-0">
                  <button
                    class="p-1.5 rounded-lg text-text-muted hover:text-text-primary hover:bg-dark-600 transition-colors"
                    title="Copiar"
                    @click="copyApiKey"
                  >
                    <Check v-if="copiedKey" :size="14" class="text-green-400" />
                    <Copy v-else :size="14" />
                  </button>
                  <button
                    class="p-1.5 rounded-lg text-text-muted hover:text-text-primary hover:bg-dark-600 transition-colors"
                    title="Mostrar/ocultar"
                    @click="showApiKey = !showApiKey"
                  >
                    <Eye v-if="!showApiKey" :size="14" />
                    <EyeOff v-else :size="14" />
                  </button>
                </div>
              </div>
            </div>

            <div class="flex items-center gap-3">
              <button
                class="inline-flex items-center gap-2 px-4 py-2 rounded-xl text-sm font-medium transition-all duration-200"
                :class="confirmRegenerate
                  ? 'glass-button-danger'
                  : 'bg-amber-500/15 text-amber-400 hover:bg-amber-500/25 border border-amber-500/20'"
                @click="handleRegenerateApiKey"
              >
                <RefreshCw :size="14" />
                {{ confirmRegenerate ? 'Confirmar regeneracion' : 'Regenerar clave' }}
              </button>
              <span v-if="confirmRegenerate" class="text-xs text-red-400/70">
                Se invalidara la clave actual. Vuelve a hacer click para confirmar.
              </span>
            </div>
          </div>
        </div>
      </div>

      <!-- Tools -->
      <div class="glass-card p-5">
        <div class="flex items-center gap-3 mb-4">
          <div class="w-8 h-8 rounded-lg bg-blue-500/15 flex items-center justify-center">
            <Download :size="14" class="text-blue-400" />
          </div>
          <div>
            <h2 class="text-base font-display font-semibold text-text-primary">Herramientas</h2>
            <p class="text-xs text-text-muted">Exporta y migra datos del sistema</p>
          </div>
        </div>

        <div class="flex flex-wrap gap-3">
          <button
            class="glass-button-secondary inline-flex items-center gap-2 px-4 py-2.5 text-sm hover:text-text-primary hover:border-blue-500/30 hover:bg-blue-500/10"
            @click="handleExportData"
          >
            <Download :size="16" />
            Exportar datos
          </button>
        </div>
      </div>

      <!-- Migration tools (founder only) -->
      <div v-if="isFounder()" class="glass-card p-5 gradient-border">
        <div class="flex items-center gap-3 mb-4">
          <div class="w-8 h-8 rounded-lg bg-amber-500/15 flex items-center justify-center">
            <Database :size="14" class="text-amber-400" />
          </div>
          <div>
            <h2 class="text-base font-display font-semibold text-text-primary">Herramientas de migracion</h2>
            <p class="text-xs text-text-muted">Solo disponible para el Founder. Estas operaciones pueden tardar varios minutos.</p>
          </div>
        </div>

        <div class="flex flex-wrap gap-3">
          <button
            class="inline-flex items-center gap-2 px-4 py-2.5 rounded-xl text-sm font-medium transition-all duration-200"
            :class="confirmMigrateBlacklist
              ? 'glass-button-danger'
              : 'bg-amber-500/15 text-amber-400 hover:bg-amber-500/25 border border-amber-500/20'"
            :disabled="store.loading"
            @click="handleMigrateBlacklist"
          >
            <Database :size="16" />
            {{ store.loading ? 'Migrando...' : (confirmMigrateBlacklist ? 'Confirmar migracion de blacklist' : 'Migrar blacklist') }}
          </button>

          <button
            class="inline-flex items-center gap-2 px-4 py-2.5 rounded-xl text-sm font-medium transition-all duration-200"
            :class="confirmMigratePlayers
              ? 'glass-button-danger'
              : 'bg-amber-500/15 text-amber-400 hover:bg-amber-500/25 border border-amber-500/20'"
            :disabled="store.loading"
            @click="handleMigratePlayers"
          >
            <Database :size="16" />
            {{ store.loading ? 'Migrando...' : (confirmMigratePlayers ? 'Confirmar migracion de jugadores' : 'Migrar jugadores') }}
          </button>
        </div>
      </div>
    </template>

    <!-- Error display -->
    <p v-if="store.error && !store.loading" class="text-red-400 text-sm text-center py-2">
      {{ store.error }}
    </p>
  </div>
</template>
