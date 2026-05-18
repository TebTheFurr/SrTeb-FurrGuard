<script setup lang="ts">
import { computed, ref } from 'vue'
import { useRouter } from 'vue-router'
import { Search, RefreshCw, LogOut, Shield, Menu, X, Eye, EyeOff } from 'lucide-vue-next'
import { useAuthStore } from '@/stores/auth'
import { useUIStore } from '@/stores/ui'

const router = useRouter()
const auth = useAuthStore()
const ui = useUIStore()
const globalSearch = ref('')
const searchFocused = ref(false)
const mobileSearchOpen = ref(false)

const user = computed(() => auth.user)

const avatarUrl = computed(() => {
  if (!user.value?.discord_id || !user.value?.avatar) return null
  return `https://cdn.discordapp.com/avatars/${user.value.discord_id}/${user.value.avatar}.png?size=64`
})

const roleBadgeColor: Record<string, string> = {
  founder: 'bg-purple-500/20 text-purple-400 border-purple-500/20',
  owner: 'bg-magenta-500/20 text-magenta-400 border-magenta-500/20',
  manager: 'bg-info/20 text-blue-400 border-blue-500/20',
  sradmin: 'bg-success-dim text-green-400 border-green-500/20',
  admin: 'bg-warning-dim text-amber-400 border-amber-500/20',
}

const isRefreshing = ref(false)

function handleRefresh() {
  isRefreshing.value = true
  location.reload()
}

function handleLogout() {
  auth.logout()
}

function toggleMobileMenu() {
  ui.toggleMobileMenu()
}

function handleGlobalSearch() {
  const q = globalSearch.value.trim()
  if (!q) return
  router.push({ name: 'players', query: { search: q } })
  globalSearch.value = ''
  mobileSearchOpen.value = false
}

function toggleMobileSearch() {
  mobileSearchOpen.value = !mobileSearchOpen.value
}
</script>

