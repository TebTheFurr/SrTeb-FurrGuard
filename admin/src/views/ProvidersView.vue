<script setup lang="ts">
import { computed, reactive, ref, useId } from 'vue'
import IconBuildings from '~icons/pixelarticons/buildings'
import IconHidden from '~icons/pixelarticons/hidden'
import IconPlus from '~icons/pixelarticons/plus'
import IconServer from '~icons/pixelarticons/server'
import IconSunglasses from '~icons/pixelarticons/sunglasses'
import IconTrash from '~icons/pixelarticons/trash'
import { api } from '@/api/client'
import type { ProviderRow, ProviderType } from '@/api/types'
import { useBusy } from '@/composables/useBusy'
import { usePagedList } from '@/composables/usePagedList'
import { confirmAction } from '@/lib/confirm'
import { formatNumber, isOn, toNum } from '@/lib/format'
import { toast } from '@/lib/toast'
import AppDialog from '@/components/ui/AppDialog.vue'
import ActiveSwitch from '@/components/ui/ActiveSwitch.vue'
import FilterTabs from '@/components/ui/FilterTabs.vue'
import ListFrame from '@/components/ui/ListFrame.vue'
import PageHeader from '@/components/ui/PageHeader.vue'
import SearchBox from '@/components/ui/SearchBox.vue'
import StatCard from '@/components/ui/StatCard.vue'
import StatusChip from '@/components/ui/StatusChip.vue'

const TYPES = {
  hosting: { label: 'Hosting', icon: IconServer },
  vpn: { label: 'VPN', icon: IconHidden },
  proxy: { label: 'Proxy', icon: IconSunglasses },
} satisfies Record<ProviderType, unknown>
const TYPE_TABS = [{ value: '', label: 'Todos' }, ...(Object.keys(TYPES) as ProviderType[]).map((value) => ({ value, ...TYPES[value] }))]

const list = usePagedList<ProviderRow, { type: string; search: string }>({
  action: 'get_providers',
  filters: { type: '', search: '' },
  allowed: { type: TYPE_TABS.map((t) => t.value) },
})
const { busy, run } = useBusy()
const stats = computed(() => (list.data.stats ?? {}) as Record<string, unknown>)

const dialogOpen = ref(false)
const form = reactive({ name: '', pattern: '', type: 'hosting' as ProviderType })
const saving = ref(false)
const formError = ref('')
const ids = { name: useId(), pattern: useId(), type: useId() }

function openDialog(): void {
  Object.assign(form, { name: '', pattern: '', type: 'hosting' })
  formError.value = ''
  dialogOpen.value = true
}

async function submit(): Promise<void> {
  if (!form.name.trim() || form.pattern.trim().length < 3) {
    formError.value = 'Escribe un nombre y un patrón de al menos 3 caracteres.'
    return
  }
  saving.value = true
  formError.value = ''
  try {
    await api('add_provider', { name: form.name.trim(), pattern: form.pattern.trim(), type: form.type })
    toast('Proveedor añadido.', 'ok')
    dialogOpen.value = false
    await list.reload()
  } catch (e) {
    formError.value = e instanceof Error ? e.message : 'No se pudo añadir.'
  } finally {
    saving.value = false
  }
}

async function toggle(row: ProviderRow, active: boolean): Promise<void> {
  if (await run(row.id, () => api('toggle_provider', { id: row.id, active }), active ? 'Proveedor activado.' : 'Proveedor desactivado.')) await list.reload()
}

async function remove(row: ProviderRow): Promise<void> {
  const ok = await confirmAction({ title: 'Eliminar proveedor', message: `Se eliminará «${row.name}» (${row.pattern}).`, confirmText: 'Eliminar', danger: true })
  if (ok && (await run(row.id, () => api('delete_provider', { id: row.id }), 'Proveedor eliminado.'))) await list.reload()
}
</script>

<template>
  <div>
    <PageHeader title="Proveedores" :icon="IconBuildings" desc="Patrones de ISP u organización que se bloquean aunque ip-api no los marque.">
      <button type="button" class="btn primary" @click="openDialog"><IconPlus aria-hidden="true" /> Añadir</button>
    </PageHeader>

    <div class="metricas seccion">
      <StatCard label="Hosting" :value="stats.hosting ?? '—'" :icon="IconServer" />
      <StatCard label="VPN" :value="stats.vpn ?? '—'" :icon="IconHidden" />
      <StatCard label="Proxy" :value="stats.proxy ?? '—'" :icon="IconSunglasses" />
    </div>

    <ListFrame :list="list" label="Proveedores bloqueados" :empty-icon="IconBuildings" empty-title="No hay proveedores con este filtro">
      <template #toolbar>
        <FilterTabs v-model="list.filters.type" label="Filtrar por tipo" :options="TYPE_TABS" />
        <SearchBox v-model="list.filters.search" label="Buscar proveedores" placeholder="Nombre o patrón…" />
      </template>

      <table class="tabla">
        <thead>
          <tr>
            <th scope="col">Nombre</th>
            <th scope="col">Patrón</th>
            <th scope="col">Tipo</th>
            <th scope="col" class="der">Bloqueos</th>
            <th scope="col">Activo</th>
            <th scope="col" class="acciones"><span class="sr-only">Acciones</span></th>
          </tr>
        </thead>
        <tbody>
          <tr v-for="row in list.items" :key="row.id">
            <td>{{ row.name }}</td>
            <td class="mono">{{ row.pattern }}</td>
            <td><StatusChip v-bind="TYPES[row.type] ?? { label: row.type }" tone="tenue" /></td>
            <td class="der num">{{ formatNumber(toNum(row.block_count)) }}</td>
            <td><ActiveSwitch :active="isOn(row.active)" :busy="busy === row.id" :label="`Proveedor ${row.name} activo`" @change="toggle(row, $event)" /></td>
            <td class="acciones">
              <button type="button" class="btn ghost icono sm" :aria-label="`Eliminar ${row.name}`" @click="remove(row)"><IconTrash aria-hidden="true" /></button>
            </td>
          </tr>
        </tbody>
      </table>
    </ListFrame>

    <AppDialog :open="dialogOpen" :icon="IconBuildings" title="Añadir proveedor" @close="dialogOpen = false">
      <form class="modal-form" novalidate @submit.prevent="submit">
        <div class="modal-cuerpo">
          <div class="campo">
            <label :for="ids.name">Nombre</label>
            <input :id="ids.name" v-model="form.name" class="input" maxlength="255" required autofocus>
          </div>
          <div class="campo">
            <label :for="ids.pattern">Patrón</label>
            <input :id="ids.pattern" v-model="form.pattern" class="input mono" minlength="3" maxlength="255" required placeholder="ovh">
            <p class="ayuda">Texto que se busca (sin distinguir mayúsculas) en el ISP, la organización y el AS.</p>
          </div>
          <div class="campo">
            <label :for="ids.type">Tipo</label>
            <select :id="ids.type" v-model="form.type" class="select">
              <option v-for="(info, value) in TYPES" :key="value" :value="value">{{ info.label }}</option>
            </select>
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
