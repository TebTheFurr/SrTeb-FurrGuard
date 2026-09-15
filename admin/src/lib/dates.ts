/**
 * El servidor guarda y envía todo en UTC con el formato `YYYY-MM-DD HH:MM:SS` sin zona
 * (docs/API.md §0). Aquí se interpreta como UTC y se muestra en hora de Madrid.
 */

const ZONE = 'Europe/Madrid'
const UTC_FORMAT = /^(\d{4})-(\d{2})-(\d{2})[ T](\d{2}):(\d{2})(?::(\d{2}))?/

const dateTime = new Intl.DateTimeFormat('es-ES', {
  timeZone: ZONE,
  day: '2-digit',
  month: '2-digit',
  year: 'numeric',
  hour: '2-digit',
  minute: '2-digit',
})
const dateOnly = new Intl.DateTimeFormat('es-ES', { timeZone: ZONE, day: 'numeric', month: 'short', year: 'numeric' })
const relative = new Intl.RelativeTimeFormat('es', { numeric: 'auto' })

const STEPS: [Intl.RelativeTimeFormatUnit, number][] = [
  ['second', 60],
  ['minute', 60],
  ['hour', 24],
  ['day', 30],
  ['month', 12],
  ['year', Number.POSITIVE_INFINITY],
]

type Input = string | null | undefined

export function parseUtc(value: Input): Date | null {
  if (!value) return null
  const match = UTC_FORMAT.exec(value)
  if (!match) return null
  const [, year, month, day, hour, minute, second] = match
  const time = Date.UTC(Number(year), Number(month) - 1, Number(day), Number(hour), Number(minute), Number(second ?? 0))
  return Number.isNaN(time) ? null : new Date(time)
}

export function formatDateTime(value: Input): string {
  const date = parseUtc(value)
  return date ? dateTime.format(date) : '—'
}

export function formatDate(value: Input): string {
  const date = parseUtc(value)
  return date ? dateOnly.format(date) : '—'
}

/** «hace 5 minutos», «ayer», «dentro de 2 horas». */
export function timeAgo(value: Input, now: number = Date.now()): string {
  const date = parseUtc(value)
  if (!date) return '—'
  let diff = (date.getTime() - now) / 1000
  // Unos segundos de desfase entre el reloj del servidor y el del navegador no son «el futuro»
  if (Math.abs(diff) < 45) return 'ahora mismo'
  for (const [unit, size] of STEPS) {
    const rounded = Math.round(diff)
    if (Math.abs(rounded) < size) return relative.format(rounded, unit)
    diff /= size
  }
  return '—'
}

export function isPast(value: Input, now: number = Date.now()): boolean {
  const date = parseUtc(value)
  return date !== null && date.getTime() <= now
}
