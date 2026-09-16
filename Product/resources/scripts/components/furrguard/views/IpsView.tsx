import React, { useState } from 'react';
import { faBan, faClipboardCheck, faGlobe } from '@fortawesome/free-solid-svg-icons';
import { IpDetail, IpRow } from '@/api/furrguard/types';
import { Dialog } from '@/components/elements/dialog';
import { Button } from '@/components/elements/button/index';
import PageHeader from '@/components/elements/ui/PageHeader';
import { useFurrGuard } from '@/components/furrguard/FurrGuardContext';
import { useDetail, usePagedList } from '@/components/furrguard/hooks';
import { formatDateTime, formatNumber, isOn, timeAgo } from '@/components/furrguard/lib/format';
import { playerPath, sectionInfo } from '@/components/furrguard/sections';
import {
    Chip,
    Chips,
    CountryTag,
    Detail,
    DetailList,
    IpText,
    ListFrame,
    Mono,
    Muted,
    PanelText,
    PlayerHead,
    RetryNotice,
    RowButton,
    RowLink,
    RowMain,
    Rows,
    SearchBox,
    Skeleton,
    Stack,
} from '@/components/furrguard/ui';

const IpsView = () => {
    const { can } = useFurrGuard();
    const info = sectionInfo('ips');
    const list = usePagedList<IpRow, { search: string }>({ action: 'get_ips', filters: { search: '' } });
    const [selected, setSelected] = useState<IpRow | null>(null);
    const detail = useDetail<IpDetail>();

    /** `ip` may come as an object with the data or just as text: complete it with the row. */
    const raw = detail.data?.ip;
    const ipInfo: IpRow | null = raw && typeof raw === 'object' ? { ...(selected as IpRow), ...raw } : selected;

    const open = (row: IpRow) => {
        setSelected(row);
        detail.load('get_ip_detail', { ip: row.ip });
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
                label={'Lista de IPs'}
                emptyIcon={faGlobe}
                emptyTitle={'No hay IPs que mostrar'}
                toolbar={<SearchBox value={list.filters.search} onChange={(value) => list.setFilter('search', value)} label={'Buscar IPs'} placeholder={'IP o parte de ella…'} />}
            >
                <thead>
                    <tr>
                        <th>IP</th>
                        <th>País</th>
                        <th>ISP</th>
                        <th>AS</th>
                        <th className={'right'}>Jugadores</th>
                        <th className={'right'}>Conexiones</th>
                        <th>Listas</th>
                        <th>Primera vez</th>
                    </tr>
                </thead>
                <tbody>
                    {list.items.map((row, index) => (
                        <tr key={row.ip ?? index}>
                            <td>
                                <RowButton type={'button'} onClick={() => open(row)} aria-label={'Ver jugadores de esta IP'}>
                                    <IpText ip={row.ip} />
                                </RowButton>
                            </td>
                            <td>
                                <CountryTag code={row.country_code} name={row.country} />
                            </td>
                            <td className={'text'}>{row.isp || <Muted>—</Muted>}</td>
                            <td>
                                <Mono>{row.asn || '—'}</Mono>
                            </td>
                            <td className={'right'}>{formatNumber(row.player_count)}</td>
                            <td className={'right'}>{formatNumber(row.connection_count)}</td>
                            <td>
                                <Chips>
                                    {isOn(row.is_whitelisted) && (
                                        <Chip tone={'accent'} icon={faClipboardCheck}>
                                            WL
                                        </Chip>
                                    )}
                                    {isOn(row.is_blacklisted) && (
                                        <Chip tone={'down'} icon={faBan}>
                                            BL
                                        </Chip>
                                    )}
                                    {!isOn(row.is_whitelisted) && !isOn(row.is_blacklisted) && <Muted>—</Muted>}
                                </Chips>
                            </td>
                            <td className={'nowrap'} title={formatDateTime(row.first_seen)}>
                                {timeAgo(row.first_seen)}
                            </td>
                        </tr>
                    ))}
                </tbody>
            </ListFrame>

            <Dialog open={selected !== null} onClose={close} title={'Detalle de la IP'}>
                <div className={'mt-2 flex flex-col gap-4'}>
                    {ipInfo && (
                        <DetailList>
                            <Detail label={'IP'}>
                                <IpText ip={ipInfo.ip} />
                            </Detail>
                            <Detail label={'País'}>
                                <CountryTag code={ipInfo.country_code} name={ipInfo.country} showName />
                            </Detail>
                            <Detail label={'ISP'}>{ipInfo.isp || '—'}</Detail>
                            <Detail label={'AS'} mono>
                                {ipInfo.asn || '—'}
                            </Detail>
                        </DetailList>
                    )}
                    {detail.loading ? (
                        <Skeleton rows={3} />
                    ) : detail.error ? (
                        <RetryNotice title={'No se pudieron cargar los jugadores'} message={detail.error} onRetry={() => selected && open(selected)} />
                    ) : detail.data ? (
                        <div>
                            <h3 className={'text-sm font-semibold mb-2'}>Jugadores que la han usado</h3>
                            {detail.data.players.length === 0 ? (
                                <PanelText className={'px-0'}>Ningún jugador registrado.</PanelText>
                            ) : (
                                <Rows>
                                    {detail.data.players.map((player) => (
                                        <li key={player.uuid}>
                                            <PlayerHead id={player.uuid} name={player.nick} />
                                            <RowMain>{can('players') ? <RowLink to={playerPath(player.uuid)}>{player.nick}</RowLink> : player.nick}</RowMain>
                                            <Muted className={'text-xs'}>{timeAgo(player.last_used)}</Muted>
                                        </li>
                                    ))}
                                </Rows>
                            )}
                        </div>
                    ) : null}
                </div>
                <Dialog.Footer>
                    <Button onClick={close}>Cerrar</Button>
                </Dialog.Footer>
            </Dialog>
        </Stack>
    );
};

export default IpsView;
