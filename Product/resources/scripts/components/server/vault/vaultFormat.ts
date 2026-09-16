import { format, formatDistanceToNow } from 'date-fns';
import es from 'date-fns/locale/es';
import { EstadoTrabajo, ProgresoTrabajo, Trabajo } from '@/api/server/vault/types';

/*
 * Vault timestamps are Unix seconds. Dates are formatted with Intl so they
 * follow the panel language (the rest of Luna has no date-fns locales loaded);
 * date-fns only covers browsers without Intl.RelativeTimeFormat.
 */

type RelativeUnit = 'second' | 'minute' | 'hour' | 'day' | 'month' | 'year';

interface RelativeTimeFormatLike {
    format(value: number, unit: RelativeUnit): string;
}

type RelativeTimeFormatConstructor = new (
    locale?: string,
    options?: { numeric?: 'always' | 'auto' }
) => RelativeTimeFormatLike;

const relativeTimeFormat = (): RelativeTimeFormatConstructor | undefined =>
    (Intl as unknown as { RelativeTimeFormat?: RelativeTimeFormatConstructor }).RelativeTimeFormat;

const MINUTE = 60;
const HOUR = 60 * MINUTE;
const DAY = 24 * HOUR;
const MONTH = 30 * DAY;
const YEAR = 365 * DAY;

const relativeParts = (seconds: number): [number, RelativeUnit] => {
    const abs = Math.abs(seconds);
    if (abs < MINUTE) return [seconds, 'second'];
    if (abs < HOUR) return [Math.round(seconds / MINUTE), 'minute'];
    if (abs < DAY) return [Math.round(seconds / HOUR), 'hour'];
    if (abs < MONTH) return [Math.round(seconds / DAY), 'day'];
    if (abs < YEAR) return [Math.round(seconds / MONTH), 'month'];
    return [Math.round(seconds / YEAR), 'year'];
};

/** "3 hours ago", "in 20 minutes"… in the given language. */
export const formatRelative = (timestamp: number, locale: string, now: number = Date.now()): string => {
    const [value, unit] = relativeParts(Math.round(timestamp - now / 1000));
    const Formatter = relativeTimeFormat();

    if (Formatter) {
        try {
            return new Formatter(locale, { numeric: 'auto' }).format(value, unit);
        } catch (error) {
            // Unknown locale tag: fall through to the English formatter.
        }
    }

    return formatDistanceToNow(new Date(timestamp * 1000), { addSuffix: true, locale: es });
};

const BYTE_UNITS = ['bytes', 'KiB', 'MiB', 'GiB', 'TiB', 'PiB'];

/** Like bytesToString (1024 steps, two decimals) but with the locale's decimal separator: "2,81 GiB". */
export const formatBytes = (bytes: number, locale: string): string => {
    const value = Number.isFinite(bytes) && bytes > 0 ? bytes : 0;
    const exponent = value < 1 ? 0 : Math.min(Math.floor(Math.log(value) / Math.log(1024)), BYTE_UNITS.length - 1);
    const scaled = value / Math.pow(1024, exponent);

    let number: string;
    try {
        number = new Intl.NumberFormat(locale, { maximumFractionDigits: 2 }).format(scaled);
    } catch (error) {
        number = String(Number(scaled.toFixed(2)));
    }

    return `${number} ${BYTE_UNITS[exponent]}`;
};

/** Absolute date and time, e.g. "13 Sept 2026, 04:37". */
export const formatDateTime = (timestamp: number, locale: string): string => {
    const date = new Date(timestamp * 1000);

    try {
        return new Intl.DateTimeFormat(locale, {
            year: 'numeric',
            month: 'short',
            day: 'numeric',
            hour: '2-digit',
            minute: '2-digit',
        }).format(date);
    } catch (error) {
        return format(date, 'yyyy-MM-dd HH:mm');
    }
};

export const formatCount = (value: number, locale: string): string => {
    try {
        return new Intl.NumberFormat(locale).format(value);
    } catch (error) {
        return String(value);
    }
};

export const ACTIVE_JOB_STATES: EstadoTrabajo[] = ['en_cola', 'despachado', 'en_curso', 'procesando'];

export const isJobActive = (job: Trabajo | null | undefined): job is Trabajo =>
    !!job && ACTIVE_JOB_STATES.indexOf(job.estado) !== -1;

const clampPercent = (value: number): number => Math.max(0, Math.min(100, value));

/** Progress of a job in percent (bytes first, then files), or null while the total is unknown. */
export const jobProgressPercent = (progress: ProgresoTrabajo | null | undefined): number | null => {
    if (!progress) return null;
    if (progress.bytes_total > 0) return clampPercent((progress.bytes / progress.bytes_total) * 100);
    if (progress.archivos_total > 0) return clampPercent((progress.archivos / progress.archivos_total) * 100);

    return null;
};

/** Readable fallback for vault audit action codes without a translation ("backup_manual" → "Backup manual"). */
export const humanizeCode = (code: string): string => {
    const text = code.replace(/[_.-]+/g, ' ').trim();

    return text ? text.charAt(0).toUpperCase() + text.slice(1) : code;
};
