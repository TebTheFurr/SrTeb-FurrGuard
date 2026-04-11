import { defineStore } from 'pinia'
import { apiRequest } from '@/lib/api'
import type { AdminUserRow, ApiResponse } from '@/types'

export const useUsersStore = defineStore('users', {
  state: () => ({
    users: [] as AdminUserRow[],
    loading: false,
    error: null as string | null,
  }),

  actions: {
    async fetch() {
      this.loading = true
      this.error = null

      try {
        const res = await apiRequest<ApiResponse<{ users: AdminUserRow[] }>>('get_admin_users')
        if (res.success && res.data) {
          this.users = res.data.users
        } else {
          this.error = res.error ?? 'Error desconocido'
        }
      } catch (e: unknown) {
        this.error = e instanceof Error ? e.message : 'Error de conexion'
      } finally {
        this.loading = false
      }
    },

    async add(data: { discord_id: string; role: string }): Promise<boolean> {
      this.error = null
      try {
        const res = await apiRequest<ApiResponse>('add_admin_user', data)
        if (res.success) {
          await this.fetch()
          return true
        } else {
          this.error = res.error ?? 'Error al añadir'
          return false
        }
      } catch (e: unknown) {
        this.error = e instanceof Error ? e.message : 'Error de conexion'
        return false
      }
    },

    async remove(id: number): Promise<boolean> {
      this.error = null
      try {
        const res = await apiRequest<ApiResponse>('remove_admin_user', { id })
        if (res.success) {
          await this.fetch()
          return true
        } else {
          this.error = res.error ?? 'Error al eliminar'
          return false
        }
      } catch (e: unknown) {
        this.error = e instanceof Error ? e.message : 'Error de conexion'
        return false
      }
    },
  },
})
