<script setup lang="ts">
import { computed, nextTick, onBeforeUnmount, ref, watch } from 'vue'
import IconChevronDown from '~icons/lucide/chevron-down'
import IconLogout from '~icons/pixelarticons/logout'
import { api } from '@/api/client'
import { discordAvatar, initials } from '@/lib/format'
import { ROLE_LABELS } from '@/lib/labels'
import { toastError } from '@/lib/toast'
import { useSession } from '@/stores/session'

const session = useSession()
const open = ref(false)
const loggingOut = ref(false)
const avatarFailed = ref(false)
const root = ref<HTMLElement | null>(null)
const trigger = ref<HTMLButtonElement | null>(null)

const avatar = computed(() => (session.user ? discordAvatar(session.user.discord_id, session.user.avatar) : null))

function onOutside(event: MouseEvent): void {
  if (!root.value?.contains(event.target as Node)) open.value = false
}

function onKeydown(event: KeyboardEvent): void {
  if (event.key === 'Escape' && open.value) {
    open.value = false
    trigger.value?.focus()
  }
}

watch(open, (isOpen) => {
  if (isOpen) {
    document.addEventListener('mousedown', onOutside)
    void nextTick(() => root.value?.querySelector<HTMLElement>('[role="menuitem"]')?.focus())
  } else {
    document.removeEventListener('mousedown', onOutside)
  }
})

onBeforeUnmount(() => document.removeEventListener('mousedown', onOutside))

async function logout(): Promise<void> {
  loggingOut.value = true
  try {
    await api('logout')
    window.location.assign(import.meta.env.BASE_URL)
  } catch (error) {
    toastError(error, 'No se pudo cerrar la sesión.')
    loggingOut.value = false
  }
}
</script>

<template>
  <div v-if="session.user" ref="root" class="usuario" @keydown="onKeydown">
    <button
      ref="trigger"
      type="button"
      class="btn ghost usuario-boton"
      aria-haspopup="menu"
      :aria-expanded="open"
      aria-controls="menu-usuario"
      @click="open = !open"
    >
      <span class="avatar sm">
        <img v-if="avatar && !avatarFailed" :src="avatar" alt="" referrerpolicy="no-referrer" @error="avatarFailed = true">
        <template v-else>{{ initials(session.user.username) }}</template>
      </span>
      <span class="usuario-nombre">{{ session.user.username }}</span>
      <IconChevronDown aria-hidden="true" />
    </button>
    <div v-if="open" id="menu-usuario" class="menu" role="menu" aria-label="Cuenta">
      <div class="menu-cab">
        <b>{{ session.user.username }}</b>
        <span class="rango" :class="session.user.role">{{ ROLE_LABELS[session.user.role] }}</span>
        <span class="mono faint">{{ session.user.discord_id }}</span>
      </div>
      <div class="menu-sep" role="separator" />
      <button type="button" role="menuitem" class="menu-item peligro" :disabled="loggingOut" @click="logout">
        <IconLogout aria-hidden="true" /> Cerrar sesión
      </button>
    </div>
  </div>
</template>

<style scoped>
.usuario { position: relative; }
.usuario-boton { gap: 9px; padding: 0 8px 0 5px; }
.usuario-nombre { max-width: 140px; overflow: hidden; text-overflow: ellipsis; }
.menu { right: 0; top: calc(100% + 6px); }
.menu-cab { display: grid; justify-items: start; gap: 5px; padding: 8px 10px 6px; font-size: var(--text-sm); }
.menu-cab .mono { font-size: 10.5px; }
@media (max-width: 700px) {
  .usuario-nombre { display: none; }
}
</style>
