<script setup lang="ts">
import { computed, ref } from 'vue'
import { useRoute, useRouter, type RouteLocationRaw } from 'vue-router'
import IconEye from '~icons/lucide/eye'
import IconEyeOff from '~icons/lucide/eye-off'
import IconSearch from '~icons/lucide/search'
import IconMenu from '~icons/pixelarticons/menu'
import { detailCrumb } from '@/lib/crumb'
import { firstSection } from '@/lib/permissions'
import { useSession } from '@/stores/session'
import UserMenu from './UserMenu.vue'

defineProps<{ menuOpen: boolean }>()
const emit = defineEmits<{ 'toggle-menu': [] }>()

const route = useRoute()
const router = useRouter()
const session = useSession()
const term = ref('')

const crumbs = computed(() => {
  const list: { label: string; to?: RouteLocationRaw }[] = []
  const parent = route.meta.parent
  if (parent) list.push({ label: router.resolve({ name: parent }).meta.title, to: { name: parent } })
  list.push({ label: detailCrumb.value ?? route.meta.title })
  return list
})

function search(): void {
  const value = term.value.trim()
  if (!value) return
  // Funciona también estando ya en Jugadores: la lista escucha los cambios de ?search=
  void router.push({ name: 'players', query: { search: value } })
  term.value = ''
}
</script>

<template>
  <header class="barra-sup">
    <button
      type="button"
      class="btn ghost icono hamburguesa"
      aria-controls="lado"
      :aria-expanded="menuOpen"
      aria-label="Menú de secciones"
      @click="emit('toggle-menu')"
    >
      <IconMenu aria-hidden="true" />
    </button>

    <nav class="zona-migas migas" aria-label="Migas de pan">
      <ol>
        <li class="raiz"><RouterLink :to="{ name: firstSection(session.permissions) ?? 'overview' }">FurrGuard</RouterLink></li>
        <li v-for="(crumb, index) in crumbs" :key="index">
          <span class="sep" aria-hidden="true">/</span>
          <RouterLink v-if="crumb.to" :to="crumb.to">{{ crumb.label }}</RouterLink>
          <span v-else class="actual" aria-current="page">{{ crumb.label }}</span>
        </li>
      </ol>
    </nav>

    <div class="zona-acciones">
      <form v-if="session.can('players')" class="busqueda-rapida buscador" role="search" @submit.prevent="search">
        <label for="busqueda-jugador" class="sr-only">Buscar jugador por nick, UUID o IP</label>
        <IconSearch aria-hidden="true" />
        <input
          id="busqueda-jugador"
          v-model="term"
          class="input"
          type="search"
          placeholder="Buscar jugador…"
          autocomplete="off"
          spellcheck="false"
          maxlength="64"
        >
      </form>
      <button
        v-if="session.canSeeIps"
        type="button"
        class="btn ghost icono"
        aria-label="Ocultar IPs"
        :aria-pressed="session.hideIps"
        :title="session.hideIps ? 'IPs ocultas: pulsa para mostrarlas' : 'Ocultar las IPs en todo el panel'"
        @click="session.hideIps = !session.hideIps"
      >
        <IconEyeOff v-if="session.hideIps" aria-hidden="true" />
        <IconEye v-else aria-hidden="true" />
      </button>
      <UserMenu />
    </div>
  </header>
</template>

<style scoped>
.busqueda-rapida { width: 220px; }
.busqueda-rapida .input { height: 34px; }
.btn[aria-pressed="true"] { color: var(--warn); background: var(--warn-bg); }
@media (max-width: 960px) {
  .raiz { display: none; }
  .raiz + li > .sep { display: none; }
}
@media (max-width: 700px) {
  .busqueda-rapida { width: 130px; }
}
@media (max-width: 480px) {
  .zona-migas { display: none !important; }
  .busqueda-rapida { flex: 1; width: auto; }
  .barra-sup .zona-acciones { flex: 1; justify-content: flex-end; }
}
</style>
