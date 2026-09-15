import type { Health } from '@/api/types'

const numbers = new Intl.NumberFormat('es-ES')

export const isOn = (value: unknown): boolean => value === true || value === 1 || value === '1'

export function toNum(value: unknown): number {
  const n = Number(value)
  return Number.isFinite(n) ? n : 0
}

export const formatNumber = (value: unknown): string => numbers.format(toNum(value))

/** 90 → «1 h 30 min», 0 → «permanente». */
export function minutesLabel(minutes: number): string {
  if (minutes <= 0) return 'permanente'
  const days = Math.floor(minutes / 1440)
  const hours = Math.floor((minutes % 1440) / 60)
  const mins = minutes % 60
  return [days && `${days} d`, hours && `${hours} h`, mins && `${mins} min`].filter(Boolean).join(' ')
}

export const secondsLabel = (seconds: number): string =>
  seconds < 60 ? `${seconds} s` : minutesLabel(Math.round(seconds / 60))

export type Tone = 'ok' | 'warn' | 'down'

/** Tono global del panel (línea de pulso): sin API key o sin ningún dato de geolocalización → down. */
export function healthTone(health: Health): Tone {
  if (!health.api_key_configured) return 'down'
  if (health.ip_api === 'down' && health.geo_mirror !== 'ok') return 'down'
  if (health.ip_api !== 'ok' || health.geo_mirror === 'missing') return 'warn'
  return 'ok'
}

export const initials = (name: string): string => name.trim().slice(0, 1).toUpperCase() || '?'

/** Solo avatares de Discord por https (la CSP solo permite cdn.discordapp.com). */
export function discordAvatar(discordId: string, avatar: string | null): string | null {
  if (!avatar) return null
  if (avatar.startsWith('https://cdn.discordapp.com/')) return avatar
  if (/^(a_)?[0-9a-f]{32}$/i.test(avatar) && /^\d{17,20}$/.test(discordId)) {
    return `https://cdn.discordapp.com/avatars/${discordId}/${avatar}.png?size=64`
  }
  return null
}

export async function copyText(text: string): Promise<boolean> {
  try {
    await navigator.clipboard.writeText(text)
    return true
  } catch {
    return false
  }
}
