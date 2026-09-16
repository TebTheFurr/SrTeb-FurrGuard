import React, { useState } from 'react';
import { useHistory, useLocation } from 'react-router-dom';
import { FontAwesomeIcon } from '@fortawesome/react-fontawesome';
import { faBan, faCheck, faLock, faTerminal, faTrash, faUserPlus } from '@fortawesome/free-solid-svg-icons';
import { furr } from '@/api/furrguard/client';
import { FurrPermsEntry, FurrPermsLog } from '@/api/furrguard/types';
import { Button } from '@/components/elements/button/index';
import Input from '@/components/elements/Input';
import PageHeader from '@/components/elements/ui/PageHeader';
import { useFurrGuard } from '@/components/furrguard/FurrGuardContext';
import { ConfirmDialog, Field, FormDialog } from '@/components/furrguard/dialogs/FormDialog';
import { TextAreaField } from '@/components/furrguard/dialogs/fields';
import { useBusy, useConfirm, usePagedList } from '@/components/furrguard/hooks';
import { formatDateTime, formatNumber, isOn, timeAgo } from '@/components/furrguard/lib/format';
import { isUuid } from '@/components/furrguard/lib/labels';
import { sectionInfo } from '@/components/furrguard/sections';
import { Chip, FilterTabs, IconButton, IpText, ListFrame, Mono, Muted, PlayerCell, PlayerHead, SearchBox, Spacer, Stack } from '@/components/furrguard/ui';

/** Active tab kept in `?tab=`: going back or reloading keeps it. */
export function useQueryTab<V extends string>(values: readonly V[], fallback: V): [V, (value: V) => void] {
    const location = useLocation();
    const history = useHistory();
    const query = new URLSearchParams(location.search);
    const raw = query.get('tab');
    const tab = raw && (values as readonly string[]).includes(raw) ? (raw as V) : fallback;
    const setTab = (value: V) => {
        const next = new URLSearchParams(location.search);
        if (value === fallback) next.delete('tab');
        else next.set('tab', value);
        const search = next.toString();
        history.replace({ pathname: location.pathname, search: search ? `?${search}` : '' });
    };

    return [tab, setTab];
}

const TABS = [
    { value: 'whitelist', label: 'Whitelist de comandos' },
    { value: 'logs', label: 'Registro de comandos' },
] as const;

const Whitelist = () => {
    const { notify } = useFurrGuard();
    const list = usePagedList<FurrPermsEntry, { search: string }>({ action: 'get_furr_perms_whitelist', filters: { search: '' }, prefix: 'wl_', legacyKey: 'entries' });
    const { busy, run } = useBusy();
    const { confirm, pending, settle } = useConfirm();
    const [dialogOpen, setDialogOpen] = useState(false);
    const [nick, setNick] = useState('');
    const [uuid, setUuid] = useState('');
    const [reason, setReason] = useState('');

    const openDialog = () => {
        setNick('');
        setUuid('');
        setReason('');
        setDialogOpen(true);
    };

    const submit = async () => {
        const trimmedNick = nick.trim();
        const trimmedUuid = uuid.trim();
        if (!/^[A-Za-z0-9_]{1,16}$/.test(trimmedNick)) throw new Error('Nick no válido: 1-16 caracteres (letras, números y _).');
        if (trimmedUuid && !isUuid(trimmedUuid)) throw new Error('El UUID no es válido. Déjalo vacío si no lo sabes.');
        await furr('add_furr_perms_whitelist', { nick: trimmedNick, ...(trimmedUuid && { uuid: trimmedUuid }), reason: reason.trim() });
        notify(`${trimmedNick} puede usar los comandos protegidos.`, 'success');
        setDialogOpen(false);
        list.reload();
    };

    const remove = async (row: FurrPermsEntry) => {
        const ok = await confirm({ title: 'Quitar de FurrPerms', message: `${row.nick} dejará de poder usar los comandos protegidos.`, confirmText: 'Quitar' });
        if (ok && (await run(row.id, () => furr('remove_furr_perms_whitelist', { id: row.id }), 'Jugador quitado de FurrPerms.'))) list.reload();
    };

    return (
        <>
            <ListFrame
                list={list}
                label={'Whitelist de FurrPerms'}
                emptyIcon={faLock}
                emptyTitle={'Nadie puede usar comandos protegidos'}
                emptyText={'Añade al staff que los necesite.'}
                toolbar={
                    <>
                        <SearchBox value={list.filters.search} onChange={(value) => list.setFilter('search', value)} label={'Buscar en la whitelist de FurrPerms'} placeholder={'Nick…'} />
                        <Spacer />
                        <Button size={Button.Sizes.Small} onClick={openDialog}>
                            <FontAwesomeIcon icon={faUserPlus} />
                            <span className={'ml-2'}>Añadir jugador</span>
                        </Button>
                    </>
                }
            >
                <thead>
                    <tr>
                        <th>Jugador</th>
                        <th>UUID</th>
                        <th>Motivo</th>
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
                                    <PlayerHead id={row.uuid || row.nick} name={row.nick} />
                                    <strong>{row.nick}</strong>
                                </PlayerCell>
                            </td>
                            <td>{row.uuid ? <Mono>{row.uuid}</Mono> : <Muted>Cualquiera con ese nick</Muted>}</td>
                            <td className={'text'}>{row.reason || <Muted>—</Muted>}</td>
                            <td>{row.added_by || <Muted>—</Muted>}</td>
                            <td className={'nowrap'} title={formatDateTime(row.created_at)}>
                                {timeAgo(row.created_at)}
                            </td>
                            <td className={'actions'}>
                                <IconButton icon={faTrash} label={`Quitar a ${row.nick}`} busy={busy === row.id} danger onClick={() => remove(row)} />
                            </td>
                        </tr>
                    ))}
                </tbody>
            </ListFrame>

            <FormDialog open={dialogOpen} title={'Añadir a FurrPerms'} submitLabel={'Añadir'} onClose={() => setDialogOpen(false)} onSubmit={submit}>
                <Field label={'Nick'} htmlFor={'fp-nick'}>
                    <Input id={'fp-nick'} value={nick} onChange={(event) => setNick(event.currentTarget.value)} maxLength={16} autoComplete={'off'} className={'font-mono'} autoFocus />
                </Field>
                <Field label={'UUID'} htmlFor={'fp-uuid'} help={'Si lo indicas, el nick solo vale con esa cuenta (evita suplantaciones en modo offline).'} optional>
                    <Input id={'fp-uuid'} value={uuid} onChange={(event) => setUuid(event.currentTarget.value)} maxLength={36} autoComplete={'off'} className={'font-mono'} />
                </Field>
                <TextAreaField id={'fp-reason'} label={'Motivo'} value={reason} onChange={setReason} rows={2} />
            </FormDialog>
            <ConfirmDialog pending={pending} onSettle={settle} />
        </>
    );
};

