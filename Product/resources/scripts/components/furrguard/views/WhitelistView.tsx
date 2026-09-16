import React, { useState } from 'react';
import { FontAwesomeIcon } from '@fortawesome/react-fontawesome';
import { faClipboardCheck, faEdit, faPlus, faTrash } from '@fortawesome/free-solid-svg-icons';
import { furr } from '@/api/furrguard/client';
import { WhitelistRow } from '@/api/furrguard/types';
import { Button } from '@/components/elements/button/index';
import PageHeader from '@/components/elements/ui/PageHeader';
import { ConfirmDialog } from '@/components/furrguard/dialogs/FormDialog';
import { WhitelistDialog, WhitelistDraft } from '@/components/furrguard/dialogs/ListDialogs';
import { useBusy, useConfirm, usePagedList } from '@/components/furrguard/hooks';
import { formatDateTime, timeAgo } from '@/components/furrguard/lib/format';
import { ENTRY_TYPES, entryInfo, isIpEntry } from '@/components/furrguard/lib/labels';
import { sectionInfo } from '@/components/furrguard/sections';
import { FilterTabs, IconButton, IpText, ListFrame, Mono, Muted, RowActions, RowMain, SearchBox, Stack, StatusChip, SubText } from '@/components/furrguard/ui';

const TYPE_TABS = [{ value: '', label: 'Todos' }, ...ENTRY_TYPES.map((t) => ({ value: t.value, label: t.label, icon: t.icon }))];

/** Value of a list entry: IPs go through IpText; names show the resolved Minecraft name over the raw value. */
export const EntryValue = ({ type, value, name }: { type: string; value: string; name?: string | null }) =>
    isIpEntry(type) ? (
        <IpText ip={value} />
    ) : (
        <RowMain>
            {name ? (
                <>
                    <strong>{name}</strong>
                    <SubText>{value}</SubText>
                </>
            ) : (
                <Mono>{value}</Mono>
            )}
        </RowMain>
    );

const WhitelistView = () => {
    const info = sectionInfo('whitelist');
    const list = usePagedList<WhitelistRow, { type: string; search: string }>({
        action: 'get_whitelist',
        filters: { type: '', search: '' },
        allowed: { type: TYPE_TABS.map((t) => t.value) },
    });
    const { busy, run } = useBusy();
    const { confirm, pending, settle } = useConfirm();
    const [draft, setDraft] = useState<WhitelistDraft | null>(null);

    const remove = async (row: WhitelistRow) => {
        const ok = await confirm({
            title: 'Quitar de la whitelist',
            message: `Se eliminará «${row.minecraft_name || row.value}». Volverá a pasar por todas las reglas.`,
            confirmText: 'Quitar',
        });
        if (ok && (await run(row.id, () => furr('remove_whitelist', { id: row.id }), 'Entrada eliminada de la whitelist.'))) list.reload();
    };

    const saved = () => {
        setDraft(null);
        list.reload();
    };

    return (
        <Stack>
            <PageHeader
                title={info.label}
                description={info.description}
                actions={
                    <Button onClick={() => setDraft({ type: 'nick', value: '', reason: '' })}>
                        <FontAwesomeIcon icon={faPlus} />
                        <span className={'ml-2'}>Añadir</span>
                    </Button>
                }
            />
            <ListFrame
                list={list}
                label={'Entradas de whitelist'}
                emptyIcon={faClipboardCheck}
                emptyTitle={'La whitelist está vacía'}
                emptyText={list.filters.search ? 'Ninguna entrada coincide con la búsqueda.' : undefined}
                toolbar={
                    <>
                        <FilterTabs value={list.filters.type} onChange={(value) => list.setFilter('type', value)} options={TYPE_TABS} label={'Filtrar por tipo'} />
                        <SearchBox value={list.filters.search} onChange={(value) => list.setFilter('search', value)} label={'Buscar en la whitelist'} placeholder={'Valor o motivo…'} />
                    </>
                }
            >
                <thead>
                    <tr>
                        <th>Tipo</th>
                        <th>Valor</th>
                        <th>Motivo</th>
                        <th>Añadido por</th>
                        <th>Fecha</th>
                        <th className={'actions'}>
                            <span className={'sr-only'}>Acciones</span>
                        </th>
                    </tr>
                </thead>
                <tbody>
                    {list.items.map((row) => {
                        const type = entryInfo(row.type);

                        return (
                            <tr key={row.id}>
                                <td>
                                    <StatusChip label={type?.label ?? row.type} icon={type?.icon ?? faClipboardCheck} />
                                </td>
                                <td>
                                    <EntryValue type={row.type} value={row.value} name={row.minecraft_name} />
                                </td>
                                <td className={'text'}>{row.reason || <Muted>—</Muted>}</td>
                                <td>{row.added_by || <Muted>—</Muted>}</td>
                                <td className={'nowrap'} title={formatDateTime(row.created_at)}>
                                    {timeAgo(row.created_at)}
                                </td>
                                <td className={'actions'}>
                                    <RowActions>
                                        <IconButton icon={faEdit} label={`Editar ${row.value}`} onClick={() => setDraft({ id: row.id, type: row.type, value: row.value, reason: row.reason })} />
                                        <IconButton icon={faTrash} label={`Quitar ${row.value}`} busy={busy === row.id} danger onClick={() => remove(row)} />
                                    </RowActions>
                                </td>
                            </tr>
                        );
                    })}
                </tbody>
            </ListFrame>

            <WhitelistDialog draft={draft} onClose={() => setDraft(null)} onSaved={saved} />
            <ConfirmDialog pending={pending} onSettle={settle} />
        </Stack>
    );
};

export default WhitelistView;
