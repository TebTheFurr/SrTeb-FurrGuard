import React, { useState } from 'react';
import { Link, useParams } from 'react-router-dom';
import styled from 'styled-components/macro';
import tw from 'twin.macro';
import { FontAwesomeIcon } from '@fortawesome/react-fontawesome';
import {
    faBan,
    faClipboardCheck,
    faCrown,
    faExclamationTriangle,
    faGlobe,
    faHistory,
    faPlug,
    faQuestionCircle,
    faTag,
    faTrash,
    faUnlock,
} from '@fortawesome/free-solid-svg-icons';
import { furr, isAbortError } from '@/api/furrguard/client';
import { BlacklistRef, NameHistory, NameHistorySource, PlayerDetail, WhitelistRef } from '@/api/furrguard/types';
import { Button } from '@/components/elements/button/index';
import DataField from '@/components/elements/ui/DataField';
import PageHeader from '@/components/elements/ui/PageHeader';
import { Notice, NoticeBody } from '@/components/server/vault/vaultStyles';
import { useFurrGuard } from '@/components/furrguard/FurrGuardContext';
import { ConfirmDialog } from '@/components/furrguard/dialogs/FormDialog';
import { BanDialog, BanDraft, WhitelistDialog, WhitelistDraft } from '@/components/furrguard/dialogs/ListDialogs';
import { useBusy, useConfirm, useLoader } from '@/components/furrguard/hooks';
import { errorMessage, formatDateTime, formatNumber, isOn, timeAgo } from '@/components/furrguard/lib/format';
import { banExpiry, banStatus, entryLabel, reasonLabel } from '@/components/furrguard/lib/labels';
import { sectionPath } from '@/components/furrguard/sections';
import {
    ActiveSwitch,
    Chip,
    CountryTag,
    EmptyState,
    IconButton,
    IpText,
    Mono,
    Muted,
    OnlineChip,
    PanelText,
    PlayerHead,
    PrimaryLink,
    RowActions,
    RowMain,
    Rows,
    SectionPanel,
    Skeleton,
    Stack,
    StatusChip,
    SubText,
    Table,
    TwoColumns,
} from '@/components/furrguard/ui';

const Card = styled.div`
    ${tw`flex flex-wrap items-start gap-5 p-5 rounded-[var(--border-radius)]`};
    background-color: var(--color-background-secondary);
    border: 1px solid var(--color-neutral);
`;

const CardBody = styled.div`
    ${tw`flex flex-col gap-3 flex-1 min-w-0`};
    flex-basis: 20rem;
`;

const NameLine = styled.div`
    ${tw`flex flex-wrap items-center gap-2`};

    h1 {
        ${tw`text-2xl font-semibold`};
        color: var(--color-base);
        overflow-wrap: anywhere;
    }
`;

const Meta = styled.div`
    ${tw`flex flex-wrap gap-x-5 gap-y-1 text-sm`};
    color: var(--color-muted);

    b {
        ${tw`font-medium`};
        color: var(--color-base);
    }
`;

const Actions = styled.div`
    ${tw`flex flex-wrap gap-2`};
`;

const SOURCE_LABELS: Record<NameHistorySource, string> = { mojang: 'Mojang', laby: 'Laby', namemc: 'NameMC' };

