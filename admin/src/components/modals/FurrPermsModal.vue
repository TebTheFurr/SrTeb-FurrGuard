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
    title="Anadir a whitelist FurrPerms"
    size="md"
    @update:model-value="emit('update:modelValue', $event)"
  >
    <form class="space-y-5" @submit.prevent="handleSubmit">
      <!-- Nick input -->
      <div>
        <label class="block text-sm font-medium text-text-secondary mb-1.5">Nickname</label>
        <input
          v-model="formNick"
          type="text"
          required
          maxlength="16"
          class="glass-input w-full px-3 py-2 text-sm text-text-primary placeholder-text-muted focus:outline-none focus:border-purple-500/40"
          placeholder="Nickname del jugador..."
        />
      </div>

      <!-- UUID input -->
      <div>
        <label class="block text-sm font-medium text-text-secondary mb-1.5">UUID (opcional)</label>
        <input
          v-model="formUuid"
          type="text"
          class="glass-input w-full px-3 py-2 text-sm text-text-primary placeholder-text-muted focus:outline-none focus:border-purple-500/40 font-mono"
          placeholder="UUID del jugador (opcional)..."
        />
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
          :disabled="submitting || !formNick.trim()"
          class="glass-button px-4 py-2.5 text-sm disabled:opacity-50"
        >
          {{ submitting ? 'Guardando...' : 'Anadir' }}
        </button>
      </div>
    </form>
  </BaseModal>
</template>
