import React, { useEffect, useMemo, useRef, useState } from 'react';
import styled from 'styled-components/macro';
import tw from 'twin.macro';
import { FontAwesomeIcon } from '@fortawesome/react-fontawesome';
import { faDownload, faExclamationTriangle, faKey, faRedo, faSave, faSync } from '@fortawesome/free-solid-svg-icons';
import { furr, isAbortError } from '@/api/furrguard/client';
import { MigrationBatch, SettingsPayload } from '@/api/furrguard/types';
import { Dialog } from '@/components/elements/dialog';
import { Button } from '@/components/elements/button/index';
import Input from '@/components/elements/Input';
import DataField from '@/components/elements/ui/DataField';
import PageHeader from '@/components/elements/ui/PageHeader';
import { ErrorText, Notice, NoticeBody } from '@/components/server/vault/vaultStyles';
import { useFurrGuard } from '@/components/furrguard/FurrGuardContext';
import { ConfirmDialog } from '@/components/furrguard/dialogs/FormDialog';
import { useConfirm, useLoader } from '@/components/furrguard/hooks';
import { errorMessage, formatDateTime, formatNumber, secondsLabel, toNum } from '@/components/furrguard/lib/format';
import { sectionInfo } from '@/components/furrguard/sections';
import { ActiveSwitch, Chip, Muted, RetryNotice, SaveBar, SectionPanel, Skeleton, Stack } from '@/components/furrguard/ui';
import { ALL_FIELDS, SETTING_GROUPS, SettingField, toPayload, toText, validateSetting } from '@/components/furrguard/views/settingsSchema';

const Narrow = styled(Stack)`
    max-width: 1080px;
`;

const Row = styled.div<{ $changed: boolean }>`
    ${tw`grid gap-x-6 gap-y-1 items-center px-4 py-3`};
    grid-template-columns: minmax(0, 1fr) minmax(160px, 240px);
    border-top: 1px solid var(--color-neutral);
    box-shadow: ${({ $changed }) => ($changed ? 'inset 3px 0 0 var(--color-primary)' : 'none')};

    @media (max-width: 700px) {
        grid-template-columns: minmax(0, 1fr);
    }
`;

const RowLabel = styled.label`
    ${tw`block text-sm font-medium`};
    color: var(--color-base);
`;

const RowMeta = styled.p`
    ${tw`flex flex-wrap items-center gap-x-3 gap-y-1 mt-1 text-xs`};
    color: var(--color-muted);

    code {
        font-size: 10px;
    }
`;

const RowControl = styled.div`
    ${tw`flex justify-end`};

    @media (max-width: 700px) {
        justify-content: flex-start;
    }
`;

const RowError = styled(ErrorText)`
    grid-column: 1 / -1;
`;

const KeyRow = styled.div`
    ${tw`flex flex-wrap items-center justify-between gap-3 px-4 py-3`};
`;

const KeyStatus = styled.div`
    ${tw`flex flex-wrap items-center gap-2 text-sm`};
`;

const Migration = styled.div`
    ${tw`flex flex-col gap-2 px-4 py-4`};
    border-top: 1px solid var(--color-neutral);

    h3 {
        ${tw`text-sm font-semibold`};
        color: var(--color-base);
    }

    p {
        ${tw`text-sm`};
        color: var(--color-muted);
    }
`;

const MigrationHead = styled.div`
    ${tw`flex flex-wrap items-start justify-between gap-3`};
`;

const Log = styled.pre`
    ${tw`p-3 m-0 text-xs whitespace-pre-wrap overflow-auto`};
    max-height: 180px;
    color: var(--color-muted);
    background-color: var(--color-background);
    border: 1px solid var(--color-neutral);
    border-radius: var(--border-radius, 8px);
`;

/* ── API key ────────────────────────────────────────────────────────────── */

