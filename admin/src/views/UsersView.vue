<script setup lang="ts">
import { ref, onMounted } from 'vue'
import { useUsersStore } from '@/stores/users'
import { usePermissions } from '@/composables/usePermissions'
import { useToast } from '@/composables/useToast'
import DataTable from '@/components/shared/DataTable.vue'
import AdminUserModal from '@/components/modals/AdminUserModal.vue'
import { Plus, Trash2 } from 'lucide-vue-next'

const store = useUsersStore()
const { can } = usePermissions()
const toast = useToast()

const showModal = ref(false)
const confirmRemoveId = ref<number | null>(null)

const columns = [
  { key: 'discord_id', label: 'Discord ID' },
  { key: 'role', label: 'Rol' },
  { key: 'created_by', label: 'Añadido por' },
  { key: 'created_at', label: 'Fecha' },
  { key: 'actions', label: '' },
]

onMounted(() => {
  if (can('users')) {
    store.fetch()
  }
})

function openAddModal() {
  showModal.value = true
}

function onModalClose() {
  showModal.value = false
}

async function onModalSubmit() {
  showModal.value = false
  toast.success('Usuario añadido', 'El administrador ha sido añadido correctamente')
}

async function handleRemove(id: number) {
  if (confirmRemoveId.value !== id) {
    confirmRemoveId.value = id
    return
  }
  confirmRemoveId.value = null
  const success = await store.remove(id)
  if (success) {
    toast.success('Usuario eliminado', 'El administrador ha sido eliminado')
  } else {
    toast.error('Error', store.error ?? 'No se pudo eliminar el usuario')
  }
}

function formatDate(dateStr: string): string {
  if (!dateStr) return '-'
  return new Date(dateStr).toLocaleString('es-ES', {
    day: '2-digit',
    month: '2-digit',
    year: 'numeric',
    hour: '2-digit',
    minute: '2-digit',
  })
}

function roleBadgeClass(role: string): string {
  const map: Record<string, string> = {
    founder: 'bg-yellow-500/15 text-yellow-400',
    owner: 'bg-red-500/15 text-red-400',
    manager: 'bg-blue-500/15 text-blue-400',
    sradmin: 'bg-purple-500/15 text-purple-400',
    admin: 'bg-green-500/15 text-green-400',
  }
  return map[role] ?? 'bg-gray-500/15 text-gray-400'
}

function roleLabel(role: string): string {
  const map: Record<string, string> = {
    founder: 'Founder',
    owner: 'Owner',
    manager: 'Manager',
    sradmin: 'Sr. Admin',
    admin: 'Admin',
  }
  return map[role] ?? role
}

function discordAvatarUrl(discordId: string): string {
  return `https://cdn.discordapp.com/embed/avatars/${parseInt(discordId) % 5}.png`
}
</script>

<template>
  <div class="space-y-6">
    <!-- Page header -->
    <div class="flex flex-col sm:flex-row items-start sm:items-center justify-between gap-4">
      <div>
        <h1 class="text-2xl font-display font-bold gradient-text">Usuarios Admin</h1>
        <p class="text-sm text-text-muted mt-1">Gestiona los administradores del panel</p>
      </div>
      <button
        class="inline-flex items-center gap-2 px-4 py-2 rounded-lg bg-purple-500 hover:bg-purple-600 text-white text-sm font-medium transition-colors"
        @click="openAddModal"
      >
        <Plus :size="16" />
        Añadir administrador
      </button>
    </div>

    <!-- Users table -->
    <DataTable
      :columns="columns"
      :rows="store.users as unknown as Record<string, unknown>[]"
      :loading="store.loading"
      empty-message="No hay administradores registrados"
      @row-click="() => {}"
    >
      <template #cell-discord_id="{ row }">
        <div class="flex items-center gap-3">
          <img
            :src="discordAvatarUrl((row as any).discord_id)"
            alt=""
            class="w-8 h-8 rounded-full"
          />
          <span class="text-sm text-text-primary font-mono">{{ (row as any).discord_id }}</span>
        </div>
      </template>

      <template #cell-role="{ row }">
        <span
          class="inline-flex px-2 py-0.5 rounded text-xs font-semibold uppercase"
          :class="roleBadgeClass((row as any).role)"
        >
          {{ roleLabel((row as any).role) }}
        </span>
      </template>

      <template #cell-created_by="{ row }">
        <span class="text-sm text-text-secondary font-mono">{{ (row as any).created_by ?? '-' }}</span>
      </template>

      <template #cell-created_at="{ row }">
        <span class="text-xs text-text-muted font-mono">{{ formatDate((row as any).created_at) }}</span>
      </template>

      <template #cell-actions="{ row }">
        <button
          v-if="(row as any).role !== 'founder'"
          class="p-1.5 rounded-lg text-text-muted hover:text-red-400 hover:bg-red-500/10 transition-colors"
          :class="confirmRemoveId === (row as any).id ? 'text-red-400 bg-red-500/10' : ''"
          :title="confirmRemoveId === (row as any).id ? 'Click de nuevo para confirmar' : 'Eliminar'"
          @click.stop="handleRemove((row as any).id)"
        >
          <Trash2 :size="16" />
        </button>
      </template>
    </DataTable>

    <!-- Error display -->
    <p v-if="store.error && !store.loading" class="text-red-400 text-sm text-center">
      {{ store.error }}
    </p>

    <!-- Add user modal -->
    <AdminUserModal
      v-model="showModal"
      @close="onModalClose"
      @submit="onModalSubmit"
    />
  </div>
</template>
