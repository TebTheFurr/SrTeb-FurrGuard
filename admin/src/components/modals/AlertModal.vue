<script setup lang="ts">
import { computed } from 'vue'
import BaseModal from '@/components/shared/BaseModal.vue'
import { Info, CheckCircle2, AlertTriangle, AlertCircle } from 'lucide-vue-next'

const props = withDefaults(defineProps<{
  modelValue: boolean
  title: string
  message: string
  variant?: 'info' | 'success' | 'warning' | 'error'
}>(), {
  variant: 'info',
})

const emit = defineEmits<{
  'update:modelValue': [value: boolean]
}>()

const okClasses = computed(() => {
  const map: Record<string, string> = {
    info: 'glass-button',
    success: 'bg-green-500 hover:bg-green-600 text-white px-5 py-2.5 rounded-xl text-sm font-semibold transition-all duration-200 shadow-[0_4px_20px_rgba(34,197,94,0.3)]',
    warning: 'bg-amber-500 hover:bg-amber-600 text-white px-5 py-2.5 rounded-xl text-sm font-semibold transition-all duration-200 shadow-[0_4px_20px_rgba(245,158,11,0.3)]',
    error: 'glass-button-danger',
  }
  return map[props.variant] ?? map.info
})

const iconStyles = computed(() => {
  const map: Record<string, { icon: string; classes: string }> = {
    info: { icon: 'info', classes: 'text-purple-400 bg-purple-500/10 border-purple-500/20' },
    success: { icon: 'success', classes: 'text-green-400 bg-green-500/10 border-green-500/20' },
    warning: { icon: 'warning', classes: 'text-amber-400 bg-amber-500/10 border-amber-500/20' },
    error: { icon: 'error', classes: 'text-red-400 bg-red-500/10 border-red-500/20' },
  }
  return map[props.variant] ?? map.info
})
</script>

<template>
  <BaseModal
    :model-value="modelValue"
    :title="title"
    size="sm"
    @update:model-value="emit('update:modelValue', $event)"
  >
    <div class="space-y-5">
      <!-- Variant icon -->
      <div class="flex justify-center">
        <div
          class="w-14 h-14 rounded-2xl flex items-center justify-center border backdrop-blur-sm"
          :class="iconStyles.classes"
        >
          <Info v-if="iconStyles.icon === 'info'" :size="28" />
          <CheckCircle2 v-else-if="iconStyles.icon === 'success'" :size="28" />
          <AlertTriangle v-else-if="iconStyles.icon === 'warning'" :size="28" />
          <AlertCircle v-else :size="28" />
        </div>
      </div>

      <p class="text-sm text-text-secondary leading-relaxed text-center">{{ message }}</p>

      <div class="flex items-center justify-end gap-3 pt-4 border-t border-glass-border-subtle">
        <button
          class="px-5 py-2.5 rounded-xl text-sm font-semibold transition-all duration-200"
          :class="okClasses"
          @click="emit('update:modelValue', false)"
        >
          OK
        </button>
      </div>
    </div>
  </BaseModal>
</template>
