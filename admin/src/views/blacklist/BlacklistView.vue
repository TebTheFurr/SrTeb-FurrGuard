<script setup lang="ts">
import { ref, shallowRef } from 'vue'
import IconChevronDown from '~icons/lucide/chevron-down'
import IconCancel from '~icons/pixelarticons/cancel'
import IconEdit from '~icons/pixelarticons/edit'
import IconGamepad from '~icons/pixelarticons/gamepad'
import IconPlus from '~icons/pixelarticons/plus'
import IconTrash from '~icons/pixelarticons/trash'
import { api } from '@/api/client'
import type { BanChild, BanRow } from '@/api/types'
import { useBusy } from '@/composables/useBusy'
import { usePagedList } from '@/composables/usePagedList'
import { banExpiry, banStatus } from '@/lib/bans'
import { confirmAction } from '@/lib/confirm'
import { formatDateTime, timeAgo } from '@/lib/dates'
import { ENTRY_TYPES, entryInfo } from '@/lib/entries'
import { isOn } from '@/lib/format'
import AddBanIpDialog from '@/components/dialogs/AddBanIpDialog.vue'
import BanDialog, { type BanDraft } from '@/components/dialogs/BanDialog.vue'
import EditBanDialog, { type BanEditTarget } from '@/components/dialogs/EditBanDialog.vue'
import UnifiedBanDialog from '@/components/dialogs/UnifiedBanDialog.vue'
import ActiveSwitch from '@/components/ui/ActiveSwitch.vue'
import FilterTabs from '@/components/ui/FilterTabs.vue'
import IpText from '@/components/ui/IpText.vue'
import ListFrame from '@/components/ui/ListFrame.vue'
import PageHeader from '@/components/ui/PageHeader.vue'
import SearchBox from '@/components/ui/SearchBox.vue'
import StatusChip from '@/components/ui/StatusChip.vue'

const STATUS_TABS = [
  { value: 'all', label: 'Todos' },
  { value: 'active', label: 'Activos' },
  { value: 'inactive', label: 'Inactivos' },
  { value: 'expired', label: 'Expirados' },
] as const

const list = usePagedList<BanRow, { status: string; type: string; search: string }>({
  action: 'get_blacklist',
  filters: { status: 'all', type: '', search: '' },
  allowed: { status: STATUS_TABS.map((t) => t.value), type: ['', ...ENTRY_TYPES.map((t) => t.value)] },
})
const { busy, run } = useBusy()

const expanded = ref(new Set<number>())
const unifiedOpen = ref(false)
const banDraft = shallowRef<BanDraft | null>(null)
const editTarget = shallowRef<BanEditTarget | null>(null)
const ipParent = shallowRef<BanRow | null>(null)

function toggleChildren(id: number): void {
  const next = new Set(expanded.value)
  if (next.has(id)) next.delete(id)
  else next.add(id)
  expanded.value = next
}

async function setActive(row: BanChild, active: boolean): Promise<void> {
  const text = active ? `Baneo ${row.ban_id} activado.` : `Baneo ${row.ban_id} desactivado.`
  if (await run(row.id, () => api('set_blacklist_active', { id: row.id, active }), text)) await list.reload()
}

async function remove(row: BanChild, isParent: boolean): Promise<void> {
  const ok = await confirmAction({
    title: 'Eliminar baneo',
    message: isParent ? `Se borrará ${row.ban_id} (${row.value}) junto a todas sus IPs hijas. No se puede deshacer.` : `Se borrará la IP hija ${row.value}.`,
    confirmText: 'Eliminar',
    danger: true,
  })
  if (ok && (await run(row.id, () => api('remove_blacklist', { id: row.id }), 'Baneo eliminado.'))) await list.reload()
}

async function saved(): Promise<void> {
  unifiedOpen.value = false
  banDraft.value = null
  editTarget.value = null
  ipParent.value = null
  await list.reload()
}
</script>

