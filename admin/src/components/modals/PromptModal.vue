<script setup lang="ts">
import { ref, watch } from 'vue'
import BaseModal from '@/components/shared/BaseModal.vue'

const props = withDefaults(defineProps<{
  modelValue: boolean
  title: string
  message: string
  placeholder?: string
  defaultValue?: string
}>(), {
  placeholder: '',
  defaultValue: '',
})

const emit = defineEmits<{
  'update:modelValue': [value: boolean]
  confirm: [value: string]
  cancel: []
}>()

const inputValue = ref('')

watch(
  () => props.modelValue,
  (open) => {
    if (open) {
      inputValue.value = props.defaultValue
    }
  },
)
</script>

<template>
  <BaseModal
    :model-value="modelValue"
    :title="title"
    size="sm"
    @update:model-value="emit('update:modelValue', $event)"
  >
    <p class="text-sm text-text-secondary leading-relaxed mb-4">{{ message }}</p>

    <input
      v-model="inputValue"
      type="text"
      :placeholder="placeholder"
      class="w-full px-3 py-2 rounded-lg bg-dark-800 border border-glass-border-subtle text-text-primary text-sm focus:outline-none focus:border-purple-500"
      @keyup.enter="emit('confirm', inputValue); emit('update:modelValue', false)"
    />

    <div class="flex items-center justify-end gap-3 mt-6 pt-4 border-t border-glass-border-subtle">
      <button
        class="px-4 py-2 rounded-lg text-sm text-text-muted hover:text-text-primary transition-colors"
        @click="emit('cancel'); emit('update:modelValue', false)"
      >
        Cancelar
      </button>
      <button
        class="px-4 py-2 rounded-lg bg-purple-500 hover:bg-purple-600 text-white text-sm font-medium transition-colors disabled:opacity-50"
        @click="emit('confirm', inputValue); emit('update:modelValue', false)"
      >
        Confirmar
      </button>
    </div>
  </BaseModal>
</template>
