import React, { useEffect, useRef, useState } from 'react';
import { FontAwesomeIcon } from '@fortawesome/react-fontawesome';
import { faCrown, faSearch, faUnlock } from '@fortawesome/free-solid-svg-icons';
import { furr, isAbortError } from '@/api/furrguard/client';
import { EntryType, LookupResult } from '@/api/furrguard/types';
import { Button } from '@/components/elements/button/index';
import Input from '@/components/elements/Input';
import { CheckRow, CheckText, HelpText } from '@/components/server/vault/vaultStyles';
import { useFurrGuard } from '@/components/furrguard/FurrGuardContext';
import { Field, FormDialog } from '@/components/furrguard/dialogs/FormDialog';
import { DurationField, EntryFields, TextAreaField } from '@/components/furrguard/dialogs/fields';
import { errorMessage, formatDateTime } from '@/components/furrguard/lib/format';
import { isNick, validateEntry } from '@/components/furrguard/lib/labels';
import { Chip, Mono } from '@/components/furrguard/ui';

/*
 * Dialogs of the whitelist and blacklist (docs/API.md §4.4). Each one resets its form every
 * time it opens with the values of whoever opened it (a row being edited, the player card…).
 */

export interface WhitelistDraft {
    id?: number;
    type: EntryType;
    value: string;
    reason?: string | null;
}

interface WhitelistDialogProps {
    draft: WhitelistDraft | null;
    onClose: () => void;
    onSaved: () => void;
}

export const WhitelistDialog = ({ draft, onClose, onSaved }: WhitelistDialogProps) => {
    const { notify } = useFurrGuard();
    const [type, setType] = useState<EntryType>('uuid');
    const [value, setValue] = useState('');
    const [reason, setReason] = useState('');
    const [touched, setTouched] = useState(false);

    useEffect(() => {
        if (!draft) return;
        setType(draft.type);
        setValue(draft.value);
        setReason(draft.reason ?? '');
        setTouched(false);
    }, [draft]);

    const submit = async () => {
        setTouched(true);
        const problem = validateEntry(type, value);
        if (problem) throw new Error(problem);
        const params = { type, value: value.trim(), reason: reason.trim() };
        if (draft?.id) await furr('edit_whitelist', { id: draft.id, ...params });
        else await furr('add_whitelist', params);
        notify(draft?.id ? 'Entrada de whitelist actualizada.' : 'Añadido a la whitelist.', 'success');
        onSaved();
    };

    return (
        <FormDialog open={draft !== null} title={draft?.id ? 'Editar entrada de whitelist' : 'Añadir a la whitelist'} onClose={onClose} onSubmit={submit}>
            <EntryFields type={type} value={value} onTypeChange={setType} onValueChange={setValue} touched={touched} idPrefix={'wl'} />
            <TextAreaField id={'wl-reason'} label={'Motivo'} value={reason} onChange={setReason} optional />
        </FormDialog>
    );
};

export interface BanDraft {
    type: EntryType;
    value: string;
}

interface BanDialogProps {
    draft: BanDraft | null;
    onClose: () => void;
    onSaved: () => void;
}

/** Advanced ban by type (uuid, nick, ip, ip_range, as). */
export const BanDialog = ({ draft, onClose, onSaved }: BanDialogProps) => {
    const { notify } = useFurrGuard();
    const [type, setType] = useState<EntryType>('uuid');
    const [value, setValue] = useState('');
    const [reason, setReason] = useState('');
    const [duration, setDuration] = useState<number | null>(0);
    const [stainIp, setStainIp] = useState(true);
    const [touched, setTouched] = useState(false);
    const stainsIps = type === 'uuid' || type === 'nick';

    useEffect(() => {
        if (!draft) return;
        setType(draft.type);
        setValue(draft.value);
        setReason('');
        setDuration(0);
        setStainIp(true);
        setTouched(false);
    }, [draft]);

    const submit = async () => {
        setTouched(true);
        const problem = validateEntry(type, value);
        if (problem) throw new Error(problem);
        const result = await furr<{ ban_id: string; reactivated?: boolean } | null>('add_blacklist', {
            type,
            value: value.trim(),
            reason: reason.trim(),
            duration_minutes: duration ?? 0,
            stain_ip: stainsIps && stainIp,
        });
        notify(result?.reactivated ? `Baneo reactivado (ID ${result.ban_id}).` : `Baneo creado (ID ${result?.ban_id ?? '—'}).`, 'success');
        onSaved();
    };

    return (
        <FormDialog
            open={draft !== null}
            title={'Baneo avanzado'}
            description={'UUID, nick, IP, rango o sistema autónomo.'}
            submitLabel={'Banear'}
            danger
            onClose={onClose}
            onSubmit={submit}
        >
            <EntryFields type={type} value={value} onTypeChange={setType} onValueChange={setValue} touched={touched} idPrefix={'ban'} />
            <TextAreaField id={'ban-reason'} label={'Motivo'} value={reason} onChange={setReason} placeholder={'Se muestra al jugador en el mensaje de expulsión'} />
            <Field label={'Duración'} htmlFor={'ban-duration'}>
                {draft && <DurationField id={'ban-duration'} value={duration} onChange={setDuration} />}
            </Field>
            {stainsIps && (
                <CheckRow>
                    <Input type={'checkbox'} checked={stainIp} onChange={() => setStainIp((current) => !current)} />
                    <CheckText>
                        Manchar sus IPs conocidas
                        <small>Se banean como hijas de este baneo y heredan su duración.</small>
                    </CheckText>
                </CheckRow>
            )}
        </FormDialog>
    );
};

