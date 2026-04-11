<script setup lang="ts">
import { ref, onMounted, onUnmounted, watch } from 'vue'
import { SkinViewer, WalkingAnimation } from 'skinview3d'

const props = withDefaults(defineProps<{
  uuid: string
  width?: number
  height?: number
}>(), {
  width: 350,
  height: 450,
})

const canvasContainer = ref<HTMLDivElement | null>(null)
let viewer: SkinViewer | null = null

function initViewer() {
  if (!canvasContainer.value) return

  disposeViewer()

  viewer = new SkinViewer({
    canvas: document.createElement('canvas'),
    width: props.width,
    height: props.height,
    skin: `https://mc-heads.net/skin/${props.uuid}`,
  })

  canvasContainer.value.innerHTML = ''
  canvasContainer.value.appendChild(viewer.canvas)

  viewer.camera.position.set(0, 0, 55)
  viewer.autoRotate = true
  viewer.autoRotateSpeed = 1
  viewer.animation = new WalkingAnimation()
  viewer.animation.speed = 0.5
  viewer.controls.enableRotate = true
  viewer.controls.enableZoom = true
}

function disposeViewer() {
  if (viewer) {
    viewer.dispose()
    viewer = null
  }
}

watch(() => props.uuid, () => {
  if (props.uuid) initViewer()
})

onMounted(() => {
  if (props.uuid) initViewer()
})

onUnmounted(() => {
  disposeViewer()
})
</script>

<template>
  <div
    ref="canvasContainer"
    class="flex items-center justify-center w-full rounded-lg"
    :style="{ minHeight: `${height}px` }"
  >
    <div class="w-10 h-10 border-3 border-dark-600 border-t-purple-500 rounded-full animate-spin" />
  </div>
</template>
