<script setup lang="ts">
import { computed, ref } from 'vue'
import { ChevronUp, ChevronDown } from 'lucide-vue-next'
import LoadingSkeleton from './LoadingSkeleton.vue'
import EmptyState from './EmptyState.vue'

export interface Column {
  key: string
  label: string
  sortable?: boolean
}

const props = defineProps<{
  columns: Column[]
  rows: Record<string, unknown>[]
  loading?: boolean
  emptyMessage?: string
}>()

const emit = defineEmits<{
  rowClick: [row: Record<string, unknown>]
  sort: [key: string, direction: 'asc' | 'desc']
}>()

const sortKey = ref('')
const sortDir = ref<'asc' | 'desc'>('asc')

function handleSort(column: Column) {
  if (!column.sortable) return
  if (sortKey.value === column.key) {
    sortDir.value = sortDir.value === 'asc' ? 'desc' : 'asc'
  } else {
    sortKey.value = column.key
    sortDir.value = 'asc'
  }
  emit('sort', column.key, sortDir.value)
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
              :class="{ 'cursor-pointer hover:text-text-secondary transition-colors': col.sortable }"
              @click="handleSort(col)"
            >
              <span class="flex items-center gap-1.5">
                {{ col.label }}
                <span v-if="col.sortable" class="flex flex-col">
                  <ChevronUp
                    :size="10"
                    class="-mb-1 transition-colors"
                    :class="sortKey === col.key && sortDir === 'asc' ? 'text-purple-400' : ''"
                  />
                  <ChevronDown
                    :size="10"
                    class="-mt-1 transition-colors"
                    :class="sortKey === col.key && sortDir === 'desc' ? 'text-purple-400' : ''"
                  />
                </span>
              </span>
            </th>
          </tr>
        </thead>
        <tbody>
          <tr
            v-for="(row, idx) in rows"
            :key="idx"
            class="border-b border-glass-border-subtle/50 last:border-0 hover:bg-hover transition-all duration-150 cursor-pointer group"
            :style="{ animation: `row-enter 0.3s var(--ease-out-expo) ${idx * 0.03}s both` }"
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
