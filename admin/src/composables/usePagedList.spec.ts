import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest'
import { createApp, effectScope, type EffectScope } from 'vue'
import { createMemoryHistory, createRouter, type Router } from 'vue-router'
import { usePagedList } from './usePagedList'

interface Call {
  action: string
  params: Record<string, unknown>
  signal: AbortSignal | undefined
  resolve: (data: unknown) => void
  reject: (error: unknown) => void
}

const calls: Call[] = []

vi.mock('@/api/client', async (importOriginal) => {
  const original = await importOriginal<typeof import('@/api/client')>()
  return {
    ...original,
    api: (action: string, params: Record<string, unknown>, options: { signal?: AbortSignal } = {}) =>
      new Promise((resolve, reject) => {
        options.signal?.addEventListener('abort', () => reject(new DOMException('Aborted', 'AbortError')))
        calls.push({ action, params, signal: options.signal, resolve, reject })
      }),
  }
})

const page = (items: string[], total = items.length) => ({
  items,
  pagination: { page: 1, per_page: 25, total, total_pages: Math.ceil(total / 25) },
})

const settle = async (): Promise<void> => {
  for (let i = 0; i < 200; i++) await Promise.resolve()
}

describe('usePagedList', () => {
  let router: Router
  let scope: EffectScope

  async function mount(url: string, prefix?: string) {
    router = createRouter({
      history: createMemoryHistory(),
      routes: [
        { path: '/jugadores', name: 'players', component: { render: () => null } },
        { path: '/otra', name: 'other', component: { render: () => null } },
      ],
    })
    await router.push(url)
    const app = createApp({ render: () => null })
    app.use(router)
    scope = effectScope()
    const list = app.runWithContext(() => scope.run(() => usePagedList<string, { filter: string; search: string }>({
      action: 'get_players',
      filters: { filter: 'all', search: '' },
      allowed: { filter: ['all', 'online'] },
      ...(prefix !== undefined && { prefix }),
    })))!
    await settle()
    return list
  }

  beforeEach(() => {
    calls.length = 0
    vi.useFakeTimers()
  })

  afterEach(() => {
    scope.stop()
    vi.useRealTimers()
  })

  it('carga con los filtros de la URL y los muestra en el formulario', async () => {
    const list = await mount('/jugadores?search=ana&page=2&filter=online')
    expect(calls).toHaveLength(1)
    expect(calls[0]!.params).toEqual({ page: 2, per_page: 25, filter: 'online', search: 'ana' })
    expect(list.filters).toEqual({ filter: 'online', search: 'ana' })
    calls[0]!.resolve(page(['a', 'b'], 30))
    await settle()
    expect(list.items).toEqual(['a', 'b'])
    expect(list.pagination.total).toBe(30)
    expect(list.loading).toBe(false)
  })

  it('ignora valores de filtro que no están permitidos', async () => {
    const list = await mount('/jugadores?filter=<script>')
    expect(list.filters.filter).toBe('all')
    expect(calls[0]!.params.filter).toBe('all')
  })

  it('la búsqueda espera a que se deje de escribir, vuelve a la página 1 y actualiza la URL', async () => {
    const list = await mount('/jugadores?page=3')
    list.filters.search = 'b'
    list.filters.search = 'bo'
    await vi.advanceTimersByTimeAsync(100)
    expect(calls).toHaveLength(1)
    await vi.advanceTimersByTimeAsync(400)
    await settle()
    expect(calls).toHaveLength(2)
    expect(calls[1]!.params).toMatchObject({ search: 'bo', page: 1 })
    expect(router.currentRoute.value.query).toEqual({ search: 'bo' })
  })

  it('aborta la petición anterior y una respuesta vieja no pisa la nueva', async () => {
    const list = await mount('/jugadores')
    const first = calls[0]!
    list.filters.filter = 'online'
    await settle()
    const second = calls[1]!
    expect(first.signal?.aborted).toBe(true)
    second.resolve(page(['nuevo']))
    first.resolve(page(['viejo']))
    await settle()
    expect(list.items).toEqual(['nuevo'])
  })

  it('reacciona a una navegación externa (búsqueda de la barra superior) estando ya en la vista', async () => {
    const list = await mount('/jugadores?search=uno')
    await router.push({ name: 'players', query: { search: 'dos' } })
    await settle()
    expect(list.filters.search).toBe('dos')
    expect(calls.at(-1)!.params).toMatchObject({ search: 'dos' })
  })

  it('cambiar de página conserva los filtros', async () => {
    const list = await mount('/jugadores?search=ana')
    list.setPage(4)
    await settle()
    expect(router.currentRoute.value.query).toEqual({ search: 'ana', page: '4' })
    expect(calls.at(-1)!.params).toMatchObject({ search: 'ana', page: 4 })
  })

  it('con prefijo solo lee y escribe sus claves', async () => {
    const list = await mount('/jugadores?log_search=x&search=otra', 'log_')
    expect(list.filters.search).toBe('x')
    list.filters.filter = 'online'
    await settle()
    expect(router.currentRoute.value.query).toEqual({ log_search: 'x', log_filter: 'online', search: 'otra' })
  })

  it('al desmontar cancela el debounce y la petición en curso', async () => {
    const list = await mount('/jugadores')
    list.filters.search = 'zzz'
    scope.stop()
    expect(calls[0]!.signal?.aborted).toBe(true)
    await vi.advanceTimersByTimeAsync(1000)
    await settle()
    expect(calls).toHaveLength(1)
  })

  it('un error conserva el mensaje del servidor y no deja filas de otra búsqueda', async () => {
    const { ApiError } = await import('@/api/client')
    const list = await mount('/jugadores')
    calls[0]!.resolve(page(['a']))
    await settle()
    list.filters.filter = 'online'
    await settle()
    calls.at(-1)!.reject(new ApiError(500, 'db', 'Error de base de datos'))
    await settle()
    expect(list.error?.message).toBe('Error de base de datos')
    expect(list.items).toEqual([])
    expect(list.loading).toBe(false)
    list.reload()
    await settle()
    expect(list.error).toBeNull()
    expect(calls.at(-1)!.params).toMatchObject({ filter: 'online' })
  })
})
