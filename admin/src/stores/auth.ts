import { defineStore } from 'pinia'
import type { AdminUser } from '@/types'

export const useAuthStore = defineStore('auth', {
  state: () => ({
    user: null as AdminUser | null,
    permissions: {} as Record<string, string[]>,
    isAuthenticated: false,
  }),
  actions: {
    initialize() {
      if (window.__FURRGUARD_USER__) {
        this.user = window.__FURRGUARD_USER__
        this.permissions = window.__ROLE_PERMISSIONS__ || {}
        this.isAuthenticated = true
      }
    },
    logout() {
      this.user = null
      this.permissions = {}
      this.isAuthenticated = false
      window.location.href = '/admin/index.php?logout=1'
    },
  },
})
