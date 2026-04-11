import { defineStore } from 'pinia'
import { apiRequest } from '@/lib/api'
import type { IPEntry, IPDetail, IPPlayer, PaginationData, ApiResponse } from '@/types'

interface IPDetailResponse {
  ip: IPDetail
  players: IPPlayer[]
}

export const useIPsStore = defineStore('ips', {
  state: () => ({
    ips: [] as IPEntry[],
    pagination: null as PaginationData | null,
    currentIP: null as IPDetail | null,
    currentIPPlayers: [] as IPPlayer[],
    loading: false,
    detailLoading: false,
    error: null as string | null,
  }),

  actions: {
    async fetchIPs(page = 1, search?: string) {
      this.loading = true
      this.error = null

      try {
        const res = await apiRequest<ApiResponse<{ ips: IPEntry[]; pagination: PaginationData }>>('get_ips', {
          page,
          search: search ?? '',
        })
        if (res.success && res.data) {
          this.ips = res.data.ips
          this.pagination = res.data.pagination ?? null
        } else {
          this.error = res.error ?? 'Error desconocido'
        }
      } catch (e: unknown) {
        this.error = e instanceof Error ? e.message : 'Error de conexion'
      } finally {
        this.loading = false
      }
    },

    async fetchIPDetail(ip: string) {
      this.detailLoading = true
      this.error = null
      try {
        const res = await apiRequest<ApiResponse<IPDetailResponse>>('get_ip_detail', { ip })
        if (res.success && res.data) {
          this.currentIP = res.data.ip
          this.currentIPPlayers = res.data.players
        } else {
          this.error = res.error ?? 'IP no encontrada'
        }
      } catch (e: unknown) {
        this.error = e instanceof Error ? e.message : 'Error de conexion'
      } finally {
        this.detailLoading = false
      }
    },
  },
})
