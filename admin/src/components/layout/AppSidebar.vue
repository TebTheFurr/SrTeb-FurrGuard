<script setup lang="ts">
import { computed, ref } from 'vue'
import { useRouter } from 'vue-router'
import {
  LayoutDashboard,
  Users,
  Link,
  Globe,
  ShieldCheck,
  ShieldOff,
  Gavel,
  ShieldAlert,
  MapPin,
  Globe2,
  Key,
  Lock,
  MessageSquare,
  FileText,
  Settings,
  UserCog,
  ChevronLeft,
  ChevronRight,
  ChevronDown,
} from 'lucide-vue-next'
import { SIDEBAR_SECTIONS } from '@/lib/constants'
import { usePermissions } from '@/composables/usePermissions'
import { useUIStore } from '@/stores/ui'
import type { BadgeCounts } from '@/types'

const router = useRouter()
const ui = useUIStore()
const { can } = usePermissions()

const collapsed = computed(() => ui.sidebarCollapsed)

// Track which categories are expanded
const expandedCategories = ref<Record<string, boolean>>({
  Gestion: true,
  Seguridad: true,
  Geolocalizacion: false,
  Modulos: false,
  Sistema: false,
})

function toggleCategory(category: string) {
  expandedCategories.value = {
    ...expandedCategories.value,
    [category]: !expandedCategories.value[category],
  }
}

// Map icon names to components
const iconMap: Record<string, ReturnType<typeof LayoutDashboard>> = {
  LayoutDashboard,
  Users,
  Link,
  Globe,
  ShieldCheck,
  ShieldOff,
  Gavel,
  ShieldAlert,
  MapPin,
  Globe2,
  Key,
  Lock,
  MessageSquare,
  FileText,
  Settings,
  UserCog,
}

// Route name mapping (sidebar id -> route name)
const routeMap: Record<string, string> = {
  overview: 'dashboard',
  players: 'players',
  connections: 'connections',
  ips: 'ips',
  whitelist: 'whitelist',
  blacklist: 'blacklist',
  sanctions: 'sanctions',
  providers: 'providers',
  countries: 'countries',
  continents: 'continents',
  furrperms: 'furrperms',
  furrsecurity: 'furrsecurity',
  messages: 'messages',
  logs: 'logs',
  settings: 'settings',
  users: 'users',
}

// Badge section ids
const badgeSections = new Set(['players', 'whitelist', 'blacklist'])

// Props for badge counts (passed from parent via provide/inject or props)
const props = defineProps<{
  badgeCounts?: BadgeCounts
}>()

function isActive(id: string): boolean {
  const routeName = routeMap[id]
  return router.currentRoute.value.name === routeName
}

function navigate(id: string) {
  const routeName = routeMap[id]
  if (routeName) {
    router.push({ name: routeName })
  }
}

function getBadgeCount(id: string): number | null {
  if (!props.badgeCounts) return null
  const counts: Record<string, number> = {
    players: props.badgeCounts.players,
    whitelist: props.badgeCounts.whitelist,
    blacklist: props.badgeCounts.blacklist,
  }
  return counts[id] ?? null
}

// Check if a section (or any item in a category) is visible
function isItemVisible(id: string): boolean {
  return can(id)
}

function hasVisibleItems(items: ReadonlyArray<{ id: string; label: string; icon: string }>): boolean {
  return items.some((item) => isItemVisible(item.id))
}
</script>

