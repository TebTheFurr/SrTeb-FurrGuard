import { onScopeDispose, ref, shallowRef } from 'vue'
import { api, isAbortError } from '@/api/client'

/**
 * Carga de un detalle para diálogos: cada carga vacía antes el dato anterior, así un fallo
 * nunca deja a la vista el registro de otra fila.
 */
export function useDetail<T>() {
  const data = shallowRef<T | null>(null)
  const loading = ref(false)
  const error = ref('')
  let controller: AbortController | null = null

  function cancel(): void {
    controller?.abort()
    controller = null
    loading.value = false
  }

  async function load(action: string, params: Record<string, unknown>): Promise<void> {
    cancel()
    const current = new AbortController()
    controller = current
    data.value = null
    error.value = ''
    loading.value = true
    try {
      const result = await api<T>(action, params, { signal: current.signal })
      if (controller === current) data.value = result
    } catch (e) {
      if (controller === current && !isAbortError(e)) error.value = e instanceof Error ? e.message : 'No se pudo cargar el detalle.'
    } finally {
      if (controller === current) {
        controller = null
        loading.value = false
      }
    }
  }

  onScopeDispose(cancel)

  return { data, loading, error, load, cancel }
}
