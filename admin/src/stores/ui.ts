import { defineStore } from 'pinia'
import { ref, computed } from 'vue'

// -------------------------------------------
// Toast Types
// -------------------------------------------

export type ToastType = 'success' | 'error' | 'warning' | 'info'

export interface Toast {
  id: string
  type: ToastType
  title: string
  message: string
  duration: number
}

// -------------------------------------------
// UI Store
// -------------------------------------------

let toastCounter = 0

export const useUIStore = defineStore('ui', () => {
  // ---- State ----
  const toasts = ref<Toast[]>([])
  const activeModal = ref<string | null>(null)
  const modalData = ref<unknown>(null)
  const sidebarCollapsed = ref(false)
  const globalLoading = ref(false)

  // ---- Getters ----
  const isModalOpen = computed(() => activeModal.value !== null)

  // ---- Actions ----

  function showToast(
    type: ToastType,
    title: string,
    message: string,
    duration = 3000,
  ): void {
    const id = `toast-${++toastCounter}`
    const toast: Toast = { id, type, title, message, duration }
    toasts.value = [...toasts.value, toast]

    if (duration > 0) {
      setTimeout(() => hideToast(id), duration)
    }
  }

  function hideToast(id: string): void {
    toasts.value = toasts.value.filter((t) => t.id !== id)
  }

  function openModal(name: string, data: unknown = null): void {
    activeModal.value = name
    modalData.value = data
  }

  function closeModal(): void {
    activeModal.value = null
    modalData.value = null
  }

  function toggleSidebar(): void {
    sidebarCollapsed.value = !sidebarCollapsed.value
  }

  function setGlobalLoading(value: boolean): void {
    globalLoading.value = value
  }

  return {
    // State
    toasts,
    activeModal,
    modalData,
    sidebarCollapsed,
    globalLoading,
    // Getters
    isModalOpen,
    // Actions
    showToast,
    hideToast,
    openModal,
    closeModal,
    toggleSidebar,
    setGlobalLoading,
  }
})
