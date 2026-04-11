<script setup lang="ts">
import { RouterView } from 'vue-router'
import AppSidebar from './AppSidebar.vue'
import AppHeader from './AppHeader.vue'
import AppFooter from './AppFooter.vue'
import { useUIStore } from '@/stores/ui'

const ui = useUIStore()
</script>

<template>
  <div class="flex min-h-screen bg-dark-900">
    <!-- Background gradient effects -->
    <div class="bg-effects">
      <div class="bg-shape-1"></div>
      <div class="bg-shape-2"></div>
      <div class="bg-shape-3"></div>
    </div>

    <!-- Sidebar -->
    <AppSidebar />

    <!-- Main content area -->
    <div
      class="flex flex-col flex-1 min-w-0 transition-all duration-300 relative z-10"
    >
      <AppHeader />

      <!-- Page content (scrollable) -->
      <main class="flex-1 overflow-y-auto p-6">
        <RouterView />
      </main>

      <AppFooter />
    </div>
  </div>
</template>
