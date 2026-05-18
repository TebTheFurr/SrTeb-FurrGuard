<script setup lang="ts">
import { ref, computed, onMounted, nextTick } from 'vue'
import { useMessagesStore } from '@/stores/messages'
import { useToast } from '@/composables/useToast'
import LoadingSkeleton from '@/components/shared/LoadingSkeleton.vue'
import { Save, Palette, Variable } from 'lucide-vue-next'

const store = useMessagesStore()
const toast = useToast()

const editingMessages = ref<Record<string, string>>({})

// Minecraft color codes
const COLOR_CODES = [
  { code: '\u00A70', label: '\u00A70\u2588\u2588', title: 'Black (\u00A70)' },
  { code: '\u00A71', label: '\u00A71\u2588\u2588', title: 'Dark Blue (\u00A71)' },
  { code: '\u00A72', label: '\u00A72\u2588\u2588', title: 'Dark Green (\u00A72)' },
  { code: '\u00A73', label: '\u00A73\u2588\u2588', title: 'Dark Aqua (\u00A73)' },
  { code: '\u00A74', label: '\u00A74\u2588\u2588', title: 'Dark Red (\u00A74)' },
  { code: '\u00A75', label: '\u00A75\u2588\u2588', title: 'Dark Purple (\u00A75)' },
  { code: '\u00A76', label: '\u00A76\u2588\u2588', title: 'Gold (\u00A76)' },
  { code: '\u00A77', label: '\u00A77\u2588\u2588', title: 'Gray (\u00A77)' },
  { code: '\u00A78', label: '\u00A78\u2588\u2588', title: 'Dark Gray (\u00A78)' },
  { code: '\u00A79', label: '\u00A79\u2588\u2588', title: 'Blue (\u00A79)' },
  { code: '\u00A7a', label: '\u00A7a\u2588\u2588', title: 'Green (\u00A7a)' },
  { code: '\u00A7b', label: '\u00A7b\u2588\u2588', title: 'Aqua (\u00A7b)' },
  { code: '\u00A7c', label: '\u00A7c\u2588\u2588', title: 'Red (\u00A7c)' },
  { code: '\u00A7d', label: '\u00A7d\u2588\u2588', title: 'Light Purple (\u00A7d)' },
  { code: '\u00A7e', label: '\u00A7e\u2588\u2588', title: 'Yellow (\u00A7e)' },
  { code: '\u00A7f', label: '\u00A7f\u2588\u2588', title: 'White (\u00A7f)' },
]

const FORMAT_CODES = [
  { code: '\u00A7l', label: 'B', title: 'Bold (\u00A7l)' },
  { code: '\u00A7m', label: 'S', title: 'Strikethrough (\u00A7m)' },
  { code: '\u00A7n', label: 'U', title: 'Underline (\u00A7n)' },
  { code: '\u00A7o', label: 'I', title: 'Italic (\u00A7o)' },
  { code: '\u00A7r', label: 'R', title: 'Reset (\u00A7r)' },
]

// Variables available for message keys
const VARIABLES: Record<string, string[]> = {
  kick: ['{server_name}', '{discord}', '{id}', '{player}', '{ip}', '{reason}', '{country}', '{country_code}', '{isp}', '{continent}', '{time_remaining}', '{ban_id}'],
  notify: ['{player}', '{ip}', '{country}', '{country_code}', '{isp}', '{continent}', '{ban_id}', '{command}', '{details}', '{reason}'],
  command: ['{usage}', '{type}', '{value}', '{player}'],
  other: ['{player}', '{type}', '{value}', '{country}', '{country_code}', '{current_country}', '{historical_country}', '{continent}', '{verify_url}'],
  fur_perms: ['{player}', '{command}'],
  furr_security: ['{player}', '{url}', '{time}', '{key}', '{value}'],
}

