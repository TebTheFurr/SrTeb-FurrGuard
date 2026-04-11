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
    title="Añadir administrador"
    size="sm"
    @update:model-value="emit('update:modelValue', $event)"
  >
    <form class="space-y-4" @submit.prevent="handleSubmit">
      <!-- Discord ID input -->
      <div>
        <label class="block text-xs text-text-muted uppercase tracking-wider mb-1">Discord ID</label>
        <input
          v-model="formDiscordId"
          type="text"
          required
          class="w-full px-3 py-2 rounded-lg bg-dark-800 border border-glass-border-subtle text-text-primary text-sm font-mono focus:outline-none focus:border-purple-500"
          placeholder="123456789012345678"
        />
        <p class="text-xs text-text-muted mt-1">ID de Discord del usuario (17-20 digitos)</p>
      </div>

      <!-- Role select -->
      <div>
        <label class="block text-xs text-text-muted uppercase tracking-wider mb-1">Rol</label>
        <select
          v-model="formRole"
          class="w-full px-3 py-2 rounded-lg bg-dark-800 border border-glass-border-subtle text-text-primary text-sm focus:outline-none focus:border-purple-500"
        >
          <option v-for="role in ADMIN_ROLES" :key="role.id" :value="role.id">
            {{ role.label }}
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
          :disabled="submitting || !formDiscordId.trim()"
          class="px-4 py-2 rounded-lg bg-purple-500 hover:bg-purple-600 text-white text-sm font-medium transition-colors disabled:opacity-50"
        >
          {{ submitting ? 'Añadiendo...' : 'Añadir' }}
        </button>
      </div>
    </form>
  </BaseModal>
</template>
