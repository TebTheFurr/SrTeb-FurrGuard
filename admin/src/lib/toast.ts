import { shallowRef } from 'vue'
import { ApiError, isAbortError } from '@/api/client'

export type ToastTone = 'ok' | 'error' | 'info' | 'warn'

export interface Toast {
  id: number
  message: string
  tone: ToastTone
}
const MAX_VISIBLE = 4

export const toasts = shallowRef<Toast[]>([])
let sequence = 0

export function dismissToast(id: number): void {
  toasts.value = toasts.value.filter((t) => t.id !== id)
}

export function toast(message: string, tone: ToastTone = 'info'): void {
  const item: Toast = { id: ++sequence, message, tone }
  toasts.value = [...toasts.value.slice(-(MAX_VISIBLE - 1)), item]
  setTimeout(() => dismissToast(item.id), tone === 'error' ? 7000 : 4200)
}

/** Para los catch: el mensaje del servidor. Un 401 no avisa (el login ya lo explica). */
export function toastError(error: unknown, fallback = 'Algo ha fallado.'): void {
  if (isAbortError(error)) return
  if (error instanceof ApiError && error.status === 401) return
  toast(error instanceof Error && error.message ? error.message : fallback, 'error')
}
