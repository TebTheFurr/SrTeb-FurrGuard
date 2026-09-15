import { computed, type WritableComputedRef } from 'vue'
import { useRoute, useRouter } from 'vue-router'

/** Pestaña activa guardada en `?tab=`: al volver atrás o recargar se conserva. */
export function useQueryTab<V extends string>(values: readonly V[], fallback: V): WritableComputedRef<V> {
  const route = useRoute()
  const router = useRouter()
  return computed<V>({
    get: () => {
      const tab = route.query.tab
      return typeof tab === 'string' && (values as readonly string[]).includes(tab) ? (tab as V) : fallback
    },
    set: (value) => {
      void router.replace({ query: { ...route.query, tab: value === fallback ? undefined : value } })
    },
  })
}
