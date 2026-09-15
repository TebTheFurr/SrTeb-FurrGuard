<script setup lang="ts">
import { ref, onMounted, onUnmounted, watch } from 'vue'

const props = withDefaults(defineProps<{
  uuid: string
  width?: number
  height?: number
}>(), {
  width: 350,
  height: 450,
})

const canvasContainer = ref<HTMLDivElement | null>(null)
const hasError = ref(false)
let viewer: any = null

async function initViewer() {
  if (!canvasContainer.value) return

  disposeViewer()
  hasError.value = false

  try {
    const { SkinViewer, WalkingAnimation } = await import('skinview3d')

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
  } catch (e) {
    console.warn('SkinViewer failed to initialize:', e)
    hasError.value = true
  }
}

function disposeViewer() {
  if (viewer) {
    try { viewer.dispose() } catch {}
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
  <div class="glass-card p-4">
    <div
      ref="canvasContainer"
      class="flex items-center justify-center w-full rounded-lg"
      :style="{ minHeight: `${height}px` }"
    >
      <div v-if="hasError" class="text-center">
        <img
          :src="`https://mc-heads.net/avatar/${uuid}/${Math.min(width!, 128)}`"
          :alt="uuid"
          class="rounded-lg"
          :style="{ width: `${Math.min(width!, 128)}px`, height: `${Math.min(width!, 128)}px` }"
        />
        <p class="text-xs text-text-muted mt-2">Vista 3D no disponible</p>
      </div>
      <div v-else class="w-10 h-10 border-[3px] border-dark-600 border-t-purple-500 rounded-full animate-spin" />
    </div>
  </div>
</template>