const ApiKeyPanel = ({ apiKey, onChange }: { apiKey: SettingsPayload['api_key'] | null; onChange: (next: SettingsPayload['api_key']) => void }) => {
    const { notifyError } = useFurrGuard();
    const { confirm, pending, settle } = useConfirm();
    const [regenerating, setRegenerating] = useState(false);
    /** The new key only lives in memory while its dialog is open. */
    const [revealed, setRevealed] = useState<string | null>(null);

    const regenerate = async () => {
        const ok = await confirm({
            title: 'Regenerar la API key',
            message: 'La clave actual dejará de funcionar al momento: todos los plugins y módulos quedarán desconectados hasta que pongas la nueva en su configuración.',
            confirmText: 'Regenerar',
        });
        if (!ok) return;
        setRegenerating(true);
        try {
            const result = await furr<{ api_key: string; prefix: string }>('regenerate_api_key');
            setRevealed(result.api_key);
            onChange({ configured: true, prefix: result.prefix, created_at: new Date().toISOString().slice(0, 19).replace('T', ' ') });
        } catch (e) {
            notifyError(e, 'No se pudo regenerar la clave.');
        } finally {
            setRegenerating(false);
        }
    };

    return (
        <SectionPanel icon={faKey} title={'API key de los plugins'} hint={'Autentica al plugin de Velocity y a los módulos. Se guarda cifrada (hash): no se puede volver a mostrar.'}>
            <KeyRow>
                <KeyStatus>
                    {apiKey?.configured ? (
                        <Chip tone={'ok'}>Configurada</Chip>
                    ) : (
                        <Chip tone={'down'} icon={faExclamationTriangle}>
                            Sin configurar
                        </Chip>
                    )}
                    {apiKey?.prefix && <span className={'font-mono text-xs'}>{apiKey.prefix}…</span>}
                    {apiKey?.created_at && <Muted className={'text-xs'}>creada {formatDateTime(apiKey.created_at)}</Muted>}
                </KeyStatus>
                {apiKey?.configured ? (
                    <Button.Danger onClick={regenerate} disabled={regenerating}>
                        <FontAwesomeIcon icon={faRedo} spin={regenerating} />
                        <span className={'ml-2'}>Regenerar</span>
                    </Button.Danger>
                ) : (
                    <Button onClick={regenerate} disabled={regenerating}>
                        <FontAwesomeIcon icon={faKey} />
                        <span className={'ml-2'}>Generar clave</span>
                    </Button>
                )}
            </KeyRow>

            <Dialog open={revealed !== null} onClose={() => setRevealed(null)} title={'Tu nueva API key'}>
                <Stack className={'mt-2'}>
                    <Notice $tone={'warning'} role={'alert'}>
                        <FontAwesomeIcon icon={faExclamationTriangle} />
                        <NoticeBody>Cópiala ahora: es la única vez que se muestra. Si la pierdes tendrás que regenerarla.</NoticeBody>
                    </Notice>
                    {revealed && <DataField label={'API key'} value={revealed} copyValue={revealed} mono />}
                    <Muted className={'text-sm'}>
                        Ponla en <code>api.key</code> del <code>config.yml</code> del plugin y de los módulos, y reinícialos.
                    </Muted>
                </Stack>
                <Dialog.Footer>
                    <Button onClick={() => setRevealed(null)}>Ya la he guardado</Button>
                </Dialog.Footer>
            </Dialog>
            <ConfirmDialog pending={pending} onSettle={settle} />
        </SectionPanel>
    );
};

/* ── Migraciones ────────────────────────────────────────────────────────── */

type MigrationId = 'migrate_blacklist' | 'migrate_players';

interface MigrationState {
    running: boolean;
    done: boolean;
    processed: number;
    changed: number;
    skipped: number;
    log: string[];
}

const BATCH_SIZE = 25;
const MAX_LOG = 200;

const MIGRATIONS: { id: MigrationId; title: string; desc: string }[] = [
    { id: 'migrate_blacklist', title: 'Blacklist unificada', desc: 'Revisa los baneos por UUID y nick contra Mojang: premium → UUID, no premium → nick, y elimina duplicados.' },
    { id: 'migrate_players', title: 'Jugadores premium', desc: 'Comprueba en Mojang qué jugadores son premium y corrige su UUID si era offline.' },
];

