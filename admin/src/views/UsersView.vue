<script setup lang="ts">
import { ref, onMounted } from 'vue'
import { useUsersStore } from '@/stores/users'
import { usePermissions } from '@/composables/usePermissions'
import { useToast } from '@/composables/useToast'
import DataTable from '@/components/shared/DataTable.vue'
import AdminUserModal from '@/components/modals/AdminUserModal.vue'
import { Plus, Trash2, Shield, Crown, UserCog, Star, User } from 'lucide-vue-next'

const store = useUsersStore()
const { can } = usePermissions()
const toast = useToast()

const showModal = ref(false)
const confirmRemoveId = ref<number | null>(null)

const columns = [
  { key: 'discord_id', label: 'Discord ID' },
  { key: 'role', label: 'Rol' },
  { key: 'created_by', label: 'Anadido por' },
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
  toast.success('Usuario anadido', 'El administrador ha sido anadido correctamente')
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
    founder: 'bg-yellow-500/15 text-yellow-400 border-yellow-500/20',
    owner: 'bg-red-500/15 text-red-400 border-red-500/20',
    manager: 'bg-blue-500/15 text-blue-400 border-blue-500/20',
    sradmin: 'bg-purple-500/15 text-purple-400 border-purple-500/20',
    admin: 'bg-green-500/15 text-green-400 border-green-500/20',
  }
  return map[role] ?? 'bg-gray-500/15 text-gray-400 border-gray-500/20'
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

function roleIcon(role: string) {
  const map: Record<string, typeof Crown> = {
    founder: Crown,
    owner: Star,
    manager: UserCog,
    sradmin: Shield,
    admin: User,
  }
  return map[role] ?? User
}

function roleDescription(role: string): string {
  const map: Record<string, string> = {
    founder: 'Acceso total',
    owner: 'Administracion completa',
    manager: 'Gestion de usuarios y configuracion',
    sradmin: 'Acceso avanzado al panel',
    admin: 'Acceso basico al panel',
  }
  return map[role] ?? 'Rol desconocido'
}

function discordAvatarUrl(discordId: string): string {
  return `https://cdn.discordapp.com/embed/avatars/${parseInt(discordId) % 5}.png`
}
</script>

<template>
  <div class="page-container">
    <!-- Page header -->
    <div class="section-header">
      <div>
        <h1 class="text-2xl font-display font-bold gradient-text">Usuarios Admin</h1>
        <p class="text-sm text-text-muted mt-1">Gestiona los administradores del panel</p>
      </div>
      <button
        class="glass-button inline-flex items-center gap-2 px-5 py-2.5 text-sm hover:shadow-[0_8px_30px_rgba(139,92,246,0.5)]"
        @click="openAddModal"
      >
        <Plus :size="16" />
        Anadir administrador
      </button>
    </div>

    <!-- User cards view on mobile, table on desktop -->
    <!-- Mobile card layout -->
    <div class="block lg:hidden space-y-3 stagger-children">
      <div
        v-for="user in store.users"
        :key="user.id"
        class="glass-card p-4"
      >
        <div class="flex items-start gap-3">
          <!-- Avatar -->
          <img
            :src="discordAvatarUrl(user.discord_id)"
            alt=""
            class="w-10 h-10 rounded-xl ring-2 ring-glass-border-subtle"
          />
          <div class="flex-1 min-w-0">
            <div class="flex items-center gap-2 mb-1">
              <span class="text-sm text-text-primary font-mono truncate">{{ user.discord_id }}</span>
              <span v-if="user.discord_username" class="text-xs text-text-muted">({{ user.discord_username }})</span>
            </div>
            <!-- Role badge -->
            <div class="flex items-center gap-2 mb-2">
              <span
                class="inline-flex items-center gap-1 px-2.5 py-1 rounded-lg text-xs font-semibold uppercase border"
                :class="roleBadgeClass(user.role)"
              >
                <component :is="roleIcon(user.role)" :size="10" />
                {{ roleLabel(user.role) }}
              </span>
            </div>
            <div class="flex items-center justify-between">
              <div class="text-xs text-text-muted">
                <span v-if="user.created_by" class="font-mono">por {{ user.created_by }}</span>
                <span class="ml-2">{{ formatDate(user.created_at) }}</span>
              </div>
              <button
                v-if="user.role !== 'founder'"
                class="p-1.5 rounded-lg transition-all duration-200"
                :class="confirmRemoveId === user.id
                  ? 'text-red-400 bg-red-500/15 border border-red-500/20'
                  : 'text-text-muted hover:text-red-400 hover:bg-red-500/10'"
                :title="confirmRemoveId === user.id ? 'Click para confirmar' : 'Eliminar'"
                @click="handleRemove(user.id)"
              >
                <Trash2 :size="14" />
              </button>
            </div>
          </div>
        </div>
      </div>

      <!-- Empty state for mobile -->
      <div v-if="!store.loading && store.users.length === 0" class="glass-card p-8 text-center">
        <User :size="32" class="text-text-tertiary mx-auto mb-3" />
        <p class="text-sm text-text-muted">No hay administradores registrados</p>
      </div>
    </div>

    <!-- Desktop table layout -->
    <div class="hidden lg:block">
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
              class="w-8 h-8 rounded-lg ring-1 ring-glass-border-subtle"
            />
            <span class="text-sm text-text-primary font-mono">{{ (row as any).discord_id }}</span>
            <span v-if="(row as any).discord_username" class="text-xs text-text-muted">({{ (row as any).discord_username }})</span>
          </div>
        </template>

        <template #cell-role="{ row }">
          <span
            class="inline-flex items-center gap-1.5 px-2.5 py-1 rounded-lg text-xs font-semibold uppercase border"
            :class="roleBadgeClass((row as any).role)"
          >
            <component :is="roleIcon((row as any).role)" :size="10" />
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
            class="p-1.5 rounded-lg transition-all duration-200"
            :class="confirmRemoveId === (row as any).id
              ? 'text-red-400 bg-red-500/15 border border-red-500/20'
              : 'text-text-muted hover:text-red-400 hover:bg-red-500/10'"
            :title="confirmRemoveId === (row as any).id ? 'Click de nuevo para confirmar' : 'Eliminar'"
            @click.stop="handleRemove((row as any).id)"
          >
            <Trash2 :size="16" />
          </button>
        </template>
      </DataTable>
    </div>

    <!-- Error display -->
    <p v-if="store.error && !store.loading" class="text-red-400 text-sm text-center py-2">
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