/** External services (Mojang, Laby, NameMC) are only queried on demand. */
const NameHistoryPanel = ({ playerName }: { playerName: string }) => {
    const { interceptError } = useFurrGuard();
    const [history, setHistory] = useState<NameHistory | null>(null);
    const [loading, setLoading] = useState(false);
    const [error, setError] = useState('');

    const load = () => {
        setLoading(true);
        setError('');
        setHistory(null);
        furr<NameHistory>('get_name_history', { player_name: playerName })
            .then(setHistory)
            .catch((e) => {
                if (isAbortError(e) || interceptError(e)) return;
                setError(errorMessage(e, 'No se pudo consultar el historial.'));
            })
            .then(() => setLoading(false));
    };

    const failed = history && history.complete === false ? history.failed_sources.map((source) => SOURCE_LABELS[source] ?? source).join(', ') : '';

    return (
        <SectionPanel
            icon={faHistory}
            title={'Historial de nombres'}
            actions={
                <Button size={Button.Sizes.Small} variant={Button.Variants.Secondary} onClick={load} disabled={loading}>
                    {history ? 'Volver a consultar' : 'Consultar'}
                </Button>
            }
        >
            {error ? (
                <PanelText role={'alert'}>{error}</PanelText>
            ) : loading ? (
                <PanelText aria-busy={'true'}>Consultando…</PanelText>
            ) : !history ? (
                <PanelText>Se consulta a servicios externos (Mojang, Laby, NameMC) solo cuando lo pides.</PanelText>
            ) : (
                <>
                    {failed && (
                        <div className={'px-4 pt-3'}>
                            <Notice $tone={'warning'} role={'status'}>
                                <FontAwesomeIcon icon={faExclamationTriangle} />
                                <NoticeBody>
                                    <strong>Historial posiblemente incompleto</strong>
                                    <p>No se pudo consultar {failed}: puede faltar algún nombre anterior. Vuelve a consultar más tarde.</p>
                                </NoticeBody>
                            </Notice>
                        </div>
                    )}
                    {history.history.length === 0 ? (
                        <PanelText>No hay cambios de nombre registrados.</PanelText>
                    ) : (
                        <Rows>
                            {history.history.map((entry, index) => (
                                <li key={`${entry.name}-${index}`}>
                                    <RowMain>
                                        <Mono className={'font-semibold'}>{entry.name}</Mono>
                                    </RowMain>
                                    <Muted className={'text-xs'}>{entry.changed_at ? formatDateTime(entry.changed_at) : 'Original'}</Muted>
                                </li>
                            ))}
                        </Rows>
                    )}
                </>
            )}
        </SectionPanel>
    );
};

