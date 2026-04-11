<script setup lang="ts">
const version = __APP_VERSION__
</script>

<template>
  <footer class="h-10 flex items-center justify-center border-t border-glass-border-subtle text-xs text-text-muted">
    <span>
      FurrGuard Admin
      <span class="mx-1 text-text-tertiary">|</span>
      v{{ version }}
      <span class="mx-1 text-text-tertiary">|</span>
      <span class="text-text-tertiary">&copy; SrTeb</span>
    </span>
  </footer>
</template>