// Message categories with labels and key prefixes
const MESSAGE_CATEGORIES = [
  {
    id: 'kick',
    label: 'Kick Messages',
    icon: 'ShieldOff',
    description: 'Mensajes mostrados al expulsar jugadores',
  },
  {
    id: 'notify',
    label: 'Notificaciones',
    icon: 'Bell',
    description: 'Notificaciones enviadas a administradores',
  },
  {
    id: 'command',
    label: 'Comandos',
    icon: 'Terminal',
    description: 'Respuestas de comandos del plugin',
  },
  {
    id: 'other',
    label: 'Otros',
    icon: 'FileText',
    description: 'Prefijo y otros mensajes',
  },
  {
    id: 'fur_perms',
    label: 'FurrPerms',
    icon: 'Lock',
    description: 'Mensajes del modulo FurrPerms (bloqueo de comandos)',
  },
  {
    id: 'furr_security',
    label: 'FurrSecurity',
    icon: 'ShieldCheck',
    description: 'Mensajes del modulo FurrSecurity (verificacion de staff)',
  },
]

const expandedCategories = ref<Set<string>>(new Set())

const groupedMessages = computed(() => {
  const groups: Record<string, Array<{ key: string; value: string }>> = {
    kick: [],
    notify: [],
    command: [],
    other: [],
    fur_perms: [],
    furr_security: [],
  }

  for (const [key, value] of Object.entries(editingMessages.value)) {
    if (key.startsWith('fur_perms_')) {
      groups.fur_perms.push({ key, value })
    } else if (key.startsWith('furr_security_')) {
      groups.furr_security.push({ key, value })
    } else if (key.startsWith('kick_')) {
      groups.kick.push({ key, value })
    } else if (key.startsWith('notify_')) {
      groups.notify.push({ key, value })
    } else if (
      key.startsWith('whitelist_') ||
      key.startsWith('blacklist_') ||
      key.startsWith('player_') ||
      key.startsWith('no_permission') ||
      key.startsWith('reload_') ||
      key.startsWith('command_') ||
      key.startsWith('invalid_')
    ) {
      groups.command.push({ key, value })
    } else {
      groups.other.push({ key, value })
    }
  }

  return groups
})

function getVariablesForCategory(categoryId: string): string[] {
  const vars = VARIABLES[categoryId] ?? VARIABLES.other
  return [...new Set(vars)]
}

function toggleCategory(id: string) {
  const s = new Set(expandedCategories.value)
  if (s.has(id)) {
    s.delete(id)
  } else {
    s.add(id)
  }
  expandedCategories.value = s
}