<template>
  <!-- Mobile search overlay -->
  <Transition
    enter-active-class="transition-all duration-300"
    leave-active-class="transition-all duration-200"
    enter-from-class="opacity-0 -translate-y-full"
    enter-to-class="opacity-100 translate-y-0"
    leave-from-class="opacity-100 translate-y-0"
    leave-to-class="opacity-0 -translate-y-full"
  >
    <div
      v-if="mobileSearchOpen"
      class="fixed inset-0 z-[60] bg-dark-950/95 backdrop-blur-xl flex items-start pt-4 px-4 sm:hidden"
    >
      <div class="w-full relative">
        <Search :size="18" class="absolute left-4 top-1/2 -translate-y-1/2 text-purple-400" />
        <input
          ref="mobileSearchInput"
          v-model="globalSearch"
          type="text"
          placeholder="Buscar jugadores, IPs, UUIDs..."
          class="w-full bg-dark-800 border border-glass-border rounded-xl pl-12 pr-12 py-3.5 text-base text-text-primary placeholder-text-muted focus:outline-none focus:border-purple-500/50 transition-all"
          autofocus
          @keydown.enter="handleGlobalSearch"
        />
        <button
          class="absolute right-3 top-1/2 -translate-y-1/2 p-1.5 rounded-lg text-text-muted hover:text-text-primary hover:bg-dark-600 transition-colors"
          @click="mobileSearchOpen = false"
        >
          <X :size="18" />
        </button>
      </div>
    </div>
  </Transition>

  <header class="h-16 flex items-center justify-between px-4 md:px-6 border-b border-glass-border-subtle z-20 relative"
    style="background: linear-gradient(180deg, rgba(14, 14, 22, 0.9) 0%, rgba(10, 10, 16, 0.85) 100%); backdrop-filter: blur(16px); -webkit-backdrop-filter: blur(16px);"
  >
    <!-- Left: Hamburger (mobile) + Global Search -->
    <div class="flex items-center gap-3 flex-1 min-w-0">
      <!-- Hamburger menu button (mobile only) -->
      <button
        class="md:hidden p-2 rounded-lg text-text-muted hover:text-text-secondary hover:bg-hover transition-all duration-200 shrink-0 active:scale-95"
        title="Menu"
        @click="toggleMobileMenu"
      >
        <Menu :size="20" />
      </button>

      <!-- Mobile search trigger -->
      <button
        class="sm:hidden p-2 rounded-lg text-text-muted hover:text-text-secondary hover:bg-hover transition-all duration-200 shrink-0 active:scale-95"
        @click="toggleMobileSearch"
      >
        <Search :size="20" />
      </button>

      <!-- Search bar: visible on md+ -->
      <div class="relative w-full hidden sm:block max-w-md">
        <Search
          :size="16"
          class="absolute left-3 top-1/2 -translate-y-1/2 transition-colors duration-200"
          :class="searchFocused ? 'text-purple-400' : 'text-text-muted'"
        />
        <input
          v-model="globalSearch"
          type="text"
          placeholder="Buscar jugadores, IPs, UUIDs..."
          class="w-full glass-input pl-9 pr-4 py-2 text-sm text-text-primary placeholder-text-muted focus:outline-none focus:border-purple-500/40 focus:shadow-[0_0_0_1px_rgba(139,92,246,0.2)]"
          @focus="searchFocused = true"
          @blur="searchFocused = false"
          @keydown.enter="handleGlobalSearch"
        />
      </div>
    </div>

    <!-- Right: Actions + User -->
    <div class="flex items-center gap-2 md:gap-3 shrink-0">
      <!-- Refresh -->
      <button
        class="p-2 rounded-lg text-text-muted hover:text-text-secondary hover:bg-hover transition-all duration-200 active:scale-95"
        :class="isRefreshing ? 'animate-spin' : ''"
        title="Recargar datos"
        @click="handleRefresh"
      >
        <RefreshCw :size="18" />
      </button>

      <!-- Toggle IPs visibility -->
      <button
        class="p-2 rounded-lg transition-all duration-200 active:scale-95"
        :class="ui.ipsRevealed ? 'text-purple-400 bg-purple-500/15 hover:bg-purple-500/25' : 'text-text-muted hover:text-text-secondary hover:bg-hover'"
        :title="ui.ipsRevealed ? 'Ocultar IPs' : 'Mostrar IPs'"
        @click="ui.toggleIpsRevealed()"
      >
        <Eye v-if="ui.ipsRevealed" :size="18" />
        <EyeOff v-else :size="18" />
      </button>

      <!-- User info -->
      <div class="flex items-center gap-2 md:gap-3 pl-2 md:pl-3 border-l border-glass-border-subtle">
        <!-- Avatar with animated ring -->
        <div v-if="avatarUrl" class="w-9 h-9 rounded-full overflow-hidden ring-2 ring-purple-500/25 hover:ring-purple-500/50 transition-all duration-300">
          <img :src="avatarUrl" alt="Avatar" class="w-full h-full object-cover" />
        </div>
        <div v-else class="w-9 h-9 rounded-full bg-dark-600 flex items-center justify-center ring-2 ring-purple-500/15">
          <Shield :size="16" class="text-purple-400" />
        </div>

        <!-- Name + ID + Role (hidden on mobile) -->
        <div class="hidden lg:block">
          <div class="text-sm font-medium text-text-primary leading-tight font-mono">
            {{ user?.discord_id ?? '' }}
            <span v-if="user?.username" class="text-text-secondary font-sans">({{ user.username }})</span>
          </div>
          <span
            v-if="user?.role"
            class="inline-block text-[10px] font-semibold uppercase tracking-wider px-1.5 py-0.5 rounded border"
            :class="roleBadgeColor[user.role] ?? 'bg-dark-600 text-text-muted border-glass-border-subtle'"
          >
            {{ user.role }}
          </span>
        </div>

        <!-- Logout -->
        <button
          class="p-2 rounded-lg text-text-muted hover:text-error hover:bg-error-dim transition-all duration-200 active:scale-95"
          title="Cerrar sesion"
          @click="handleLogout"
        >
          <LogOut :size="18" />
        </button>
      </div>
    </div>
  </header>
</template>
