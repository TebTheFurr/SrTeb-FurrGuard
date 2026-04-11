<script setup lang="ts">
import { computed } from 'vue'
import { Search, RefreshCw, LogOut, Shield } from 'lucide-vue-next'
import { useAuthStore } from '@/stores/auth'
import { useUIStore } from '@/stores/ui'

const auth = useAuthStore()
const ui = useUIStore()

const user = computed(() => auth.user)

const avatarUrl = computed(() => {
  if (!user.value?.discord_id || !user.value?.avatar) return null
  return `https://cdn.discordapp.com/avatars/${user.value.discord_id}/${user.value.avatar}.png?size=64`
})

const roleBadgeColor: Record<string, string> = {
  founder: 'bg-purple-500/20 text-purple-400',
  owner: 'bg-magenta-500/20 text-magenta-400',
  manager: 'bg-info/20 text-blue-400',
  sradmin: 'bg-success-dim text-green-400',
  admin: 'bg-warning-dim text-amber-400',
}

function handleRefresh() {
  // Reload current route data by emitting a custom event
  window.dispatchEvent(new CustomEvent('furrguard:refresh'))
}

function handleLogout() {
  auth.logout()
}
</script>

<template>
  <header class="h-16 glass-sidebar flex items-center justify-between px-6 border-b border-glass-border-subtle z-20">
    <!-- Left: Global Search -->
    <div class="flex items-center gap-3 flex-1 max-w-md">
      <div class="relative w-full">
        <Search :size="16" class="absolute left-3 top-1/2 -translate-y-1/2 text-text-muted" />
        <input
          type="text"
          placeholder="Buscar jugadores, IPs, UUIDs..."
          class="w-full bg-dark-700 border border-glass-border-subtle rounded-lg pl-9 pr-4 py-2 text-sm text-text-primary placeholder-text-muted focus:outline-none focus:border-purple-500/50 transition-colors"
        />
      </div>
    </div>

    <!-- Right: Actions + User -->
    <div class="flex items-center gap-4">
      <!-- Refresh -->
      <button
        class="p-2 rounded-lg text-text-muted hover:text-text-secondary hover:bg-hover transition-colors"
        title="Recargar datos"
        @click="handleRefresh"
      >
        <RefreshCw :size="18" />
      </button>

      <!-- User info -->
      <div class="flex items-center gap-3 pl-4 border-l border-glass-border-subtle">
        <!-- Avatar -->
        <div v-if="avatarUrl" class="w-8 h-8 rounded-full overflow-hidden ring-2 ring-purple-500/30">
          <img :src="avatarUrl" alt="Avatar" class="w-full h-full object-cover" />
        </div>
        <div v-else class="w-8 h-8 rounded-full bg-dark-600 flex items-center justify-center">
          <Shield :size="16" class="text-purple-400" />
        </div>

        <!-- Name + Role -->
        <div class="hidden sm:block">
          <div class="text-sm font-medium text-text-primary leading-tight">
            {{ user?.username ?? 'Admin' }}
          </div>
          <span
            v-if="user?.role"
            class="inline-block text-[10px] font-semibold uppercase tracking-wider px-1.5 py-0.5 rounded"
            :class="roleBadgeColor[user.role] ?? 'bg-dark-600 text-text-muted'"
          >
            {{ user.role }}
          </span>
        </div>

        <!-- Logout -->
        <button
          class="p-2 rounded-lg text-text-muted hover:text-error hover:bg-error-dim transition-colors ml-1"
          title="Cerrar sesion"
          @click="handleLogout"
        >
          <LogOut :size="18" />
        </button>
      </div>
    </div>
  </header>
</template>
