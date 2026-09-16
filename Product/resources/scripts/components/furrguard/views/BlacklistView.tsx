import React, { useState } from 'react';
import styled from 'styled-components/macro';
import tw from 'twin.macro';
import { FontAwesomeIcon } from '@fortawesome/react-fontawesome';
import { faBan, faChevronDown, faEdit, faGamepad, faPlus, faTrash } from '@fortawesome/free-solid-svg-icons';
import { furr } from '@/api/furrguard/client';
import { BanChild, BanRow } from '@/api/furrguard/types';
import { Button } from '@/components/elements/button/index';
import PageHeader from '@/components/elements/ui/PageHeader';
import { ConfirmDialog } from '@/components/furrguard/dialogs/FormDialog';
import { AddBanIpDialog, BanDialog, BanDraft, BanEditTarget, EditBanDialog, UnifiedBanDialog } from '@/components/furrguard/dialogs/ListDialogs';
import { useBusy, useConfirm, usePagedList } from '@/components/furrguard/hooks';
import { formatDateTime, isOn, timeAgo } from '@/components/furrguard/lib/format';
import { banExpiry, banStatus, ENTRY_TYPES, entryInfo } from '@/components/furrguard/lib/labels';
import { sectionInfo } from '@/components/furrguard/sections';
import { EntryValue } from '@/components/furrguard/views/WhitelistView';
import {
    ActiveSwitch,
    CompactSelect,
    FilterTabs,
    IconButton,
    IpText,
    ListFrame,
    Mono,
    Muted,
    RowActions,
    SearchBox,
    Stack,
    StatusChip,
    SubText,
} from '@/components/furrguard/ui';

const STATUS_TABS = [
    { value: 'all', label: 'Todos' },
    { value: 'active', label: 'Activos' },
    { value: 'inactive', label: 'Inactivos' },
    { value: 'expired', label: 'Expirados' },
] as const;

const Target = styled.div`
    ${tw`flex flex-wrap items-center gap-2`};
`;

const ChildrenToggle = styled.button<{ $open: boolean }>`
    ${tw`inline-flex items-center gap-1 mt-1 text-xs font-medium`};
    color: var(--color-primary);

    svg {
        font-size: 0.6rem;
        transition: transform 150ms ease;
        transform: rotate(${({ $open }) => ($open ? 180 : 0)}deg);
    }
`;

