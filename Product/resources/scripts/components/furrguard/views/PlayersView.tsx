import React from 'react';
import { faBan, faClipboardCheck, faGamepad } from '@fortawesome/free-solid-svg-icons';
import { PlayerRow } from '@/api/furrguard/types';
import PageHeader from '@/components/elements/ui/PageHeader';
import { useFurrGuard } from '@/components/furrguard/FurrGuardContext';
import { usePagedList } from '@/components/furrguard/hooks';
import { formatDateTime, formatNumber, isOn, timeAgo } from '@/components/furrguard/lib/format';
import { playerPath, sectionInfo } from '@/components/furrguard/sections';
import {
    Chip,
    Chips,
    CountryTag,
    FilterTabs,
    IpText,
    ListFrame,
    Mono,
    Muted,
    OnlineChip,
    PlayerCell,
    PlayerHead,
    RowLink,
    RowMain,
    SearchBox,
    Stack,
    SubText,
} from '@/components/furrguard/ui';

const FILTERS = [
    { value: 'all', label: 'Todos' },
    { value: 'online', label: 'Online' },
    { value: 'whitelisted', label: 'En whitelist' },
    { value: 'blacklisted', label: 'En blacklist' },
] as const;

const PlayersView = () => {
    const { canSeeIps } = useFurrGuard();
    const info = sectionInfo('players');
    const list = usePagedList<PlayerRow, { filter: string; search: string }>({
        action: 'get_players',
        filters: { filter: 'all', search: '' },
        allowed: { filter: FILTERS.map((f) => f.value) },
    });

    return (
        <Stack>
            <PageHeader title={info.label} description={info.description} />
            <ListFrame
                list={list}
                label={'Lista de jugadores'}
                emptyIcon={faGamepad}
                emptyTitle={list.filters.search ? 'Ningún jugador coincide' : 'Aún no hay jugadores'}
                emptyText={list.filters.search ? `No hay resultados para «${list.filters.search}» con este filtro.` : undefined}
                toolbar={
                    <>
                        <FilterTabs value={list.filters.filter} onChange={(value) => list.setFilter('filter', value)} options={FILTERS} label={'Filtrar jugadores'} />
                        <SearchBox value={list.filters.search} onChange={(value) => list.setFilter('search', value)} label={'Buscar jugadores'} placeholder={'Nick, UUID o IP…'} />
                    </>
                }
            >
                <thead>
                    <tr>
                        <th>Jugador</th>
                        <th>UUID</th>
                        {canSeeIps && <th>Última IP</th>}
                        <th>País</th>
                        <th>Estado</th>
                        <th className={'right'}>Conexiones</th>
                        <th>Última vez</th>
                    </tr>
                </thead>
                <tbody>
                    {list.items.map((player) => {
                        const online = isOn(player.is_online);
                        const wl = isOn(player.is_whitelisted);
                        const bl = isOn(player.is_blacklisted);

                        return (
                            <tr key={player.uuid}>
                                <td>
                                    <PlayerCell>
                                        <PlayerHead id={player.uuid} name={player.last_nick} />
                                        <RowMain>
                                            <RowLink to={playerPath(player.uuid)}>{player.last_nick}</RowLink>
                                            {player.first_nick && player.first_nick !== player.last_nick && <SubText>antes {player.first_nick}</SubText>}
                                        </RowMain>
                                    </PlayerCell>
                                </td>
                                <td>
                                    <Mono title={player.uuid}>{player.uuid}</Mono>
                                </td>
                                {canSeeIps && (
                                    <td>
                                        <IpText ip={player.last_ip} />
                                    </td>
                                )}
                                <td>
                                    <CountryTag code={player.last_country_code} name={player.last_country} />
                                </td>
                                <td>
                                    <Chips>
                                        {online && <OnlineChip />}
                                        {wl && (
                                            <Chip tone={'accent'} icon={faClipboardCheck}>
                                                WL
                                            </Chip>
                                        )}
                                        {bl && (
                                            <Chip tone={'down'} icon={faBan}>
                                                BL
                                            </Chip>
                                        )}
                                        {!online && !wl && !bl && <Muted>—</Muted>}
                                    </Chips>
                                </td>
                                <td className={'right'}>{formatNumber(player.total_connections)}</td>
                                <td className={'nowrap'} title={formatDateTime(player.last_seen)}>
                                    {timeAgo(player.last_seen)}
                                </td>
                            </tr>
                        );
                    })}
                </tbody>
            </ListFrame>
        </Stack>
    );
};

export default PlayersView;
