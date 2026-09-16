import { Health } from '@/api/furrguard/types';

/*
 * Numbers, dates and small text helpers of the FurrGuard page. FurrGuard stores and sends
 * everything in UTC as `YYYY-MM-DD HH:MM:SS` without a zone (docs/API.md §0): it is parsed as
 * UTC and shown in Madrid time, like the FurrGuard panel itself.
 */

const ZONE = 'Europe/Madrid';
const UTC_FORMAT = /^(\d{4})-(\d{2})-(\d{2})[ T](\d{2}):(\d{2})(?::(\d{2}))?/;

const numbers = new Intl.NumberFormat('es-ES');
const dateTime = new Intl.DateTimeFormat('es-ES', {
    timeZone: ZONE,
    day: '2-digit',
    month: '2-digit',
    year: 'numeric',
    hour: '2-digit',
    minute: '2-digit',
});
const dateOnly = new Intl.DateTimeFormat('es-ES', { timeZone: ZONE, day: 'numeric', month: 'short', year: 'numeric' });
const relative = new Intl.RelativeTimeFormat('es', { numeric: 'auto' });

const STEPS: [Intl.RelativeTimeFormatUnit, number][] = [
    ['second', 60],
    ['minute', 60],
    ['hour', 24],
    ['day', 30],
    ['month', 12],
    ['year', Number.POSITIVE_INFINITY],
];

type DateInput = string | null | undefined;

export const isOn = (value: unknown): boolean => value === true || value === 1 || value === '1';

export function toNum(value: unknown): number {
    const n = Number(value);

    return Number.isFinite(n) ? n : 0;
}

export const formatNumber = (value: unknown): string => numbers.format(toNum(value));

/** Counters may arrive as text ("1234") or be missing: format what is numeric, show the rest as is. */
export function displayCount(value: unknown): string {
    if (typeof value === 'number' || (typeof value === 'string' && /^-?\d+(\.\d+)?$/.test(value.trim()))) return formatNumber(value);

    return value === null || value === undefined ? '—' : String(value);
}

/** 90 → «1 h 30 min», 0 → «permanente». */
export function minutesLabel(minutes: number): string {
    if (minutes <= 0) return 'permanente';
    const days = Math.floor(minutes / 1440);
    const hours = Math.floor((minutes % 1440) / 60);
    const mins = minutes % 60;

    return [days && `${days} d`, hours && `${hours} h`, mins && `${mins} min`].filter(Boolean).join(' ');
}

export const secondsLabel = (seconds: number): string => (seconds < 60 ? `${seconds} s` : minutesLabel(Math.round(seconds / 60)));

export function parseUtc(value: DateInput): Date | null {
    if (!value) return null;
    const match = UTC_FORMAT.exec(value);
    if (!match) return null;
    const [, year, month, day, hour, minute, second] = match;
    const time = Date.UTC(Number(year), Number(month) - 1, Number(day), Number(hour), Number(minute), Number(second ?? 0));

    return Number.isNaN(time) ? null : new Date(time);
}

export function formatDateTime(value: DateInput): string {
    const date = parseUtc(value);

    return date ? dateTime.format(date) : '—';
}

export function formatDate(value: DateInput): string {
    const date = parseUtc(value);

    return date ? dateOnly.format(date) : '—';
}

/** «hace 5 minutos», «ayer», «dentro de 2 horas». */
export function timeAgo(value: DateInput, now: number = Date.now()): string {
    const date = parseUtc(value);
    if (!date) return '—';
    let diff = (date.getTime() - now) / 1000;
    // A few seconds of drift between the server and the browser clocks are not "the future".
    if (Math.abs(diff) < 45) return 'ahora mismo';
    for (const [unit, size] of STEPS) {
        const rounded = Math.round(diff);
        if (Math.abs(rounded) < size) return relative.format(rounded, unit);
        diff /= size;
    }

    return '—';
}

export function isPast(value: DateInput, now: number = Date.now()): boolean {
    const date = parseUtc(value);

    return date !== null && date.getTime() <= now;
}

export type HealthTone = 'ok' | 'warn' | 'down';

/** Overall tone of the FurrGuard health: no API key or no geolocation data at all → down. */
export function healthTone(health: Health): HealthTone {
    if (!health.api_key_configured) return 'down';
    if (health.ip_api === 'down' && health.geo_mirror !== 'ok') return 'down';
    if (health.ip_api !== 'ok' || health.geo_mirror === 'missing') return 'warn';

    return 'ok';
}

export const initials = (name: string): string => name.trim().slice(0, 1).toUpperCase() || '?';

/** Only Discord CDN avatars over https are rendered as images. */
export function discordAvatar(discordId: string, avatar: string | null): string | null {
    if (!avatar) return null;
    if (avatar.startsWith('https://cdn.discordapp.com/')) return avatar;
    if (/^(a_)?[0-9a-f]{32}$/i.test(avatar) && /^\d{17,20}$/.test(discordId)) {
        return `https://cdn.discordapp.com/avatars/${discordId}/${avatar}.png?size=64`;
    }

    return null;
}

/** Text of a thrown value for the user: the FurrGuard message when there is one. */
export const errorMessage = (error: unknown, fallback = 'Algo ha fallado.'): string =>
    error instanceof Error && error.message ? error.message : fallback;
