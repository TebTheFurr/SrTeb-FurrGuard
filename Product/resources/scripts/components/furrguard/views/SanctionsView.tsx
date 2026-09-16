import React from 'react';
import { faArchive, faBan, faClock, faHourglassHalf, faInfinity, faPause, faTrash } from '@fortawesome/free-solid-svg-icons';
import { furr } from '@/api/furrguard/client';
import { SanctionFilter, SanctionRow } from '@/api/furrguard/types';
import PageHeader from '@/components/elements/ui/PageHeader';
import { useFurrGuard } from '@/components/furrguard/FurrGuardContext';
import { ConfirmDialog } from '@/components/furrguard/dialogs/FormDialog';
import { useBusy, useConfirm, usePagedList } from '@/components/furrguard/hooks';
import { formatDateTime, isOn, timeAgo, toNum } from '@/components/furrguard/lib/format';
import { banExpiry, banStatus, entryLabel } from '@/components/furrguard/lib/labels';
import { sectionInfo } from '@/components/furrguard/sections';
import { EntryValue } from '@/components/furrguard/views/WhitelistView';
import { ActiveSwitch, Chip, FilterTabs, IconButton, ListFrame, Mono, Muted, RowActions, SearchBox, Stack, StatCard, StatsGrid, StatusChip } from '@/components/furrguard/ui';

const FILTER_VALUES: SanctionFilter[] = ['all', 'active', 'temporary', 'permanent', 'expired', 'inactive'];

const SanctionsView = () => {
    const { can } = useFurrGuard();
    const info = sectionInfo('sanctions');
    const list = usePagedList<SanctionRow, { filter: string; search: string }>({
        action: 'get_sanctions',
        filters: { filter: 'all', search: '' },
        allowed: { filter: FILTER_VALUES },
    });
    const { busy, run } = useBusy();
    const { confirm, pending, settle } = useConfirm();

    /** The stats come with every page: cards and tabs update on their own. */
    const raw = (list.data.stats ?? {}) as Record<string, unknown>;
    const stat = (key: string): number | null => (raw[key] === undefined ? null : toNum(raw[key]));
    const stats = { all: stat('all') ?? stat('total'), active: stat('active'), temporary: stat('temporary'), permanent: stat('permanent'), expired: stat('expired'), inactive: stat('inactive') };

    const tabs = [
        { value: 'all', label: 'Todas', count: stats.all },
        { value: 'active', label: 'Activas', count: stats.active },
        { value: 'temporary', label: 'Temporales', count: stats.temporary },
        { value: 'permanent', label: 'Permanentes', count: stats.permanent },
        { value: 'expired', label: 'Expiradas', count: stats.expired },
        { value: 'inactive', label: 'Inactivas', count: stats.inactive },
    ];

    const setActive = async (row: SanctionRow, active: boolean) => {
        if (await run(row.id, () => furr('set_blacklist_active', { id: row.id, active }), active ? 'Sanción activada.' : 'Sanción desactivada.')) list.reload();
    };

    const remove = async (row: SanctionRow) => {
        const ok = await confirm({ title: 'Eliminar sanción', message: `Se borrará ${row.ban_id} (${row.value}) y sus IPs hijas.`, confirmText: 'Eliminar' });
        if (ok && (await run(row.id, () => furr('remove_blacklist', { id: row.id }), 'Sanción eliminada.'))) list.reload();
    };

    return (
        <Stack>
            <PageHeader title={info.label} description={info.description} />

            <StatsGrid $min={140}>
                <StatCard label={'Activas'} value={stats.active} icon={faBan} tone={'down'} />
                <StatCard label={'Temporales'} value={stats.temporary} icon={faHourglassHalf} />
                <StatCard label={'Permanentes'} value={stats.permanent} icon={faInfinity} />
                <StatCard label={'Expiradas'} value={stats.expired} icon={faClock} tone={'warn'} />
                <StatCard label={'Inactivas'} value={stats.inactive} icon={faPause} />
            </StatsGrid>

            <ListFrame
                list={list}
                label={'Sanciones'}
                emptyIcon={faArchive}
                emptyTitle={'No hay sanciones con este filtro'}
                toolbar={
                    <>
                        <FilterTabs value={list.filters.filter} onChange={(value) => list.setFilter('filter', value)} options={tabs} label={'Filtrar sanciones'} />
                        <SearchBox value={list.filters.search} onChange={(value) => list.setFilter('search', value)} label={'Buscar sanciones'} placeholder={'ID, valor, motivo o autor…'} />
                    </>
                }
            >
                <thead>
                    <tr>
                        <th>ID</th>
                        <th>Tipo</th>
                        <th>Valor</th>
                        <th>Motivo</th>
                        <th>Autor</th>
                        <th>Creada</th>
                        <th>Expira</th>
                        <th>Estado</th>
                        {can('blacklist') && (
                            <th className={'actions'}>
                                <span className={'sr-only'}>Acciones</span>
                            </th>
                        )}
                    </tr>
                </thead>
                <tbody>
                    {list.items.map((row) => (
                        <tr key={row.id}>
                            <td>
                                <Mono>{row.ban_id}</Mono>
                            </td>
                            <td>
                                <Chip>{entryLabel(row.type)}</Chip>
                            </td>
                            <td>
                                <EntryValue type={row.type} value={row.value} name={row.minecraft_name} />
                            </td>
                            <td className={'text'}>{row.reason || <Muted>—</Muted>}</td>
                            <td>{row.added_by || <Muted>—</Muted>}</td>
                            <td className={'nowrap'} title={formatDateTime(row.created_at)}>
                                {timeAgo(row.created_at)}
                            </td>
                            <td>
                                <StatusChip {...banExpiry(row.expires_at)} />
                            </td>
                            <td>
                                <StatusChip {...banStatus(row.active, row.expires_at)} />
                            </td>
                            {can('blacklist') && (
                                <td className={'actions'}>
                                    <RowActions>
                                        <ActiveSwitch active={isOn(row.active)} busy={busy === row.id} label={`Sanción ${row.ban_id} activa`} onChange={(active) => setActive(row, active)} />
                                        <IconButton icon={faTrash} label={`Eliminar sanción ${row.ban_id}`} danger onClick={() => remove(row)} />
                                    </RowActions>
                                </td>
                            )}
                        </tr>
                    ))}
                </tbody>
            </ListFrame>

            <ConfirmDialog pending={pending} onSettle={settle} />
        </Stack>
    );
};

export default SanctionsView;
