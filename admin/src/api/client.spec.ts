import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest'
import { api, ApiError, configureApi, isAbortError } from './client'

const json = (status: number, body: unknown, headers: Record<string, string> = {}): Response =>
  new Response(JSON.stringify(body), { status, headers: { 'Content-Type': 'application/json', ...headers } })

describe('api()', () => {
  const fetchMock = vi.fn<typeof fetch>()
  const unauthorized = vi.fn()
  const csrf = vi.fn()

  beforeEach(() => {
    vi.stubGlobal('fetch', fetchMock)
    configureApi({ csrfToken: 'tok-123', hooks: { unauthorized, csrf } })
  })

  afterEach(() => {
    fetchMock.mockReset()
    unauthorized.mockReset()
    csrf.mockReset()
    vi.unstubAllGlobals()
  })

  it('envía POST JSON con la cabecera CSRF, la cookie y la acción', async () => {
    fetchMock.mockResolvedValue(json(200, { success: true, data: { ok: 1 } }))
    const data = await api('get_players', { page: 2, action: 'intento_de_pisar' })
    expect(data).toEqual({ ok: 1 })
    const [url, init] = fetchMock.mock.calls[0]!
    expect(url).toBe('/admin/api.php')
    expect(init?.method).toBe('POST')
    expect(init?.credentials).toBe('same-origin')
    expect((init?.headers as Record<string, string>)['X-CSRF-Token']).toBe('tok-123')
    expect(JSON.parse(String(init?.body))).toEqual({ page: 2, action: 'get_players' })
  })

  it.each([400, 404, 409, 422, 500, 503])('lee {error, code} con HTTP %i', async (status) => {
    fetchMock.mockResolvedValue(json(status, { success: false, error: 'Mensaje del servidor', code: 'algo' }))
    const error = await api('x').catch((e: unknown) => e)
    expect(error).toBeInstanceOf(ApiError)
    expect(error).toMatchObject({ status, code: 'algo', message: 'Mensaje del servidor' })
  })

  it('trata success:false con HTTP 200 como error', async () => {
    fetchMock.mockResolvedValue(json(200, { success: false, error: 'Ya existe en whitelist', code: 'conflict' }))
    await expect(api('add_whitelist')).rejects.toMatchObject({ status: 200, code: 'conflict', message: 'Ya existe en whitelist' })
  })

  it('da un mensaje por estado si el cuerpo no trae error', async () => {
    fetchMock.mockResolvedValue(json(403, { success: false }))
    await expect(api('x')).rejects.toMatchObject({ status: 403, message: 'No tienes permiso para hacer esto.' })
  })

  it('no revienta con una respuesta que no es JSON', async () => {
    fetchMock.mockResolvedValue(new Response('<html>502</html>', { status: 502 }))
    await expect(api('x')).rejects.toMatchObject({ status: 502, code: 'bad_response' })
  })

  it('401 avisa para mostrar el login', async () => {
    fetchMock.mockResolvedValue(json(401, { success: false, error: 'No autenticado', code: 'unauthorized' }))
    await expect(api('x')).rejects.toMatchObject({ status: 401 })
    expect(unauthorized).toHaveBeenCalledTimes(1)
    expect(csrf).not.toHaveBeenCalled()
  })

  it('403 csrf avisa para recargar', async () => {
    fetchMock.mockResolvedValue(json(403, { success: false, error: 'Token CSRF inválido', code: 'csrf' }))
    await expect(api('x')).rejects.toMatchObject({ code: 'csrf' })
    expect(csrf).toHaveBeenCalledTimes(1)
  })

  it('429 incluye el tiempo de espera del cuerpo o de Retry-After', async () => {
    fetchMock.mockResolvedValueOnce(json(429, { success: false, error: 'Límite', code: 'rate_limited', retry_after: 42 }))
    await expect(api('x')).rejects.toMatchObject({ retryAfter: 42, message: expect.stringContaining('42 s') })
    fetchMock.mockResolvedValueOnce(json(429, { success: false, code: 'rate_limited' }, { 'Retry-After': '7' }))
    await expect(api('x')).rejects.toMatchObject({ retryAfter: 7, message: expect.stringContaining('7 s') })
  })

  it('un fallo de red es ApiError con código network', async () => {
    fetchMock.mockRejectedValue(new TypeError('Failed to fetch'))
    await expect(api('x')).rejects.toMatchObject({ status: 0, code: 'network' })
  })

  it('una petición abortada se propaga como AbortError, no como ApiError', async () => {
    fetchMock.mockImplementation((_url, init) => new Promise((_resolve, reject) => {
      init?.signal?.addEventListener('abort', () => reject(new DOMException('Aborted', 'AbortError')))
    }))
    const controller = new AbortController()
    const pending = api('x', {}, { signal: controller.signal }).catch((e: unknown) => e)
    controller.abort()
    const error = await pending
    expect(isAbortError(error)).toBe(true)
    expect(error).not.toBeInstanceOf(ApiError)
  })
})
