<script setup lang="ts">
defineProps<{
  filters: ReadonlyArray<{ id: string; label: string }>
  modelValue: string
}>()

const emit = defineEmits<{
  'update:modelValue': [value: string]
}>()
</script>

<template>
  <div class="flex items-center gap-1 p-1 bg-dark-700 rounded-lg border border-glass-border-subtle">
    <button
      v-for="filter in filters"
      :key="filter.id"
      class="px-3 py-1.5 rounded-md text-sm font-medium transition-all duration-200"
      :class="
        modelValue === filter.id
          ? 'bg-purple-500/20 text-purple-400 shadow-sm'
          : 'text-text-muted hover:text-text-secondary'
      "
      @click="emit('update:modelValue', filter.id)"
    >
      {{ filter.label }}
    </button>
  </div>
</template>