interface UnifiedBanDialogProps {
    open: boolean;
    onClose: () => void;
    onSaved: () => void;
}

/**
 * Ban by name: only `player_name` is sent and the server decides whether it is premium (UUID)
 * or not (nick). «Verificar» is informative only and its result is cleared as soon as the name
 * changes, so the UUID of another player is never shown.
 */
export const UnifiedBanDialog = ({ open, onClose, onSaved }: UnifiedBanDialogProps) => {
    const { notify } = useFurrGuard();
    const [name, setName] = useState('');
    const [reason, setReason] = useState('');
    const [duration, setDuration] = useState<number | null>(0);
    const [stainIp, setStainIp] = useState(true);
    const [lookup, setLookup] = useState<(LookupResult & { query: string }) | null>(null);
    const [lookupError, setLookupError] = useState('');
    const [checking, setChecking] = useState(false);
    const controller = useRef<AbortController | null>(null);

    useEffect(() => {
        controller.current?.abort();
        if (!open) return;
        setName('');
        setReason('');
        setDuration(0);
        setStainIp(true);
        setLookup(null);
        setLookupError('');
    }, [open]);

    const changeName = (next: string) => {
        controller.current?.abort();
        setName(next);
        setLookup(null);
        setLookupError('');
        setChecking(false);
    };

    const verify = () => {
        const query = name.trim();
        if (!isNick(query)) return;
        controller.current?.abort();
        const current = new AbortController();
        controller.current = current;
        setChecking(true);
        setLookupError('');
        furr<LookupResult>('lookup_player', { player_name: query }, current.signal)
            .then((result) => setLookup({ ...result, query }))
            .catch((error) => {
                if (!isAbortError(error)) setLookupError(errorMessage(error, 'No se pudo consultar Mojang.'));
            })
            .then(() => {
                if (controller.current === current) setChecking(false);
            });
    };

    const submit = async () => {
        const trimmed = name.trim();
        if (!isNick(trimmed)) throw new Error('Escribe un nick válido (1-16 caracteres: letras, números y _).');
        const result = await furr<{ ban_id: string; player_name: string; is_premium: boolean }>('add_blacklist_unified', {
            player_name: trimmed,
            reason: reason.trim(),
            duration_minutes: duration ?? 0,
            stain_ip: stainIp,
        });
        notify(`${result.player_name} baneado por ${result.is_premium ? 'UUID (premium)' : 'nick (no premium)'} · ID ${result.ban_id}.`, 'success');
        onSaved();
    };

    return (
        <FormDialog
            open={open}
            title={'Banear jugador'}
            description={'Por nombre: el servidor decide si banea el UUID premium o el nick.'}
            submitLabel={'Banear'}
            danger
            onClose={onClose}
            onSubmit={submit}
        >
            <Field label={'Nombre del jugador'} htmlFor={'uban-name'} error={lookupError || null}>
                <div className={'flex gap-2'}>
                    <Input
                        id={'uban-name'}
                        value={name}
                        onChange={(event) => changeName(event.currentTarget.value)}
                        maxLength={17}
                        autoComplete={'off'}
                        spellCheck={false}
                        className={'font-mono'}
                        autoFocus
                    />
                    <Button type={'button'} variant={Button.Variants.Secondary} onClick={verify} disabled={checking || !isNick(name.trim())}>
                        <FontAwesomeIcon icon={faSearch} spin={checking} />
                        <span className={'ml-2'}>Verificar</span>
                    </Button>
                </div>
                {lookup && (
                    <div className={'flex flex-wrap items-center gap-2 mt-2 text-xs'} role={'status'}>
                        {lookup.status === 'premium' ? (
                            <>
                                <Chip tone={'gold'} icon={faCrown}>
                                    Premium
                                </Chip>
                                <Mono>
                                    {lookup.name} · {lookup.uuid}
                                </Mono>
                            </>
                        ) : lookup.status === 'not_found' ? (
                            <>
                                <Chip icon={faUnlock}>No premium</Chip>
                                <span>Se baneará el nick.</span>
                            </>
                        ) : (
                            <HelpText>Mojang no responde: no se puede saber si es premium. Inténtalo en unos minutos o usa el baneo avanzado.</HelpText>
                        )}
                    </div>
                )}
            </Field>
            <TextAreaField id={'uban-reason'} label={'Motivo'} value={reason} onChange={setReason} />
            <Field label={'Duración'} htmlFor={'uban-duration'}>
                {open && <DurationField id={'uban-duration'} value={duration} onChange={setDuration} />}
            </Field>
            <CheckRow>
                <Input type={'checkbox'} checked={stainIp} onChange={() => setStainIp((current) => !current)} />
                <CheckText>Manchar sus IPs conocidas</CheckText>
            </CheckRow>
        </FormDialog>
    );
};

