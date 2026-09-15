<script setup lang="ts">
import { ref, watch } from 'vue'
import { useUsersStore } from '@/stores/users'
import BaseModal from '@/components/shared/BaseModal.vue'
import { ADMIN_ROLES } from '@/lib/constants'

const props = defineProps<{
  modelValue: boolean
}>()

const emit = defineEmits<{
  'update:modelValue': [value: boolean]
  close: []
  submit: []
}>()

const store = useUsersStore()

const formDiscordId = ref('')
const formRole = ref('admin')
const submitting = ref(false)

watch(
  () => props.modelValue,
  (open) => {
    if (open) {
      formDiscordId.value = ''
      formRole.value = 'admin'
    }
  },
)

async function handleSubmit() {
  if (!formDiscordId.value.trim()) return

  submitting.value = true
  const success = await store.add({
    discord_id: formDiscordId.value.trim(),
    role: formRole.value,
  })

  submitting.value = false
  if (success) {
    emit('submit')
    emit('update:modelValue', false)
  }
}
</script>

<template>
  <BaseModal
    :model-value="modelValue"
    title="Anadir administrador"
    size="sm"
    @update:model-value="emit('update:modelValue', $event)"
  >
    <form class="space-y-5" @submit.prevent="handleSubmit">
      <!-- Discord ID input -->
      <div>
        <label class="block text-sm font-medium text-text-secondary mb-1.5">Discord ID</label>
        <input
          v-model="formDiscordId"
          type="text"
          required
          class="glass-input w-full px-3 py-2 text-sm text-text-primary placeholder-text-muted focus:outline-none focus:border-purple-500/40 font-mono"
          placeholder="123456789012345678"
        />
        <p class="text-xs text-text-muted mt-1.5">ID de Discord del usuario (17-20 digitos)</p>
      </div>

      <!-- Role select -->
      <div>
        <label class="block text-sm font-medium text-text-secondary mb-1.5">Rol</label>
        <select
          v-model="formRole"
          class="glass-input w-full px-3 py-2 text-sm text-text-primary focus:outline-none focus:border-purple-500/40"
        >
          <option v-for="role in ADMIN_ROLES" :key="role.id" :value="role.id">
            {{ role.label }}
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
          :disabled="submitting || !formDiscordId.trim()"
          class="glass-button px-4 py-2.5 text-sm disabled:opacity-50"
        >
          {{ submitting ? 'Anadiendo...' : 'Anadir' }}
        </button>
      </div>
    </form>
  </BaseModal>
</template>
