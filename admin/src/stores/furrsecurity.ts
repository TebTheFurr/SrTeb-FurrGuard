import { defineStore } from 'pinia'
import { apiRequest } from '@/lib/api'
import type {
  FurrSecurityStaff,
  FurrSecuritySession,
  FurrSecurityLog,
  FurrSecurityStats,
  PaginationData,
  ApiResponse,
} from '@/types'

export const useFurrSecurityStore = defineStore('furrsecurity', {
  state: () => ({
    staff: [] as FurrSecurityStaff[],
    sessions: [] as FurrSecuritySession[],
    logs: [] as FurrSecurityLog[],
    stats: null as FurrSecurityStats | null,
    logPagination: null as PaginationData | null,
    loading: false,
    error: null as string | null,
    staffSearch: '',
    sessionSearch: '',
    logSearch: '',
    logFilter: 'all',
  }),

  actions: {
    async fetchStaff(search?: string) {
      this.loading = true
      this.error = null
      if (search !== undefined) this.staffSearch = search

      try {
        const res = await apiRequest<ApiResponse<FurrSecurityStaff[]>>('furrsecurity_get_staff', {
          search: this.staffSearch,
        })
        if (res.success && res.data) {
          this.staff = res.data
        } else {
          this.error = res.error ?? 'Error desconocido'
        }
      } catch (e: unknown) {
        this.error = e instanceof Error ? e.message : 'Error de conexion'
      } finally {
        this.loading = false
      }
    },

    async addStaff(data: { discord_id: string; minecraft_nick: string }) {
      try {
        const res = await apiRequest<ApiResponse>('furrsecurity_add_staff', data)
        if (!res.success) {
          this.error = res.error ?? 'Error al añadir'
          return false
        }
        await this.fetchStaff(this.staffSearch)
        return true
      } catch (e: unknown) {
        this.error = e instanceof Error ? e.message : 'Error de conexion'
        return false
      }
    },

    async removeStaff(id: number) {
      try {
        const res = await apiRequest<ApiResponse>('furrsecurity_remove_staff', { id })
        if (!res.success) {
          this.error = res.error ?? 'Error al eliminar'
          return false
        }
        await this.fetchStaff(this.staffSearch)
        return true
      } catch (e: unknown) {
        this.error = e instanceof Error ? e.message : 'Error de conexion'
        return false
      }
    },

    async fetchSessions(search?: string) {
      this.loading = true
      this.error = null
      if (search !== undefined) this.sessionSearch = search

      try {
        const res = await apiRequest<ApiResponse<FurrSecuritySession[]>>('furrsecurity_get_sessions', {
          search: this.sessionSearch,
        })
        if (res.success && res.data) {
          this.sessions = res.data
        } else {
          this.error = res.error ?? 'Error desconocido'
        }
      } catch (e: unknown) {
        this.error = e instanceof Error ? e.message : 'Error de conexion'
      } finally {
        this.loading = false
      }
    },

    async fetchLogs(page = 1, filter?: string, search?: string) {
      this.loading = true
      this.error = null
      if (filter !== undefined) this.logFilter = filter
      if (search !== undefined) this.logSearch = search

      try {
        const res = await apiRequest<ApiResponse<{ logs: FurrSecurityLog[]; pagination: PaginationData }>>('furrsecurity_get_logs', {
          page,
          filter: this.logFilter,
          search: this.logSearch,
        })
        if (res.success && res.data) {
          this.logs = res.data.logs
          this.logPagination = res.data.pagination ?? null
        } else {
          this.error = res.error ?? 'Error desconocido'
        }
      } catch (e: unknown) {
        this.error = e instanceof Error ? e.message : 'Error de conexion'
      } finally {
        this.loading = false
      }
    },

    async revokeSession(id: number) {
      try {
        const res = await apiRequest<ApiResponse>('furrsecurity_revoke_session', { id })
        if (!res.success) {
          this.error = res.error ?? 'Error al revocar'
          return false
        }
        await this.fetchSessions(this.sessionSearch)
        return true
      } catch (e: unknown) {
        this.error = e instanceof Error ? e.message : 'Error de conexion'
        return false
      }
    },

    async fetchStats() {
      try {
        const res = await apiRequest<ApiResponse<FurrSecurityStats>>('furrsecurity_get_stats')
        if (res.success && res.data) {
          this.stats = res.data
        }
      } catch {
        // Stats are non-critical, silently fail
      }
    },
  },
})
