import { defineStore } from 'pinia'
import { apiRequest } from '@/lib/api'
import type { SettingsMap, ApiResponse, MigrationResult, PlayerMigrationResult, ExportData } from '@/types'

export const useSettingsStore = defineStore('settings', {
  state: () => ({
    settings: {} as SettingsMap,
    loading: false,
    error: null as string | null,
  }),

  actions: {
    async fetch() {
      this.loading = true
      this.error = null

      try {
        const res = await apiRequest<ApiResponse<{ settings: SettingsMap }>>('get_settings')
        if (res.success && res.data) {
          this.settings = { ...res.data.settings }
        } else {
          this.error = res.error ?? 'Error desconocido'
        }
      } catch (e: unknown) {
        this.error = e instanceof Error ? e.message : 'Error de conexion'
      } finally {
        this.loading = false
      }
    },

    async save(settings: SettingsMap): Promise<boolean> {
      this.loading = true
      this.error = null

      try {
        const res = await apiRequest<ApiResponse>('save_settings', { settings })
        if (res.success) {
          this.settings = { ...settings }
          return true
        } else {
          this.error = res.error ?? 'Error al guardar'
          return false
        }
      } catch (e: unknown) {
        this.error = e instanceof Error ? e.message : 'Error de conexion'
        return false
      } finally {
        this.loading = false
      }
    },

    async regenerateApiKey(): Promise<string | null> {
      this.error = null
      try {
        const res = await apiRequest<ApiResponse<{ api_key: string }>>('regenerate_api_key')
        if (res.success && res.data) {
          this.settings = { ...this.settings, api_key: res.data.api_key }
          return res.data.api_key
        } else {
          this.error = res.error ?? 'Error al regenerar'
          return null
        }
      } catch (e: unknown) {
        this.error = e instanceof Error ? e.message : 'Error de conexion'
        return null
      }
    },

    async exportData(): Promise<ExportData | null> {
      this.error = null
      try {
        const res = await apiRequest<ApiResponse<ExportData>>('export_data')
        if (res.success && res.data) {
          return res.data
        } else {
          this.error = res.error ?? 'Error al exportar'
          return null
        }
      } catch (e: unknown) {
        this.error = e instanceof Error ? e.message : 'Error de conexion'
        return null
      }
    },

    async migrateBlacklist(): Promise<MigrationResult | null> {
      this.loading = true
      this.error = null
      try {
        const res = await apiRequest<ApiResponse<MigrationResult>>('migrate_blacklist')
        if (res.success && res.data) {
          return res.data
        } else {
          this.error = res.error ?? 'Error en la migracion'
          return null
        }
      } catch (e: unknown) {
        this.error = e instanceof Error ? e.message : 'Error de conexion'
        return null
      } finally {
        this.loading = false
      }
    },

    async migratePlayers(): Promise<PlayerMigrationResult | null> {
      this.loading = true
      this.error = null
      try {
        const res = await apiRequest<ApiResponse<PlayerMigrationResult>>('migrate_players')
        if (res.success && res.data) {
          return res.data
        } else {
          this.error = res.error ?? 'Error en la migracion'
          return null
        }
      } catch (e: unknown) {
        this.error = e instanceof Error ? e.message : 'Error de conexion'
        return null
      } finally {
        this.loading = false
      }
    },
  },
})
