<script setup lang="ts">
import IconAlert from '~icons/pixelarticons/alert'
import IconCircleQuestion from '~icons/pixelarticons/circle-question'
import { pendingConfirm, settleConfirm } from '@/lib/confirm'
import AppDialog from './AppDialog.vue'
</script>

<template>
  <AppDialog
    :open="pendingConfirm !== null"
    :title="pendingConfirm?.title ?? ''"
    :icon="pendingConfirm?.icon ?? (pendingConfirm?.danger ? IconAlert : IconCircleQuestion)"
    :danger="pendingConfirm?.danger"
    @close="settleConfirm(false)"
  >
    <div class="modal-cuerpo">
      <p class="muted">{{ pendingConfirm?.message }}</p>
    </div>
    <footer class="modal-pie">
      <!-- en acciones peligrosas el foco empieza en Cancelar: un Enter despistado no borra nada -->
      <button type="button" class="btn ghost" :autofocus="pendingConfirm?.danger" @click="settleConfirm(false)">Cancelar</button>
      <button
        type="button"
        class="btn"
        :class="pendingConfirm?.danger ? 'danger' : 'primary'"
        :autofocus="!pendingConfirm?.danger"
        @click="settleConfirm(true)"
      >
        {{ pendingConfirm?.confirmText ?? 'Confirmar' }}
      </button>
    </footer>
  </AppDialog>
</template>
