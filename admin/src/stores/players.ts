import { defineStore } from 'pinia'
import { apiRequest } from '@/lib/api'
import type { Player, PlayerDetail, PlayerLookup, NameHistoryEntry, PaginationData, ApiResponse } from '@/types'

export const usePlayersStore = defineStore('players', {
  state: () => ({
    players: [] as Player[],
    pagination: null as PaginationData | null,
    currentFilter: 'all',
    currentSearch: '',
    currentPlayer: null as PlayerDetail | null,
    lookupResult: null as PlayerLookup | null,
    nameHistory: [] as NameHistoryEntry[],
    loading: false,
    detailLoading: false,
    error: null as string | null,
  }),

  actions: {
    async fetchPlayers(page = 1, filter?: string, search?: string) {
      this.loading = true
      this.error = null
      if (filter !== undefined) this.currentFilter = filter
      if (search !== undefined) this.currentSearch = search

      try {
        const res = await apiRequest<ApiResponse<{ players: Player[] }>>('get_players', {
          page,
          filter: this.currentFilter,
          search: this.currentSearch,
        })
        if (res.success && res.data) {
          this.players = res.data.players
          this.pagination = res.pagination ?? null
        } else {
          this.error = res.error ?? 'Error desconocido'
        }
      } catch (e: unknown) {
        this.error = e instanceof Error ? e.message : 'Error de conexion'
      } finally {
        this.loading = false
      }
    },

    async fetchPlayer(uuid: string) {
      this.detailLoading = true
      this.error = null
      try {
        const res = await apiRequest<ApiResponse<PlayerDetail>>('get_player_detail', { uuid })
        if (res.success && res.data) {
          this.currentPlayer = res.data
        } else {
          this.error = res.error ?? 'Jugador no encontrado'
        }
      } catch (e: unknown) {
        this.error = e instanceof Error ? e.message : 'Error de conexion'
      } finally {
        this.detailLoading = false
      }
    },

    async lookupPlayer(query: string) {
      this.loading = true
      try {
        const res = await apiRequest<ApiResponse<PlayerLookup>>('lookup_player', {
          player_name: query,
        })
        if (res.success && res.data) {
          this.lookupResult = res.data
        } else {
          this.lookupResult = { is_premium: false, uuid: null, name: null, error: res.error ?? 'No encontrado' }
        }
      } catch {
        this.lookupResult = { is_premium: false, uuid: null, name: null, error: 'Error de conexion' }
      } finally {
        this.loading = false
      }
    },

    async getNameHistory(playerName: string) {
      try {
        const res = await apiRequest<ApiResponse<NameHistoryEntry[]>>('get_name_history', {
          player_name: playerName,
        })
        if (res.success && res.data) {
          this.nameHistory = res.data
        } else {
          this.nameHistory = []
        }
      } catch {
        this.nameHistory = []
      }
    },
  },
})
