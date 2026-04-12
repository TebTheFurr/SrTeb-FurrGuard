<script setup lang="ts">
import { RouterView } from 'vue-router'
import AppSidebar from './AppSidebar.vue'
import AppHeader from './AppHeader.vue'
import AppFooter from './AppFooter.vue'
import { useUIStore } from '@/stores/ui'

const ui = useUIStore()

function handleBackdropClick() {
  ui.closeMobileMenu()
}
</script>

<template>
  <div class="flex min-h-screen bg-dark-900">
    <!-- Background gradient effects -->
    <div class="bg-effects">
      <div class="bg-shape-1"></div>
      <div class="bg-shape-2"></div>
      <div class="bg-shape-3"></div>
    </div>

    <!-- Mobile sidebar backdrop overlay -->
    <Transition
      enter-active-class="transition-opacity duration-300"
      leave-active-class="transition-opacity duration-300"
      enter-from-class="opacity-0"
      enter-to-class="opacity-100"
      leave-from-class="opacity-100"
      leave-to-class="opacity-0"
    >
      <div
        v-if="ui.mobileMenuOpen"
        class="fixed inset-0 bg-black/60 backdrop-blur-sm z-40 md:hidden"
        @click="handleBackdropClick"
      />
    </Transition>

    <!-- Sidebar: fixed overlay on mobile, static on desktop -->
    <AppSidebar />

    <!-- Main content area -->
    <div
      class="flex flex-col flex-1 min-w-0 transition-all duration-300 relative z-10"
    >
      <AppHeader />

      <!-- Page content (scrollable) -->
      <main class="flex-1 overflow-y-auto p-4 md:p-6">
        <RouterView />
      </main>

      <AppFooter />
    </div>
  </div>
</template>