export interface BanEditTarget {
    id: number;
    ban_id: string;
    value: string;
    reason: string | null;
    expires_at: string | null;
}

interface EditBanDialogProps {
    ban: BanEditTarget | null;
    onClose: () => void;
    onSaved: () => void;
}

export const EditBanDialog = ({ ban, onClose, onSaved }: EditBanDialogProps) => {
    const { notify } = useFurrGuard();
    const [reason, setReason] = useState('');
    const [duration, setDuration] = useState<number | null>(null);

    useEffect(() => {
        if (!ban) return;
        setReason(ban.reason ?? '');
        setDuration(null);
    }, [ban]);

    const submit = async () => {
        if (!ban) return;
        // duration_minutes null = keep the current expiry (propagated to the children when it changes)
        await furr('edit_blacklist', { id: ban.id, reason: reason.trim(), duration_minutes: duration });
        notify(`Baneo ${ban.ban_id} actualizado.`, 'success');
        onSaved();
    };

    return (
        <FormDialog open={ban !== null} title={'Editar baneo'} description={ban ? `${ban.ban_id} · ${ban.value}` : undefined} onClose={onClose} onSubmit={submit}>
            <TextAreaField id={'eban-reason'} label={'Motivo'} value={reason} onChange={setReason} />
            <Field
                label={'Nueva duración'}
                htmlFor={'eban-duration'}
                help={`Expira ahora: ${ban?.expires_at ? formatDateTime(ban.expires_at) : 'nunca (permanente)'}. La nueva duración cuenta desde este momento.`}
            >
                {ban && <DurationField id={'eban-duration'} value={duration} onChange={setDuration} allowUnchanged />}
            </Field>
        </FormDialog>
    );
};

interface AddBanIpDialogProps {
    parent: { id: number; ban_id: string; value: string } | null;
    onClose: () => void;
    onSaved: () => void;
}

export const AddBanIpDialog = ({ parent, onClose, onSaved }: AddBanIpDialogProps) => {
    const { notify } = useFurrGuard();
    const [ip, setIp] = useState('');
    const [touched, setTouched] = useState(false);
    const problem = touched || ip ? validateEntry('ip', ip) : null;

    useEffect(() => {
        if (!parent) return;
        setIp('');
        setTouched(false);
    }, [parent]);

    const submit = async () => {
        setTouched(true);
        if (!parent) return;
        const invalid = validateEntry('ip', ip);
        if (invalid) throw new Error(invalid);
        await furr('add_blacklist_ip', { parent_id: parent.id, ip: ip.trim() });
        notify('IP añadida al baneo.', 'success');
        onSaved();
    };

    return (
        <FormDialog
            open={parent !== null}
            title={'Añadir IP al baneo'}
            description={parent ? `Hija de ${parent.ban_id} (${parent.value})` : undefined}
            submitLabel={'Añadir'}
            onClose={onClose}
            onSubmit={submit}
        >
            <Field label={'IP'} htmlFor={'ban-ip'} help={'Hereda la expiración del baneo padre y se desactiva con él.'} error={problem}>
                <Input
                    id={'ban-ip'}
                    value={ip}
                    onChange={(event) => setIp(event.currentTarget.value)}
                    placeholder={'203.0.113.7'}
                    hasError={!!problem}
                    autoComplete={'off'}
                    className={'font-mono'}
                    autoFocus
                />
            </Field>
        </FormDialog>
    );
};
