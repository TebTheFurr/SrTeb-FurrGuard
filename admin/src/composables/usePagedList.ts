/**
 * Lista paginada en servidor sincronizada con la URL.
 *
 * - La query de la URL es la fuente de verdad: al volver a una vista (o si la barra superior
 *   cambia `?search=`) el filtro mostrado y el aplicado son siempre el mismo.
 * - Cada carga aborta la anterior: una respuesta vieja nunca pisa una búsqueda nueva.
 * - La búsqueda espera a que se deje de escribir; el debounce se cancela al desmontar.
 */
import { onScopeDispose, reactive, ref, shallowRef, watch } from 'vue'
import { useRoute, useRouter, type LocationQuery, type LocationQueryRaw } from 'vue-router'
import { api, ApiError, isAbortError } from '@/api/client'
import type { Pagination } from '@/api/types'
import { toNum } from '@/lib/format'

export type Filters = Record<string, string>

export interface PagedListOptions<F extends Filters> {
  action: string
  /** Valores por defecto. Un valor vacío no se envía al servidor. */
  filters: F
  /** Valores admitidos por filtro: lo que llegue por la URL fuera de la lista se ignora. */
  allowed?: { [K in keyof F]?: readonly string[] }
  /** Prefijo de las claves en la URL, para varias listas en una misma vista. */
  prefix?: string
  perPage?: number
  /** Filtros que esperan a que se deje de escribir. Por defecto solo `search`. */
  debounced?: readonly (keyof F)[]
  debounceMs?: number
  /** Clave con la que respondían las acciones «como hoy» antes de `items` (§4.4). */
  legacyKey?: string
}

interface ListState<F extends Filters> {
  filters: F
  page: number
  perPage: number
}

export const PER_PAGE_OPTIONS = [25, 50, 100] as const

const firstString = (value: LocationQuery[string] | undefined): string | null => {
  const item = Array.isArray(value) ? value[0] : value
  return typeof item === 'string' ? item : null
}

function readPagination(result: Record<string, unknown>, count: number, state: ListState<Filters>): Pagination {
  const raw = result.pagination
  if (typeof raw === 'object' && raw !== null) {
    const p = raw as Record<string, unknown>
    return {
      page: toNum(p.page) || state.page,
      per_page: toNum(p.per_page) || state.perPage,
      total: toNum(p.total),
      total_pages: toNum(p.total_pages),
    }
  }
  return { page: 1, per_page: state.perPage, total: count, total_pages: count ? 1 : 0 }
}

function readItems<T>(result: unknown, legacyKey?: string): T[] {
  if (Array.isArray(result)) return result as T[]
  if (typeof result !== 'object' || result === null) return []
  const data = result as Record<string, unknown>
  if (Array.isArray(data.items)) return data.items as T[]
  const legacy = legacyKey ? data[legacyKey] : undefined
  return Array.isArray(legacy) ? (legacy as T[]) : []
}