const BlacklistView = () => {
    const info = sectionInfo('blacklist');
    const list = usePagedList<BanRow, { status: string; type: string; search: string }>({
        action: 'get_blacklist',
        filters: { status: 'all', type: '', search: '' },
        allowed: { status: STATUS_TABS.map((t) => t.value), type: ['', ...ENTRY_TYPES.map((t) => t.value)] },
    });
    const { busy, run } = useBusy();
    const { confirm, pending, settle } = useConfirm();
    const [expanded, setExpanded] = useState<Set<number>>(new Set());
    const [unifiedOpen, setUnifiedOpen] = useState(false);
    const [banDraft, setBanDraft] = useState<BanDraft | null>(null);
    const [editTarget, setEditTarget] = useState<BanEditTarget | null>(null);
    const [ipParent, setIpParent] = useState<BanRow | null>(null);

    const toggleChildren = (id: number) => {
        setExpanded((current) => {
            const next = new Set(current);
            if (next.has(id)) next.delete(id);
            else next.add(id);

            return next;
        });
    };

    const setActive = async (row: BanChild, active: boolean) => {
        const text = active ? `Baneo ${row.ban_id} activado.` : `Baneo ${row.ban_id} desactivado.`;
        if (await run(row.id, () => furr('set_blacklist_active', { id: row.id, active }), text)) list.reload();
    };

    const remove = async (row: BanChild, isParent: boolean) => {
        const ok = await confirm({
            title: 'Eliminar baneo',
            message: isParent ? `Se borrará ${row.ban_id} (${row.value}) junto a todas sus IPs hijas. No se puede deshacer.` : `Se borrará la IP hija ${row.value}.`,
            confirmText: 'Eliminar',
        });
        if (ok && (await run(row.id, () => furr('remove_blacklist', { id: row.id }), 'Baneo eliminado.'))) list.reload();
    };

    const saved = () => {
        setUnifiedOpen(false);
        setBanDraft(null);
        setEditTarget(null);
        setIpParent(null);
        list.reload();
    };

    return (
        <Stack>
            <PageHeader
                title={info.label}
                description={info.description}
                actions={
                    <>
                        <Button.Danger onClick={() => setUnifiedOpen(true)}>
                            <FontAwesomeIcon icon={faGamepad} />
                            <span className={'ml-2'}>Banear jugador</span>
                        </Button.Danger>
                        <Button variant={Button.Variants.Secondary} onClick={() => setBanDraft({ type: 'ip', value: '' })}>
                            <FontAwesomeIcon icon={faPlus} />
                            <span className={'ml-2'}>Baneo avanzado</span>
                        </Button>
                    </>
                }
            />
            <ListFrame
                list={list}
                label={'Baneos'}
                emptyIcon={faBan}
                emptyTitle={'No hay baneos con este filtro'}
                toolbar={
                    <>
                        <FilterTabs value={list.filters.status} onChange={(value) => list.setFilter('status', value)} options={STATUS_TABS} label={'Filtrar por estado'} />
                        <SearchBox value={list.filters.search} onChange={(value) => list.setFilter('search', value)} label={'Buscar baneos'} placeholder={'Valor, ID o motivo…'} />
                        <CompactSelect aria-label={'Tipo'} value={list.filters.type} onChange={(event) => list.setFilter('type', event.currentTarget.value)}>
                            <option value={''}>Todos los tipos</option>
                            {ENTRY_TYPES.map((type) => (
                                <option key={type.value} value={type.value}>
                                    {type.label}
                                </option>
                            ))}
                        </CompactSelect>
                    </>
                }
            >
                <thead>
                    <tr>
                        <th>ID</th>
                        <th>Objetivo</th>
                        <th>Motivo</th>
                        <th>Estado</th>
                        <th>Expira</th>
                        <th>Creado</th>
                        <th className={'actions'}>
                            <span className={'sr-only'}>Acciones</span>
                        </th>
                    </tr>
                </thead>
                <tbody>
                    {list.items.map((row) => {
                        const type = entryInfo(row.type);
                        const open = expanded.has(row.id);

                        return (
                            <React.Fragment key={row.id}>
                                <tr>
                                    <td>
                                        <Mono>{row.ban_id}</Mono>
                                    </td>
                                    <td>
                                        <Target>
                                            <StatusChip label={type?.label ?? row.type} icon={type?.icon ?? faBan} />
                                            <EntryValue type={row.type} value={row.value} name={row.minecraft_name} />
                                        </Target>
                                        {row.children.length > 0 && (
                                            <ChildrenToggle type={'button'} $open={open} aria-expanded={open} onClick={() => toggleChildren(row.id)}>
                                                <FontAwesomeIcon icon={faChevronDown} />
                                                {row.children.length} {row.children.length === 1 ? 'IP manchada' : 'IPs manchadas'}
                                            </ChildrenToggle>
                                        )}
                                    </td>
                                    <td className={'text'}>
                                        {row.reason || <Muted>—</Muted>}
                                        <SubText>por {row.added_by || 'Sistema'}</SubText>
                                    </td>
                                    <td>
                                        <StatusChip {...banStatus(row.active, row.expires_at)} />
                                    </td>
                                    <td>
                                        <StatusChip {...banExpiry(row.expires_at)} />
                                    </td>
                                    <td className={'nowrap'} title={formatDateTime(row.created_at)}>
                                        {timeAgo(row.created_at)}
                                    </td>
                                    <td className={'actions'}>
                                        <RowActions>
                                            <ActiveSwitch active={isOn(row.active)} busy={busy === row.id} label={`Baneo ${row.ban_id} activo`} onChange={(active) => setActive(row, active)} />
                                            <IconButton icon={faEdit} label={`Editar baneo ${row.ban_id}`} onClick={() => setEditTarget(row)} />
                                            <IconButton icon={faPlus} label={`Añadir IP al baneo ${row.ban_id}`} onClick={() => setIpParent(row)} />
                                            <IconButton icon={faTrash} label={`Eliminar baneo ${row.ban_id}`} danger onClick={() => remove(row, true)} />
                                        </RowActions>
                                    </td>
                                </tr>
                                {open &&
                                    row.children.map((child) => (
                                        <tr key={child.id} className={'child'}>
                                            <td>
                                                <Mono>{child.ban_id}</Mono>
                                            </td>
                                            <td>
                                                <Muted className={'text-xs mr-2'}>IP hija</Muted>
                                                <IpText ip={child.value} />
                                            </td>
                                            <td>
                                                <Muted>Hereda el motivo</Muted>
                                            </td>
                                            <td>
                                                <StatusChip {...banStatus(child.active, child.expires_at)} />
                                            </td>
                                            <td>
                                                <StatusChip {...banExpiry(child.expires_at)} />
                                            </td>
                                            <td />
                                            <td className={'actions'}>
                                                <RowActions>
                                                    <ActiveSwitch active={isOn(child.active)} busy={busy === child.id} label={`IP hija ${child.ban_id} activa`} onChange={(active) => setActive(child, active)} />
                                                    <IconButton icon={faTrash} label={`Eliminar IP hija ${child.ban_id}`} danger onClick={() => remove(child, false)} />
                                                </RowActions>
                                            </td>
                                        </tr>
                                    ))}
                            </React.Fragment>
                        );
                    })}
                </tbody>
            </ListFrame>

            <UnifiedBanDialog open={unifiedOpen} onClose={() => setUnifiedOpen(false)} onSaved={saved} />
            <BanDialog draft={banDraft} onClose={() => setBanDraft(null)} onSaved={saved} />
            <EditBanDialog ban={editTarget} onClose={() => setEditTarget(null)} onSaved={saved} />
            <AddBanIpDialog parent={ipParent} onClose={() => setIpParent(null)} onSaved={saved} />
            <ConfirmDialog pending={pending} onSettle={settle} />
        </Stack>
    );
};

export default BlacklistView;
