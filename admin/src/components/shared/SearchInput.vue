<script setup lang="ts">
import { ref, watch } from 'vue'
import { Search } from 'lucide-vue-next'

const props = withDefaults(defineProps<{
  modelValue: string
  placeholder?: string
}>(), {
  placeholder: 'Buscar...',
})

const emit = defineEmits<{
  'update:modelValue': [value: string]
}>()

const localValue = ref(props.modelValue)
let debounceTimer: ReturnType<typeof setTimeout> | null = null

watch(() => props.modelValue, (val) => {
  if (val !== localValue.value) {
    localValue.value = val
  }
})

function onInput(event: Event) {
  const value = (event.target as HTMLInputElement).value
  localValue.value = value

  if (debounceTimer) clearTimeout(debounceTimer)
  debounceTimer = setTimeout(() => {
    emit('update:modelValue', value)
  }, 300)
}
</script>

<template>
  <div class="relative">
    <Search :size="16" class="absolute left-3 top-1/2 -translate-y-1/2 text-text-muted" />
    <input
      type="text"
      :value="localValue"
      :placeholder="placeholder"
      class="w-full bg-dark-700 border border-glass-border-subtle rounded-lg pl-9 pr-4 py-2 text-sm text-text-primary placeholder-text-muted focus:outline-none focus:border-purple-500/50 transition-colors"
      @input="onInput"
    />
  </div>
</template>
