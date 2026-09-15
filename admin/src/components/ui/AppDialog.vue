<script setup lang="ts">
/**
 * Diálogo con <dialog> nativo y showModal(): foco atrapado y Escape los da el navegador.
 * Al cerrar devuelve el foco a quien lo abrió. El contenido solo existe mientras está abierto,
 * así cada apertura empieza con estado limpio.
 */
import { onBeforeUnmount, onMounted, ref, useId, watch, type Component } from 'vue'
import IconX from '~icons/lucide/x'

const props = withDefaults(
  defineProps<{ open: boolean; title: string; sub?: string; icon?: Component; wide?: boolean; danger?: boolean }>(),
  { sub: '', icon: undefined, wide: false, danger: false },
)
const emit = defineEmits<{ close: [] }>()

const dialog = ref<HTMLDialogElement | null>(null)
const titleId = useId()
let opener: HTMLElement | null = null
let pressedOnBackdrop = false

function restoreFocus(): void {
  if (opener?.isConnected) opener.focus()
  opener = null
}

function sync(open: boolean): void {
  const el = dialog.value
  if (!el) return
  if (open && !el.open) {
    opener = document.activeElement instanceof HTMLElement ? document.activeElement : null
    el.showModal()
  } else if (!open && el.open) {
    el.close()
    restoreFocus()
  }
}

watch(() => props.open, sync, { flush: 'post' })
onMounted(() => sync(props.open))

/** Chrome puede cerrar el diálogo sin evento cancel tras varios Escape: el padre debe enterarse. */
function onNativeClose(): void {
  if (props.open) {
    restoreFocus()
    emit('close')
  }
}

function onPointerDown(event: MouseEvent): void {
  pressedOnBackdrop = event.target === dialog.value
}

function onClick(event: MouseEvent): void {
  if (pressedOnBackdrop && event.target === dialog.value) emit('close')
  pressedOnBackdrop = false
}

onBeforeUnmount(() => {
  if (dialog.value?.open) {
    dialog.value.close()
    restoreFocus()
  }
})
</script>

<template>
  <dialog
    ref="dialog"
    class="modal"
    :class="{ ancho: wide, peligro: danger }"
    :aria-labelledby="titleId"
    @cancel.prevent="emit('close')"
    @close="onNativeClose"
    @mousedown="onPointerDown"
    @click="onClick"
  >
    <div v-if="open" class="modal-caja">
      <header class="modal-cab">
        <div>
          <h2 :id="titleId">
            <component :is="icon" v-if="icon" aria-hidden="true" />
            {{ title }}
          </h2>
          <p v-if="sub" class="sub">{{ sub }}</p>
        </div>
        <button type="button" class="btn ghost icono sm cerrar" aria-label="Cerrar" @click="emit('close')">
          <IconX aria-hidden="true" />
        </button>
      </header>
      <slot />
    </div>
  </dialog>
</template>
