import React, { useEffect, useState } from 'react';
import Input, { Textarea } from '@/components/elements/Input';
import Select from '@/components/elements/Select';
import { EntryType } from '@/api/furrguard/types';
import { Field } from '@/components/furrguard/dialogs/FormDialog';
import { minutesLabel } from '@/components/furrguard/lib/format';
import { DURATION_PRESETS, ENTRY_TYPES, entryInfo, validateEntry } from '@/components/furrguard/lib/labels';
import { Muted } from '@/components/furrguard/ui';

const MAX_MINUTES = 5_256_000; // 10 years

const clamp = (value: number): number => Math.min(MAX_MINUTES, Math.max(1, Math.round(value || 1)));

const modeOf = (value: number | null, allowUnchanged: boolean): string => {
    if (value === null) return allowUnchanged ? 'unchanged' : '0';

    return DURATION_PRESETS.some((preset) => preset.minutes === value) ? String(value) : 'custom';
};

export interface DurationFieldProps {
    id: string;
    value: number | null;
    onChange: (minutes: number | null) => void;
    /** Adds «Sin cambios» (null) for the edit dialog. */
    allowUnchanged?: boolean;
}

/** Ban duration in minutes (0 = permanent). With `allowUnchanged`, null = keep the current one. */
export const DurationField = ({ id, value, onChange, allowUnchanged = false }: DurationFieldProps) => {
    const [mode, setMode] = useState(() => modeOf(value, allowUnchanged));
    const [custom, setCustom] = useState(value && value > 0 ? value : 60);

    useEffect(() => {
        if (mode === 'unchanged') onChange(null);
        else if (mode === 'custom') onChange(clamp(custom));
        else onChange(Number(mode));
    }, [mode, custom]);

    return (
        <div className={'flex flex-col gap-2'}>
            <Select id={id} value={mode} onChange={(event) => setMode(event.currentTarget.value)}>
                {allowUnchanged && <option value={'unchanged'}>Sin cambios</option>}
                {DURATION_PRESETS.map((preset) => (
                    <option key={preset.minutes} value={String(preset.minutes)}>
                        {preset.label}
                    </option>
                ))}
                <option value={'custom'}>Personalizada…</option>
            </Select>
            {mode === 'custom' && (
                <div className={'flex items-center gap-3'}>
                    <Input
                        id={`${id}-minutes`}
                        aria-label={'Duración en minutos'}
                        type={'number'}
                        min={1}
                        max={MAX_MINUTES}
                        step={1}
                        value={custom}
                        onChange={(event) => setCustom(Number(event.currentTarget.value))}
                        className={'w-32'}
                    />
                    <Muted className={'text-xs'}>min · {minutesLabel(clamp(custom))}</Muted>
                </div>
            )}
        </div>
    );
};

export interface EntryFieldsProps {
    type: EntryType;
    value: string;
    onTypeChange: (type: EntryType) => void;
    onValueChange: (value: string) => void;
    /** Show validation errors even before the user typed (after a submit attempt). */
    touched?: boolean;
    lockType?: boolean;
    idPrefix: string;
}

/** Type + value of a whitelist/blacklist entry, with format help and per-type validation. */
export const EntryFields = ({ type, value, onTypeChange, onValueChange, touched, lockType, idPrefix }: EntryFieldsProps) => {
    const info = entryInfo(type);
    const problem = touched || value ? validateEntry(type, value) : null;

    return (
        <>
            <Field label={'Tipo'} htmlFor={`${idPrefix}-type`}>
                <Select id={`${idPrefix}-type`} value={type} onChange={(event) => onTypeChange(event.currentTarget.value as EntryType)} disabled={lockType}>
                    {ENTRY_TYPES.map((option) => (
                        <option key={option.value} value={option.value}>
                            {option.label}
                        </option>
                    ))}
                </Select>
            </Field>
            <Field label={'Valor'} htmlFor={`${idPrefix}-value`} help={info?.help} error={problem}>
                <Input
                    id={`${idPrefix}-value`}
                    value={value}
                    onChange={(event) => onValueChange(event.currentTarget.value)}
                    placeholder={info?.placeholder}
                    hasError={!!problem}
                    autoComplete={'off'}
                    spellCheck={false}
                    maxLength={255}
                    className={'font-mono'}
                    autoFocus
                />
            </Field>
        </>
    );
};

export interface TextAreaFieldProps {
    id: string;
    label: string;
    value: string;
    onChange: (value: string) => void;
    rows?: number;
    maxLength?: number;
    placeholder?: string;
    help?: string;
    optional?: boolean;
    mono?: boolean;
}

export const TextAreaField = ({ id, label, value, onChange, rows = 3, maxLength = 500, placeholder, help, optional, mono }: TextAreaFieldProps) => (
    <Field label={label} htmlFor={id} help={help} optional={optional}>
        <Textarea
            id={id}
            value={value}
            onChange={(event) => onChange(event.currentTarget.value)}
            rows={rows}
            maxLength={maxLength}
            placeholder={placeholder}
            spellCheck={false}
            className={mono ? 'font-mono text-xs' : undefined}
        />
    </Field>
);
