<script setup lang="ts">
import IconX from '~icons/lucide/x'
import IconAlert from '~icons/pixelarticons/alert'
import IconCheck from '~icons/pixelarticons/check'
import IconInfoBox from '~icons/pixelarticons/info-box'
import IconWarningBox from '~icons/pixelarticons/warning-box'
import { dismissToast, toasts, type ToastTone } from '@/lib/toast'

const ICONS = { ok: IconCheck, error: IconWarningBox, info: IconInfoBox, warn: IconAlert } satisfies Record<ToastTone, unknown>
</script>

<template>
  <div class="toasts" aria-live="polite">
    <div v-for="item in toasts" :key="item.id" class="toast" :class="item.tone" :role="item.tone === 'error' ? 'alert' : 'status'">
      <component :is="ICONS[item.tone]" class="toast-icono" aria-hidden="true" />
      <span>{{ item.message }}</span>
      <button type="button" class="btn ghost icono sm" aria-label="Cerrar aviso" @click="dismissToast(item.id)">
        <IconX aria-hidden="true" />
      </button>
    </div>
  </div>
</template>

<style scoped>
.toast .toast-icono { color: var(--accent); }
.toast.ok .toast-icono { color: var(--ok); }
.toast.error .toast-icono { color: var(--down); }
.toast.warn .toast-icono { color: var(--warn); }
</style>
