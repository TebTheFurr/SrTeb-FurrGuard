import { defineStore } from 'pinia'
import { apiRequest } from '@/lib/api'
import type { LogEntry, ApiResponse } from '@/types'

export const useLogsStore = defineStore('logs', {
  state: () => ({
    logs: [] as LogEntry[],
    loading: false,
    error: null as string | null,
    currentFilter: 'all',
    currentSearch: '',
  }),

  actions: {
    async fetch(filter?: string) {
      this.loading = true
      this.error = null
      if (filter !== undefined) this.currentFilter = filter

      try {
        const res = await apiRequest<ApiResponse<{ logs: LogEntry[] }>>('get_logs', {
          filter: this.currentFilter,
        })
        if (res.success && res.data) {
          this.logs = res.data.logs
        } else {
          this.error = res.error ?? 'Error desconocido'
        }
      } catch (e: unknown) {
        this.error = e instanceof Error ? e.message : 'Error de conexion'
      } finally {
        this.loading = false
      }
    },
  },
})
