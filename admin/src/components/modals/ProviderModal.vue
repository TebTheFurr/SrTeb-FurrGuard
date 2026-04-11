<script setup lang="ts">
import { ref, watch } from 'vue'
import { useProvidersStore } from '@/stores/providers'
import BaseModal from '@/components/shared/BaseModal.vue'

const props = defineProps<{
  modelValue: boolean
}>()

const emit = defineEmits<{
  'update:modelValue': [value: boolean]
  close: []
  submit: []
}>()

const store = useProvidersStore()

const formName = ref('')
const formPattern = ref('')
const formType = ref('hosting')
const submitting = ref(false)

const providerTypes = [
  { id: 'hosting', label: 'Hosting' },
  { id: 'vpn', label: 'VPN' },
  { id: 'proxy', label: 'Proxy' },
]

watch(
  () => props.modelValue,
  (open) => {
    if (open) {
      formName.value = ''
      formPattern.value = ''
      formType.value = 'hosting'
    }
  },
)

async function handleSubmit() {
  if (!formName.value.trim() || !formPattern.value.trim()) return

  submitting.value = true
  const success = await store.add({
    name: formName.value.trim(),
    pattern: formPattern.value.trim(),
    type: formType.value,
  })

  submitting.value = false
  if (success) {
    emit('submit')
  }
}
</script>

<template>
  <BaseModal
    :model-value="modelValue"
    title="Añadir proveedor"
    size="md"
    @update:model-value="emit('update:modelValue', $event)"
  >
    <form class="space-y-4" @submit.prevent="handleSubmit">
      <!-- Name input -->
      <div>
        <label class="block text-xs text-text-muted uppercase tracking-wider mb-1">Nombre</label>
        <input
          v-model="formName"
          type="text"
          required
          class="w-full px-3 py-2 rounded-lg bg-dark-800 border border-glass-border-subtle text-text-primary text-sm focus:outline-none focus:border-purple-500"
          placeholder="Nombre del proveedor..."
        />
      </div>

      <!-- Pattern input -->
      <div>
        <label class="block text-xs text-text-muted uppercase tracking-wider mb-1">Patron</label>
        <input
          v-model="formPattern"
          type="text"
          required
          class="w-full px-3 py-2 rounded-lg bg-dark-800 border border-glass-border-subtle text-text-primary text-sm focus:outline-none focus:border-purple-500 font-mono"
          placeholder="Patron de coincidencia (ej: ovh, digitalocean)..."
        />
        <p class="text-xs text-text-muted mt-1">Se comparara con el ISP/ASN de las conexiones</p>
      </div>

      <!-- Type select -->
      <div>
        <label class="block text-xs text-text-muted uppercase tracking-wider mb-1">Tipo</label>
        <select
          v-model="formType"
          class="w-full px-3 py-2 rounded-lg bg-dark-800 border border-glass-border-subtle text-text-primary text-sm focus:outline-none focus:border-purple-500"
        >
          <option v-for="t in providerTypes" :key="t.id" :value="t.id">
            {{ t.label }}
          </option>
        </select>
      </div>

      <!-- Error display -->
      <p v-if="store.error" class="text-red-400 text-sm">{{ store.error }}</p>

      <!-- Actions -->
      <div class="flex items-center justify-end gap-3 pt-2">
        <button
          type="button"
          class="px-4 py-2 rounded-lg text-sm text-text-muted hover:text-text-primary transition-colors"
          @click="emit('close')"
        >
          Cancelar
        </button>
        <button
          type="submit"
          :disabled="submitting || !formName.trim() || !formPattern.trim()"
          class="px-4 py-2 rounded-lg bg-purple-500 hover:bg-purple-600 text-white text-sm font-medium transition-colors disabled:opacity-50"
        >
          {{ submitting ? 'Guardando...' : 'Añadir' }}
        </button>
      </div>
    </form>
  </BaseModal>
</template>
