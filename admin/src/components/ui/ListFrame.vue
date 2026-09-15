<script setup lang="ts">
/** Marco común de las listas paginadas: barra de filtros, carga, error, vacío y paginación. */
import { computed, useId, type Component } from 'vue'
import IconChevronLeft from '~icons/lucide/chevron-left'
import IconChevronRight from '~icons/lucide/chevron-right'
import IconReload from '~icons/pixelarticons/reload'
import IconWarningBox from '~icons/pixelarticons/warning-box'
import type { ApiError } from '@/api/client'
import type { Pagination } from '@/api/types'
import { PER_PAGE_OPTIONS } from '@/composables/usePagedList'
import { formatNumber } from '@/lib/format'
import EmptyState from './EmptyState.vue'

interface ListLike {
  items: readonly unknown[]
  pagination: Pagination
  loading: boolean
  error: ApiError | null
  perPage: number
  setPage: (page: number) => void
  setPerPage: (perPage: number) => void
  reload: () => Promise<void>
}

const props = withDefaults(
  defineProps<{ list: ListLike; label: string; emptyIcon?: Component; emptyTitle?: string; emptyText?: string }>(),
  { emptyIcon: undefined, emptyTitle: 'No hay nada que mostrar', emptyText: '' },
)

const perPageId = useId()
const page = computed(() => props.list.pagination.page)
const totalPages = computed(() => Math.max(1, props.list.pagination.total_pages))
const range = computed(() => {
  const { total, per_page: perPage } = props.list.pagination
  const from = total ? (page.value - 1) * perPage + 1 : 0
  return `${formatNumber(from)}–${formatNumber(Math.min(total, page.value * perPage))} de ${formatNumber(total)}`
})
</script>

<template>
  <section class="panel lista" :aria-label="label">
    <div v-if="$slots.toolbar" class="lista-barra"><slot name="toolbar" /></div>

    <div v-if="list.error && list.items.length" class="aviso down lista-aviso" role="alert">
      <IconWarningBox aria-hidden="true" />
      <span class="texto">{{ list.error.message }}</span>
      <button type="button" class="btn sm" @click="list.reload()">Reintentar</button>
    </div>

    <EmptyState v-if="list.error && !list.items.length" tone="error" title="No se pudo cargar" :text="list.error.message">
      <button type="button" class="btn" @click="list.reload()"><IconReload aria-hidden="true" /> Reintentar</button>
    </EmptyState>
    <div v-else-if="list.loading && !list.items.length" class="lista-carga" aria-busy="true">
      <span class="sr-only">Cargando…</span>
      <span v-for="n in 6" :key="n" class="esqueleto" />
    </div>
    <EmptyState v-else-if="!list.items.length" :icon="emptyIcon" :title="emptyTitle" :text="emptyText">
      <slot name="empty" />
    </EmptyState>
    <div v-else class="tabla-marco" :class="{ refrescando: list.loading }" :aria-busy="list.loading">
      <slot />
    </div>

    <footer v-if="list.pagination.total > 0" class="panel-pie paginacion">
      <span class="num">{{ range }}</span>
      <span class="spacer" />
      <label :for="perPageId" class="por-pagina">Por página</label>
      <select :id="perPageId" class="select sm" :value="list.perPage" @change="list.setPerPage(Number(($event.target as HTMLSelectElement).value))">
        <option v-for="n in PER_PAGE_OPTIONS" :key="n" :value="n">{{ n }}</option>
      </select>
      <button type="button" class="btn sm icono" :disabled="page <= 1" aria-label="Página anterior" @click="list.setPage(page - 1)">
        <IconChevronLeft aria-hidden="true" />
      </button>
      <span class="num" aria-live="polite">Página {{ page }} de {{ totalPages }}</span>
      <button type="button" class="btn sm icono" :disabled="page >= totalPages" aria-label="Página siguiente" @click="list.setPage(page + 1)">
        <IconChevronRight aria-hidden="true" />
      </button>
    </footer>
  </section>
</template>

<style scoped>
.lista-barra {
  display: flex;
  flex-wrap: wrap;
  align-items: center;
  gap: 10px 14px;
  padding: 12px 16px 0;
  border-bottom: 1px solid var(--rule);
}
.lista-barra :deep(.pestanas) { flex: 1 1 100%; border-bottom: 0; margin: 0 -6px; }
.lista-barra :deep(.buscador) { flex: 1 1 240px; max-width: 360px; margin-bottom: 12px; }
.lista-barra :deep(.select), .lista-barra :deep(.btn) { margin-bottom: 12px; }
.lista-barra :deep(.select) { width: auto; min-width: 150px; }
.lista-aviso { margin: 12px 16px 0; }
.lista-carga { display: grid; gap: 14px; padding: 22px 18px; }
.lista-carga .esqueleto:nth-child(3n) { width: 72%; }
.lista-carga .esqueleto:nth-child(3n + 1) { width: 88%; }
.paginacion .select.sm { width: auto; height: 28px; padding-right: 28px; background-position: calc(100% - 15px) 12px, calc(100% - 10px) 12px; }
.por-pagina { color: var(--ink-3); }
@media (max-width: 600px) {
  .paginacion .spacer, .por-pagina, .paginacion .select { display: none; }
}
</style>