<template>
  <aside
    class="glass-sidebar flex flex-col h-screen sticky top-0 z-30 transition-all duration-300"
    :class="collapsed ? 'w-[var(--spacing-sidebar-collapsed)]' : 'w-[var(--spacing-sidebar)]'"
  >
    <!-- Logo / Brand -->
    <div class="flex items-center gap-3 px-4 h-16 border-b border-glass-border-subtle">
      <div class="w-8 h-8 rounded-lg gradient-primary flex items-center justify-center shrink-0">
        <ShieldCheck :size="18" class="text-white" />
      </div>
      <transition name="fade">
        <span v-if="!collapsed" class="font-display font-bold text-lg gradient-text whitespace-nowrap">
          FurrGuard
        </span>
      </transition>
    </div>

    <!-- Navigation -->
    <nav class="flex-1 overflow-y-auto py-4 px-2 space-y-1">
      <template v-for="section in SIDEBAR_SECTIONS" :key="'category' in section ? section.category : section.id">
        <!-- Standalone item (Dashboard) -->
        <button
          v-if="!('category' in section)"
          class="sidebar-item w-full flex items-center gap-3 px-3 py-2.5 rounded-lg transition-all duration-200 text-sm font-medium"
          :class="[
            isActive(section.id)
              ? 'bg-active text-purple-400'
              : 'text-text-secondary hover:bg-hover hover:text-text-primary',
            collapsed ? 'justify-center' : '',
          ]"
          :title="collapsed ? section.label : undefined"
          @click="navigate(section.id)"
        >
          <component
            :is="iconMap[section.icon]"
            :size="20"
            class="shrink-0"
          />
          <transition name="fade">
            <span v-if="!collapsed">{{ section.label }}</span>
          </transition>
        </button>

        <!-- Category group -->
        <template v-else>
          <template v-if="hasVisibleItems(section.items)">
            <!-- Category header -->
            <button
              v-if="!collapsed"
              class="w-full flex items-center justify-between px-3 py-2 text-xs font-semibold uppercase tracking-wider text-text-muted hover:text-text-secondary transition-colors"
              @click="toggleCategory(section.category)"
            >
              <span>{{ section.category }}</span>
              <ChevronDown
                :size="14"
                class="transition-transform duration-200"
                :class="expandedCategories[section.category] ? 'rotate-180' : ''"
              />
            </button>

            <!-- Collapsed: just a divider -->
            <div v-else class="my-2 mx-3 h-px bg-glass-border-subtle"></div>

            <!-- Category items -->
            <div v-show="collapsed || expandedCategories[section.category]" class="space-y-0.5">
              <button
                v-for="item in section.items"
                :key="item.id"
                v-show="isItemVisible(item.id)"
                class="sidebar-item w-full flex items-center gap-3 px-3 py-2 rounded-lg transition-all duration-200 text-sm"
                :class="[
                  isActive(item.id)
                    ? 'bg-active text-purple-400 font-medium'
                    : 'text-text-secondary hover:bg-hover hover:text-text-primary',
                  collapsed ? 'justify-center' : '',
                ]"
                :title="collapsed ? item.label : undefined"
                @click="navigate(item.id)"
              >
                <component
                  :is="iconMap[item.icon]"
                  :size="18"
                  class="shrink-0"
                />
                <transition name="fade">
                  <span v-if="!collapsed" class="truncate">{{ item.label }}</span>
                </transition>
                <!-- Badge count -->
                <span
                  v-if="!collapsed && badgeSections.has(item.id) && getBadgeCount(item.id) !== null"
                  class="ml-auto text-xs bg-purple-500/20 text-purple-400 px-2 py-0.5 rounded-full"
                >
                  {{ getBadgeCount(item.id) }}
                </span>
              </button>
            </div>
          </template>
        </template>
      </template>
    </nav>

    <!-- Collapse toggle -->
    <div class="border-t border-glass-border-subtle p-2">
      <button
        class="w-full flex items-center justify-center gap-2 px-3 py-2 rounded-lg text-text-muted hover:text-text-secondary hover:bg-hover transition-colors text-sm"
        @click="ui.toggleSidebar()"
      >
        <component :is="collapsed ? ChevronRight : ChevronLeft" :size="18" />
        <transition name="fade">
          <span v-if="!collapsed">Colapsar</span>
        </transition>
      </button>
    </div>
  </aside>
</template>

<style scoped>
.sidebar-item {
  position: relative;
}

.sidebar-item.router-link-active::before {
  content: '';
  position: absolute;
  left: 0;
  top: 50%;
  transform: translateY(-50%);
  width: 3px;
  height: 60%;
  background: linear-gradient(180deg, var(--color-purple-500), var(--color-magenta-500));
  border-radius: 0 2px 2px 0;
}

.fade-enter-active,
.fade-leave-active {
  transition: opacity 0.2s ease;
}

.fade-enter-from,
.fade-leave-to {
  opacity: 0;
}
</style>
