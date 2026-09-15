<script setup lang="ts">
import { RouterView } from 'vue-router'
import { gsap } from 'gsap'
import ToastNotification from '@/components/shared/ToastNotification.vue'
import { useUIStore } from '@/stores/ui'

const ui = useUIStore()

function onBeforeEnter(el: Element) {
  gsap.set(el, {
    opacity: 0,
    y: 16,
    scale: 0.98,
    filter: 'blur(4px)',
  })
}

function onEnter(el: Element, done: () => void) {
  gsap.to(el, {
    opacity: 1,
    y: 0,
    scale: 1,
    filter: 'blur(0px)',
    duration: 0.4,
    ease: 'power3.out',
    onComplete: done,
  })
}

function onLeave(el: Element, done: () => void) {
  gsap.to(el, {
    opacity: 0,
    y: -8,
    scale: 0.99,
    filter: 'blur(2px)',
    duration: 0.25,
    ease: 'power2.in',
    onComplete: done,
  })
}
</script>

<template>
  <RouterView v-slot="{ Component }">
    <Transition
      :css="false"
      mode="out-in"
      @before-enter="onBeforeEnter"
      @enter="onEnter"
      @leave="onLeave"
    >
      <component :is="Component" />
    </Transition>
  </RouterView>
  <div id="toast-container" class="fixed bottom-4 right-4 z-50 flex flex-col gap-2">
    <ToastNotification
      v-for="toast in ui.toasts"
      :key="toast.id"
      :toast="toast"
      @close="ui.hideToast(toast.id)"
    />
  </div>
</template>
