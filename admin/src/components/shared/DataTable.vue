<script setup lang="ts">
import { ChevronUp, ChevronDown } from 'lucide-vue-next'
import LoadingSkeleton from './LoadingSkeleton.vue'
import EmptyState from './EmptyState.vue'

export interface Column {
  key: string
  label: string
  sortable?: boolean
}

defineProps<{
  columns: Column[]
  rows: Record<string, unknown>[]
  loading?: boolean
  emptyMessage?: string
}>()

const emit = defineEmits<{
  rowClick: [row: Record<string, unknown>]
  sort: [key: string, direction: 'asc' | 'desc']
}>()

function handleSort(column: Column) {
  if (!column.sortable) return
  emit('sort', column.key, 'asc')
}
</script>

<template>
  <div class="glass-card overflow-hidden">
    <!-- Loading state -->
    <LoadingSkeleton v-if="loading" :rows="5" />

    <!-- Empty state -->
    <EmptyState
      v-else-if="rows.length === 0"
      title="Sin datos"
      :description="emptyMessage ?? 'No se encontraron resultados'"
      icon="Inbox"
    />

    <!-- Table -->
    <div v-else class="overflow-x-auto">
      <table class="w-full text-sm">
        <thead>
          <tr class="border-b border-glass-border-subtle">
            <th
              v-for="col in columns"
              :key="col.key"
              class="px-4 py-3 text-left text-xs font-semibold uppercase tracking-wider text-text-muted"
              :class="{ 'cursor-pointer hover:text-text-secondary': col.sortable }"
              @click="handleSort(col)"
            >
              <span class="flex items-center gap-1">
                {{ col.label }}
                <span v-if="col.sortable" class="flex flex-col">
                  <ChevronUp :size="10" class="-mb-1" />
                  <ChevronDown :size="10" class="-mt-1" />
                </span>
              </span>
            </th>
          </tr>
        </thead>
        <tbody>
          <tr
            v-for="(row, idx) in rows"
            :key="idx"
            class="border-b border-glass-border-subtle last:border-0 hover:bg-hover transition-colors cursor-pointer"
            @click="emit('rowClick', row)"
          >
            <td
              v-for="col in columns"
              :key="col.key"
              class="px-4 py-3 text-text-secondary"
            >
              <slot :name="`cell-${col.key}`" :row="row" :value="row[col.key]">
                {{ row[col.key] }}
              </slot>
            </td>
          </tr>
        </tbody>
      </table>
    </div>
  </div>
</template>
