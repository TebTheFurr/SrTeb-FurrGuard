import { defineStore } from 'pinia'
import { apiRequest } from '@/lib/api'
import type { MessagesMap, ApiResponse } from '@/types'

export const useMessagesStore = defineStore('messages', {
  state: () => ({
    messages: {} as MessagesMap,
    loading: false,
    error: null as string | null,
    dirty: false,
  }),

  actions: {
    async fetch() {
      this.loading = true
      this.error = null

      try {
        const res = await apiRequest<ApiResponse<{ messages: MessagesMap }>>('get_messages')
        if (res.success && res.data) {
          this.messages = { ...res.data.messages }
          this.dirty = false
        } else {
          this.error = res.error ?? 'Error desconocido'
        }
      } catch (e: unknown) {
        this.error = e instanceof Error ? e.message : 'Error de conexion'
      } finally {
        this.loading = false
      }
    },

    async save(messages: MessagesMap) {
      this.loading = true
      this.error = null

      try {
        const res = await apiRequest<ApiResponse>('save_messages', { messages })
        if (res.success) {
          this.messages = { ...messages }
          this.dirty = false
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

    markDirty() {
      this.dirty = true
    },
  },
})
