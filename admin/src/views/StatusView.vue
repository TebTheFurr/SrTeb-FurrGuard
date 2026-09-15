<script setup lang="ts">
import { computed } from 'vue'
import IconDownasaur from '~icons/pixelarticons/downasaur'
import IconLock from '~icons/pixelarticons/lock'
import { firstSection } from '@/lib/permissions'
import { useSession } from '@/stores/session'
import EmptyState from '@/components/ui/EmptyState.vue'

const props = defineProps<{ kind: 'forbidden' | 'notfound' }>()
const session = useSession()
const home = computed(() => firstSection(session.permissions))
const copy = computed(() => props.kind === 'forbidden'
  ? { icon: IconLock, title: 'Tu rol no tiene acceso a esta sección', text: 'Si lo necesitas, pídeselo a un founder.' }
  : { icon: IconDownasaur, title: 'Aquí no hay nada', text: 'La dirección no corresponde a ninguna sección del panel.' })
</script>

<template>
  <EmptyState :icon="copy.icon" :title="copy.title" :text="copy.text">
    <RouterLink v-if="home" class="btn primary" :to="{ name: home }">Ir al panel</RouterLink>
  </EmptyState>
</template>