export function usePagedList<T, F extends Filters>(options: PagedListOptions<F>) {
  const route = useRoute()
  const router = useRouter()
  const ownRoute = route.name
  const prefix = options.prefix ?? ''
  const defaults: F = { ...options.filters }
  const defaultPerPage = options.perPage ?? PER_PAGE_OPTIONS[0]
  const debounced = new Set<keyof F>(options.debounced ?? ['search'])
  const keys = Object.keys(defaults) as (keyof F & string)[]
  const queryKey = (key: string): string => `${prefix}${key}`

  const filters = reactive({ ...defaults }) as F
  const page = ref(1)
  const perPage = ref(defaultPerPage)
  const items = shallowRef<T[]>([])
  const data = shallowRef<Record<string, unknown>>({})
  const pagination = ref<Pagination>({ page: 1, per_page: defaultPerPage, total: 0, total_pages: 0 })
  const loading = ref(false)
  const error = shallowRef<ApiError | null>(null)

  let controller: AbortController | null = null
  let timer: ReturnType<typeof setTimeout> | null = null
  let appliedKey = ''
  let loadedKey = ''
  let syncing = false

  function clearTimer(): void {
    if (timer !== null) clearTimeout(timer)
    timer = null
  }

  function readQuery(query: LocationQuery): ListState<F> {
    const next = { ...defaults }
    for (const key of keys) {
      const value = firstString(query[queryKey(key)])?.trim().slice(0, 100)
      const allowed = options.allowed?.[key]
      if (value === undefined || (allowed && !allowed.includes(value))) continue
      next[key] = value as F[typeof key]
    }
    const pageValue = Math.floor(Number(firstString(query[queryKey('page')])))
    const perPageValue = Number(firstString(query[queryKey('per_page')]))
    return {
      filters: next,
      page: Number.isFinite(pageValue) && pageValue > 1 ? pageValue : 1,
      perPage: (PER_PAGE_OPTIONS as readonly number[]).includes(perPageValue) ? perPageValue : defaultPerPage,
    }
  }

  function commit(): void {
    clearTimer()
    const query: LocationQueryRaw = { ...route.query }
    for (const key of keys) {
      query[queryKey(key)] = filters[key] && filters[key] !== defaults[key] ? filters[key] : undefined
    }
    query[queryKey('page')] = page.value > 1 ? String(page.value) : undefined
    query[queryKey('per_page')] = perPage.value !== defaultPerPage ? String(perPage.value) : undefined
    if (router.resolve({ query }).fullPath === route.fullPath) return
    void router.replace({ query })
  }

  async function load(state: ListState<F> = readQuery(route.query)): Promise<void> {
    controller?.abort()
    const current = new AbortController()
    controller = current
    loading.value = true
    error.value = null
    const params: Record<string, unknown> = { page: state.page, per_page: state.perPage }
    for (const key of keys) if (state.filters[key]) params[key] = state.filters[key]
    const key = JSON.stringify(params)
    try {
      const result = await api<unknown>(options.action, params, { signal: current.signal })
      if (controller !== current) return
      const list = readItems<T>(result, options.legacyKey)
      items.value = list
      data.value = typeof result === 'object' && result !== null && !Array.isArray(result) ? (result as Record<string, unknown>) : {}
      pagination.value = readPagination(data.value, list.length, state)
      loadedKey = key
    } catch (e) {
      if (controller !== current || isAbortError(e)) return
      error.value = e instanceof ApiError ? e : new ApiError(0, 'unexpected', 'No se pudo cargar la lista.')
      // Filas de otra búsqueda confundirían: solo se conservan si falla una recarga de lo mismo
      if (loadedKey !== key) items.value = []
    } finally {
      if (controller === current) {
        controller = null
        loading.value = false
      }
    }
  }

  function apply(query: LocationQuery, force = false): void {
    const state = readQuery(query)
    const key = JSON.stringify(state)
    if (!force && key === appliedKey) return
    appliedKey = key
    clearTimer()
    syncing = true
    Object.assign(filters, state.filters)
    page.value = state.page
    perPage.value = state.perPage
    syncing = false
    void load(state)
  }

  watch(
    () => keys.map((key) => filters[key]),
    (now, before) => {
      if (syncing) return
      const changed = keys.filter((_, i) => now[i] !== before[i])
      if (!changed.length) return
      page.value = 1
      if (changed.every((key) => debounced.has(key))) {
        clearTimer()
        timer = setTimeout(commit, options.debounceMs ?? 350)
      } else {
        commit()
      }
    },
    { flush: 'sync' },
  )

  watch(
    () => route.query,
    (query) => {
      if (route.name === ownRoute) apply(query)
    },
  )

  onScopeDispose(() => {
    clearTimer()
    controller?.abort()
    controller = null
  })

  apply(route.query, true)

  return reactive({
    items,
    data,
    pagination,
    loading,
    error,
    filters,
    page,
    perPage,
    setPage(next: number): void {
      page.value = Math.max(1, Math.floor(next))
      commit()
    },
    setPerPage(next: number): void {
      perPage.value = next
      page.value = 1
      commit()
    },
    reload: (): Promise<void> => load(),
  })
}

export type PagedList<T, F extends Filters = Filters> = ReturnType<typeof usePagedList<T, F>>
