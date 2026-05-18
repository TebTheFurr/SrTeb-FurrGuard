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
  <div class="flex h-screen bg-dark-950 overflow-hidden">
    <!-- Background gradient effects (enhanced) -->
    <div class="bg-effects">
      <div class="bg-shape-1"></div>
      <div class="bg-shape-2"></div>
      <div class="bg-shape-3"></div>
      <div class="bg-shape-4"></div>
      <div class="bg-shape-5"></div>
    </div>

    <!-- Noise texture overlay for premium feel -->
    <div class="noise-overlay"></div>

    <!-- Mobile sidebar backdrop overlay -->
    <Transition
      enter-active-class="transition-all duration-300"
      leave-active-class="transition-all duration-300"
      enter-from-class="opacity-0"
      enter-to-class="opacity-100"
      leave-from-class="opacity-100"
      leave-to-class="opacity-0"
    >
      <div
        v-if="ui.mobileMenuOpen"
        class="fixed inset-0 bg-black/70 backdrop-blur-md z-40 md:hidden"
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
      <main class="flex-1 overflow-y-auto flex flex-col">
        <div class="page-container flex-1">
          <RouterView />
        </div>
        <AppFooter />
      </main>
    </div>
  </div>
</template>
