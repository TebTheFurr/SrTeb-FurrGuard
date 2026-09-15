<script setup lang="ts">
/** Duración de un baneo en minutos (0 = permanente). Con `allowUnchanged`, null = «sin cambios». */
import { ref, watch } from 'vue'
import { DURATION_PRESETS } from '@/lib/entries'
import { minutesLabel } from '@/lib/format'

const MAX_MINUTES = 5_256_000 // 10 años

const props = withDefaults(defineProps<{ id: string; allowUnchanged?: boolean }>(), { allowUnchanged: false })
const model = defineModel<number | null>({ required: true })

function modeOf(value: number | null): string {
  if (value === null) return props.allowUnchanged ? 'unchanged' : '0'
  return DURATION_PRESETS.some((preset) => preset.minutes === value) ? String(value) : 'custom'
}

const mode = ref(modeOf(model.value))
const custom = ref(model.value && model.value > 0 ? model.value : 60)
const clamp = (value: number): number => Math.min(MAX_MINUTES, Math.max(1, Math.round(value || 1)))

watch([mode, custom], ([nextMode, minutes]) => {
  if (nextMode === 'unchanged') model.value = null
  else if (nextMode === 'custom') model.value = clamp(minutes)
  else model.value = Number(nextMode)
})
</script>

<template>
  <div class="duracion">
    <select :id="id" v-model="mode" class="select">
      <option v-if="allowUnchanged" value="unchanged">Sin cambios</option>
      <option v-for="preset in DURATION_PRESETS" :key="preset.minutes" :value="String(preset.minutes)">{{ preset.label }}</option>
      <option value="custom">Personalizada…</option>
    </select>
    <div v-if="mode === 'custom'" class="duracion-propia">
      <label :for="`${id}-minutos`" class="sr-only">Duración en minutos</label>
      <input :id="`${id}-minutos`" v-model.number="custom" class="input" type="number" min="1" :max="MAX_MINUTES" step="1" required>
      <span class="faint">min · {{ minutesLabel(clamp(custom)) }}</span>
    </div>
  </div>
</template>

<style scoped>
.duracion { display: grid; gap: 8px; }
.duracion-propia { display: flex; align-items: center; gap: 10px; }
.duracion-propia .input { width: 130px; }
</style>
