/**
 * Locale-aware formatting for the live resource readouts.
 *
 * The readouts repaint many times per second while animating, so the Intl
 * formatters are built once per locale and option set and then reused.
 */

const FALLBACK_LOCALE = 'en';
const BYTE_UNITS = ['B', 'KiB', 'MiB', 'GiB', 'TiB'] as const;
const BYTE_STEP = 1024;

const numberFormats = new Map<string, Intl.NumberFormat>();
const dateFormats = new Map<string, Intl.DateTimeFormat>();

const cached = <T>(cache: Map<string, T>, key: string, create: () => T): T => {
    const existing = cache.get(key);
    if (existing) {
        return existing;
    }

    const created = create();
    cache.set(key, created);

    return created;
};

/** Intl throws on malformed locale tags; the panel falls back to English everywhere else too. */
const withLocale = <T>(locale: string, build: (tag: string) => T): T => {
    try {
        return build(locale);
    } catch (e) {
        return build(FALLBACK_LOCALE);
    }
};

const numberFormat = (locale: string, options: Intl.NumberFormatOptions): Intl.NumberFormat =>
    cached(numberFormats, `${locale}|${JSON.stringify(options)}`, () =>
        withLocale(locale, (tag) => new Intl.NumberFormat(tag, options))
    );

const dateFormat = (locale: string, options: Intl.DateTimeFormatOptions): Intl.DateTimeFormat =>
    cached(dateFormats, `${locale}|${JSON.stringify(options)}`, () =>
        withLocale(locale, (tag) => new Intl.DateTimeFormat(tag, options))
    );

export const formatNumber = (value: number, locale: string, minDigits: number, maxDigits = minDigits): string =>
    numberFormat(locale, { minimumFractionDigits: minDigits, maximumFractionDigits: maxDigits }).format(value);

/** Formats a 0..100 value (Wings reports CPU as 100 per core) with the locale's percent style. */
export const formatPercent = (value: number, locale: string, minDigits: number, maxDigits = minDigits): string =>
    numberFormat(locale, { style: 'percent', minimumFractionDigits: minDigits, maximumFractionDigits: maxDigits }).format(
        value / 100
    );

/** Largest binary unit that keeps the value at or above 1, found by division to avoid log rounding. */
const byteUnit = (size: number): { scaled: number; exponent: number } => {
    let scaled = size;
    let exponent = 0;
    while (scaled >= BYTE_STEP && exponent < BYTE_UNITS.length - 1) {
        scaled /= BYTE_STEP;
        exponent++;
    }

    return { scaled, exponent };
};

/** Binary units, matching how Pterodactyl sizes memory and disk limits. Whole bytes never show decimals. */
export const formatBytes = (bytes: number, locale: string, minDigits: number, maxDigits = minDigits): string => {
    const { scaled, exponent } = byteUnit(Math.max(0, bytes));
    const value =
        exponent === 0 ? formatNumber(scaled, locale, 0) : formatNumber(scaled, locale, minDigits, maxDigits);

    return `${value} ${BYTE_UNITS[exponent]}`;
};

export const formatExactBytes = (bytes: number, locale: string): string =>
    `${formatNumber(Math.round(Math.max(0, bytes)), locale, 0)} bytes`;

/** Hours, minutes and seconds in the locale's own clock style. */
export const formatClock = (time: number, locale: string, timeZone?: string): string =>
    dateFormat(locale, { hour: '2-digit', minute: '2-digit', second: '2-digit', timeZone }).format(time);

export const formatDay = (time: number, locale: string, timeZone?: string): string =>
    dateFormat(locale, { weekday: 'short', day: 'numeric', month: 'short', year: 'numeric', timeZone }).format(time);
