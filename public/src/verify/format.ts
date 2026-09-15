/* Formato de la verificación: fechas (el servidor habla en UTC, se muestra en Madrid), cuenta atrás y bandera. */

const UTC_PATTERN = /^(\d{4})-(\d{2})-(\d{2})[ T](\d{2}):(\d{2}):(\d{2})Z?$/

/** `YYYY-MM-DD HH:MM:SS` (UTC) → milisegundos; NaN si el formato o la fecha no son válidos. */
export function parseUtc(value: string): number {
  const match = UTC_PATTERN.exec(value)
  if (!match) return Number.NaN
  const [year, month, day, hour, minute, second] = match.slice(1).map(Number) as [
    number, number, number, number, number, number,
  ]
  const ms = Date.UTC(year, month - 1, day, hour, minute, second)
  const date = new Date(ms)
  // Date.UTC desborda (30 de febrero → 2 de marzo): se rechaza en vez de mostrar otra fecha
  const exact = date.getUTCFullYear() === year && date.getUTCMonth() === month - 1 && date.getUTCDate() === day
  return exact && hour < 24 && minute < 60 && second < 60 ? ms : Number.NaN
}

const madridParts = new Intl.DateTimeFormat('es-ES', {
  timeZone: 'Europe/Madrid',
  day: 'numeric',
  month: 'long',
  year: 'numeric',
  hour: '2-digit',
  minute: '2-digit',
  second: '2-digit',
  hourCycle: 'h23',
})

/** Se compone a mano desde formatToParts para no depender de los separadores de cada versión de ICU. */
export function formatMadrid(ms: number): string {
  if (!Number.isFinite(ms)) return '—'
  const part = Object.fromEntries(madridParts.formatToParts(ms).map((p) => [p.type, p.value]))
  return `${part.day} de ${part.month} de ${part.year} · ${part.hour}:${part.minute}:${part.second}`
}

/** Segundos enteros hasta caducar (0 = caducado). Una fecha ilegible cuenta como caducada. */
export function secondsLeft(expiresAtMs: number, nowMs: number): number {
  if (!Number.isFinite(expiresAtMs)) return 0
  return Math.max(0, Math.ceil((expiresAtMs - nowMs) / 1000))
}

export function formatCountdown(seconds: number): string {
  const total = Math.max(0, Math.floor(seconds))
  const hours = Math.floor(total / 3600)
  const minutes = Math.floor((total % 3600) / 60)
  const secs = String(total % 60).padStart(2, '0')
  return hours > 0 ? `${hours}:${String(minutes).padStart(2, '0')}:${secs}` : `${minutes}:${secs}`
}

export interface FlagImage { src: string; srcset: string }

/**
 * Bandera de flagcdn.com. Solo con un código ISO 3166-1 alfa-2 válido: el valor del servidor
 * nunca acaba tal cual en una URL. null → se muestra el icono genérico.
 */
export function flagImage(code: string | null): FlagImage | null {
  if (!code || !/^[A-Za-z]{2}$/.test(code)) return null
  const iso = code.toLowerCase()
  return { src: `https://flagcdn.com/20x15/${iso}.png`, srcset: `https://flagcdn.com/40x30/${iso}.png 2x` }
}
