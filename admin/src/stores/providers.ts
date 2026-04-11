import { defineStore } from 'pinia'
import { apiRequest } from '@/lib/api'
import type { Provider, ProviderStats, PaginationData, ApiResponse } from '@/types'

export const useProvidersStore = defineStore('providers', {
  state: () => ({
    providers: [] as Provider[],
    stats: null as ProviderStats | null,
    pagination: null as PaginationData | null,
    loading: false,
    error: null as string | null,
    currentFilter: 'all',
    currentSearch: '',
  }),

  actions: {
    async fetch(page = 1, filter?: string, search?: string) {
      this.loading = true
      this.error = null
      if (filter !== undefined) this.currentFilter = filter
      if (search !== undefined) this.currentSearch = search

      try {
        const res = await apiRequest<ApiResponse<{ providers: Provider[]; stats: ProviderStats; pagination: PaginationData }>>('get_providers', {
          page,
          filter: this.currentFilter,
          search: this.currentSearch,
        })
        if (res.success && res.data) {
          this.providers = res.data.providers
          this.stats = res.data.stats
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

    async add(data: { name: string; pattern: string; type: string }) {
      try {
        const res = await apiRequest<ApiResponse>('add_provider', data)
        if (!res.success) {
          this.error = res.error ?? 'Error al añadir'
          return false
        }
        await this.fetch(this.pagination?.current_page ?? 1, this.currentFilter, this.currentSearch)
        return true
      } catch (e: unknown) {
        this.error = e instanceof Error ? e.message : 'Error de conexion'
        return false
      }
    },

    async toggle(id: number, active: boolean) {
      try {
        const res = await apiRequest<ApiResponse>('toggle_provider', { id, active })
        if (!res.success) {
          this.error = res.error ?? 'Error al cambiar estado'
          return false
        }
        await this.fetch(this.pagination?.current_page ?? 1, this.currentFilter, this.currentSearch)
        return true
      } catch (e: unknown) {
        this.error = e instanceof Error ? e.message : 'Error de conexion'
        return false
      }
    },
  },
})