function messageLabel(key: string): string {
  const labels: Record<string, string> = {
    prefix: 'Prefijo del Plugin',
    kick_proxy: 'Kick - Proxy',
    kick_vpn: 'Kick - VPN',
    kick_hosting: 'Kick - Hosting',
    kick_mobile: 'Kick - Red Movil',
    kick_blacklisted: 'Kick - Blacklist',
    kick_blocked_provider: 'Kick - Proveedor Bloqueado',
    kick_blocked_country: 'Kick - Pais Bloqueado',
    kick_blocked_continent: 'Kick - Continente Bloqueado',
    kick_compromised_account: 'Kick - Cuenta Comprometida',
    kick_default: 'Kick - Default (Sin razon especifica)',
    kick_api_error: 'Kick - Error de API',
    kick_timeout: 'Kick - Timeout',
    kick_interrupted: 'Kick - Interrumpido',
    kick_execution_error: 'Kick - Error de Ejecucion',
    kick_completion_error: 'Kick - Error de Completitud',
    kick_unknown_error: 'Kick - Error Desconocido',
    whitelist_added: 'Whitelist Anadida',
    whitelist_removed: 'Whitelist Eliminada',
    blacklist_added: 'Blacklist Anadida',
    blacklist_removed: 'Blacklist Eliminada',
    player_allowed: 'Jugador Permitido',
    player_blocked: 'Jugador Bloqueado',
    no_permission: 'Sin Permisos',
    reload_success: 'Recarga Exitosa',
    command_usage: 'Uso de Comando',
    player_not_found: 'Jugador No Encontrado',
    invalid_type: 'Tipo Invalido',
    notify_proxy_blocked: 'Proxy Bloqueado',
    notify_vpn_blocked: 'VPN Bloqueada',
    notify_hosting_blocked: 'Hosting Bloqueado',
    notify_provider_blocked: 'Proveedor Bloqueado',
    notify_country_blocked: 'Pais Bloqueado',
    notify_continent_blocked: 'Continente Bloqueado',
    notify_compromised_account: 'Cuenta Comprometida',
    notify_blacklisted: 'Blacklist',
    notify_whitelisted: 'Whitelist',
    notify_player_join: 'Jugador Conecto (Hispano)',
    notify_non_hispanic_join: 'Jugador Conecto (No Hispano)',
    notify_player_disconnect: 'Jugador Desconecto',
    notify_settings_updated: 'Config Actualizada',
    notify_providers_updated: 'Proveedores Actualizados',
    notify_player_kicked: 'Jugador Expulsado',
    // FurrPerms
    fur_perms_no_permission: 'Sin Permisos (FurrPerms)',
    fur_perms_command_blocked: 'Comando Bloqueado',
    fur_perms_logged: 'Intento Registrado',
    fur_perms_notify_blocked: 'Notificar - Comando Bloqueado',
    fur_perms_notify_allowed: 'Notificar - Comando Permitido',
    // FurrSecurity
    furr_security_prefix: 'Prefijo del Plugin',
    furr_security_verification_required: 'Verificacion Requerida',
    furr_security_verification_link: 'Link de Verificacion',
    furr_security_verification_proxy_mode: 'Verificacion en Proxy',
    furr_security_verification_success: 'Verificacion Exitosa',
    furr_security_verification_failed: 'Verificacion Fallida',
    furr_security_session_expired: 'Sesion Expirada',
    furr_security_session_expiring: 'Sesion Expirando',
    furr_security_not_staff: 'No es Staff',
    furr_security_already_verified: 'Ya Verificado',
    furr_security_locked_movement: 'Bloqueado - Movimiento',
    furr_security_locked_command: 'Bloqueado - Comandos',
    furr_security_locked_inventory: 'Bloqueado - Inventario',
    furr_security_locked_chat: 'Bloqueado - Chat',
    furr_security_locked_server_switch: 'Bloqueado - Cambio de Servidor',
    furr_security_admin_notification: 'Notificacion Admin',
    furr_security_reload_success: 'Recarga Exitosa',
    furr_security_no_permission: 'Sin Permisos',
    furr_security_player_not_found: 'Jugador No Encontrado',
    furr_security_stats_header: 'Header Estadisticas',
    furr_security_stats_line: 'Linea Estadisticas',
    furr_security_kick_unverified: 'Kick - No Verificado',
    furr_security_kick_blacklisted: 'Kick - Blacklist Seguridad',
    furr_security_verification_timeout: 'Link Expirado',
    furr_security_auto_blacklisted: 'Auto-Blacklist (3 intentos)',
  }
  return labels[key] ?? key.replace(/_/g, ' ').replace(/\b\w/g, (c) => c.toUpperCase())
}

function onMessageInput(key: string, value: string) {
  editingMessages.value = { ...editingMessages.value, [key]: value }
  store.markDirty()
}

function insertCode(key: string, code: string) {
  const textarea = document.querySelector<HTMLTextAreaElement>(`[data-key="${key}"]`)
  if (!textarea) return

  const start = textarea.selectionStart
  const end = textarea.selectionEnd
  const current = editingMessages.value[key] ?? ''
  const updated = current.slice(0, start) + code + current.slice(end)
  editingMessages.value = { ...editingMessages.value, [key]: updated }
  store.markDirty()

  nextTick(() => {
    textarea.focus()
    const pos = start + code.length
    textarea.setSelectionRange(pos, pos)
  })
}

function insertVariable(key: string, variable: string) {
  insertCode(key, variable)
}

