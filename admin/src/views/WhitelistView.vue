<script setup lang="ts">
import { shallowRef } from 'vue'
import IconChecklist from '~icons/pixelarticons/checklist'
import IconEdit from '~icons/pixelarticons/edit'
import IconPlus from '~icons/pixelarticons/plus'
import IconTrash from '~icons/pixelarticons/trash'
import { api } from '@/api/client'
import type { WhitelistRow } from '@/api/types'
import { useBusy } from '@/composables/useBusy'
import { usePagedList } from '@/composables/usePagedList'
import { confirmAction } from '@/lib/confirm'
import { formatDateTime, timeAgo } from '@/lib/dates'
import { ENTRY_TYPES, entryInfo } from '@/lib/entries'
import WhitelistDialog, { type WhitelistDraft } from '@/components/dialogs/WhitelistDialog.vue'
import FilterTabs from '@/components/ui/FilterTabs.vue'
import IpText from '@/components/ui/IpText.vue'
import ListFrame from '@/components/ui/ListFrame.vue'
import PageHeader from '@/components/ui/PageHeader.vue'
import SearchBox from '@/components/ui/SearchBox.vue'
import StatusChip from '@/components/ui/StatusChip.vue'

const TYPE_TABS = [{ value: '', label: 'Todos' }, ...ENTRY_TYPES.map((t) => ({ value: t.value, label: t.label, icon: t.icon }))]

const list = usePagedList<WhitelistRow, { type: string; search: string }>({
  action: 'get_whitelist',
  filters: { type: '', search: '' },
  allowed: { type: TYPE_TABS.map((t) => t.value) },
})
const { busy, run } = useBusy()
const draft = shallowRef<WhitelistDraft | null>(null)

async function remove(row: WhitelistRow): Promise<void> {
  const ok = await confirmAction({ title: 'Quitar de la whitelist', message: `Se eliminará «${row.minecraft_name || row.value}». Volverá a pasar por todas las reglas.`, confirmText: 'Quitar', danger: true })
  if (ok && (await run(row.id, () => api('remove_whitelist', { id: row.id }), 'Entrada eliminada de la whitelist.'))) await list.reload()
}

async function saved(): Promise<void> {
  draft.value = null
  await list.reload()
}
</script>

<template>
  <div>
    <PageHeader title="Whitelist" :icon="IconChecklist" desc="Exime de la detección automática y de la cuenta comprometida. Un baneo gana siempre a la whitelist.">
      <button type="button" class="btn primary" @click="draft = { type: 'nick', value: '', reason: '' }"><IconPlus aria-hidden="true" /> Añadir</button>
    </PageHeader>

    <ListFrame :list="list" label="Entradas de whitelist" :empty-icon="IconChecklist" empty-title="La whitelist está vacía" :empty-text="list.filters.search ? 'Ninguna entrada coincide con la búsqueda.' : ''">
      <template #toolbar>
        <FilterTabs v-model="list.filters.type" label="Filtrar por tipo" :options="TYPE_TABS" />
        <SearchBox v-model="list.filters.search" label="Buscar en la whitelist" placeholder="Valor o motivo…" />
      </template>

      <table class="tabla">
        <thead>
          <tr>
            <th scope="col">Tipo</th>
            <th scope="col">Valor</th>
            <th scope="col">Motivo</th>
            <th scope="col">Añadido por</th>
            <th scope="col">Fecha</th>
            <th scope="col" class="acciones"><span class="sr-only">Acciones</span></th>
          </tr>
        </thead>
        <tbody>
          <tr v-for="row in list.items" :key="row.id">
            <td><StatusChip :label="entryInfo(row.type)?.label ?? row.type" :icon="entryInfo(row.type)?.icon" tone="tenue" /></td>
            <td>
              <IpText v-if="row.type === 'ip' || row.type === 'ip_range'" :ip="row.value" />
              <template v-else>
                <b v-if="row.minecraft_name">{{ row.minecraft_name }}</b>
                <span class="mono" :class="{ 'sub-celda': row.minecraft_name }">{{ row.value }}</span>
              </template>
            </td>
            <td class="celda-texto">{{ row.reason || '—' }}</td>
            <td>{{ row.added_by || '—' }}</td>
            <td class="nowrap" :title="formatDateTime(row.created_at)">{{ timeAgo(row.created_at) }}</td>
            <td class="acciones">
              <span class="fila-acciones">
                <button type="button" class="btn ghost icono sm" :aria-label="`Editar ${row.value}`" @click="draft = { id: row.id, type: row.type, value: row.value, reason: row.reason }">
                  <IconEdit aria-hidden="true" />
                </button>
                <button type="button" class="btn ghost icono sm" :aria-label="`Quitar ${row.value}`" :aria-busy="busy === row.id" @click="remove(row)">
                  <IconTrash aria-hidden="true" />
                </button>
              </span>
            </td>
          </tr>
        </tbody>
      </table>
    </ListFrame>

    <WhitelistDialog :open="draft !== null" :draft="draft" @close="draft = null" @saved="saved" />
  </div>
</template>
