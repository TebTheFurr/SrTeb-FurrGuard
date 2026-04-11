import { defineStore } from 'pinia'
import { apiRequest } from '@/lib/api'
import type { OverviewData, BadgeCounts, ApiResponse } from '@/types'

export const useOverviewStore = defineStore('overview', {
  state: () => ({
    stats: null as OverviewData | null,
    badgeCounts: null as BadgeCounts | null,
    loading: false,
    error: null as string | null,
  }),

  actions: {
    async fetchOverview() {
      this.loading = true
      this.error = null
      try {
        const res = await apiRequest<ApiResponse<OverviewData>>('get_overview')
        if (res.success && res.data) {
          this.stats = res.data
        } else {
          this.error = res.error ?? 'Error desconocido'
        }
      } catch (e: unknown) {
        this.error = e instanceof Error ? e.message : 'Error de conexion'
      } finally {
        this.loading = false
      }
    },

    async fetchCounts() {
      try {
        const res = await apiRequest<ApiResponse<BadgeCounts>>('get_counts')
        if (res.success && res.data) {
          this.badgeCounts = res.data
        }
      } catch {
        // Badge counts are non-critical; silently fail
      }
    },
  },
})
