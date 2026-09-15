<script setup lang="ts">
import { reactive, ref, useId } from 'vue'
import IconTrash from '~icons/pixelarticons/trash'
import IconUserPlus from '~icons/pixelarticons/user-plus'
import IconUsers from '~icons/pixelarticons/users'
import { api } from '@/api/client'
import type { AdminUserRow, Role } from '@/api/types'
import { useBusy } from '@/composables/useBusy'
import { usePagedList } from '@/composables/usePagedList'
import { confirmAction } from '@/lib/confirm'
import { formatDateTime, timeAgo } from '@/lib/dates'
import { ROLE_LABELS } from '@/lib/labels'
import { toast } from '@/lib/toast'
import { useSession } from '@/stores/session'
import AppDialog from '@/components/ui/AppDialog.vue'
import ListFrame from '@/components/ui/ListFrame.vue'
import PageHeader from '@/components/ui/PageHeader.vue'

const ASSIGNABLE: Exclude<Role, 'founder'>[] = ['owner', 'manager', 'sradmin', 'admin']

const session = useSession()
const list = usePagedList<AdminUserRow, Record<string, string>>({ action: 'get_admin_users', filters: {}, legacyKey: 'users' })
const { busy, run } = useBusy()

const dialogOpen = ref(false)
const form = reactive({ discordId: '', role: 'admin' as Exclude<Role, 'founder'> })
const saving = ref(false)
const formError = ref('')
const ids = { discord: useId(), role: useId() }

function openDialog(): void {
  Object.assign(form, { discordId: '', role: 'admin' })
  formError.value = ''
  dialogOpen.value = true
}

async function submit(): Promise<void> {
  if (!/^\d{17,20}$/.test(form.discordId.trim())) {
    formError.value = 'El Discord ID son 17 a 20 dígitos (Ajustes de Discord → Avanzado → Modo desarrollador → Copiar ID).'
    return
  }
  saving.value = true
  formError.value = ''
  try {
    await api('add_admin_user', { discord_id: form.discordId.trim(), role: form.role })
    toast('Usuario añadido. Podrá entrar con su cuenta de Discord.', 'ok')
    dialogOpen.value = false
    await list.reload()
  } catch (e) {
    formError.value = e instanceof Error ? e.message : 'No se pudo añadir.'
  } finally {
    saving.value = false
  }
}

async function remove(row: AdminUserRow): Promise<void> {
  const ok = await confirmAction({ title: 'Quitar acceso', message: `${row.discord_username || row.discord_id} perderá el acceso y se cerrarán sus sesiones abiertas.`, confirmText: 'Quitar acceso', danger: true })
  if (ok && (await run(row.id, () => api('remove_admin_user', { id: row.id }), 'Acceso retirado.'))) await list.reload()
}
</script>

<template>
  <div>
    <PageHeader title="Usuarios" :icon="IconUsers" desc="Quién puede entrar al panel y con qué rol.">
      <button type="button" class="btn primary" @click="openDialog"><IconUserPlus aria-hidden="true" /> Añadir usuario</button>
    </PageHeader>

    <ListFrame :list="list" label="Usuarios del panel" :empty-icon="IconUsers" empty-title="No hay usuarios">
      <table class="tabla">
        <thead>
          <tr>
            <th scope="col">Usuario</th>
            <th scope="col">Discord ID</th>
            <th scope="col">Rol</th>
            <th scope="col">Añadido por</th>
            <th scope="col">Desde</th>
            <th scope="col" class="acciones"><span class="sr-only">Acciones</span></th>
          </tr>
        </thead>
        <tbody>
          <tr v-for="row in list.items" :key="row.id">
            <td>{{ row.discord_username || 'Aún no ha entrado' }}<span v-if="row.discord_id === session.user?.discord_id" class="sub-celda">Tú</span></td>
            <td class="mono">{{ row.discord_id }}</td>
            <td><span class="rango" :class="row.role">{{ ROLE_LABELS[row.role] ?? row.role }}</span></td>
            <td class="mono">{{ row.created_by || '—' }}</td>
            <td class="nowrap" :title="formatDateTime(row.created_at)">{{ timeAgo(row.created_at) }}</td>
            <td class="acciones">
              <button
                v-if="row.removable"
                type="button"
                class="btn ghost icono sm"
                :aria-label="`Quitar acceso a ${row.discord_username || row.discord_id}`"
                :aria-busy="busy === row.id"
                @click="remove(row)"
              >
                <IconTrash aria-hidden="true" />
              </button>
            </td>
          </tr>
        </tbody>
      </table>
    </ListFrame>

    <AppDialog :open="dialogOpen" :icon="IconUserPlus" title="Añadir usuario" @close="dialogOpen = false">
      <form class="modal-form" novalidate @submit.prevent="submit">
        <div class="modal-cuerpo">
          <div class="campo">
            <label :for="ids.discord">Discord ID</label>
            <input :id="ids.discord" v-model="form.discordId" class="input mono" inputmode="numeric" maxlength="20" required autofocus>
          </div>
          <div class="campo">
            <label :for="ids.role">Rol</label>
            <select :id="ids.role" v-model="form.role" class="select">
              <option v-for="role in ASSIGNABLE" :key="role" :value="role">{{ ROLE_LABELS[role] }}</option>
            </select>
            <p class="ayuda">Owner: todo salvo proveedores, ajustes y usuarios. Manager: jugadores, conexiones, IPs y listas. Sr. Admin y Admin: jugadores y listas, sin IPs.</p>
          </div>
          <p v-if="formError" class="form-error" role="alert">{{ formError }}</p>
        </div>
        <footer class="modal-pie">
          <button type="button" class="btn ghost" @click="dialogOpen = false">Cancelar</button>
          <button type="submit" class="btn primary" :aria-busy="saving" :disabled="saving">Añadir</button>
        </footer>
      </form>
    </AppDialog>
  </div>
</template>
