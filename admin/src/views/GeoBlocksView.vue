<script setup lang="ts">
/** Países y continentes bloqueados: misma vista, cambian el prefijo de los campos y las acciones (§4.4 «igual que hoy»). */
import { computed, reactive, ref, useId } from 'vue'
import IconCancel from '~icons/pixelarticons/cancel'
import IconCheck from '~icons/pixelarticons/check'
import IconEarth from '~icons/pixelarticons/earth'
import IconEdit from '~icons/pixelarticons/edit'
import IconMap from '~icons/pixelarticons/map'
import IconPlus from '~icons/pixelarticons/plus'
import IconTrash from '~icons/pixelarticons/trash'
import { api } from '@/api/client'
import type { Flag, Num } from '@/api/types'
import { useBusy } from '@/composables/useBusy'
import { usePagedList } from '@/composables/usePagedList'
import { confirmAction } from '@/lib/confirm'
import { formatNumber, isOn } from '@/lib/format'
import { toast } from '@/lib/toast'
import AppDialog from '@/components/ui/AppDialog.vue'
import ActiveSwitch from '@/components/ui/ActiveSwitch.vue'
import ListFrame from '@/components/ui/ListFrame.vue'
import McText from '@/components/ui/McText.vue'
import PageHeader from '@/components/ui/PageHeader.vue'
import SearchBox from '@/components/ui/SearchBox.vue'
import StatCard from '@/components/ui/StatCard.vue'

type Kind = 'country' | 'continent'
type GeoRow = { id: number; kick_message: string | null; block_count: Num; active: Flag } & Record<string, unknown>

const CONTINENTS = [
  { code: 'AF', name: 'África' }, { code: 'AN', name: 'Antártida' }, { code: 'AS', name: 'Asia' }, { code: 'EU', name: 'Europa' },
  { code: 'NA', name: 'Norteamérica' }, { code: 'OC', name: 'Oceanía' }, { code: 'SA', name: 'Sudamérica' },
]

const props = defineProps<{ kind: Kind }>()

const copy = computed(() => props.kind === 'country'
  ? { title: 'Países', one: 'país', icon: IconMap, plural: 'countries', desc: 'Conexiones desde estos países se expulsan con su mensaje (o el genérico si no tiene).' }
  : { title: 'Continentes', one: 'continente', icon: IconEarth, plural: 'continents', desc: 'Bloqueo por continente: se evalúa después de proveedores y países.' })

const list = usePagedList<GeoRow, { search: string }>({
  action: props.kind === 'country' ? 'get_countries' : 'get_continents',
  filters: { search: '' },
  legacyKey: props.kind === 'country' ? 'countries' : 'continents',
})
const { busy, run } = useBusy()
const stats = computed(() => (list.data.stats ?? {}) as Record<string, unknown>)

const code = (row: GeoRow): string => String(row[`${props.kind}_code`] ?? '')
const name = (row: GeoRow): string => String(row[`${props.kind}_name`] ?? '')

const dialogOpen = ref(false)
const editing = ref<GeoRow | null>(null)
const form = reactive({ code: '', name: '', kickMessage: '' })
const saving = ref(false)
const formError = ref('')
const ids = { code: useId(), name: useId(), kick: useId() }

function openDialog(row: GeoRow | null): void {
  editing.value = row
  Object.assign(form, { code: row ? code(row) : '', name: row ? name(row) : '', kickMessage: row?.kick_message ?? '' })
  formError.value = ''
  dialogOpen.value = true
}

function pickContinent(): void {
  form.name = CONTINENTS.find((c) => c.code === form.code)?.name ?? form.name
}

async function submit(): Promise<void> {
  const prefix = props.kind
  if (!/^[A-Z]{2}$/.test(form.code.trim().toUpperCase()) || !form.name.trim()) {
    formError.value = `Escribe el código de ${copy.value.one} (2 letras) y su nombre.`
    return
  }
  saving.value = true
  formError.value = ''
  const fields = { [`${prefix}_name`]: form.name.trim(), kick_message: form.kickMessage.trim() }
  try {
    if (editing.value) await api(`edit_${prefix}`, { id: editing.value.id, ...fields })
    else await api(`add_${prefix}`, { [`${prefix}_code`]: form.code.trim().toUpperCase(), ...fields })
    toast(editing.value ? 'Cambios guardados.' : `${copy.value.one === 'país' ? 'País' : 'Continente'} bloqueado.`, 'ok')
    dialogOpen.value = false
    await list.reload()
  } catch (e) {
    formError.value = e instanceof Error ? e.message : 'No se pudo guardar.'
  } finally {
    saving.value = false
  }
}

async function toggle(row: GeoRow, active: boolean): Promise<void> {
  if (await run(row.id, () => api(`toggle_${props.kind}`, { id: row.id, active }), active ? 'Bloqueo activado.' : 'Bloqueo desactivado.')) await list.reload()
}