const blank = (): MigrationState => ({ running: false, done: false, processed: 0, changed: 0, skipped: 0, log: [] });

/** Batched migrations with a cursor (§4.4): they advance until next_cursor = null and can be cancelled. */
const MigrationsPanel = () => {
    const { notify, notifyError } = useFurrGuard();
    const { confirm, pending, settle } = useConfirm();
    const [state, setState] = useState<Record<MigrationId, MigrationState>>({ migrate_blacklist: blank(), migrate_players: blank() });
    const controllers = useRef<Partial<Record<MigrationId, AbortController>>>({});

    useEffect(
        () => () => {
            Object.values(controllers.current).forEach((controller) => controller?.abort());
        },
        []
    );

    const patch = (id: MigrationId, changes: Partial<MigrationState>) => setState((current) => ({ ...current, [id]: { ...current[id], ...changes } }));

    const start = async (id: MigrationId, title: string) => {
        const ok = await confirm({
            title: `Ejecutar «${title}»`,
            message: 'Consulta a Mojang en lotes de 25. Puede tardar varios minutos; puedes cancelarla cuando quieras.',
            confirmText: 'Empezar',
        });
        if (!ok) return;
        const controller = new AbortController();
        controllers.current[id] = controller;
        const totals = { processed: 0, changed: 0, skipped: 0, log: [] as string[] };
        setState((current) => ({ ...current, [id]: { ...blank(), running: true } }));
        let cursor: string | number | null | undefined;
        try {
            do {
                const params: Record<string, unknown> = { batch_size: BATCH_SIZE };
                if (cursor !== undefined && cursor !== null) params.cursor = cursor;
                const batch = await furr<MigrationBatch>(id, params, controller.signal);
                totals.processed += toNum(batch.processed);
                totals.changed += toNum(batch.changed);
                totals.skipped += toNum(batch.skipped);
                totals.log = [...totals.log, ...(batch.details ?? []).map(String)].slice(-MAX_LOG);
                patch(id, { ...totals, log: [...totals.log] });
                cursor = batch.next_cursor;
            } while (cursor !== null && cursor !== undefined && !controller.signal.aborted);
            const done = cursor === null || cursor === undefined;
            patch(id, { done, running: false });
            if (done) notify(`«${title}» terminada: ${totals.processed} procesados, ${totals.changed} cambiados.`, 'success');
        } catch (e) {
            patch(id, { running: false });
            if (!isAbortError(e)) notifyError(e, 'La migración se ha detenido por un error.');
        } finally {
            if (controllers.current[id] === controller) delete controllers.current[id];
        }
    };

    const cancel = (id: MigrationId) => {
        controllers.current[id]?.abort();
        patch(id, { running: false });
        notify('Migración cancelada. Lo ya procesado se conserva.', 'warning');
    };

    return (
        <SectionPanel icon={faSync} title={'Migraciones'} hint={'Tareas de mantenimiento que consultan a Mojang. Quedan en el registro.'}>
            {MIGRATIONS.map((migration) => {
                const current = state[migration.id];
                const started = current.running || current.processed > 0 || current.done;

                return (
                    <Migration key={migration.id}>
                        <MigrationHead>
                            <div>
                                <h3>{migration.title}</h3>
                                <p>{migration.desc}</p>
                            </div>
                            {current.running ? (
                                <Button.Danger size={Button.Sizes.Small} onClick={() => cancel(migration.id)}>
                                    Cancelar
                                </Button.Danger>
                            ) : (
                                <Button size={Button.Sizes.Small} variant={Button.Variants.Secondary} onClick={() => start(migration.id, migration.title)}>
                                    <FontAwesomeIcon icon={faSync} />
                                    <span className={'ml-2'}>Ejecutar</span>
                                </Button>
                            )}
                        </MigrationHead>
                        {started && (
                            <>
                                <Muted className={'text-xs'} aria-live={'polite'}>
                                    {current.done ? 'Terminada' : current.running ? 'En curso' : 'Detenida'} · procesados <b>{formatNumber(current.processed)}</b> · cambiados{' '}
                                    <b>{formatNumber(current.changed)}</b> · omitidos <b>{formatNumber(current.skipped)}</b>
                                </Muted>
                                {current.log.length > 0 && (
                                    <Log tabIndex={0} aria-label={`Detalles de ${migration.title}`}>
                                        {current.log.join('\n')}
                                    </Log>
                                )}
                            </>
                        )}
                    </Migration>
                );
            })}
            <ConfirmDialog pending={pending} onSettle={settle} />
        </SectionPanel>
    );
};