function previewMessage(raw: string): string {
  const mcColorMap: Record<string, string> = {
    '\u00A70': '#000000',
    '\u00A71': '#0000AA',
    '\u00A72': '#00AA00',
    '\u00A73': '#00AAAA',
    '\u00A74': '#AA0000',
    '\u00A75': '#AA00AA',
    '\u00A76': '#FFAA00',
    '\u00A77': '#AAAAAA',
    '\u00A78': '#555555',
    '\u00A79': '#5555FF',
    '\u00A7a': '#55FF55',
    '\u00A7b': '#55FFFF',
    '\u00A7c': '#FF5555',
    '\u00A7d': '#FF55FF',
    '\u00A7e': '#FFFF55',
    '\u00A7f': '#FFFFFF',
  }

  let html = raw
    .replace(/&/g, '&amp;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;')

  // Reset
  html = html.replace(/\u00A7r/g, '</span>')

  // Format codes
  html = html.replace(/\u00A7l([^]*?)(?=\u00A7|$)/g, '<strong>$1</strong>')
  html = html.replace(/\u00A7n([^]*?)(?=\u00A7|$)/g, '<u>$1</u>')
  html = html.replace(/\u00A7m([^]*?)(?=\u00A7|$)/g, '<del>$1</del>')
  html = html.replace(/\u00A7o([^]*?)(?=\u00A7|$)/g, '<em>$1</em>')

  // Color codes
  for (const [code, color] of Object.entries(mcColorMap)) {
    const escaped = code.replace(/\u00A7/g, '\u00A7')
    html = html.split(escaped).join(`<span style="color:${color}">`)
  }

  return html
}

async function handleSave() {
  const success = await store.save(editingMessages.value)
  if (success) {
    toast.success('Mensajes guardados', 'Los mensajes se han actualizado correctamente')
  } else {
    toast.error('Error al guardar', store.error ?? 'No se pudieron guardar los mensajes')
  }
}

onMounted(async () => {
  await store.fetch()
  editingMessages.value = { ...store.messages }
  // Expand all categories by default
  expandedCategories.value = new Set(MESSAGE_CATEGORIES.map((c) => c.id))
})
</script>