async function remove(row: GeoRow): Promise<void> {
  const ok = await confirmAction({ title: `Desbloquear ${copy.value.one}`, message: `Se eliminará el bloqueo de ${name(row)} (${code(row)}).`, confirmText: 'Eliminar', danger: true })
  if (ok && (await run(row.id, () => api(`delete_${props.kind}`, { id: row.id }), 'Bloqueo eliminado.'))) await list.reload()
}
</script>

<template>
  <div>
    <PageHeader :title="copy.title" :icon="copy.icon" :desc="copy.desc">
      <button type="button" class="btn primary" @click="openDialog(null)"><IconPlus aria-hidden="true" /> Bloquear {{ copy.one }}</button>
    </PageHeader>

    <div class="metricas seccion">
      <StatCard label="Bloqueados" :value="stats.total ?? '—'" :icon="copy.icon" />
      <StatCard label="Activos" :value="stats.active ?? '—'" :icon="IconCheck" tone="ok" />
      <StatCard label="Expulsiones" :value="stats.total_blocks ?? '—'" :icon="IconCancel" tone="down" />
    </div>

    <ListFrame :list="list" :label="copy.title" :empty-icon="copy.icon" :empty-title="`No hay ningún ${copy.one} bloqueado`">
      <template #toolbar>
        <SearchBox v-model="list.filters.search" :label="`Buscar ${copy.title.toLowerCase()}`" placeholder="Código o nombre…" />
      </template>

      <table class="tabla">
        <thead>
          <tr>
            <th scope="col">Código</th>
            <th scope="col">Nombre</th>
            <th scope="col">Mensaje propio</th>
            <th scope="col" class="der">Expulsiones</th>
            <th scope="col">Activo</th>
            <th scope="col" class="acciones"><span class="sr-only">Acciones</span></th>
          </tr>
        </thead>
        <tbody>
          <tr v-for="row in list.items" :key="row.id">
            <td class="mono">{{ code(row) }}</td>
            <td>{{ name(row) }}</td>
            <td class="celda-texto truncate">{{ row.kick_message || 'Mensaje genérico' }}</td>
            <td class="der num">{{ formatNumber(row.block_count) }}</td>
            <td><ActiveSwitch :active="isOn(row.active)" :busy="busy === row.id" :label="`Bloqueo de ${name(row)} activo`" @change="toggle(row, $event)" /></td>
            <td class="acciones">
              <span class="fila-acciones">
                <button type="button" class="btn ghost icono sm" :aria-label="`Editar ${name(row)}`" @click="openDialog(row)"><IconEdit aria-hidden="true" /></button>
                <button type="button" class="btn ghost icono sm" :aria-label="`Eliminar ${name(row)}`" @click="remove(row)"><IconTrash aria-hidden="true" /></button>
              </span>
            </td>
          </tr>
        </tbody>
      </table>
    </ListFrame>

    <AppDialog :open="dialogOpen" :icon="copy.icon" wide :title="editing ? `Editar ${copy.one}` : `Bloquear ${copy.one}`" @close="dialogOpen = false">
      <form class="modal-form" novalidate @submit.prevent="submit">
        <div class="modal-cuerpo">
          <div class="formulario fila-dos">
            <div class="campo">
              <label :for="ids.code">Código</label>
              <select v-if="kind === 'continent'" :id="ids.code" v-model="form.code" class="select" :disabled="!!editing" @change="pickContinent">
                <option value="" disabled>Elige…</option>
                <option v-for="c in CONTINENTS" :key="c.code" :value="c.code">{{ c.code }} · {{ c.name }}</option>
              </select>
              <input v-else :id="ids.code" v-model="form.code" class="input mono" maxlength="2" placeholder="ES" :disabled="!!editing" required autofocus>
            </div>
            <div class="campo">
              <label :for="ids.name">Nombre</label>
              <input :id="ids.name" v-model="form.name" class="input" maxlength="100" required>
            </div>
          </div>
          <div class="campo">
            <label :for="ids.kick">Mensaje de expulsión <span class="faint">(opcional)</span></label>
            <textarea :id="ids.kick" v-model="form.kickMessage" class="textarea mono" rows="4" maxlength="2000" />
            <p class="ayuda">Admite códigos &amp; y §. Vacío = mensaje genérico de Mensajes.</p>
            <McText v-if="form.kickMessage" :text="form.kickMessage" />
          </div>
          <p v-if="formError" class="form-error" role="alert">{{ formError }}</p>
        </div>
        <footer class="modal-pie">
          <button type="button" class="btn ghost" @click="dialogOpen = false">Cancelar</button>
          <button type="submit" class="btn primary" :aria-busy="saving" :disabled="saving">Guardar</button>
        </footer>
      </form>
    </AppDialog>
  </div>
</template>

<style scoped>
.fila-dos { grid-template-columns: 160px minmax(0, 1fr); }
@media (max-width: 600px) { .fila-dos { grid-template-columns: minmax(0, 1fr); } }
</style>
