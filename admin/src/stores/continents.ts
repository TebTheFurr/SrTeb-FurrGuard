import { defineStore } from 'pinia'
import { apiRequest } from '@/lib/api'
import type { Continent, ContinentStats, ApiResponse } from '@/types'

export const useContinentsStore = defineStore('continents', {
  state: () => ({
    continents: [] as Continent[],
    stats: null as ContinentStats | null,
    loading: false,
    error: null as string | null,
    currentSearch: '',
  }),

  actions: {
    async fetch(search?: string) {
      this.loading = true
      this.error = null
      if (search !== undefined) this.currentSearch = search

      try {
        const res = await apiRequest<ApiResponse<{ continents: Continent[]; stats: ContinentStats }>>('get_continents', {
          search: this.currentSearch,
        })
        if (res.success && res.data) {
          this.continents = res.data.continents
          this.stats = res.data.stats
        } else {
          this.error = res.error ?? 'Error desconocido'
        }
      } catch (e: unknown) {
        this.error = e instanceof Error ? e.message : 'Error de conexion'
      } finally {
        this.loading = false
      }
    },

    async add(data: { continent_code: string; continent_name: string; kick_message: string }) {
      try {
        const res = await apiRequest<ApiResponse>('add_continent', data)
        if (!res.success) {
          this.error = res.error ?? 'Error al añadir'
          return false
        }
        await this.fetch(this.currentSearch)
        return true
      } catch (e: unknown) {
        this.error = e instanceof Error ? e.message : 'Error de conexion'
        return false
      }
    },

    async edit(id: number, data: { continent_name: string; kick_message: string }) {
      try {
        const res = await apiRequest<ApiResponse>('edit_continent', { id, ...data })
        if (!res.success) {
          this.error = res.error ?? 'Error al editar'
          return false
        }
        await this.fetch(this.currentSearch)
        return true
      } catch (e: unknown) {
        this.error = e instanceof Error ? e.message : 'Error de conexion'
        return false
      }
    },

    async toggle(id: number, active: boolean) {
      try {
        const res = await apiRequest<ApiResponse>('toggle_continent', { id, active })
        if (!res.success) {
          this.error = res.error ?? 'Error al cambiar estado'
          return false
        }
        await this.fetch(this.currentSearch)
        return true
      } catch (e: unknown) {
        this.error = e instanceof Error ? e.message : 'Error de conexion'
        return false
      }
    },

    async remove(id: number) {
      try {
        const res = await apiRequest<ApiResponse>('delete_continent', { id })
        if (!res.success) {
          this.error = res.error ?? 'Error al eliminar'
          return false
        }
        await this.fetch(this.currentSearch)
        return true
      } catch (e: unknown) {
        this.error = e instanceof Error ? e.message : 'Error de conexion'
        return false
      }
    },
  },
})
