import { useUIStore } from '@/stores/ui'
import type { ToastType } from '@/stores/ui'

/**
 * Convenience wrapper around the UI store toast actions.
 * Usage: const toast = useToast(); toast.success('Title', 'Message')
 */
export function useToast() {
  const ui = useUIStore()

  return {
    success: (title: string, message: string, duration?: number) =>
      ui.showToast('success', title, message, duration),
    error: (title: string, message: string, duration?: number) =>
      ui.showToast('error', title, message, duration),
    warning: (title: string, message: string, duration?: number) =>
      ui.showToast('warning', title, message, duration),
    info: (title: string, message: string, duration?: number) =>
      ui.showToast('info', title, message, duration),
    show: (type: ToastType, title: string, message: string, duration?: number) =>
      ui.showToast(type, title, message, duration),
    hide: (id: string) => ui.hideToast(id),
  }
}
