import React, { useState } from 'react';
import { faPlug } from '@fortawesome/free-solid-svg-icons';
import { ConnectionRow } from '@/api/furrguard/types';
import { Dialog } from '@/components/elements/dialog';
import { Button } from '@/components/elements/button/index';
import PageHeader from '@/components/elements/ui/PageHeader';
import { useFurrGuard } from '@/components/furrguard/FurrGuardContext';
import { useDetail, usePagedList } from '@/components/furrguard/hooks';
import { formatDateTime, isOn, timeAgo } from '@/components/furrguard/lib/format';
import { detectionsOf, geoSourceLabel, reasonLabel } from '@/components/furrguard/lib/labels';
import { playerPath, sectionInfo } from '@/components/furrguard/sections';
import {
    Chips,
    CountryTag,
    Detail,
    DetailList,
    FilterTabs,
    IpText,
    ListFrame,
    Muted,
    PrimaryLink,
    RetryNotice,
    RowLink,
    SearchBox,
    Skeleton,
    Stack,
    StatusChip,
} from '@/components/furrguard/ui';

const FILTERS = [
    { value: 'all', label: 'Todas' },
    { value: 'allowed', label: 'Permitidas' },
    { value: 'blocked', label: 'Bloqueadas' },
    { value: 'proxy', label: 'Proxy' },
    { value: 'vpn', label: 'VPN' },
    { value: 'hosting', label: 'Hosting' },
    { value: 'mobile', label: 'Móvil' },
] as const;

const Detections = ({ row, empty }: { row: ConnectionRow; empty: string }) => {
    const found = detectionsOf(row);

    return (
        <Chips>
            {found.map((d) => (
                <StatusChip key={d.key} label={d.label} icon={d.icon} tone={'warn'} />
            ))}
            {found.length === 0 && <Muted>{empty}</Muted>}
        </Chips>
    );
};

const ConnectionsView = () => {
    const { can, canSeeIps } = useFurrGuard();
    const info = sectionInfo('connections');
    const list = usePagedList<ConnectionRow, { filter: string; search: string }>({
        action: 'get_connections',
        filters: { filter: 'all', search: '' },
        allowed: { filter: FILTERS.map((f) => f.value) },
    });
    const [selected, setSelected] = useState<ConnectionRow | null>(null);
    const detail = useDetail<{ connection: ConnectionRow }>();
    const connection = detail.data?.connection ?? null;

    const open = (row: ConnectionRow) => {
        setSelected(row);
        detail.load('get_connection_detail', { id: row.id });
    };

    const close = () => {
        detail.cancel();
        setSelected(null);
    };

    return (
        <Stack>
            <PageHeader title={info.label} description={info.description} />
            <ListFrame
                list={list}
                label={'Lista de conexiones'}
                emptyIcon={faPlug}
                emptyTitle={'No hay conexiones con este filtro'}
                toolbar={
                    <>
                        <FilterTabs value={list.filters.filter} onChange={(value) => list.setFilter('filter', value)} options={FILTERS} label={'Filtrar conexiones'} />
                        <SearchBox value={list.filters.search} onChange={(value) => list.setFilter('search', value)} label={'Buscar conexiones'} placeholder={'Nick, UUID o IP…'} />
                    </>
                }
            >
                <thead>
                    <tr>
                        <th>Fecha</th>
                        <th>Jugador</th>
                        {canSeeIps && <th>IP</th>}
                        <th>País</th>
                        <th>Detección</th>
                        <th>Resultado</th>
                        <th className={'actions'}>
                            <span className={'sr-only'}>Acciones</span>
                        </th>
                    </tr>
                </thead>
                <tbody>
                    {list.items.map((row) => (
                        <tr key={row.id} className={isOn(row.blocked) ? 'blocked' : undefined}>
                            <td className={'nowrap'} title={formatDateTime(row.created_at)}>
                                {timeAgo(row.created_at)}
                            </td>
                            <td>{row.uuid && can('players') ? <RowLink to={playerPath(row.uuid)}>{row.nick}</RowLink> : row.nick}</td>
                            {canSeeIps && (
                                <td>
                                    <IpText ip={row.ip} />
                                </td>
                            )}
                            <td>
                                <CountryTag code={row.country_code} name={row.country} />
                            </td>
                            <td>
                                <Detections row={row} empty={'—'} />
                            </td>
                            <td>
                                <StatusChip {...reasonLabel(isOn(row.blocked) ? row.block_reason : 'allowed')} />
                            </td>
                            <td className={'actions'}>
                                <Button size={Button.Sizes.Small} variant={Button.Variants.Secondary} onClick={() => open(row)} aria-label={`Ver detalle de la conexión de ${row.nick}`}>
                                    Detalle
                                </Button>
                            </td>
                        </tr>
                    ))}
                </tbody>
            </ListFrame>

            <Dialog
                open={selected !== null}
                onClose={close}
                title={'Detalle de la conexión'}
                description={selected ? `${selected.nick} · ${formatDateTime(selected.created_at)}` : undefined}
            >
                <div className={'mt-2'}>
                    {detail.loading ? (
                        <Skeleton rows={4} />
                    ) : detail.error ? (
                        <RetryNotice title={'No se pudo cargar el detalle'} message={detail.error} onRetry={() => selected && open(selected)} />
                    ) : connection ? (
                        <DetailList>
                            <Detail label={'Jugador'}>{connection.nick}</Detail>
                            <Detail label={'UUID'} mono>
                                {connection.uuid ?? '—'}
                            </Detail>
                            {canSeeIps && (
                                <Detail label={'IP'}>
                                    <IpText ip={connection.ip} />
                                </Detail>
                            )}
                            <Detail label={'País'}>
                                <CountryTag code={connection.country_code} name={connection.country} showName />
                            </Detail>
                            <Detail label={'Región / ciudad'}>{[connection.region, connection.city].filter(Boolean).join(' · ') || '—'}</Detail>
                            <Detail label={'ISP'}>{connection.isp || '—'}</Detail>
                            <Detail label={'Organización'}>{connection.org || '—'}</Detail>
                            <Detail label={'AS'} mono>
                                {connection.asn || '—'} {connection.asname || ''}
                            </Detail>
                            <Detail label={'Versión'} mono>
                                {connection.game_version || '—'}
                            </Detail>
                            <Detail label={'Zona horaria'}>{connection.timezone || '—'}</Detail>
                            <Detail label={'Geolocalización'}>{geoSourceLabel(connection.geo_source)}</Detail>
                            <Detail label={'Detección'}>
                                <Detections row={connection} empty={'Nada sospechoso'} />
                            </Detail>
                            <Detail label={'Resultado'}>
                                <StatusChip {...reasonLabel(isOn(connection.blocked) ? connection.block_reason : 'allowed')} />
                            </Detail>
                        </DetailList>
                    ) : null}
                </div>
                <Dialog.Footer>
                    {connection?.uuid && can('players') && <PrimaryLink to={playerPath(connection.uuid)}>Ver jugador</PrimaryLink>}
                    <Button onClick={close}>Cerrar</Button>
                </Dialog.Footer>
            </Dialog>
        </Stack>
    );
};

export default ConnectionsView;
