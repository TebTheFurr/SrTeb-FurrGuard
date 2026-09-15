/*
 * Arranque sin router: si /verify.php inyectó window.__VERIFY_DATA__ se muestra la
 * verificación; si no, la landing. Todo lo de aquí es puro para poder probarlo.
 */

export type View = { kind: 'landing' } | { kind: 'verify'; data: VerifyData }

type Raw = Record<string, unknown>

const INVALID: VerifyData = {
  state: 'error',
  title: 'No se pudo cargar la verificación',
  message: 'La página recibió datos incompletos.',
  code: 'invalid_data',
}

/** Parámetros que no deben quedarse en el historial ni sobrevivir a una recarga (§3.4). */
const SENSITIVE_PARAMS = ['token', 'code', 'state'] as const

const isText = (value: unknown): value is string => typeof value === 'string'
const isFilled = (value: unknown): value is string => isText(value) && value.length > 0
const textOrNull = (value: unknown): string | null => (isFilled(value) ? value : null)

function parseConfirm(raw: Raw): VerifyData | null {
  const { csrf, token, minecraft_nick, request_ip, requested_at, token_expires_at } = raw
  if (
    !isFilled(csrf) || !isFilled(token) || !isFilled(minecraft_nick) || !isFilled(request_ip) ||
    !isFilled(requested_at) || !isFilled(token_expires_at)
  ) {
    return null
  }
  return {
    state: 'confirm',
    csrf,
    token,
    minecraft_nick,
    request_ip,
    request_country: textOrNull(raw.request_country),
    request_country_code: textOrNull(raw.request_country_code),
    requested_at,
    token_expires_at,
  }
}

/** Valida lo inyectado y copia solo los campos del contrato. Datos rotos → error, nunca la landing. */
export function resolveView(raw: unknown): View {
  if (raw === undefined || raw === null) return { kind: 'landing' }
  if (typeof raw !== 'object') return { kind: 'verify', data: INVALID }

  const input = raw as Raw
  const { title, message } = input
  let data: VerifyData | null = null

  if (input.state === 'confirm') {
    data = parseConfirm(input)
  } else if (input.state === 'success' && isFilled(title) && isText(message)) {
    data = { state: 'success', title, message }
  } else if (input.state === 'error' && isFilled(title) && isText(message)) {
    data = { state: 'error', title, message, code: isText(input.code) ? input.code : '' }
  }

  return { kind: 'verify', data: data ?? INVALID }
}

/** URL relativa sin los parámetros sensibles, o null si no había ninguno. */
export function scrubUrl(href: string): string | null {
  const url = new URL(href)
  const present = SENSITIVE_PARAMS.filter((key) => url.searchParams.has(key))
  if (present.length === 0) return null
  for (const key of present) url.searchParams.delete(key)
  return url.pathname + url.search + url.hash
}

export function applyScrub(
  location: Pick<Location, 'href'>,
  history: Pick<History, 'state' | 'replaceState'>,
): void {
  const clean = scrubUrl(location.href)
  if (clean !== null) history.replaceState(history.state, '', clean)
}
