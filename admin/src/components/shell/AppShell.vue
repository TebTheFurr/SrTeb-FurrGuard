<script setup lang="ts">
import FgFooter from '@shared/ui/components/FgFooter.vue'
import { nextTick, onBeforeUnmount, onMounted, ref, watch } from 'vue'
import { useRoute } from 'vue-router'
import { detailCrumb } from '@/lib/crumb'
import { useSession } from '@/stores/session'
import SideNav from './SideNav.vue'
import TopBar from './TopBar.vue'

const HEALTH_REFRESH_MS = 120_000

const session = useSession()
const route = useRoute()
const menuOpen = ref(false)
const main = ref<HTMLElement | null>(null)
let healthTimer: ReturnType<typeof setInterval> | undefined

watch(
  () => route.path,
  () => {
    menuOpen.value = false
    detailCrumb.value = null
    // Al cambiar de página el foco va al contenido, como en una navegación completa
    void nextTick(() => main.value?.focus({ preventScroll: true }))
  },
)

// Cajón (≤ 960 px): va antes que el botón en el DOM, así que al abrirlo el foco entra en él y al
// cerrarlo sin navegar vuelve al botón (navegando, el watch de la ruta lo lleva al contenido)
watch(menuOpen, (open) => {
  if (open) void nextTick(() => document.querySelector<HTMLElement>('#lado a')?.focus())
})

function closeMenu(): void {
  menuOpen.value = false
  document.querySelector<HTMLElement>('[aria-controls="lado"]')?.focus()
}

function onKeydown(event: KeyboardEvent): void {
  if (event.key === 'Escape' && menuOpen.value) closeMenu()
}

onMounted(() => {
  // En Resumen la propia vista ya pide get_overview y actualiza la línea de pulso
  if (route.name !== 'overview') void session.refreshHealth()
  healthTimer = setInterval(() => {
    if (document.visibilityState === 'visible') void session.refreshHealth()
  }, HEALTH_REFRESH_MS)
  document.addEventListener('keydown', onKeydown)
})

onBeforeUnmount(() => {
  clearInterval(healthTimer)
  document.removeEventListener('keydown', onKeydown)
})
</script>

<template>
  <div class="shell" :class="{ 'menu-abierto': menuOpen }" :data-estado="session.tone ?? undefined">
    <a class="saltar" href="#contenido">Saltar al contenido</a>
    <SideNav id="lado" />
    <button v-if="menuOpen" type="button" class="velo-menu" aria-label="Cerrar menú" @click="closeMenu" />
    <div class="principal">
      <TopBar :menu-open="menuOpen" @toggle-menu="menuOpen = !menuOpen" />
      <main id="contenido" ref="main" class="contenido" tabindex="-1">
        <RouterView v-slot="{ Component, route: current }">
          <component :is="Component" :key="current.path" />
        </RouterView>
        <FgFooter />
      </main>
    </div>
  </div>
</template>
