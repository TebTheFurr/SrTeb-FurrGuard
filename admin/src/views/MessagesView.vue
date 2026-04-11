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
  kick: ['{server_name}', '{discord}', '{id}', '{player}', '{ip}', '{reason}', '{country}', '{country_code}', '{isp}', '{time_remaining}', '{ban_id}'],
  notify: ['{player}', '{ip}', '{country}', '{country_code}', '{isp}', '{ban_id}', '{command}'],
  command: ['{usage}', '{type}', '{value}'],
  other: ['{player}', '{type}', '{value}', '{country}', '{country_code}', '{current_country}', '{historical_country}', '{continent}', '{verify_url}'],
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
]

const expandedCategories = ref<Set<string>>(new Set())

const groupedMessages = computed(() => {
  const groups: Record<string, Array<{ key: string; value: string }>> = {
    kick: [],
    notify: [],
    command: [],
    other: [],
  }

  for (const [key, value] of Object.entries(editingMessages.value)) {
    if (key.startsWith('kick_')) {
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
    kick_blacklisted: 'Kick - Blacklist',
    kick_blocked_provider: 'Kick - Proveedor Bloqueado',
    kick_blocked_country: 'Kick - Pais Bloqueado',
    kick_blocked_continent: 'Kick - Continente Bloqueado',
    kick_compromised_account: 'Kick - Cuenta Comprometida',
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
    notify_blacklisted: 'Blacklist',
    notify_whitelisted: 'Whitelist',
    notify_player_join: 'Jugador Conecto (Hispano)',
    notify_non_hispanic_join: 'Jugador Conecto (No Hispano)',
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
  <div class="space-y-6">
    <!-- Page header -->
    <div class="flex flex-col sm:flex-row items-start sm:items-center justify-between gap-4">
      <div>
        <h1 class="text-2xl font-display font-bold gradient-text">Mensajes</h1>
        <p class="text-sm text-text-muted mt-1">Configura los mensajes del plugin en Minecraft</p>
      </div>
      <button
        class="inline-flex items-center gap-2 px-4 py-2 rounded-lg bg-purple-500 hover:bg-purple-600 text-white text-sm font-medium transition-colors disabled:opacity-50"
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
    <div v-else class="space-y-4">
      <div
        v-for="category in MESSAGE_CATEGORIES"
        :key="category.id"
        class="glass-card overflow-hidden"
      >
        <!-- Category header -->
        <button
          class="w-full flex items-center justify-between px-4 py-3 hover:bg-hover transition-colors"
          @click="toggleCategory(category.id)"
        >
          <div class="flex items-center gap-3">
            <span class="text-sm font-semibold text-text-primary">{{ category.label }}</span>
            <span class="text-xs text-text-muted">({{ groupedMessages[category.id]?.length ?? 0 }})</span>
          </div>
          <svg
            class="w-4 h-4 text-text-muted transition-transform"
            :class="{ 'rotate-180': expandedCategories.has(category.id) }"
            fill="none" stroke="currentColor" viewBox="0 0 24 24"
          >
            <path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M19 9l-7 7-7-7" />
          </svg>
        </button>

        <!-- Category body -->
        <div v-if="expandedCategories.has(category.id)" class="border-t border-glass-border-subtle">
          <p class="px-4 pt-3 pb-1 text-xs text-text-muted">{{ category.description }}</p>

          <!-- Variable buttons -->
          <div class="px-4 pb-2 flex flex-wrap gap-1.5">
            <span class="text-xs text-text-muted flex items-center gap-1 mr-1"><Variable :size="12" /> Variables:</span>
            <button
              v-for="v in getVariablesForCategory(category.id)"
              :key="v"
              class="px-2 py-0.5 rounded text-xs font-mono bg-dark-600 text-cyan-400 hover:bg-dark-500 transition-colors"
              @click="insertVariable(groupedMessages[category.id]?.[0]?.key ?? '', v)"
            >
              {{ v }}
            </button>
          </div>

          <!-- Messages list -->
          <div class="divide-y divide-glass-border-subtle">
            <div
              v-for="msg in groupedMessages[category.id]"
              :key="msg.key"
              class="px-4 py-3"
            >
              <div class="flex items-start justify-between gap-3 mb-2">
                <div>
                  <span class="text-sm font-medium text-text-primary">{{ messageLabel(msg.key) }}</span>
                  <span class="ml-2 text-xs text-text-muted font-mono">{{ msg.key }}</span>
                </div>
              </div>

              <!-- Color code toolbar -->
              <div class="flex items-center gap-1 mb-2 flex-wrap">
                <span class="text-xs text-text-muted flex items-center gap-1 mr-1"><Palette :size="12" /></span>
                <button
                  v-for="color in COLOR_CODES"
                  :key="color.code"
                  class="w-6 h-6 rounded text-xs font-bold flex items-center justify-center border border-glass-border-subtle hover:scale-110 transition-transform"
                  :title="color.title"
                  @click="insertCode(msg.key, color.code)"
                >
                  <span class="font-sans" style="font-size: 10px">{{ color.label.slice(-2) }}</span>
                </button>
                <div class="w-px h-5 bg-glass-border-subtle mx-1" />
                <button
                  v-for="fmt in FORMAT_CODES"
                  :key="fmt.code"
                  class="w-6 h-6 rounded text-xs font-bold flex items-center justify-center bg-dark-600 text-text-secondary border border-glass-border-subtle hover:bg-dark-500 transition-colors"
                  :title="fmt.title"
                  @click="insertCode(msg.key, fmt.code)"
                >
                  {{ fmt.label }}
                </button>
              </div>

              <!-- Textarea -->
              <textarea
                :data-key="msg.key"
                :value="editingMessages[msg.key] ?? ''"
                rows="3"
                class="w-full px-3 py-2 rounded-lg bg-dark-800 border border-glass-border-subtle text-text-primary text-sm font-mono focus:outline-none focus:border-purple-500 resize-y"
                @input="onMessageInput(msg.key, ($event.target as HTMLTextAreaElement).value)"
              />
            </div>
          </div>
        </div>
      </div>
    </div>

    <!-- Error display -->
    <p v-if="store.error && !store.loading" class="text-red-400 text-sm text-center">
      {{ store.error }}
    </p>
  </div>
</template>