const LOG_FILTERS = [
    { value: 'all', label: 'Todos' },
    { value: 'allowed', label: 'Permitidos', icon: faCheck },
    { value: 'blocked', label: 'Bloqueados', icon: faBan },
] as const;

const Logs = () => {
    const { notify, notifyError } = useFurrGuard();
    const list = usePagedList<FurrPermsLog, { filter: string; search: string }>({
        action: 'get_furr_perms_logs',
        filters: { filter: 'all', search: '' },
        allowed: { filter: LOG_FILTERS.map((f) => f.value) },
        prefix: 'log_',
        perPage: 50,
        legacyKey: 'logs',
    });
    const { confirm, pending, settle } = useConfirm();
    const [clearing, setClearing] = useState(false);

    const clearOld = async () => {
        const ok = await confirm({ title: 'Limpiar registro antiguo', message: 'Se borrarán los registros de comandos de más de 30 días.', confirmText: 'Limpiar' });
        if (!ok) return;
        setClearing(true);
        try {
            const result = await furr<{ deleted_count?: number } | null>('clear_furr_perms_logs');
            notify(`Registro limpiado: ${formatNumber(result?.deleted_count ?? 0)} entradas borradas.`, 'success');
            list.reload();
        } catch (e) {
            notifyError(e);
        } finally {
            setClearing(false);
        }
    };

    return (
        <>
            <ListFrame
                list={list}
                label={'Registro de comandos'}
                emptyIcon={faTerminal}
                emptyTitle={'No hay comandos registrados con este filtro'}
                toolbar={
                    <>
                        <FilterTabs value={list.filters.filter} onChange={(value) => list.setFilter('filter', value)} options={LOG_FILTERS} label={'Filtrar por resultado'} />
                        <SearchBox value={list.filters.search} onChange={(value) => list.setFilter('search', value)} label={'Buscar en el registro de comandos'} placeholder={'Jugador o comando…'} />
                        <Spacer />
                        <Button size={Button.Sizes.Small} variant={Button.Variants.Secondary} onClick={clearOld} disabled={clearing}>
                            <FontAwesomeIcon icon={faTrash} />
                            <span className={'ml-2'}>Limpiar antiguos</span>
                        </Button>
                    </>
                }
            >
                <thead>
                    <tr>
                        <th>Fecha</th>
                        <th>Jugador</th>
                        <th>Comando</th>
                        <th>Servidor</th>
                        <th>Resultado</th>
                        <th>IP</th>
                    </tr>
                </thead>
                <tbody>
                    {list.items.map((row) => (
                        <tr key={row.id} className={isOn(row.allowed) ? undefined : 'blocked'}>
                            <td className={'nowrap'} title={formatDateTime(row.created_at)}>
                                {timeAgo(row.created_at)}
                            </td>
                            <td>{row.player_nick}</td>
                            <td className={'text'}>
                                <Mono>{row.command}</Mono>
                            </td>
                            <td>{row.server_name || <Muted>—</Muted>}</td>
                            <td>
                                {isOn(row.allowed) ? (
                                    <Chip tone={'ok'} icon={faCheck}>
                                        Permitido
                                    </Chip>
                                ) : (
                                    <Chip tone={'down'} icon={faBan} title={row.reason ?? undefined}>
                                        Bloqueado
                                    </Chip>
                                )}
                            </td>
                            <td>
                                <IpText ip={row.ip_address} />
                            </td>
                        </tr>
                    ))}
                </tbody>
            </ListFrame>
            <ConfirmDialog pending={pending} onSettle={settle} />
        </>
    );
};

const FurrPermsView = () => {
    const info = sectionInfo('furrperms');
    const [tab, setTab] = useQueryTab(
        TABS.map((t) => t.value),
        'whitelist'
    );

    return (
        <Stack>
            <PageHeader title={info.label} description={info.description} />
            <FilterTabs value={tab} onChange={(value) => setTab(value as typeof tab)} options={TABS} label={'Secciones de FurrPerms'} />
            {/* Each tab mounts its own list: independent searches and filters (wl_ and log_ prefixes in the URL). */}
            {tab === 'whitelist' ? <Whitelist /> : <Logs />}
        </Stack>
    );
};

export default FurrPermsView;
