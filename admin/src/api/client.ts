/**
 * Cliente de la API del panel (docs/API.md §4.2): POST JSON a /admin/api.php con cabecera
 * X-CSRF-Token y la cookie de sesión. Cualquier respuesta que no sea `{success: true}` se
 * convierte en ApiError leyendo `{error, code}` sea cual sea el estado HTTP.
 */

export const API_URL = '/admin/api.php'

export class ApiError extends Error {
  readonly status: number
  readonly code: string
  readonly retryAfter: number | null

  constructor(status: number, code: string, message: string, retryAfter: number | null = null) {
    super(message)
    this.name = 'ApiError'
    this.status = status
    this.code = code
    this.retryAfter = retryAfter
  }
}

export interface ApiHooks {
  /** 401: la sesión del panel ya no vale. */
  unauthorized?: (error: ApiError) => void
  /** 403 `csrf`: el token del documento ya no coincide con el de la sesión. */
  csrf?: (error: ApiError) => void
}

let csrfToken = ''
let hooks: ApiHooks = {}

export function configureApi(options: { csrfToken: string; hooks?: ApiHooks }): void {
  csrfToken = options.csrfToken
  hooks = options.hooks ?? {}
}

export function isAbortError(error: unknown): boolean {
  return typeof error === 'object' && error !== null && (error as { name?: unknown }).name === 'AbortError'
}

const FALLBACK_MESSAGES: Record<number, string> = {
  400: 'La petición no es válida.',
  401: 'Tu sesión ha caducado. Vuelve a iniciar sesión.',
  403: 'No tienes permiso para hacer esto.',
  404: 'No se ha encontrado lo que buscabas.',
  409: 'Ya existe un registro igual.',
  422: 'Hay datos que no son válidos.',
  429: 'Demasiadas peticiones.',
  500: 'Error interno del servidor.',
  502: 'El servidor no está disponible ahora mismo.',
  503: 'El servicio no está disponible ahora mismo.',
}

type JsonObject = Record<string, unknown>

const isObject = (value: unknown): value is JsonObject =>
  typeof value === 'object' && value !== null && !Array.isArray(value)

function retryAfterOf(response: Response, body: JsonObject): number | null {
  const fromBody = Number(body.retry_after)
  if (Number.isFinite(fromBody) && fromBody > 0) return Math.ceil(fromBody)
  const fromHeader = Number(response.headers.get('Retry-After'))
  return Number.isFinite(fromHeader) && fromHeader > 0 ? Math.ceil(fromHeader) : null
}

function errorFrom(response: Response, body: unknown): ApiError {
  const status = response.status
  if (!isObject(body)) {
    return new ApiError(status, 'bad_response', `El servidor respondió de forma inesperada (HTTP ${status}).`)
  }
  const serverMessage = typeof body.error === 'string' && body.error.trim() ? body.error.trim() : null
  const code = typeof body.code === 'string' && body.code ? body.code : status === 401 ? 'unauthorized' : 'error'

  if (status === 429) {
    const wait = retryAfterOf(response, body)
    const message = wait
      ? `Demasiadas peticiones: espera ${wait} s y vuelve a intentarlo.`
      : serverMessage ?? 'Demasiadas peticiones: espera un momento y vuelve a intentarlo.'
    return new ApiError(status, code, message, wait)
  }
  const message = serverMessage ?? FALLBACK_MESSAGES[status] ?? 'No se pudo completar la operación.'
  return new ApiError(status, code, message)
}

export async function api<T>(
  action: string,
  params: Record<string, unknown> = {},
  options: { signal?: AbortSignal } = {},
): Promise<T> {
  let response: Response
  try {
    response = await fetch(API_URL, {
      method: 'POST',
      credentials: 'same-origin',
      headers: {
        'Content-Type': 'application/json',
        Accept: 'application/json',
        'X-CSRF-Token': csrfToken,
      },
      // `action` va al final: ningún parámetro puede sustituirla
      body: JSON.stringify({ ...params, action }),
      signal: options.signal,
    })
  } catch (error) {
    if (isAbortError(error)) throw error
    throw new ApiError(0, 'network', 'No se pudo conectar con el servidor. Revisa tu conexión.')
  }

  const text = await response.text()
  let body: unknown = null
  try {
    body = text ? JSON.parse(text) : null
  } catch {
    body = null
  }

  if (response.ok && isObject(body) && body.success === true) {
    return (body.data ?? null) as T
  }

  const error = errorFrom(response, body)
  if (error.status === 401) hooks.unauthorized?.(error)
  else if (error.status === 403 && error.code === 'csrf') hooks.csrf?.(error)
  throw error
}
