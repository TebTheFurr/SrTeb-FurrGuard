import { createRouter, createWebHistory, type RouteRecordRaw } from 'vue-router'
import type { Section } from '@/api/types'
import { firstSection } from '@/lib/permissions'
import type { useSession } from '@/stores/session'

declare module 'vue-router' {
  interface RouteMeta {
    section?: Section
    title: string
    /** Ruta madre en las migas (ficha de jugador → Jugadores). */
    parent?: string
  }
}

const routes: RouteRecordRaw[] = [
  { path: '/', name: 'overview', component: () => import('@/views/OverviewView.vue'), meta: { section: 'overview', title: 'Resumen' } },
  { path: '/jugadores', name: 'players', component: () => import('@/views/players/PlayersView.vue'), meta: { section: 'players', title: 'Jugadores' } },
  {
    path: '/jugadores/:uuid', name: 'player', component: () => import('@/views/players/PlayerDetailView.vue'), props: true,
    meta: { section: 'players', title: 'Ficha de jugador', parent: 'players' },
  },
  { path: '/conexiones', name: 'connections', component: () => import('@/views/ConnectionsView.vue'), meta: { section: 'connections', title: 'Conexiones' } },
  { path: '/ips', name: 'ips', component: () => import('@/views/IPsView.vue'), meta: { section: 'ips', title: 'IPs' } },
  { path: '/whitelist', name: 'whitelist', component: () => import('@/views/WhitelistView.vue'), meta: { section: 'whitelist', title: 'Whitelist' } },
  { path: '/blacklist', name: 'blacklist', component: () => import('@/views/blacklist/BlacklistView.vue'), meta: { section: 'blacklist', title: 'Blacklist' } },
  { path: '/sanciones', name: 'sanctions', component: () => import('@/views/SanctionsView.vue'), meta: { section: 'sanctions', title: 'Sanciones' } },
  { path: '/proveedores', name: 'providers', component: () => import('@/views/ProvidersView.vue'), meta: { section: 'providers', title: 'Proveedores' } },
  {
    path: '/paises', name: 'countries', component: () => import('@/views/GeoBlocksView.vue'), props: { kind: 'country' },
    meta: { section: 'countries', title: 'Países' },
  },
  {
    path: '/continentes', name: 'continents', component: () => import('@/views/GeoBlocksView.vue'), props: { kind: 'continent' },
    meta: { section: 'continents', title: 'Continentes' },
  },
  { path: '/mensajes', name: 'messages', component: () => import('@/views/MessagesView.vue'), meta: { section: 'messages', title: 'Mensajes' } },
  { path: '/registro', name: 'logs', component: () => import('@/views/LogsView.vue'), meta: { section: 'logs', title: 'Registro' } },
  { path: '/ajustes', name: 'settings', component: () => import('@/views/settings/SettingsView.vue'), meta: { section: 'settings', title: 'Ajustes' } },
  { path: '/usuarios', name: 'users', component: () => import('@/views/UsersView.vue'), meta: { section: 'users', title: 'Usuarios' } },
  { path: '/furrperms', name: 'furrperms', component: () => import('@/views/modules/FurrPermsView.vue'), meta: { section: 'furrperms', title: 'FurrPerms' } },
  {
    path: '/furrsecurity', name: 'furrsecurity', component: () => import('@/views/modules/FurrSecurityView.vue'),
    meta: { section: 'furrsecurity', title: 'FurrSecurity' },
  },
  {
    path: '/sin-acceso', name: 'forbidden', component: () => import('@/views/StatusView.vue'), props: { kind: 'forbidden' },
    meta: { title: 'Sin acceso' },
  },
  {
    path: '/:pathMatch(.*)*', name: 'notfound', component: () => import('@/views/StatusView.vue'), props: { kind: 'notfound' },
    meta: { title: 'No encontrado' },
  },
]

const STALE_CHUNK = /dynamically imported module|Importing a module script failed|error loading dynamically/i

export function createAppRouter(session: ReturnType<typeof useSession>) {
  const router = createRouter({
    history: createWebHistory(import.meta.env.BASE_URL),
    routes,
    scrollBehavior: (to, from, saved) => saved ?? (to.path !== from.path ? { top: 0 } : false),
  })

  router.beforeEach((to) => {
    const section = to.meta.section
    if (!section || session.can(section)) return true
    const first = to.name === 'overview' ? firstSection(session.permissions) : null
    return first ? { name: first } : { name: 'forbidden', query: { desde: to.fullPath } }
  })

  router.afterEach((to) => {
    document.title = `${to.meta.title} · FurrGuard`
  })

  // Tras un despliegue los chunks antiguos ya no existen: se recarga la página una vez
  router.onError((error: unknown, to) => {
    if (error instanceof Error && STALE_CHUNK.test(error.message)) {
      window.location.assign(router.resolve(to).href)
    }
  })

  return router
}
