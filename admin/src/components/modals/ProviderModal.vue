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
    title="Anadir proveedor"
    size="md"
    @update:model-value="emit('update:modelValue', $event)"
  >
    <form class="space-y-5" @submit.prevent="handleSubmit">
      <!-- Name input -->
      <div>
        <label class="block text-sm font-medium text-text-secondary mb-1.5">Nombre</label>
        <input
          v-model="formName"
          type="text"
          required
          class="glass-input w-full px-3 py-2 text-sm text-text-primary placeholder-text-muted focus:outline-none focus:border-purple-500/40"
          placeholder="Nombre del proveedor..."
        />
      </div>

      <!-- Pattern input -->
      <div>
        <label class="block text-sm font-medium text-text-secondary mb-1.5">Patron</label>
        <input
          v-model="formPattern"
          type="text"
          required
          class="glass-input w-full px-3 py-2 text-sm text-text-primary placeholder-text-muted focus:outline-none focus:border-purple-500/40 font-mono"
          placeholder="Patron de coincidencia (ej: ovh, digitalocean)..."
        />
        <p class="text-xs text-text-muted mt-1.5">Se comparara con el ISP/ASN de las conexiones</p>
      </div>

      <!-- Type select -->
      <div>
        <label class="block text-sm font-medium text-text-secondary mb-1.5">Tipo</label>
        <select
          v-model="formType"
          class="glass-input w-full px-3 py-2 text-sm text-text-primary focus:outline-none focus:border-purple-500/40"
        >
          <option v-for="t in providerTypes" :key="t.id" :value="t.id">
            {{ t.label }}
          </option>
        </select>
      </div>

      <!-- Error display -->
      <div v-if="store.error" class="flex items-center gap-2 p-3 rounded-xl bg-error-dim border border-red-500/15">
        <div class="w-1.5 h-1.5 rounded-full bg-red-400 animate-pulse"></div>
        <p class="text-red-400 text-sm">{{ store.error }}</p>
      </div>

      <!-- Actions -->
      <div class="flex items-center justify-end gap-3 pt-3 border-t border-glass-border-subtle">
        <button
          type="button"
          class="glass-button-secondary px-4 py-2.5 text-sm hover:text-text-primary"
          @click="emit('close')"
        >
          Cancelar
        </button>
        <button
          type="submit"
          :disabled="submitting || !formName.trim() || !formPattern.trim()"
          class="glass-button px-4 py-2.5 text-sm disabled:opacity-50"
        >
          {{ submitting ? 'Guardando...' : 'Anadir' }}
        </button>
      </div>
    </form>
  </BaseModal>
</template>
