<script setup lang="ts">
/** Único componente que pinta IPs: respeta el interruptor «ocultar IPs» y las IPs que oculta el servidor. */
import { useSession } from '@/stores/session'

withDefaults(defineProps<{ ip: string | null | undefined; hiddenByServer?: boolean }>(), { hiddenByServer: false })
const session = useSession()
</script>

<template>
  <span v-if="!ip" class="faint" :title="hiddenByServer ? 'Tu rol no puede ver IPs' : undefined">
    {{ hiddenByServer ? 'oculta' : '—' }}
  </span>
  <span v-else-if="session.hideIps" class="ip-oculta" title="IP oculta: puedes mostrarla desde la barra superior">
    <span aria-hidden="true">•••.•••.•••</span><span class="sr-only">IP oculta</span>
  </span>
  <span v-else class="mono ip">{{ ip }}</span>
</template>

<style scoped>
.ip { color: var(--ink-2); font-size: 11.5px; }
.ip-oculta { color: var(--ink-3); font-family: var(--mono); font-size: 11px; letter-spacing: .05em; }
</style>
