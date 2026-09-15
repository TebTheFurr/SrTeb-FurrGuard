<script setup lang="ts">
import IconCopy from '~icons/lucide/copy'
import { copyText } from '@/lib/format'
import { toast } from '@/lib/toast'

const props = withDefaults(defineProps<{ value: string; label?: string }>(), { label: 'valor' })

async function copy(): Promise<void> {
  if (await copyText(props.value)) toast('Copiado al portapapeles.', 'ok')
  else toast('No se pudo copiar: selecciónalo y cópialo a mano.', 'error')
}
</script>

<template>
  <div class="copiable">
    <span>{{ value }}</span>
    <button type="button" class="btn ghost icono sm" :aria-label="`Copiar ${label}`" @click="copy">
      <IconCopy aria-hidden="true" />
    </button>
  </div>
</template>
