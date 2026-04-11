<script setup lang="ts">
import { ref, watch } from 'vue'
import { useFurrPermsStore } from '@/stores/furrperms'
import BaseModal from '@/components/shared/BaseModal.vue'

const props = defineProps<{
  modelValue: boolean
}>()

const emit = defineEmits<{
  'update:modelValue': [value: boolean]
  close: []
  submit: []
}>()

const store = useFurrPermsStore()

const formNick = ref('')
const formUuid = ref('')
const submitting = ref(false)

watch(
  () => props.modelValue,
  (open) => {
    if (open) {
      formNick.value = ''
      formUuid.value = ''
    }
  },
)

async function handleSubmit() {
  if (!formNick.value.trim()) return

  submitting.value = true
  const success = await store.addToWhitelist({
    nick: formNick.value.trim(),
    uuid: formUuid.value.trim(),
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
    title="Añadir a whitelist FurrPerms"
    size="md"
    @update:model-value="emit('update:modelValue', $event)"
  >
    <form class="space-y-4" @submit.prevent="handleSubmit">
      <!-- Nick input -->
      <div>
        <label class="block text-xs text-text-muted uppercase tracking-wider mb-1">Nickname</label>
        <input
          v-model="formNick"
          type="text"
          required
          maxlength="16"
          class="w-full px-3 py-2 rounded-lg bg-dark-800 border border-glass-border-subtle text-text-primary text-sm focus:outline-none focus:border-purple-500"
          placeholder="Nickname del jugador..."
        />
      </div>

      <!-- UUID input -->
      <div>
        <label class="block text-xs text-text-muted uppercase tracking-wider mb-1">UUID (opcional)</label>
        <input
          v-model="formUuid"
          type="text"
          class="w-full px-3 py-2 rounded-lg bg-dark-800 border border-glass-border-subtle text-text-primary text-sm focus:outline-none focus:border-purple-500 font-mono"
          placeholder="UUID del jugador (opcional)..."
        />
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
          :disabled="submitting || !formNick.trim()"
          class="px-4 py-2 rounded-lg bg-purple-500 hover:bg-purple-600 text-white text-sm font-medium transition-colors disabled:opacity-50"
        >
          {{ submitting ? 'Guardando...' : 'Añadir' }}
        </button>
      </div>
    </form>
  </BaseModal>
</template>