/* ── Ajustes ────────────────────────────────────────────────────────────── */

const SettingsView = () => {
    const { notify, notifyError } = useFurrGuard();
    const info = sectionInfo('settings');
    const { confirm, pending, settle } = useConfirm();
    const { data, error, reload } = useLoader<SettingsPayload>((signal) => furr<SettingsPayload>('get_settings', {}, signal));
    const [baseline, setBaseline] = useState<Record<string, string>>({});
    const [form, setForm] = useState<Record<string, string>>({});
    const [apiKey, setApiKey] = useState<SettingsPayload['api_key'] | null>(null);
    const [saving, setSaving] = useState(false);
    const [exporting, setExporting] = useState(false);

    useEffect(() => {
        if (!data) return;
        const values = Object.fromEntries(ALL_FIELDS.map((field) => [field.key, toText(data.settings?.[field.key], field)]));
        setBaseline(values);
        setForm(values);
        setApiKey(data.api_key ?? null);
    }, [data]);

    const valueOf = (key: string): string => (form[key] ?? '').trim();
    const changed = useMemo(() => ALL_FIELDS.filter((field) => valueOf(field.key) !== (baseline[field.key] ?? '').trim()), [form, baseline]);
    const errors = useMemo(() => Object.fromEntries(ALL_FIELDS.map((field) => [field.key, validateSetting(field, valueOf(field.key))])), [form]);
    const invalid = changed.filter((field) => errors[field.key]);

    useEffect(() => {
        if (changed.length === 0) return;
        const handler = (event: BeforeUnloadEvent) => {
            event.preventDefault();
            event.returnValue = '';
        };
        window.addEventListener('beforeunload', handler);

        return () => window.removeEventListener('beforeunload', handler);
    }, [changed.length]);

    const set = (key: string, value: string) => setForm((current) => ({ ...current, [key]: value }));

    const save = async () => {
        // Nothing is sent unless the load finished well: settings are never overwritten with empty values.
        if (!data || !changed.length || invalid.length) return;
        setSaving(true);
        try {
            const settings = Object.fromEntries(changed.map((field) => [field.key, toPayload(field, valueOf(field.key))]));
            await furr('save_settings', { settings });
            setBaseline((current) => ({ ...current, ...Object.fromEntries(changed.map((field) => [field.key, valueOf(field.key)])) }));
            notify('Ajustes guardados. Los plugins los recogerán en unos segundos.', 'success');
        } catch (e) {
            notifyError(e, 'No se pudieron guardar los ajustes.');
        } finally {
            setSaving(false);
        }
    };

    const discard = async () => {
        if (await confirm({ title: 'Descartar cambios', message: `Se perderán los cambios de ${changed.length} ajuste(s).`, confirmText: 'Descartar' })) setForm(baseline);
    };

    const exportData = async () => {
        setExporting(true);
        try {
            const exported = await furr<unknown>('export_data');
            const blob = new Blob([JSON.stringify(exported, null, 2)], { type: 'application/json' });
            const url = URL.createObjectURL(blob);
            const link = document.createElement('a');
            link.href = url;
            link.download = `furrguard-export-${new Date().toISOString().slice(0, 16).replace(/[:T]/g, '')}.json`;
            link.click();
            window.setTimeout(() => URL.revokeObjectURL(url), 1000);
            notify('Exportación descargada.', 'success');
        } catch (e) {
            notifyError(e, errorMessage(e, 'No se pudo exportar.'));
        } finally {
            setExporting(false);
        }
    };

    const control = (field: SettingField) => {
        const id = `setting-${field.key}`;
        if (field.kind === 'bool') {
            return <ActiveSwitch active={valueOf(field.key) === '1'} label={field.label} onChange={(on) => set(field.key, on ? '1' : '0')} />;
        }
        const numeric = field.kind === 'int' || field.kind === 'float';

        return (
            <Input
                id={id}
                value={form[field.key] ?? ''}
                onChange={(event) => set(field.key, event.currentTarget.value)}
                type={numeric ? 'number' : 'text'}
                inputMode={field.kind === 'int' ? 'numeric' : field.kind === 'float' ? 'decimal' : undefined}
                min={field.min}
                max={field.max}
                step={field.kind === 'float' ? '0.1' : undefined}
                maxLength={field.maxLength}
                hasError={!!errors[field.key]}
                className={field.kind !== 'text' ? 'font-mono' : undefined}
                disabled={saving}
            />
        );
    };

    return (
        <Narrow>
            <PageHeader
                title={info.label}
                description={info.description}
                actions={
                    <Button variant={Button.Variants.Secondary} onClick={exportData} disabled={exporting || !data}>
                        <FontAwesomeIcon icon={faDownload} />
                        <span className={'ml-2'}>Exportar datos</span>
                    </Button>
                }
            />

            {error && !data ? (
                <RetryNotice title={'No se pudieron cargar los ajustes'} message={`${error.message} Hasta que carguen no se puede guardar nada.`} onRetry={reload} />
            ) : !data ? (
                <Skeleton rows={6} />
            ) : (
                <>
                    {SETTING_GROUPS.map((group) => (
                        <SectionPanel key={group.id} title={group.title} hint={group.desc}>
                            {group.fields.map((field) => {
                                const isChanged = changed.includes(field);
                                const problem = errors[field.key];

                                return (
                                    <Row key={field.key} $changed={isChanged}>
                                        <div>
                                            <RowLabel htmlFor={`setting-${field.key}`}>{field.label}</RowLabel>
                                            <RowMeta>
                                                <code>{field.key}</code>
                                                {field.min !== undefined && (
                                                    <span>
                                                        {field.min}–{field.max}
                                                        {field.unit === 's' ? ' s' : field.unit ? ` ${field.unit}` : ''}
                                                    </span>
                                                )}
                                                {field.unit === 's' && !problem && <span>= {secondsLabel(Number(form[field.key]))}</span>}
                                                {field.help && <span>{field.help}</span>}
                                            </RowMeta>
                                        </div>
                                        <RowControl>{control(field)}</RowControl>
                                        {problem && <RowError role={'alert'}>{problem}</RowError>}
                                    </Row>
                                );
                            })}
                        </SectionPanel>
                    ))}

                    {changed.length > 0 && (
                        <SaveBar role={'region'} aria-label={'Cambios sin guardar'}>
                            <span>
                                {changed.length === 1 ? '1 ajuste modificado' : `${changed.length} ajustes modificados`}
                                {invalid.length > 0 && <Muted className={'ml-2 text-xs'}>· corrige {invalid.length === 1 ? 'el valor marcado' : 'los valores marcados'}</Muted>}
                            </span>
                            <Button.Text onClick={discard} disabled={saving}>
                                Descartar
                            </Button.Text>
                            <Button onClick={save} disabled={saving || invalid.length > 0}>
                                <FontAwesomeIcon icon={faSave} />
                                <span className={'ml-2'}>{saving ? 'Guardando…' : 'Guardar'}</span>
                            </Button>
                        </SaveBar>
                    )}

                    <ApiKeyPanel apiKey={apiKey} onChange={setApiKey} />
                    <MigrationsPanel />
                </>
            )}
            <ConfirmDialog pending={pending} onSettle={settle} />
        </Narrow>
    );
};

export default SettingsView;
