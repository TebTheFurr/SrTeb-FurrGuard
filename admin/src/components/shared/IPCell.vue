<script setup lang="ts">
import { ref, computed } from 'vue'
import { useUIStore } from '@/stores/ui'
import CountryFlag from './CountryFlag.vue'
import { Copy, Check } from 'lucide-vue-next'

const props = defineProps<{
  ip: string
  country?: string | null
  countryCode?: string | null
  isp?: string | null
}>()

const ui = useUIStore()
const copied = ref(false)

const revealed = computed(() => ui.ipsRevealed)

async function copyIP() {
  try {
    await navigator.clipboard.writeText(props.ip)
    copied.value = true
    setTimeout(() => { copied.value = false }, 1500)
  } catch {}
}
</script>

<template>
  <div class="flex items-center gap-2 group">
    <CountryFlag v-if="countryCode" :code="countryCode" />
    <span
      class="text-sm font-mono text-text-primary select-none transition-all duration-300 ease-out"
      :class="revealed ? 'blur-0 select-text' : 'blur-[5px]'"
    >{{ ip }}</span>
    <button
      class="p-0.5 rounded text-text-muted opacity-0 group-hover:opacity-100 hover:text-purple-400 transition-all duration-200"
      @click.stop="copyIP"
      title="Copiar IP"
    >
      <Check v-if="copied" :size="12" class="text-success" />
      <Copy v-else :size="12" />
    </button>
    <span v-if="isp" class="text-xs text-text-muted hidden lg:inline">({{ isp }})</span>
  </div>
</template>
