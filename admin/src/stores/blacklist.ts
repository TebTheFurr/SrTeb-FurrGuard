import { defineStore } from 'pinia'
import { apiRequest } from '@/lib/api'
import type { BlacklistEntry, SanctionStats, PaginationData, ApiResponse } from '@/types'

export const useBlacklistStore = defineStore('blacklist', {
  state: () => ({
    entries: [] as BlacklistEntry[],
    sanctions: [] as BlacklistEntry[],
    pagination: null as PaginationData | null,
    stats: null as SanctionStats | null,
    loading: false,
    sanctionsLoading: false,
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
        const res = await apiRequest<ApiResponse<{ entries: BlacklistEntry[] }>>('get_blacklist', {
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

    async fetchSanctions(page = 1, filter = 'all', search = '') {
      this.sanctionsLoading = true
      this.error = null

      try {
        const res = await apiRequest<ApiResponse<{ sanctions: BlacklistEntry[]; stats: SanctionStats; pagination: PaginationData }>>('get_sanctions', {
          page,
          filter,
          search,
        })
        if (res.success && res.data) {
          this.sanctions = res.data.sanctions
          this.stats = res.data.stats
          this.pagination = res.data.pagination ?? null
        } else {
          this.error = res.error ?? 'Error desconocido'
        }
      } catch (e: unknown) {
        this.error = e instanceof Error ? e.message : 'Error de conexion'
      } finally {
        this.sanctionsLoading = false
      }
    },

    async add(data: { type: string; value: string; reason: string; duration?: number; stain_ip?: number }) {
      try {
        const res = await apiRequest<ApiResponse>('add_blacklist', data)
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

    async addUnified(data: { player_name: string; reason: string; duration?: number; stain_ip?: number }) {
      try {
        const res = await apiRequest<ApiResponse>('add_blacklist_unified', data)
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

    async addIP(data: { value: string; reason: string }) {
      try {
        const res = await apiRequest<ApiResponse>('add_blacklist', {
          type: 'ip',
          value: data.value,
          reason: data.reason,
          duration: 0,
          stain_ip: 0,
        })
        if (!res.success) {
          this.error = res.error ?? 'Error al añadir IP'
          return false
        }
        await this.fetch()
        return true
      } catch (e: unknown) {
        this.error = e instanceof Error ? e.message : 'Error de conexion'
        return false
      }
    },

    async edit(id: number, data: { type: string; value: string; reason: string; duration?: number }) {
      try {
        const res = await apiRequest<ApiResponse>('edit_blacklist', { id, ...data })
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
        const res = await apiRequest<ApiResponse>('remove_blacklist', { id })
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
        const res = await apiRequest<ApiResponse>('remove_blacklist_by_value', { type, value })
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

    async toggle(id: number, active: boolean) {
      try {
        const res = await apiRequest<ApiResponse>('toggle_blacklist', { id, active })
        if (!res.success) {
          this.error = res.error ?? 'Error al cambiar estado'
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
