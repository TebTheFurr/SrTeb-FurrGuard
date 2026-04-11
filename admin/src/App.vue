<script setup lang="ts">
import { RouterView } from 'vue-router'
import ToastNotification from '@/components/shared/ToastNotification.vue'
import { useUIStore } from '@/stores/ui'

const ui = useUIStore()
</script>

<template>
  <RouterView />
  <div id="toast-container" class="fixed bottom-4 right-4 z-50 flex flex-col gap-2">
    <ToastNotification
      v-for="toast in ui.toasts"
      :key="toast.id"
      :toast="toast"
      @close="ui.hideToast(toast.id)"
    />
  </div>
</template>
