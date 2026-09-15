<script setup lang="ts">
import { onBeforeUnmount, onMounted, ref, useTemplateRef } from 'vue'
// 128 y no 64: se recorta y amplía (ver .marca-icono); la landing ya la descarga para la llamada final
import logo from '@shared/img/furrguard-128.webp'
import IconMenu from '~icons/lucide/menu'
import IconX from '~icons/lucide/x'
import IconDiscord from '~icons/pixelarticons/discord'
import { DISCORD_URL, NAV, PANEL_URL } from './content'

const open = ref(false)
const toggleButton = useTemplateRef<HTMLButtonElement>('toggle')
const desktop = window.matchMedia('(min-width: 861px)')

function close(returnFocus = false): void {
  if (!open.value) return
  open.value = false
  if (returnFocus) toggleButton.value?.focus()
}

function onKeydown(event: KeyboardEvent): void {
  if (event.key === 'Escape') close(true)
}

function onViewportChange(): void {
  if (desktop.matches) close()
}

onMounted(() => {
  document.addEventListener('keydown', onKeydown)
  desktop.addEventListener('change', onViewportChange)
})

onBeforeUnmount(() => {
  document.removeEventListener('keydown', onKeydown)
  desktop.removeEventListener('change', onViewportChange)
})
</script>

<template>
  <header class="cabecera">
    <div class="wrap cabecera-fila">
      <a href="#inicio" class="marca" aria-label="FurrGuard, ir al inicio" @click="close()">
        <span class="marca-icono"><img :src="logo" width="32" height="32" alt="" class="pixel"></span>
        <span class="marca-nombre">FurrGuard</span>
        <span class="chip tenue marca-chip">by SrTeb</span>
      </a>

      <nav class="nav" aria-label="Secciones">
        <a v-for="link in NAV" :key="link.id" :href="`#${link.id}`" class="nav-enlace">{{ link.label }}</a>
      </nav>

      <div class="cabecera-acciones">
        <a :href="PANEL_URL" class="btn ghost">Panel</a>
        <a :href="DISCORD_URL" class="btn primary" target="_blank" rel="noopener noreferrer">
          <IconDiscord class="icono" aria-hidden="true" /> Discord
        </a>
      </div>

      <button
        ref="toggle"
        type="button"
        class="hamburguesa"
        aria-controls="menu-movil"
        :aria-expanded="open"
        :aria-label="open ? 'Cerrar menú' : 'Abrir menú'"
        @click="open = !open"
      >
        <IconX v-if="open" class="glifo" aria-hidden="true" />
        <IconMenu v-else class="glifo" aria-hidden="true" />
      </button>
    </div>

    <nav id="menu-movil" class="menu-movil" aria-label="Menú" :hidden="!open">
      <div class="wrap menu-movil-lista">
        <a v-for="link in NAV" :key="link.id" :href="`#${link.id}`" class="menu-movil-enlace" @click="close()">
          {{ link.label }}
        </a>
        <div class="menu-movil-acciones">
          <a :href="PANEL_URL" class="btn lg">Entrar al panel</a>
          <a :href="DISCORD_URL" class="btn primary lg" target="_blank" rel="noopener noreferrer" @click="close()">
            <IconDiscord class="icono" aria-hidden="true" /> Únete al Discord
          </a>
        </div>
      </div>
    </nav>
  </header>
</template>
