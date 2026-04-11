import { defineStore } from 'pinia'
import { apiRequest } from '@/lib/api'
import type { FurrPermsEntry, FurrPermsLog, FurrPermsLogStats, PaginationData, ApiResponse } from '@/types'

export const useFurrPermsStore = defineStore('furrperms', {
  state: () => ({
    whitelist: [] as FurrPermsEntry[],
    whitelistTotal: 0,
    logs: [] as FurrPermsLog[],
    logStats: null as FurrPermsLogStats | null,
    logPagination: null as PaginationData | null,
    loading: false,
    error: null as string | null,
    currentSearch: '',
    currentFilter: 'all',
  }),

  actions: {
    async fetchWhitelist(search?: string) {
      this.loading = true
      this.error = null
      if (search !== undefined) this.currentSearch = search

      try {
        const res = await apiRequest<ApiResponse<{ entries: FurrPermsEntry[]; total: number }>>('get_furr_perms_whitelist', {
          search: this.currentSearch,
        })
        if (res.success && res.data) {
          this.whitelist = res.data.entries
          this.whitelistTotal = res.data.total
        } else {
          this.error = res.error ?? 'Error desconocido'
        }
      } catch (e: unknown) {
        this.error = e instanceof Error ? e.message : 'Error de conexion'
      } finally {
        this.loading = false
      }
    },

    async addToWhitelist(data: { nick: string; uuid: string; reason?: string }) {
      try {
        const res = await apiRequest<ApiResponse>('add_furr_perms_whitelist', data)
        if (!res.success) {
          this.error = res.error ?? 'Error al añadir'
          return false
        }
        await this.fetchWhitelist(this.currentSearch)
        return true
      } catch (e: unknown) {
        this.error = e instanceof Error ? e.message : 'Error de conexion'
        return false
      }
    },

    async removeFromWhitelist(id: number) {
      try {
        const res = await apiRequest<ApiResponse>('remove_furr_perms_whitelist', { id })
        if (!res.success) {
          this.error = res.error ?? 'Error al eliminar'
          return false
        }
        await this.fetchWhitelist(this.currentSearch)
        return true
      } catch (e: unknown) {
        this.error = e instanceof Error ? e.message : 'Error de conexion'
        return false
      }
    },

    async fetchLogs(page = 1, filter?: string, search?: string) {
      this.loading = true
      this.error = null
      if (filter !== undefined) this.currentFilter = filter
      if (search !== undefined) this.currentSearch = search

      try {
        const res = await apiRequest<ApiResponse<{ logs: FurrPermsLog[]; stats: FurrPermsLogStats; pagination: PaginationData }>>('get_furr_perms_logs', {
          page,
          filter: this.currentFilter,
          search: this.currentSearch,
        })
        if (res.success && res.data) {
          this.logs = res.data.logs
          this.logStats = res.data.stats
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

    async clearLogs() {
      try {
        const res = await apiRequest<ApiResponse>('clear_furr_perms_logs')
        if (!res.success) {
          this.error = res.error ?? 'Error al limpiar logs'
          return false
        }
        await this.fetchLogs(1, this.currentFilter, this.currentSearch)
        return true
      } catch (e: unknown) {
        this.error = e instanceof Error ? e.message : 'Error de conexion'
        return false
      }
    },
  },
})
