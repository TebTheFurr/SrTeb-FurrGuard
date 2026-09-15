<script setup lang="ts">
import { reactive, ref, useId } from 'vue'
import IconTrash from '~icons/pixelarticons/trash'
import IconUserPlus from '~icons/pixelarticons/user-plus'
import IconUsers from '~icons/pixelarticons/users'
import { api } from '@/api/client'
import type { StaffRow } from '@/api/types'
import { useBusy } from '@/composables/useBusy'
import { usePagedList } from '@/composables/usePagedList'
import { confirmAction } from '@/lib/confirm'
import { formatDateTime, timeAgo } from '@/lib/dates'
import { toast } from '@/lib/toast'
import AppDialog from '@/components/ui/AppDialog.vue'
import ListFrame from '@/components/ui/ListFrame.vue'
import PlayerHead from '@/components/ui/PlayerHead.vue'
import SearchBox from '@/components/ui/SearchBox.vue'

const emit = defineEmits<{ changed: [] }>()

const list = usePagedList<StaffRow, { search: string }>({ action: 'furrsecurity_get_staff', filters: { search: '' }, prefix: 'staff_', legacyKey: 'staff' })
const { busy, run } = useBusy()

const dialogOpen = ref(false)
const form = reactive({ discordId: '', nick: '' })
const saving = ref(false)
const formError = ref('')
const ids = { discord: useId(), nick: useId() }

function openDialog(): void {
  Object.assign(form, { discordId: '', nick: '' })
  formError.value = ''
  dialogOpen.value = true
}

async function submit(): Promise<void> {
  if (!/^\d{17,20}$/.test(form.discordId.trim()) || !/^[A-Za-z0-9_]{1,16}$/.test(form.nick.trim())) {
    formError.value = 'Escribe un Discord ID de 17-20 dígitos y un nick de Minecraft válido.'
    return
  }
  saving.value = true
  formError.value = ''
  try {
    await api('furrsecurity_add_staff', { discord_id: form.discordId.trim(), minecraft_nick: form.nick.trim() })
    toast(`${form.nick.trim()} añadido al staff verificado.`, 'ok')
    dialogOpen.value = false
    emit('changed')
    await list.reload()
  } catch (e) {
    formError.value = e instanceof Error ? e.message : 'No se pudo añadir.'
  } finally {
    saving.value = false
  }
}

async function remove(row: StaffRow): Promise<void> {
  const ok = await confirmAction({ title: 'Quitar del staff', message: `${row.minecraft_nick} dejará de poder verificarse.`, confirmText: 'Quitar', danger: true })
  if (ok && (await run(row.id, () => api('furrsecurity_remove_staff', { id: row.id }), 'Quitado del staff.'))) {
    emit('changed')
    await list.reload()
  }
}
</script>

<template>
  <ListFrame :list="list" label="Staff de FurrSecurity" :empty-icon="IconUsers" empty-title="No hay staff registrado">
    <template #toolbar>
      <SearchBox v-model="list.filters.search" label="Buscar staff" placeholder="Nick o Discord ID…" />
      <span class="spacer" />
      <button type="button" class="btn primary" @click="openDialog"><IconUserPlus aria-hidden="true" /> Añadir staff</button>
    </template>

    <table class="tabla">
      <thead>
        <tr>
          <th scope="col">Nick</th>
          <th scope="col">Discord ID</th>
          <th scope="col">Añadido por</th>
          <th scope="col">Fecha</th>
          <th scope="col" class="acciones"><span class="sr-only">Acciones</span></th>
        </tr>
      </thead>
      <tbody>
        <tr v-for="row in list.items" :key="row.id">
          <td><span class="row"><PlayerHead :id="row.minecraft_nick" :name="row.minecraft_nick" /><b>{{ row.minecraft_nick }}</b></span></td>
          <td class="mono">{{ row.discord_id }}</td>
          <td class="mono">{{ row.added_by || '—' }}</td>
          <td class="nowrap" :title="formatDateTime(row.added_at)">{{ timeAgo(row.added_at) }}</td>
          <td class="acciones">
            <button type="button" class="btn ghost icono sm" :aria-label="`Quitar a ${row.minecraft_nick}`" :aria-busy="busy === row.id" @click="remove(row)"><IconTrash aria-hidden="true" /></button>
          </td>
        </tr>
      </tbody>
    </table>
  </ListFrame>

  <AppDialog :open="dialogOpen" :icon="IconUserPlus" title="Añadir staff" @close="dialogOpen = false">
    <form class="modal-form" novalidate @submit.prevent="submit">
      <div class="modal-cuerpo">
        <div class="campo">
          <label :for="ids.discord">Discord ID</label>
          <input :id="ids.discord" v-model="form.discordId" class="input mono" inputmode="numeric" maxlength="20" required autofocus>
        </div>
        <div class="campo">
          <label :for="ids.nick">Nick de Minecraft</label>
          <input :id="ids.nick" v-model="form.nick" class="input mono" maxlength="16" required>
        </div>
        <p v-if="formError" class="form-error" role="alert">{{ formError }}</p>
      </div>
      <footer class="modal-pie">
        <button type="button" class="btn ghost" @click="dialogOpen = false">Cancelar</button>
        <button type="submit" class="btn primary" :aria-busy="saving" :disabled="saving">Añadir</button>
      </footer>
    </form>
  </AppDialog>
</template>
