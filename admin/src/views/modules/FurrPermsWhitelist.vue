<script setup lang="ts">
import { reactive, ref, useId } from 'vue'
import IconLock from '~icons/pixelarticons/lock'
import IconTrash from '~icons/pixelarticons/trash'
import IconUserPlus from '~icons/pixelarticons/user-plus'
import { api } from '@/api/client'
import type { FurrPermsEntry } from '@/api/types'
import { useBusy } from '@/composables/useBusy'
import { usePagedList } from '@/composables/usePagedList'
import { confirmAction } from '@/lib/confirm'
import { formatDateTime, timeAgo } from '@/lib/dates'
import { isUuid } from '@/lib/entries'
import { toast } from '@/lib/toast'
import AppDialog from '@/components/ui/AppDialog.vue'
import ListFrame from '@/components/ui/ListFrame.vue'
import PlayerHead from '@/components/ui/PlayerHead.vue'
import SearchBox from '@/components/ui/SearchBox.vue'

const list = usePagedList<FurrPermsEntry, { search: string }>({
  action: 'get_furr_perms_whitelist',
  filters: { search: '' },
  prefix: 'wl_',
  legacyKey: 'entries',
})
const { busy, run } = useBusy()

const dialogOpen = ref(false)
const form = reactive({ nick: '', uuid: '', reason: '' })
const saving = ref(false)
const formError = ref('')
const ids = { nick: useId(), uuid: useId(), reason: useId() }

function openDialog(): void {
  Object.assign(form, { nick: '', uuid: '', reason: '' })
  formError.value = ''
  dialogOpen.value = true
}

async function submit(): Promise<void> {
  const nick = form.nick.trim()
  const uuid = form.uuid.trim()
  if (!/^[A-Za-z0-9_]{1,16}$/.test(nick)) {
    formError.value = 'Nick no válido: 1-16 caracteres (letras, números y _).'
    return
  }
  if (uuid && !isUuid(uuid)) {
    formError.value = 'El UUID no es válido. Déjalo vacío si no lo sabes.'
    return
  }
  saving.value = true
  formError.value = ''
  try {
    await api('add_furr_perms_whitelist', { nick, ...(uuid && { uuid }), reason: form.reason.trim() })
    toast(`${nick} puede usar los comandos protegidos.`, 'ok')
    dialogOpen.value = false
    await list.reload()
  } catch (e) {
    formError.value = e instanceof Error ? e.message : 'No se pudo añadir.'
  } finally {
    saving.value = false
  }
}

async function remove(row: FurrPermsEntry): Promise<void> {
  const ok = await confirmAction({ title: 'Quitar de FurrPerms', message: `${row.nick} dejará de poder usar los comandos protegidos.`, confirmText: 'Quitar', danger: true })
  if (ok && (await run(row.id, () => api('remove_furr_perms_whitelist', { id: row.id }), 'Jugador quitado de FurrPerms.'))) await list.reload()
}
</script>

<template>
  <ListFrame :list="list" label="Whitelist de FurrPerms" :empty-icon="IconLock" empty-title="Nadie puede usar comandos protegidos" empty-text="Añade al staff que los necesite.">
    <template #toolbar>
      <SearchBox v-model="list.filters.search" label="Buscar en la whitelist de FurrPerms" placeholder="Nick…" />
      <span class="spacer" />
      <button type="button" class="btn primary" @click="openDialog"><IconUserPlus aria-hidden="true" /> Añadir jugador</button>
    </template>

    <table class="tabla">
      <thead>
        <tr>
          <th scope="col">Jugador</th>
          <th scope="col">UUID</th>
          <th scope="col">Motivo</th>
          <th scope="col">Añadido por</th>
          <th scope="col">Fecha</th>
          <th scope="col" class="acciones"><span class="sr-only">Acciones</span></th>
        </tr>
      </thead>
      <tbody>
        <tr v-for="row in list.items" :key="row.id">
          <td><span class="row"><PlayerHead :id="row.uuid || row.nick" :name="row.nick" /><b>{{ row.nick }}</b></span></td>
          <td class="mono">{{ row.uuid || 'Cualquiera con ese nick' }}</td>
          <td class="celda-texto">{{ row.reason || '—' }}</td>
          <td>{{ row.added_by || '—' }}</td>
          <td class="nowrap" :title="formatDateTime(row.created_at)">{{ timeAgo(row.created_at) }}</td>
          <td class="acciones">
            <button type="button" class="btn ghost icono sm" :aria-label="`Quitar a ${row.nick}`" :aria-busy="busy === row.id" @click="remove(row)"><IconTrash aria-hidden="true" /></button>
          </td>
        </tr>
      </tbody>
    </table>
  </ListFrame>

  <AppDialog :open="dialogOpen" :icon="IconUserPlus" title="Añadir a FurrPerms" @close="dialogOpen = false">
    <form class="modal-form" novalidate @submit.prevent="submit">
      <div class="modal-cuerpo">
        <div class="campo">
          <label :for="ids.nick">Nick</label>
          <input :id="ids.nick" v-model="form.nick" class="input mono" maxlength="16" autocomplete="off" required autofocus>
        </div>
        <div class="campo">
          <label :for="ids.uuid">UUID <span class="faint">(opcional)</span></label>
          <input :id="ids.uuid" v-model="form.uuid" class="input mono" maxlength="36" autocomplete="off">
          <p class="ayuda">Si lo indicas, el nick solo vale con esa cuenta (evita suplantaciones en modo offline).</p>
        </div>
        <div class="campo">
          <label :for="ids.reason">Motivo</label>
          <textarea :id="ids.reason" v-model="form.reason" class="textarea" rows="2" maxlength="500" />
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
