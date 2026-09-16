import React, { useEffect, useMemo, useRef, useState } from 'react';
import styled from 'styled-components/macro';
import tw from 'twin.macro';
import { FontAwesomeIcon } from '@fortawesome/react-fontawesome';
import { faCode, faCommentAlt, faPalette, faSave } from '@fortawesome/free-solid-svg-icons';
import { furr } from '@/api/furrguard/client';
import { Button } from '@/components/elements/button/index';
import { Textarea } from '@/components/elements/Input';
import PageHeader from '@/components/elements/ui/PageHeader';
import { useFurrGuard } from '@/components/furrguard/FurrGuardContext';
import { ConfirmDialog } from '@/components/furrguard/dialogs/FormDialog';
import { useConfirm, useLoader } from '@/components/furrguard/hooks';
import { MC_COLOR_NAMES, MC_COLORS, MC_FORMATS } from '@/components/furrguard/lib/mc';
import { sectionInfo } from '@/components/furrguard/sections';
import { EmptyState, FilterTabs, McPreview, Muted, RetryNotice, SaveBar, SearchBox, SectionPanel, Skeleton, Stack, Toolbar } from '@/components/furrguard/ui';

type Group = 'furrguard' | 'furrperms' | 'furrsecurity';

/** Prefixes of docs/API.md §2: FurrSecurity messages use `furr_security_` (with underscore). */
const groupOf = (key: string): Group => (key.startsWith('fur_perms_') ? 'furrperms' : key.startsWith('furr_security_') ? 'furrsecurity' : 'furrguard');

/** Indicative variables per module: which key accepts which is not validated. */
const VARIABLES: Record<Group, string[]> = {
    furrguard: [
        '{player}', '{reason}', '{id}', '{ban_id}', '{time_remaining}', '{server_name}', '{discord}', '{ip}', '{country}',
        '{country_code}', '{continent}', '{isp}', '{type}', '{value}', '{usage}', '{historical_country}', '{current_country}',
    ],
    furrperms: ['{player}', '{command}', '{reason}'],
    furrsecurity: ['{player}', '{url}', '{verify_url}', '{time}', '{time_remaining}', '{discord}', '{key}', '{value}'],
};

const labelOf = (key: string): string => {
    const text = key.replace(/^(fur_perms_|furr_security_)/, '').replace(/^kick_/, 'expulsión · ').replace(/^notify_/, 'aviso · ').replace(/_/g, ' ');

    return text.charAt(0).toUpperCase() + text.slice(1);
};

const Tools = styled.div`
    ${tw`flex flex-wrap items-center gap-x-4 gap-y-2 px-4 py-3`};
    border-bottom: 1px solid var(--color-neutral);
`;

const ToolGroup = styled.span`
    ${tw`inline-flex flex-wrap items-center gap-1`};

    > svg {
        ${tw`mr-1`};
        font-size: 0.7rem;
        color: var(--color-muted);
    }
`;

const Swatch = styled.button<{ $color: string }>`
    ${tw`w-5 h-5 rounded transition-transform duration-100`};
    background-color: ${({ $color }) => $color};
    border: 1px solid var(--color-neutral);

    &:hover {
        transform: scale(1.15);
    }
`;

const SmallCode = styled.button`
    ${tw`px-2 py-0.5 font-mono text-xs transition-colors duration-150`};
    color: var(--color-muted);
    background-color: var(--color-background);
    border: 1px solid var(--color-neutral);
    border-radius: 6px;

    &:hover {
        color: var(--color-base);
        border-color: var(--color-primary);
    }
`;

const MessageCard = styled.div<{ $changed: boolean }>`
    ${tw`flex flex-col gap-2 p-4`};
    border-top: 1px solid var(--color-neutral);
    box-shadow: ${({ $changed }) => ($changed ? 'inset 3px 0 0 var(--color-primary)' : 'none')};
`;

const MessageHead = styled.div`
    ${tw`flex flex-wrap items-center justify-between gap-2 text-sm`};

    label {
        color: var(--color-base);
    }

    code {
        ${tw`ml-2 text-xs`};
        color: var(--color-muted);
    }
`;

const Editor = styled.div`
    ${tw`grid grid-cols-1 gap-3 lg:grid-cols-2`};
`;

