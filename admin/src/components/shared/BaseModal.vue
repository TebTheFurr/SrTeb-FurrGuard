<script setup lang="ts">
import { onMounted, onUnmounted, watch } from 'vue'
import { X } from 'lucide-vue-next'

const props = withDefaults(defineProps<{
  modelValue: boolean
  title: string
  size?: 'sm' | 'md' | 'lg'
}>(), {
  size: 'md',
})

const emit = defineEmits<{
  'update:modelValue': [value: boolean]
}>()

const sizeClasses: Record<string, string> = {
  sm: 'max-w-md',
  md: 'max-w-lg',
  lg: 'max-w-2xl',
}

function close() {
  emit('update:modelValue', false)
}

function onOverlayClick(e: MouseEvent) {
  if (e.target === e.currentTarget) {
    close()
  }
}

function onKeydown(e: KeyboardEvent) {
  if (e.key === 'Escape') {
    close()
  }
}

watch(() => props.modelValue, (open) => {
  if (open) {
    document.addEventListener('keydown', onKeydown)
    document.body.style.overflow = 'hidden'
  } else {
    document.removeEventListener('keydown', onKeydown)
    document.body.style.overflow = ''
  }
})

onMounted(() => {
  if (props.modelValue) {
    document.addEventListener('keydown', onKeydown)
    document.body.style.overflow = 'hidden'
  }
})

onUnmounted(() => {
  document.removeEventListener('keydown', onKeydown)
  document.body.style.overflow = ''
})
</script>

<template>
  <Teleport to="body">
    <transition name="modal">
      <div
        v-if="modelValue"
        class="fixed inset-0 z-50 flex items-center justify-center p-4"
        @click="onOverlayClick"
      >
        <!-- Backdrop -->
        <div class="absolute inset-0 bg-black/60 backdrop-blur-sm"></div>

        <!-- Modal panel -->
        <div
          :class="sizeClasses[size]"
          class="relative w-full glass-modal p-6 animate-[modal-in_0.2s_ease-out]"
        >
          <!-- Header -->
          <div class="flex items-center justify-between mb-4">
            <h2 class="text-lg font-display font-semibold text-text-primary">
              {{ title }}
            </h2>
            <button
              class="p-1.5 rounded-lg text-text-muted hover:text-text-primary hover:bg-dark-600 transition-colors"
              @click="close"
            >
              <X :size="18" />
            </button>
          </div>

          <!-- Body slot -->
          <slot />

          <!-- Footer slot -->
          <div v-if="$slots.footer" class="mt-6 pt-4 border-t border-glass-border-subtle">
            <slot name="footer" />
          </div>
        </div>
      </div>
    </transition>
  </Teleport>
</template>

<style scoped>
.modal-enter-active,
.modal-leave-active {
  transition: opacity 0.2s ease;
}

.modal-enter-from,
.modal-leave-to {
  opacity: 0;
}
</style>
