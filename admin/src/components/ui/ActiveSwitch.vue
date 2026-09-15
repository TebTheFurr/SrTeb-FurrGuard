<script setup lang="ts">
/**
 * Interruptor pesimista: no cambia hasta que el servidor confirma y la lista se recarga.
 * Si la petición falla, el interruptor sigue mostrando el estado real.
 */
const props = withDefaults(defineProps<{ active: boolean; label: string; busy?: boolean; disabled?: boolean }>(), {
  busy: false,
  disabled: false,
})
const emit = defineEmits<{ change: [active: boolean] }>()

function onChange(event: Event): void {
  const input = event.target as HTMLInputElement
  const next = input.checked
  input.checked = props.active
  emit('change', next)
}
</script>

<template>
  <input
    type="checkbox"
    role="switch"
    class="interruptor"
    :checked="active"
    :aria-checked="active"
    :aria-label="label"
    :aria-busy="busy"
    :disabled="busy || disabled"
    @change="onChange"
  >
</template>