<template>
  <div class="page-container">
    <!-- Page header -->
    <div class="section-header">
      <div>
        <h1 class="text-2xl font-display font-bold gradient-text">Mensajes</h1>
        <p class="text-sm text-text-muted mt-1">Configura los mensajes del plugin en Minecraft</p>
      </div>
      <button
        class="glass-button inline-flex items-center gap-2 px-5 py-2.5 text-sm disabled:opacity-40 hover:shadow-[0_8px_30px_rgba(139,92,246,0.5)]"
        :disabled="!store.dirty || store.loading"
        @click="handleSave"
      >
        <Save :size="16" />
        {{ store.loading ? 'Guardando...' : 'Guardar cambios' }}
      </button>
    </div>

    <!-- Loading state -->
    <LoadingSkeleton v-if="store.loading && Object.keys(editingMessages).length === 0" :rows="6" />

    <!-- Message categories -->
    <div v-else class="space-y-4 stagger-children">
      <div
        v-for="category in MESSAGE_CATEGORIES"
        :key="category.id"
        class="glass-card overflow-hidden"
      >
        <!-- Category header -->
        <button
          class="w-full flex items-center justify-between px-5 py-4 hover:bg-hover transition-colors"
          @click="toggleCategory(category.id)"
        >
          <div class="flex items-center gap-3">
            <div class="w-8 h-8 rounded-lg gradient-primary flex items-center justify-center opacity-80">
              <span class="text-white text-xs font-bold">{{ category.label.charAt(0) }}</span>
            </div>
            <div class="text-left">
              <span class="text-sm font-semibold text-text-primary">{{ category.label }}</span>
              <span class="ml-2 text-xs text-text-muted">({{ groupedMessages[category.id]?.length ?? 0 }} mensajes)</span>
            </div>
          </div>
          <svg
            class="w-4 h-4 text-text-muted transition-transform duration-300"
            :class="{ 'rotate-180': expandedCategories.has(category.id) }"
            fill="none" stroke="currentColor" viewBox="0 0 24 24"
          >
            <path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M19 9l-7 7-7-7" />
          </svg>
        </button>

        <!-- Category body -->
        <div v-if="expandedCategories.has(category.id)" class="border-t border-glass-border-subtle">
          <div class="px-5 pt-4 pb-2">
            <p class="text-xs text-text-muted mb-3">{{ category.description }}</p>

            <!-- Variable buttons -->
            <div class="flex flex-wrap items-center gap-1.5 mb-4">
              <div class="flex items-center gap-1 text-xs text-text-tertiary mr-1">
                <Variable :size="12" />
                <span>Variables:</span>
              </div>
              <button
                v-for="v in getVariablesForCategory(category.id)"
                :key="v"
                class="px-2 py-0.5 rounded-md text-xs font-mono bg-dark-800/80 text-cyan-400 border border-glass-border-subtle hover:bg-dark-700 hover:border-cyan-500/30 transition-all duration-200"
                @click="insertVariable(groupedMessages[category.id]?.[0]?.key ?? '', v)"
              >
                {{ v }}
              </button>
            </div>
          </div>

          <!-- Messages list -->
          <div class="divide-y divide-glass-border-subtle">
            <div
              v-for="msg in groupedMessages[category.id]"
              :key="msg.key"
              class="px-5 py-4 hover:bg-hover/50 transition-colors"
            >
              <div class="flex items-start justify-between gap-3 mb-3">
                <div>
                  <span class="text-sm font-medium text-text-primary">{{ messageLabel(msg.key) }}</span>
                  <span class="ml-2 text-xs text-text-tertiary font-mono bg-dark-800/60 px-1.5 py-0.5 rounded">{{ msg.key }}</span>
                </div>
              </div>

              <!-- Color code toolbar -->
              <div class="flex items-center gap-1 mb-3 flex-wrap">
                <span class="text-xs text-text-tertiary flex items-center gap-1 mr-1">
                  <Palette :size="12" />
                </span>
                <button
                  v-for="color in COLOR_CODES"
                  :key="color.code"
                  class="w-6 h-6 rounded-md text-xs font-bold flex items-center justify-center border border-glass-border-subtle hover:scale-110 hover:border-glass-border-strong transition-all duration-200"
                  :title="color.title"
                  @click="insertCode(msg.key, color.code)"
                >
                  <span class="font-sans" style="font-size: 10px">{{ color.label.slice(-2) }}</span>
                </button>
                <div class="w-px h-5 bg-glass-border-subtle mx-1" />
                <button
                  v-for="fmt in FORMAT_CODES"
                  :key="fmt.code"
                  class="w-6 h-6 rounded-md text-xs font-bold flex items-center justify-center bg-dark-800/80 text-text-secondary border border-glass-border-subtle hover:bg-dark-700 hover:border-glass-border-strong transition-all duration-200"
                  :title="fmt.title"
                  @click="insertCode(msg.key, fmt.code)"
                >
                  {{ fmt.label }}
                </button>
              </div>

              <!-- Editor + Preview side by side on larger screens -->
              <div class="grid grid-cols-1 lg:grid-cols-2 gap-3">
                <!-- Textarea -->
                <textarea
                  :data-key="msg.key"
                  :value="editingMessages[msg.key] ?? ''"
                  rows="3"
                  class="w-full px-3 py-2.5 rounded-xl bg-dark-800/60 border border-glass-border-subtle text-text-primary text-sm font-mono focus:outline-none focus:border-purple-500/50 focus:shadow-[0_0_12px_rgba(139,92,246,0.1)] resize-y transition-all duration-200 placeholder:text-text-tertiary"
                  @input="onMessageInput(msg.key, ($event.target as HTMLTextAreaElement).value)"
                />

                <!-- Preview panel -->
                <div class="rounded-xl bg-dark-950/60 border border-glass-border-subtle p-3 min-h-[4.5rem]">
                  <div class="text-[10px] text-text-tertiary uppercase tracking-wider mb-1.5 font-semibold">Vista previa</div>
                  <div
                    class="text-sm font-mono leading-relaxed whitespace-pre-wrap break-words"
                    v-html="previewMessage(editingMessages[msg.key] ?? '')"
                  />
                </div>
              </div>
            </div>
          </div>
        </div>
      </div>
    </div>

    <!-- Error display -->
    <p v-if="store.error && !store.loading" class="text-red-400 text-sm text-center py-2">
      {{ store.error }}
    </p>
  </div>
</template>
