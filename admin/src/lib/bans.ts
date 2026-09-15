import IconCancel from '~icons/pixelarticons/cancel'
import IconClock from '~icons/pixelarticons/clock'
import IconHourglass from '~icons/pixelarticons/hourglass'
import IconInfinity from '~icons/pixelarticons/infinity'
import IconPause from '~icons/pixelarticons/pause'
import type { Flag } from '@/api/types'
import { formatDateTime, isPast, timeAgo } from './dates'
import { isOn } from './format'
import type { Label } from './labels'

export function banStatus(active: Flag, expiresAt: string | null): Label {
  if (!isOn(active)) return { label: 'Inactivo', icon: IconPause, tone: 'tenue' }
  if (expiresAt && isPast(expiresAt)) return { label: 'Expirado', icon: IconClock, tone: 'warn' }
  return { label: 'Activo', icon: IconCancel, tone: 'down' }
}

export function banExpiry(expiresAt: string | null): Label & { title?: string } {
  if (!expiresAt) return { label: 'Permanente', icon: IconInfinity, tone: 'tenue' }
  return { label: timeAgo(expiresAt), icon: IconHourglass, tone: 'tenue', title: formatDateTime(expiresAt) }
}
