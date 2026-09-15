import { ref } from 'vue'
import { toast, toastError } from '@/lib/toast'

/**
 * Ejecuta una mutación marcando qué elemento está ocupado. El aviso de éxito solo sale
 * cuando el servidor ha respondido bien; si falla se muestra su mensaje y devuelve false.
 */
export function useBusy() {
  const busy = ref<string | number | null>(null)

  async function run(key: string | number, action: () => Promise<unknown>, success?: string): Promise<boolean> {
    busy.value = key
    try {
      await action()
      if (success) toast(success, 'ok')
      return true
    } catch (error) {
      toastError(error)
      return false
    } finally {
      busy.value = null
    }
  }

  return { busy, run }
}
