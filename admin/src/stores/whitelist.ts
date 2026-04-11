import { defineStore } from 'pinia'
import { apiRequest } from '@/lib/api'
import type { WhitelistEntry, ApiResponse } from '@/types'

export const useWhitelistStore = defineStore('whitelist', {
  state: () => ({
    entries: [] as WhitelistEntry[],
    loading: false,
    error: null as string | null,
    currentFilter: 'all',
    currentSearch: '',
  }),

  actions: {
    async fetch(filter?: string, search?: string) {
      this.loading = true
      this.error = null
      if (filter !== undefined) this.currentFilter = filter
      if (search !== undefined) this.currentSearch = search

      try {
        const res = await apiRequest<ApiResponse<{ entries: WhitelistEntry[] }>>('get_whitelist', {
          filter: this.currentFilter,
          search: this.currentSearch,
        })
        if (res.success && res.data) {
          this.entries = res.data.entries
        } else {
          this.error = res.error ?? 'Error desconocido'
        }
      } catch (e: unknown) {
        this.error = e instanceof Error ? e.message : 'Error de conexion'
      } finally {
        this.loading = false
      }
    },

    async add(data: { type: string; value: string; reason: string }) {
      try {
        const res = await apiRequest<ApiResponse>('add_whitelist', data)
        if (!res.success) {
          this.error = res.error ?? 'Error al añadir'
          return false
        }
        await this.fetch()
        return true
      } catch (e: unknown) {
        this.error = e instanceof Error ? e.message : 'Error de conexion'
        return false
      }
    },

    async edit(id: number, data: { type: string; value: string; reason: string }) {
      try {
        const res = await apiRequest<ApiResponse>('edit_whitelist', { id, ...data })
        if (!res.success) {
          this.error = res.error ?? 'Error al editar'
          return false
        }
        await this.fetch()
        return true
      } catch (e: unknown) {
        this.error = e instanceof Error ? e.message : 'Error de conexion'
        return false
      }
    },

    async remove(id: number) {
      try {
        const res = await apiRequest<ApiResponse>('remove_whitelist', { id })
        if (!res.success) {
          this.error = res.error ?? 'Error al eliminar'
          return false
        }
        await this.fetch()
        return true
      } catch (e: unknown) {
        this.error = e instanceof Error ? e.message : 'Error de conexion'
        return false
      }
    },

    async removeByValue(type: string, value: string) {
      try {
        const res = await apiRequest<ApiResponse>('remove_whitelist_by_value', { type, value })
        if (!res.success) {
          this.error = res.error ?? 'Error al eliminar'
          return false
        }
        await this.fetch()
        return true
      } catch (e: unknown) {
        this.error = e instanceof Error ? e.message : 'Error de conexion'
        return false
      }
    },
  },
})
