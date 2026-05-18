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
    <div class="space-y-5">
      <p class="text-sm text-text-secondary leading-relaxed">{{ message }}</p>

      <input
        v-model="inputValue"
        type="text"
        :placeholder="placeholder"
        class="glass-input w-full px-3 py-2 text-sm text-text-primary placeholder-text-muted focus:outline-none focus:border-purple-500/40"
        @keyup.enter="emit('confirm', inputValue); emit('update:modelValue', false)"
      />

      <div class="flex items-center justify-end gap-3 pt-4 border-t border-glass-border-subtle">
        <button
          class="glass-button-secondary px-4 py-2.5 text-sm hover:text-text-primary"
          @click="emit('cancel'); emit('update:modelValue', false)"
        >
          Cancelar
        </button>
        <button
          class="glass-button px-4 py-2.5 text-sm disabled:opacity-50"
          @click="emit('confirm', inputValue); emit('update:modelValue', false)"
        >
          Confirmar
        </button>
      </div>
    </div>
  </BaseModal>
</template>
