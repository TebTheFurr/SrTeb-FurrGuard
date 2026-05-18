<script setup lang="ts">
import { ref, watch, computed } from 'vue'
import { Search, X } from 'lucide-vue-next'

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
const focused = ref(false)
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

function clearValue() {
  localValue.value = ''
  emit('update:modelValue', '')
}

const hasValue = computed(() => localValue.value.length > 0)
</script>

<template>
  <div class="relative">
    <Search
      :size="16"
      class="absolute left-3 top-1/2 -translate-y-1/2 transition-colors duration-200"
      :class="focused ? 'text-purple-400' : 'text-text-muted'"
    />
    <input
      type="text"
      :value="localValue"
      :placeholder="placeholder"
      class="w-full glass-input pl-9 pr-4 py-2 text-sm text-text-primary placeholder-text-muted focus:outline-none focus:border-purple-500/40 focus:shadow-[0_0_0_1px_rgba(139,92,246,0.15)]"
      @input="onInput"
      @focus="focused = true"
      @blur="focused = false"
    />
    <button
      v-if="hasValue"
      class="absolute right-2 top-1/2 -translate-y-1/2 p-1 rounded text-text-muted hover:text-text-primary transition-colors"
      @click="clearValue"
    >
      <X :size="14" />
    </button>
  </div>
</template>
