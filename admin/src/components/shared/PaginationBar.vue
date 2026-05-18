<script setup lang="ts">
import { computed } from 'vue'
import { ChevronLeft, ChevronRight } from 'lucide-vue-next'

const props = defineProps<{
  currentPage: number
  totalPages: number
  total: number
}>()

const emit = defineEmits<{
  pageChange: [page: number]
}>()

const pages = computed(() => {
  const total = props.totalPages
  const current = props.currentPage
  const delta = 2
  const range: number[] = []

  for (
    let i = Math.max(1, current - delta);
    i <= Math.min(total, current + delta);
    i++
  ) {
    range.push(i)
  }

  return range
})

function goTo(page: number) {
  if (page < 1 || page > props.totalPages || page === props.currentPage) return
  emit('pageChange', page)
}
</script>

<template>
  <div class="flex items-center justify-between px-4 py-3 text-sm">
    <span class="text-text-muted">
      Total: <span class="text-text-secondary font-medium tabular-nums">{{ total }}</span>
    </span>

    <div class="flex items-center gap-1">
      <button
        class="p-1.5 rounded-lg text-text-muted hover:text-text-primary hover:bg-hover transition-all duration-200 disabled:opacity-30 disabled:cursor-not-allowed active:scale-95"
        :disabled="currentPage <= 1"
        @click="goTo(currentPage - 1)"
      >
        <ChevronLeft :size="16" />
      </button>

      <template v-for="page in pages" :key="page">
        <button
          class="min-w-[32px] h-8 rounded-lg text-sm font-medium transition-all duration-200"
          :class="
            page === currentPage
              ? 'bg-purple-500/20 text-purple-400 shadow-[0_0_12px_rgba(139,92,246,0.15)]'
              : 'text-text-muted hover:text-text-primary hover:bg-hover'
          "
          @click="goTo(page)"
        >
          {{ page }}
        </button>
      </template>

      <button
        class="p-1.5 rounded-lg text-text-muted hover:text-text-primary hover:bg-hover transition-all duration-200 disabled:opacity-30 disabled:cursor-not-allowed active:scale-95"
        :disabled="currentPage >= totalPages"
        @click="goTo(currentPage + 1)"
      >
        <ChevronRight :size="16" />
      </button>
    </div>
  </div>
</template>
