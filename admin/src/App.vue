<script setup lang="ts">
import { RouterView } from 'vue-router'
</script>

<template>
  <RouterView />
  <div id="toast-container" class="fixed bottom-4 right-4 z-50 flex flex-col gap-2"></div>
</template>
