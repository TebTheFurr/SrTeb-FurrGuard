<script setup lang="ts">
import { RouterView } from 'vue-router'
import { gsap } from 'gsap'
import ToastNotification from '@/components/shared/ToastNotification.vue'
import { useUIStore } from '@/stores/ui'

const ui = useUIStore()

function onBeforeEnter(el: Element) {
  gsap.set(el, { opacity: 0, y: 10 })
}

function onEnter(el: Element, done: () => void) {
  gsap.to(el, {
    opacity: 1,
    y: 0,
    duration: 0.3,
    ease: 'power2.out',
    onComplete: done,
  })
}

function onLeave(el: Element, done: () => void) {
  gsap.to(el, {
    opacity: 0,
    y: -10,
    duration: 0.2,
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