const PlayerDetailView = () => {
    const { uuid } = useParams<{ uuid: string }>();
    const { can, canSeeIps } = useFurrGuard();
    const { busy, run } = useBusy();
    const { confirm, pending, settle } = useConfirm();
    const [whitelistDraft, setWhitelistDraft] = useState<WhitelistDraft | null>(null);
    const [banDraft, setBanDraft] = useState<BanDraft | null>(null);
    const { data: detail, error, reload } = useLoader<PlayerDetail>((signal) => furr<PlayerDetail>('get_player_detail', { uuid }, signal), [uuid]);

    const player = detail?.player ?? null;
    const isPremium = detail?.premium.status === 'premium';
    const premium =
        detail?.premium.status === 'premium'
            ? { label: 'Premium', icon: faCrown, tone: 'gold' as const }
            : detail?.premium.status === 'not_found'
            ? { label: 'No premium', icon: faUnlock, tone: 'neutral' as const }
            : { label: 'Premium desconocido', icon: faQuestionCircle, tone: 'neutral' as const };

    /** Premium → by UUID; not premium → by nick (its offline UUID changes with the name). */
    const openWhitelist = () => {
        if (!player) return;
        setWhitelistDraft(isPremium ? { type: 'uuid', value: player.uuid, reason: '' } : { type: 'nick', value: player.last_nick, reason: '' });
    };

    const openBan = () => {
        if (!player) return;
        setBanDraft(isPremium ? { type: 'uuid', value: player.uuid } : { type: 'nick', value: player.last_nick });
    };

    const afterSave = () => {
        setWhitelistDraft(null);
        setBanDraft(null);
        reload();
    };

    const removeWhitelist = async (entry: WhitelistRef) => {
        const ok = await confirm({ title: 'Quitar de la whitelist', message: `Se eliminará la entrada ${entryLabel(entry.type)} «${entry.value}».`, confirmText: 'Quitar' });
        if (ok && (await run(`wl-${entry.id}`, () => furr('remove_whitelist', { id: entry.id }), 'Entrada de whitelist eliminada.'))) reload();
    };

    const toggleBan = async (entry: BlacklistRef, active: boolean) => {
        if (await run(`bl-${entry.id}`, () => furr('set_blacklist_active', { id: entry.id, active }), active ? 'Baneo activado.' : 'Baneo desactivado.')) reload();
    };

    const removeBan = async (entry: BlacklistRef) => {
        const ok = await confirm({ title: 'Eliminar baneo', message: `Se borrará el baneo ${entry.ban_id} y sus IPs hijas. No se puede deshacer.`, confirmText: 'Eliminar' });
        if (ok && (await run(`bl-${entry.id}`, () => furr('remove_blacklist', { id: entry.id }), 'Baneo eliminado.'))) reload();
    };

    if (error) {
        return (
            <Stack>
                <PageHeader title={'Ficha de jugador'} />
                <EmptyState icon={faExclamationTriangle} tone={'down'} title={error.status === 404 ? 'Jugador no encontrado' : 'No se pudo cargar el jugador'} text={error.message}>
                    <Link to={sectionPath('players')}>
                        <Button variant={Button.Variants.Secondary} size={Button.Sizes.Small}>
                            Volver a jugadores
                        </Button>
                    </Link>
                    {error.status !== 404 && (
                        <Button size={Button.Sizes.Small} onClick={reload}>
                            Reintentar
                        </Button>
                    )}
                </EmptyState>
            </Stack>
        );
    }

    if (!detail || !player) {
        return (
            <Stack>
                <PageHeader title={'Ficha de jugador'} />
                <Skeleton rows={3} />
            </Stack>
        );
    }

    return (
        <Stack>
            <PageHeader
                title={player.last_nick}
                description={
                    <>
                        <PrimaryLink to={sectionPath('players')}>Jugadores</PrimaryLink> › Ficha de jugador
                    </>
                }
            />

            <Card>
                <PlayerHead id={player.uuid} name={player.last_nick} size={72} />
                <CardBody>
                    <NameLine>
                        <h1>{player.last_nick}</h1>
                        {isOn(player.is_online) && <OnlineChip />}
                        <StatusChip {...premium} />
                        {isOn(player.is_whitelisted) && (
                            <Chip tone={'accent'} icon={faClipboardCheck}>
                                Whitelist
                            </Chip>
                        )}
                        {isOn(player.is_blacklisted) && (
                            <Chip tone={'down'} icon={faBan}>
                                Blacklist
                            </Chip>
                        )}
                    </NameLine>
                    <DataField label={'UUID'} value={player.uuid} copyValue={player.uuid} mono />
                    <Meta>
                        <span>
                            Primera vez <b title={formatDateTime(player.first_seen)}>{timeAgo(player.first_seen)}</b>
                        </span>
                        <span>
                            Última vez <b title={formatDateTime(player.last_seen)}>{timeAgo(player.last_seen)}</b>
                        </span>
                        <span>
                            Conexiones <b>{formatNumber(player.total_connections)}</b>
                        </span>
                        {canSeeIps && (
                            <span>
                                Última IP{' '}
                                <b>
                                    <IpText ip={player.last_ip} hiddenByServer={detail.ip_hidden} />
                                </b>
                            </span>
                        )}
                        <span>
                            País{' '}
                            <b>
                                <CountryTag code={player.last_country_code} name={player.last_country} showName />
                            </b>
                        </span>
                    </Meta>
                </CardBody>
                <Actions>
                    {can('whitelist') && (
                        <Button variant={Button.Variants.Secondary} onClick={openWhitelist}>
                            <FontAwesomeIcon icon={faClipboardCheck} />
                            <span className={'ml-2'}>Whitelist</span>
                        </Button>
                    )}
                    {can('blacklist') && (
                        <Button.Danger onClick={openBan}>
                            <FontAwesomeIcon icon={faBan} />
                            <span className={'ml-2'}>Banear</span>
                        </Button.Danger>
                    )}
                </Actions>
            </Card>

            <TwoColumns>
                <SectionPanel icon={faClipboardCheck} title={'Whitelist'}>
                    {detail.whitelist_entries.length === 0 ? (
                        <PanelText>No tiene entradas de whitelist.</PanelText>
                    ) : (
                        <Rows>
                            {detail.whitelist_entries.map((entry) => (
                                <li key={entry.id}>
                                    <Chip>{entryLabel(entry.type)}</Chip>
                                    <RowMain>
                                        <Mono>{entry.value}</Mono>
                                    </RowMain>
                                    {can('whitelist') && (
                                        <IconButton icon={faTrash} label={`Quitar ${entry.value} de la whitelist`} busy={busy === `wl-${entry.id}`} danger onClick={() => removeWhitelist(entry)} />
                                    )}
                                </li>
                            ))}
                        </Rows>
                    )}
                </SectionPanel>

                <SectionPanel icon={faBan} title={'Baneos'}>
                    {detail.blacklist_entries.length === 0 ? (
                        <PanelText>No tiene baneos.</PanelText>
                    ) : (
                        <Rows>
                            {detail.blacklist_entries.map((entry) => (
                                <li key={entry.id}>
                                    <Muted className={'font-mono text-xs'}>{entry.ban_id}</Muted>
                                    <RowMain>
                                        <Mono>
                                            {entryLabel(entry.type)} · {entry.value}
                                        </Mono>
                                        <SubText>{entry.reason || 'Sin motivo'}</SubText>
                                    </RowMain>
                                    <StatusChip {...banStatus(entry.active, entry.expires_at)} />
                                    <StatusChip {...banExpiry(entry.expires_at)} />
                                    {can('blacklist') && (
                                        <RowActions>
                                            <ActiveSwitch active={isOn(entry.active)} busy={busy === `bl-${entry.id}`} label={`Baneo ${entry.ban_id} activo`} onChange={(active) => toggleBan(entry, active)} />
                                            <IconButton icon={faTrash} label={`Eliminar baneo ${entry.ban_id}`} danger onClick={() => removeBan(entry)} />
                                        </RowActions>
                                    )}
                                </li>
                            ))}
                        </Rows>
                    )}
                </SectionPanel>

                <SectionPanel icon={faTag} title={'Nicks usados'}>
                    {detail.nicks.length === 0 ? (
                        <PanelText>Sin nicks registrados.</PanelText>
                    ) : (
                        <Rows>
                            {detail.nicks.map((nick) => (
                                <li key={nick.nick}>
                                    <RowMain>
                                        <Mono className={'font-semibold'}>{nick.nick}</Mono>
                                    </RowMain>
                                    <Muted className={'text-xs'} title={formatDateTime(nick.last_used)}>
                                        {formatDateTime(nick.first_used)} → {timeAgo(nick.last_used)}
                                    </Muted>
                                </li>
                            ))}
                        </Rows>
                    )}
                </SectionPanel>

                <NameHistoryPanel playerName={player.last_nick} />
            </TwoColumns>

            {canSeeIps && (
                <SectionPanel icon={faGlobe} title={'IPs'}>
                    {detail.ip_hidden || detail.ips.length === 0 ? (
                        <PanelText>{detail.ip_hidden ? 'Tu rol no puede ver las IPs.' : 'Sin IPs registradas.'}</PanelText>
                    ) : (
                        <Table>
                            <thead>
                                <tr>
                                    <th>IP</th>
                                    <th>País</th>
                                    <th>ISP</th>
                                    <th>Primera vez</th>
                                    <th>Última vez</th>
                                </tr>
                            </thead>
                            <tbody>
                                {detail.ips.map((ip, index) => (
                                    <tr key={ip.ip ?? index}>
                                        <td>
                                            <IpText ip={ip.ip} />
                                        </td>
                                        <td>
                                            <CountryTag code={ip.country_code} name={ip.country} showName />
                                        </td>
                                        <td className={'text'}>{ip.isp || <Muted>—</Muted>}</td>
                                        <td className={'nowrap'}>{formatDateTime(ip.first_used)}</td>
                                        <td className={'nowrap'} title={formatDateTime(ip.last_used)}>
                                            {timeAgo(ip.last_used)}
                                        </td>
                                    </tr>
                                ))}
                            </tbody>
                        </Table>
                    )}
                </SectionPanel>
            )}

            <SectionPanel icon={faPlug} title={'Conexiones recientes'}>
                {detail.recent_connections.length === 0 ? (
                    <PanelText>Sin conexiones registradas.</PanelText>
                ) : (
                    <Table>
                        <thead>
                            <tr>
                                <th>Fecha</th>
                                {canSeeIps && <th>IP</th>}
                                <th>País</th>
                                <th>Nick</th>
                                <th>Resultado</th>
                            </tr>
                        </thead>
                        <tbody>
                            {detail.recent_connections.map((connection) => (
                                <tr key={connection.id} className={isOn(connection.blocked) ? 'blocked' : undefined}>
                                    <td className={'nowrap'}>{formatDateTime(connection.created_at)}</td>
                                    {canSeeIps && (
                                        <td>
                                            <IpText ip={connection.ip} />
                                        </td>
                                    )}
                                    <td>
                                        <CountryTag code={connection.country_code} name={connection.country} />
                                    </td>
                                    <td>
                                        <Mono>{connection.nick}</Mono>
                                    </td>
                                    <td>
                                        <StatusChip {...reasonLabel(isOn(connection.blocked) ? connection.block_reason : 'allowed')} />
                                    </td>
                                </tr>
                            ))}
                        </tbody>
                    </Table>
                )}
            </SectionPanel>

            <WhitelistDialog draft={whitelistDraft} onClose={() => setWhitelistDraft(null)} onSaved={afterSave} />
            <BanDialog draft={banDraft} onClose={() => setBanDraft(null)} onSaved={afterSave} />
            <ConfirmDialog pending={pending} onSettle={settle} />
        </Stack>
    );
};

export default PlayerDetailView;