<template>
  <div>
    <PageHeader title="Blacklist" :icon="IconCancel" desc="Baneos por UUID, nick, IP, rango o AS. Desactivar un baneo desactiva también sus IPs manchadas.">
      <button type="button" class="btn danger" @click="unifiedOpen = true"><IconGamepad aria-hidden="true" /> Banear jugador</button>
      <button type="button" class="btn" @click="banDraft = { type: 'ip', value: '' }"><IconPlus aria-hidden="true" /> Baneo avanzado</button>
    </PageHeader>

    <ListFrame :list="list" label="Baneos" :empty-icon="IconCancel" empty-title="No hay baneos con este filtro">
      <template #toolbar>
        <FilterTabs v-model="list.filters.status" label="Filtrar por estado" :options="STATUS_TABS" />
        <SearchBox v-model="list.filters.search" label="Buscar baneos" placeholder="Valor, ID o motivo…" />
        <label class="sr-only" for="filtro-tipo-ban">Tipo</label>
        <select id="filtro-tipo-ban" v-model="list.filters.type" class="select">
          <option value="">Todos los tipos</option>
          <option v-for="type in ENTRY_TYPES" :key="type.value" :value="type.value">{{ type.label }}</option>
        </select>
      </template>

      <table class="tabla">
        <thead>
          <tr>
            <th scope="col">ID</th>
            <th scope="col">Objetivo</th>
            <th scope="col">Motivo</th>
            <th scope="col">Estado</th>
            <th scope="col">Expira</th>
            <th scope="col">Creado</th>
            <th scope="col" class="acciones"><span class="sr-only">Acciones</span></th>
          </tr>
        </thead>
        <tbody>
          <template v-for="row in list.items" :key="row.id">
            <tr>
              <td class="mono">{{ row.ban_id }}</td>
              <td>
                <div class="objetivo">
                  <StatusChip :label="entryInfo(row.type)?.label ?? row.type" :icon="entryInfo(row.type)?.icon" tone="tenue" />
                  <IpText v-if="row.type === 'ip' || row.type === 'ip_range'" :ip="row.value" />
                  <span v-else class="valor">
                    <b v-if="row.minecraft_name">{{ row.minecraft_name }}</b>
                    <span class="mono" :class="{ 'sub-celda': row.minecraft_name }">{{ row.value }}</span>
                  </span>
                </div>
                <button
                  v-if="row.children.length"
                  type="button"
                  class="btn ghost sm hijas"
                  :aria-expanded="expanded.has(row.id)"
                  :aria-controls="row.children.map((child) => `hija-${child.id}`).join(' ')"
                  @click="toggleChildren(row.id)"
                >
                  <IconChevronDown aria-hidden="true" class="giro" :class="{ abierto: expanded.has(row.id) }" />
                  {{ row.children.length }} {{ row.children.length === 1 ? 'IP manchada' : 'IPs manchadas' }}
                </button>
              </td>
              <td class="celda-texto">{{ row.reason || '—' }}<span class="sub-celda">por {{ row.added_by || 'Sistema' }}</span></td>
              <td><StatusChip v-bind="banStatus(row.active, row.expires_at)" /></td>
              <td><StatusChip v-bind="banExpiry(row.expires_at)" /></td>
              <td class="nowrap" :title="formatDateTime(row.created_at)">{{ timeAgo(row.created_at) }}</td>
              <td class="acciones">
                <span class="fila-acciones">
                  <ActiveSwitch :active="isOn(row.active)" :busy="busy === row.id" :label="`Baneo ${row.ban_id} activo`" @change="setActive(row, $event)" />
                  <button type="button" class="btn ghost icono sm" :aria-label="`Editar baneo ${row.ban_id}`" @click="editTarget = row"><IconEdit aria-hidden="true" /></button>
                  <button type="button" class="btn ghost icono sm" :aria-label="`Añadir IP al baneo ${row.ban_id}`" @click="ipParent = row"><IconPlus aria-hidden="true" /></button>
                  <button type="button" class="btn ghost icono sm" :aria-label="`Eliminar baneo ${row.ban_id}`" @click="remove(row, true)"><IconTrash aria-hidden="true" /></button>
                </span>
              </td>
            </tr>
            <template v-if="expanded.has(row.id)">
              <tr v-for="child in row.children" :id="`hija-${child.id}`" :key="child.id" class="hija">
                <td class="mono">{{ child.ban_id }}</td>
                <td><span class="sangria">IP hija</span> <IpText :ip="child.value" /></td>
                <td class="faint">Hereda el motivo</td>
                <td><StatusChip v-bind="banStatus(child.active, child.expires_at)" /></td>
                <td><StatusChip v-bind="banExpiry(child.expires_at)" /></td>
                <td />
                <td class="acciones">
                  <span class="fila-acciones">
                    <ActiveSwitch :active="isOn(child.active)" :busy="busy === child.id" :label="`IP hija ${child.ban_id} activa`" @change="setActive(child, $event)" />
                    <button type="button" class="btn ghost icono sm" :aria-label="`Eliminar IP hija ${child.ban_id}`" @click="remove(child, false)"><IconTrash aria-hidden="true" /></button>
                  </span>
                </td>
              </tr>
            </template>
          </template>
        </tbody>
      </table>
    </ListFrame>

    <UnifiedBanDialog :open="unifiedOpen" @close="unifiedOpen = false" @saved="saved" />
    <BanDialog :open="banDraft !== null" :draft="banDraft" @close="banDraft = null" @saved="saved" />
    <EditBanDialog :open="editTarget !== null" :ban="editTarget" @close="editTarget = null" @saved="saved" />
    <AddBanIpDialog :open="ipParent !== null" :parent="ipParent" @close="ipParent = null" @saved="saved" />
  </div>
</template>

<style scoped>
.objetivo { display: flex; align-items: center; gap: 8px; flex-wrap: wrap; }
.valor { display: grid; line-height: 1.3; }
.hijas { margin-top: 6px; margin-left: -6px; color: var(--fox); }
.giro { transition: transform var(--t) var(--ease); }
.giro.abierto { transform: rotate(180deg); }
.sangria { color: var(--ink-3); font-size: var(--text-xs); margin-right: 6px; }
</style>
