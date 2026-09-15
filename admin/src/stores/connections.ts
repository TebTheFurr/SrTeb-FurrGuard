import { defineStore } from 'pinia'
import { apiRequest } from '@/lib/api'
import type { Connection, PaginationData, ApiResponse } from '@/types'

export const useConnectionsStore = defineStore('connections', {
  state: () => ({
    connections: [] as Connection[],
    pagination: null as PaginationData | null,
    currentFilter: 'all',
    currentSearch: '',
    currentConnection: null as Connection | null,
    loading: false,
    detailLoading: false,
    error: null as string | null,
  }),

  actions: {
    async fetchConnections(page = 1, filter?: string, search?: string) {
      this.loading = true
      this.error = null
      if (filter !== undefined) this.currentFilter = filter
      if (search !== undefined) this.currentSearch = search

      try {
        const res = await apiRequest<ApiResponse<{ connections: Connection[]; pagination: PaginationData }>>('get_connections', {
          page,
          filter: this.currentFilter,
          search: this.currentSearch,
        })
        if (res.success && res.data) {
          this.connections = res.data.connections
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

    async fetchConnection(id: number) {
      this.detailLoading = true
      this.error = null
      try {
        const res = await apiRequest<ApiResponse<{ connection: Connection }>>('get_connection_detail', { id })
        if (res.success && res.data) {
          this.currentConnection = res.data.connection
        } else {
          this.error = res.error ?? 'Conexion no encontrada'
        }
      } catch (e: unknown) {
        this.error = e instanceof Error ? e.message : 'Error de conexion'
      } finally {
        this.detailLoading = false
      }
    },
  },
})
