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
  <div class="flex items-center gap-1 p-1 rounded-lg border border-glass-border-subtle bg-glass-medium/50 backdrop-blur-sm">
    <button
      v-for="filter in filters"
      :key="filter.id"
      class="px-3 py-1.5 rounded-md text-sm font-medium transition-all duration-200 relative"
      :class="
        modelValue === filter.id
          ? 'bg-purple-500/15 text-purple-400 shadow-sm'
          : 'text-text-muted hover:text-text-secondary hover:bg-hover'
      "
      @click="emit('update:modelValue', filter.id)"
    >
      <span class="relative z-10">{{ filter.label }}</span>
      <div
        v-if="modelValue === filter.id"
        class="absolute bottom-0 left-2 right-2 h-0.5 gradient-primary rounded-full"
      ></div>
    </button>
  </div>
</template>
