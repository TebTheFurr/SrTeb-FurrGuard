import React, { useState } from 'react';
import { FontAwesomeIcon } from '@fortawesome/react-fontawesome';
import { faCheck, faCheckDouble, faClock, faHourglassHalf, faScroll, faShieldAlt, faSignOutAlt, faTrash, faUserPlus, faUsers } from '@fortawesome/free-solid-svg-icons';
import { furr } from '@/api/furrguard/client';
import { SecurityLogRow, SecurityStats, StaffRow, VerificationRow } from '@/api/furrguard/types';
import { Button } from '@/components/elements/button/index';
import Input from '@/components/elements/Input';
import PageHeader from '@/components/elements/ui/PageHeader';
import { useFurrGuard } from '@/components/furrguard/FurrGuardContext';
import { ConfirmDialog, Field, FormDialog } from '@/components/furrguard/dialogs/FormDialog';
import { useBusy, useConfirm, useLoader, usePagedList } from '@/components/furrguard/hooks';
import { formatDateTime, isPast, timeAgo } from '@/components/furrguard/lib/format';
import { isDiscordId, Label, securityActionLabel } from '@/components/furrguard/lib/labels';
import { sectionInfo } from '@/components/furrguard/sections';
import { useQueryTab } from '@/components/furrguard/views/FurrPermsView';
import {
    FilterTabs,
    IconButton,
    IpText,
    ListFrame,
    Mono,
    Muted,
    PlayerCell,
    PlayerHead,
    RowMain,
    SearchBox,
    Spacer,
    Stack,
    StatCard,
    StatsGrid,
    StatusChip,
    SubText,
    TextWithIps,
} from '@/components/furrguard/ui';

const TABS = [
    { value: 'staff', label: 'Staff' },
    { value: 'sessions', label: 'Sesiones' },
    { value: 'logs', label: 'Registro' },
] as const;

const Staff = ({ onChanged }: { onChanged: () => void }) => {
    const { notify } = useFurrGuard();
    const list = usePagedList<StaffRow, { search: string }>({ action: 'furrsecurity_get_staff', filters: { search: '' }, prefix: 'staff_', legacyKey: 'staff' });
    const { busy, run } = useBusy();
    const { confirm, pending, settle } = useConfirm();
    const [dialogOpen, setDialogOpen] = useState(false);
    const [discordId, setDiscordId] = useState('');
    const [nick, setNick] = useState('');

    const openDialog = () => {
        setDiscordId('');
        setNick('');
        setDialogOpen(true);
    };

    const submit = async () => {
        if (!isDiscordId(discordId) || !/^[A-Za-z0-9_]{1,16}$/.test(nick.trim())) throw new Error('Escribe un Discord ID de 17-20 dígitos y un nick de Minecraft válido.');
        await furr('furrsecurity_add_staff', { discord_id: discordId.trim(), minecraft_nick: nick.trim() });
        notify(`${nick.trim()} añadido al staff verificado.`, 'success');
        setDialogOpen(false);
        onChanged();
        list.reload();
    };

    const remove = async (row: StaffRow) => {
        const ok = await confirm({ title: 'Quitar del staff', message: `${row.minecraft_nick} dejará de poder verificarse.`, confirmText: 'Quitar' });
        if (ok && (await run(row.id, () => furr('furrsecurity_remove_staff', { id: row.id }), 'Quitado del staff.'))) {
            onChanged();
            list.reload();
        }
    };

    return (
        <>
            <ListFrame
                list={list}
                label={'Staff de FurrSecurity'}
                emptyIcon={faUsers}
                emptyTitle={'No hay staff registrado'}
                toolbar={
                    <>
                        <SearchBox value={list.filters.search} onChange={(value) => list.setFilter('search', value)} label={'Buscar staff'} placeholder={'Nick o Discord ID…'} />
                        <Spacer />
                        <Button size={Button.Sizes.Small} onClick={openDialog}>
                            <FontAwesomeIcon icon={faUserPlus} />
                            <span className={'ml-2'}>Añadir staff</span>
                        </Button>
                    </>
                }
            >
                <thead>
                    <tr>
                        <th>Nick</th>
                        <th>Discord ID</th>
                        <th>Añadido por</th>
                        <th>Fecha</th>
                        <th className={'actions'}>
                            <span className={'sr-only'}>Acciones</span>
                        </th>
                    </tr>
                </thead>
                <tbody>
                    {list.items.map((row) => (
                        <tr key={row.id}>
                            <td>
                                <PlayerCell>
                                    <PlayerHead id={row.minecraft_nick} name={row.minecraft_nick} />
                                    <strong>{row.minecraft_nick}</strong>
                                </PlayerCell>
                            </td>
                            <td>
                                <Mono>{row.discord_id}</Mono>
                            </td>
                            <td>
                                <Mono>{row.added_by || '—'}</Mono>
                            </td>
                            <td className={'nowrap'} title={formatDateTime(row.added_at)}>
                                {timeAgo(row.added_at)}
                            </td>
                            <td className={'actions'}>
                                <IconButton icon={faTrash} label={`Quitar a ${row.minecraft_nick}`} busy={busy === row.id} danger onClick={() => remove(row)} />
                            </td>
                        </tr>
                    ))}
                </tbody>
            </ListFrame>

            <FormDialog open={dialogOpen} title={'Añadir staff'} submitLabel={'Añadir'} onClose={() => setDialogOpen(false)} onSubmit={submit}>
                <Field label={'Discord ID'} htmlFor={'staff-discord'}>
                    <Input id={'staff-discord'} value={discordId} onChange={(event) => setDiscordId(event.currentTarget.value)} inputMode={'numeric'} maxLength={20} className={'font-mono'} autoFocus />
                </Field>
                <Field label={'Nick de Minecraft'} htmlFor={'staff-nick'}>
                    <Input id={'staff-nick'} value={nick} onChange={(event) => setNick(event.currentTarget.value)} maxLength={16} className={'font-mono'} />
                </Field>
            </FormDialog>
            <ConfirmDialog pending={pending} onSettle={settle} />
        </>
    );
};

