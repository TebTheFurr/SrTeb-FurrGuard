import { defineStore } from 'pinia'
import { apiRequest } from '@/lib/api'
import type { Country, CountryStats, PaginationData, ApiResponse } from '@/types'

export const useCountriesStore = defineStore('countries', {
  state: () => ({
    countries: [] as Country[],
    stats: null as CountryStats | null,
    pagination: null as PaginationData | null,
    loading: false,
    error: null as string | null,
    currentSearch: '',
  }),

  actions: {
    async fetch(page = 1, search?: string) {
      this.loading = true
      this.error = null
      if (search !== undefined) this.currentSearch = search

      try {
        const res = await apiRequest<ApiResponse<{ countries: Country[]; stats: CountryStats; pagination: PaginationData }>>('get_countries', {
          page,
          search: this.currentSearch,
        })
        if (res.success && res.data) {
          this.countries = res.data.countries
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

    async add(data: { country_code: string; country_name: string; kick_message: string }) {
      try {
        const res = await apiRequest<ApiResponse>('add_country', data)
        if (!res.success) {
          this.error = res.error ?? 'Error al añadir'
          return false
        }
        await this.fetch(this.pagination?.current_page ?? 1, this.currentSearch)
        return true
      } catch (e: unknown) {
        this.error = e instanceof Error ? e.message : 'Error de conexion'
        return false
      }
    },

    async edit(id: number, data: { country_name: string; kick_message: string }) {
      try {
        const res = await apiRequest<ApiResponse>('edit_country', { id, ...data })
        if (!res.success) {
          this.error = res.error ?? 'Error al editar'
          return false
        }
        await this.fetch(this.pagination?.current_page ?? 1, this.currentSearch)
        return true
      } catch (e: unknown) {
        this.error = e instanceof Error ? e.message : 'Error de conexion'
        return false
      }
    },

    async toggle(id: number, active: boolean) {
      try {
        const res = await apiRequest<ApiResponse>('toggle_country', { id, active })
        if (!res.success) {
          this.error = res.error ?? 'Error al cambiar estado'
          return false
        }
        await this.fetch(this.pagination?.current_page ?? 1, this.currentSearch)
        return true
      } catch (e: unknown) {
        this.error = e instanceof Error ? e.message : 'Error de conexion'
        return false
      }
    },

    async remove(id: number) {
      try {
        const res = await apiRequest<ApiResponse>('delete_country', { id })
        if (!res.success) {
          this.error = res.error ?? 'Error al eliminar'
          return false
        }
        await this.fetch(this.pagination?.current_page ?? 1, this.currentSearch)
        return true
      } catch (e: unknown) {
        this.error = e instanceof Error ? e.message : 'Error de conexion'
        return false
      }
    },
  },
})
