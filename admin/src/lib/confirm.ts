import { shallowRef, type Component } from 'vue'

export interface ConfirmRequest {
  title: string
  message: string
  confirmText?: string
  danger?: boolean
  icon?: Component
}

interface PendingConfirm extends ConfirmRequest {
  resolve: (confirmed: boolean) => void
}

/** Un único diálogo de confirmación (ConfirmHost.vue) sustituye a window.confirm. */
export const pendingConfirm = shallowRef<PendingConfirm | null>(null)

export function confirmAction(request: ConfirmRequest): Promise<boolean> {
  pendingConfirm.value?.resolve(false)
  return new Promise((resolve) => {
    pendingConfirm.value = { ...request, resolve }
  })
}

export function settleConfirm(confirmed: boolean): void {
  const pending = pendingConfirm.value
  pendingConfirm.value = null
  pending?.resolve(confirmed)
}