const SESSION_FILTERS = [
    { value: 'active', label: 'Activas' },
    { value: 'pending', label: 'Pendientes' },
    { value: 'all', label: 'Todas' },
] as const;

const statusOf = (row: VerificationRow): Label => {
    if (row.status === 'pending') return { label: 'Pendiente', icon: faHourglassHalf, tone: 'warn' };
    if (row.status === 'verified' && !isPast(row.expires_at)) return { label: 'Verificada', icon: faCheck, tone: 'ok' };

    return { label: 'Caducada', icon: faClock, tone: 'neutral' };
};

const Sessions = ({ onChanged }: { onChanged: () => void }) => {
    const list = usePagedList<VerificationRow, { status: string; search: string }>({
        action: 'furrsecurity_get_sessions',
        filters: { status: 'active', search: '' },
        allowed: { status: SESSION_FILTERS.map((f) => f.value) },
        prefix: 'ses_',
    });
    const { busy, run } = useBusy();
    const { confirm, pending, settle } = useConfirm();

    const revoke = async (row: VerificationRow) => {
        const ok = await confirm({ title: 'Revocar sesión', message: `${row.minecraft_nick} tendrá que volver a verificarse para seguir jugando.`, confirmText: 'Revocar' });
        if (ok && (await run(row.id, () => furr('furrsecurity_revoke_session', { id: row.id }), 'Sesión revocada.'))) {
            onChanged();
            list.reload();
        }
    };

    return (
        <>
            <ListFrame
                list={list}
                label={'Sesiones de verificación'}
                emptyIcon={faShieldAlt}
                emptyTitle={'No hay sesiones con este filtro'}
                toolbar={
                    <>
                        <FilterTabs value={list.filters.status} onChange={(value) => list.setFilter('status', value)} options={SESSION_FILTERS} label={'Filtrar sesiones'} />
                        <SearchBox value={list.filters.search} onChange={(value) => list.setFilter('search', value)} label={'Buscar sesiones'} placeholder={'Nick, UUID o Discord ID…'} />
                    </>
                }
            >
                <thead>
                    <tr>
                        <th>Jugador</th>
                        <th>Discord ID</th>
                        <th>Estado</th>
                        <th>Verificada</th>
                        <th>Expira</th>
                        <th>IP</th>
                        <th className={'actions'}>
                            <span className={'sr-only'}>Acciones</span>
                        </th>
                    </tr>
                </thead>
                <tbody>
                    {list.items.map((row) => {
                        const status = statusOf(row);

                        return (
                            <tr key={row.id}>
                                <td>
                                    <RowMain>
                                        {row.minecraft_nick}
                                        <SubText>{row.uuid}</SubText>
                                    </RowMain>
                                </td>
                                <td>
                                    <Mono>{row.discord_id || '—'}</Mono>
                                </td>
                                <td>
                                    <StatusChip {...status} />
                                </td>
                                <td className={'nowrap'}>{formatDateTime(row.verified_at)}</td>
                                <td className={'nowrap'} title={formatDateTime(row.expires_at)}>
                                    {timeAgo(row.expires_at)}
                                </td>
                                <td>
                                    <IpText ip={row.ip_address} />
                                </td>
                                <td className={'actions'}>
                                    {status.tone !== 'neutral' && (
                                        <Button size={Button.Sizes.Small} variant={Button.Variants.Secondary} onClick={() => revoke(row)} disabled={busy === row.id}>
                                            <FontAwesomeIcon icon={faSignOutAlt} />
                                            <span className={'ml-2'}>Revocar</span>
                                        </Button>
                                    )}
                                </td>
                            </tr>
                        );
                    })}
                </tbody>
            </ListFrame>
            <ConfirmDialog pending={pending} onSettle={settle} />
        </>
    );
};