const MessagesView = () => {
    const { notify, notifyError } = useFurrGuard();
    const info = sectionInfo('messages');
    const { confirm, pending, settle } = useConfirm();
    const { data, error, reload } = useLoader<Record<string, string>>(async (signal) => {
        const result = await furr<{ messages: Record<string, unknown> }>('get_messages', {}, signal);

        return Object.fromEntries(Object.entries(result?.messages ?? {}).map(([k, v]) => [k, String(v ?? '')]));
    });
    const [original, setOriginal] = useState<Record<string, string>>({});
    const [draft, setDraft] = useState<Record<string, string>>({});
    const [group, setGroup] = useState<Group>('furrguard');
    const [filter, setFilter] = useState('');
    const [saving, setSaving] = useState(false);
    const focus = useRef<{ key: string; start: number; end: number } | null>(null);
    const areas = useRef<Record<string, HTMLTextAreaElement | null>>({});

    useEffect(() => {
        if (data) {
            setOriginal(data);
            setDraft(data);
        }
    }, [data]);

    const changedKeys = useMemo(() => Object.keys(original).filter((key) => draft[key] !== original[key]), [original, draft]);

    // Leaving with unsaved changes asks first (browser navigation away from the page).
    useEffect(() => {
        if (changedKeys.length === 0) return;
        const handler = (event: BeforeUnloadEvent) => {
            event.preventDefault();
            event.returnValue = '';
        };
        window.addEventListener('beforeunload', handler);

        return () => window.removeEventListener('beforeunload', handler);
    }, [changedKeys.length]);

    const groups = useMemo(() => {
        const counts: Record<Group, number> = { furrguard: 0, furrperms: 0, furrsecurity: 0 };
        for (const key of Object.keys(original)) counts[groupOf(key)]++;

        return [
            { value: 'furrguard', label: 'FurrGuard', count: counts.furrguard },
            { value: 'furrperms', label: 'FurrPerms', count: counts.furrperms },
            { value: 'furrsecurity', label: 'FurrSecurity', count: counts.furrsecurity },
        ];
    }, [original]);

    const visibleKeys = useMemo(() => {
        const term = filter.trim().toLowerCase();

        return Object.keys(original)
            .filter((key) => groupOf(key) === group)
            .filter((key) => !term || key.includes(term) || (draft[key] ?? '').toLowerCase().includes(term))
            .sort();
    }, [original, draft, group, filter]);

    const remember = (key: string, element: HTMLTextAreaElement) => {
        focus.current = { key, start: element.selectionStart, end: element.selectionEnd };
    };

    /** Inserts into the message that had the focus, at the cursor. */
    const insert = (snippet: string) => {
        const target = focus.current;
        if (!target || !visibleKeys.includes(target.key)) {
            notify('Pulsa primero dentro del mensaje donde quieres insertar.', 'info');

            return;
        }
        const value = draft[target.key] ?? '';
        const next = value.slice(0, target.start) + snippet + value.slice(target.end);
        const caret = target.start + snippet.length;
        setDraft((current) => ({ ...current, [target.key]: next }));
        focus.current = { key: target.key, start: caret, end: caret };
        window.setTimeout(() => {
            const element = areas.current[target.key];
            element?.focus();
            element?.setSelectionRange(caret, caret);
        }, 0);
    };

    const save = async () => {
        const keys = changedKeys;
        if (!keys.length) return;
        setSaving(true);
        try {
            const messages = Object.fromEntries(keys.map((key) => [key, draft[key] ?? '']));
            await furr('save_messages', { messages });
            setOriginal((current) => ({ ...current, ...messages }));
            notify(keys.length === 1 ? 'Mensaje guardado.' : `${keys.length} mensajes guardados.`, 'success');
        } catch (e) {
            notifyError(e, 'No se pudieron guardar los mensajes.');
        } finally {
            setSaving(false);
        }
    };

    const discard = async () => {
        if (await confirm({ title: 'Descartar cambios', message: `Se perderán los cambios de ${changedKeys.length} mensaje(s).`, confirmText: 'Descartar' })) setDraft(original);
    };

    return (
        <Stack>
            <PageHeader title={info.label} description={info.description} />

            {error && !data ? (
                <RetryNotice title={'No se pudieron cargar los mensajes'} message={error.message} onRetry={reload} />
            ) : !data ? (
                <Skeleton rows={4} />
            ) : (
                <>
                    <SectionPanel icon={faCommentAlt} title={'Mensajes'} hint={'Pulsa dentro de un mensaje y usa los botones para insertar colores o variables.'}>
                        <Toolbar>
                            <FilterTabs value={group} onChange={(value) => setGroup(value as Group)} options={groups} label={'Módulo'} />
                            <SearchBox value={filter} onChange={setFilter} label={'Filtrar mensajes'} placeholder={'Clave o texto…'} />
                        </Toolbar>
                        <Tools role={'toolbar'} aria-label={'Insertar en el mensaje seleccionado'}>
                            <ToolGroup>
                                <FontAwesomeIcon icon={faPalette} />
                                {Object.keys(MC_COLORS).map((code) => (
                                    <Swatch
                                        key={code}
                                        type={'button'}
                                        $color={MC_COLORS[code]}
                                        title={`${MC_COLOR_NAMES[code]} (&${code})`}
                                        aria-label={`Color ${MC_COLOR_NAMES[code]}, código &${code}`}
                                        onMouseDown={(event) => event.preventDefault()}
                                        onClick={() => insert(`&${code}`)}
                                    />
                                ))}
                            </ToolGroup>
                            <ToolGroup>
                                {MC_FORMATS.map((format) => (
                                    <SmallCode key={format.code} type={'button'} title={`${format.label} (&${format.code})`} onMouseDown={(event) => event.preventDefault()} onClick={() => insert(`&${format.code}`)}>
                                        &amp;{format.code}
                                    </SmallCode>
                                ))}
                            </ToolGroup>
                            <ToolGroup>
                                <FontAwesomeIcon icon={faCode} />
                                {VARIABLES[group].map((variable) => (
                                    <SmallCode key={variable} type={'button'} onMouseDown={(event) => event.preventDefault()} onClick={() => insert(variable)}>
                                        {variable}
                                    </SmallCode>
                                ))}
                            </ToolGroup>
                        </Tools>

                        {visibleKeys.length === 0 ? (
                            <EmptyState icon={faCommentAlt} title={'Ningún mensaje coincide'} />
                        ) : (
                            visibleKeys.map((key) => {
                                const changed = draft[key] !== original[key];

                                return (
                                    <MessageCard key={key} $changed={changed}>
                                        <MessageHead>
                                            <label htmlFor={`msg-${key}`}>
                                                <strong>{labelOf(key)}</strong>
                                                <code>{key}</code>
                                            </label>
                                            {changed && (
                                                <Button.Text size={Button.Sizes.Small} onClick={() => setDraft((current) => ({ ...current, [key]: original[key] ?? '' }))}>
                                                    Restaurar
                                                </Button.Text>
                                            )}
                                        </MessageHead>
                                        <Editor>
                                            <Textarea
                                                id={`msg-${key}`}
                                                ref={(element: HTMLTextAreaElement | null) => {
                                                    areas.current[key] = element;
                                                }}
                                                value={draft[key] ?? ''}
                                                rows={3}
                                                spellCheck={false}
                                                className={'font-mono text-xs'}
                                                onChange={(event) => {
                                                    setDraft((current) => ({ ...current, [key]: event.currentTarget.value }));
                                                    remember(key, event.currentTarget);
                                                }}
                                                onFocus={(event) => remember(key, event.currentTarget)}
                                                onSelect={(event) => remember(key, event.currentTarget)}
                                                onKeyUp={(event) => remember(key, event.currentTarget)}
                                                onClick={(event) => remember(key, event.currentTarget)}
                                            />
                                            <McPreview text={draft[key] ?? ''} label={'Vista previa'} />
                                        </Editor>
                                    </MessageCard>
                                );
                            })
                        )}
                    </SectionPanel>

                    {changedKeys.length > 0 && (
                        <SaveBar role={'region'} aria-label={'Cambios sin guardar'}>
                            <span>
                                {changedKeys.length === 1 ? '1 mensaje modificado' : `${changedKeys.length} mensajes modificados`}
                                <Muted className={'ml-2 text-xs'}>Los plugins los recogen en unos segundos.</Muted>
                            </span>
                            <Button.Text onClick={discard} disabled={saving}>
                                Descartar
                            </Button.Text>
                            <Button onClick={save} disabled={saving}>
                                <FontAwesomeIcon icon={faSave} />
                                <span className={'ml-2'}>{saving ? 'Guardando…' : 'Guardar'}</span>
                            </Button>
                        </SaveBar>
                    )}
                </>
            )}
            <ConfirmDialog pending={pending} onSettle={settle} />
        </Stack>
    );
};

export default MessagesView;
