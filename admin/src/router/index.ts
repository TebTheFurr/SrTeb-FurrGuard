import { createRouter, createWebHashHistory } from 'vue-router'
import { useAuthStore } from '@/stores/auth'

const router = createRouter({
  history: createWebHashHistory(),
  routes: [
    // Unauthenticated
    {
      path: '/login',
      name: 'login',
      component: () => import('@/views/LoginView.vue'),
      meta: { requiresAuth: false },
    },

    // Authenticated routes wrapped in DashboardLayout
    {
      path: '/',
      component: () => import('@/components/layout/DashboardLayout.vue'),
      children: [
        { path: '', name: 'dashboard', component: () => import('@/views/DashboardView.vue') },
        { path: 'players', name: 'players', component: () => import('@/views/PlayersView.vue') },
        { path: 'players/:uuid', name: 'player-detail', component: () => import('@/views/PlayerDetailView.vue') },
        { path: 'connections', name: 'connections', component: () => import('@/views/ConnectionsView.vue') },
        { path: 'ips', name: 'ips', component: () => import('@/views/IPsView.vue') },
        { path: 'whitelist', name: 'whitelist', component: () => import('@/views/WhitelistView.vue') },
        { path: 'blacklist', name: 'blacklist', component: () => import('@/views/BlacklistView.vue') },
        { path: 'sanctions', name: 'sanctions', component: () => import('@/views/SanctionsView.vue') },
        { path: 'providers', name: 'providers', component: () => import('@/views/ProvidersView.vue') },
        { path: 'countries', name: 'countries', component: () => import('@/views/CountriesView.vue') },
        { path: 'continents', name: 'continents', component: () => import('@/views/ContinentsView.vue') },
        { path: 'furrperms', name: 'furrperms', component: () => import('@/views/FurrPermsView.vue') },
        { path: 'furrsecurity', name: 'furrsecurity', component: () => import('@/views/FurrSecurityView.vue') },
        { path: 'messages', name: 'messages', component: () => import('@/views/MessagesView.vue') },
        { path: 'logs', name: 'logs', component: () => import('@/views/LogsView.vue') },
        { path: 'settings', name: 'settings', component: () => import('@/views/SettingsView.vue') },
        { path: 'users', name: 'users', component: () => import('@/views/UsersView.vue') },
      ],
    },
  ],
})

router.beforeEach((to) => {
  const auth = useAuthStore()

  if (to.meta.requiresAuth === false) {
    return true
  }

  if (!auth.isAuthenticated) {
    return { name: 'login' }
  }

  return true
})

export default router