const LOG_GROUPS = [
    { value: 'all', label: 'Todo' },
    { value: 'verification', label: 'Verificaciones' },
    { value: 'failed', label: 'Fallos' },
    { value: 'blacklist', label: 'Auto-baneos' },
    { value: 'session', label: 'Sesiones' },
] as const;

const Logs = () => {
    const list = usePagedList<SecurityLogRow, { group: string; search: string }>({
        action: 'furrsecurity_get_logs',
        filters: { group: 'all', search: '' },
        allowed: { group: LOG_GROUPS.map((g) => g.value) },
        prefix: 'log_',
        perPage: 50,
        legacyKey: 'logs',
    });

    return (
        <ListFrame
            list={list}
            label={'Registro de FurrSecurity'}
            emptyIcon={faScroll}
            emptyTitle={'No hay eventos con este filtro'}
            toolbar={
                <>
                    <FilterTabs value={list.filters.group} onChange={(value) => list.setFilter('group', value)} options={LOG_GROUPS} label={'Filtrar eventos'} />
                    <SearchBox value={list.filters.search} onChange={(value) => list.setFilter('search', value)} label={'Buscar en el registro de FurrSecurity'} placeholder={'Nick, UUID, Discord o detalle…'} />
                </>
            }
        >
            <thead>
                <tr>
                    <th>Fecha</th>
                    <th>Evento</th>
                    <th>Jugador</th>
                    <th>Discord ID</th>
                    <th>Detalles</th>
                    <th>IP</th>
                </tr>
            </thead>
            <tbody>
                {list.items.map((row) => (
                    <tr key={row.id}>
                        <td className={'nowrap'} title={timeAgo(row.created_at)}>
                            {formatDateTime(row.created_at)}
                        </td>
                        <td>
                            <StatusChip {...securityActionLabel(row.action)} />
                        </td>
                        <td>{row.minecraft_nick || <Muted>—</Muted>}</td>
                        <td>
                            <Mono>{row.discord_id || '—'}</Mono>
                        </td>
                        <td className={'text'}>
                            <TextWithIps text={row.details} />
                        </td>
                        <td>
                            <IpText ip={row.ip_address} />
                        </td>
                    </tr>
                ))}
            </tbody>
        </ListFrame>
    );
};

const FurrSecurityView = () => {
    const info = sectionInfo('furrsecurity');
    const [tab, setTab] = useQueryTab(
        TABS.map((t) => t.value),
        'staff'
    );
    /** The stats are secondary: if they fail the cards show «—» and the view stays usable. */
    const { data: stats, reload } = useLoader<SecurityStats>((signal) => furr<SecurityStats>('furrsecurity_get_stats', {}, signal));

    return (
        <Stack>
            <PageHeader title={info.label} description={info.description} />

            <StatsGrid $min={150}>
                <StatCard label={'Staff'} value={stats?.total_staff} icon={faUsers} />
                <StatCard label={'Sesiones activas'} value={stats?.active_sessions} icon={faShieldAlt} tone={'ok'} />
                <StatCard label={'Pendientes'} value={stats?.pending_verifications} icon={faHourglassHalf} tone={'warn'} />
                <StatCard label={'Verificados hoy'} value={stats?.verified_today} icon={faCheckDouble} />
            </StatsGrid>

            <FilterTabs value={tab} onChange={(value) => setTab(value as typeof tab)} options={TABS} label={'Secciones de FurrSecurity'} />
            {tab === 'staff' ? <Staff onChanged={reload} /> : tab === 'sessions' ? <Sessions onChanged={reload} /> : <Logs />}
        </Stack>
    );
};

export default FurrSecurityView;
