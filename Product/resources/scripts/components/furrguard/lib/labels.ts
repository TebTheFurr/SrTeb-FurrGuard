import { IconDefinition } from '@fortawesome/fontawesome-svg-core';
import {
    faBan,
    faBroadcastTower,
    faBuilding,
    faCheck,
    faClipboardCheck,
    faClock,
    faCog,
    faCommentAlt,
    faCommentDots,
    faExclamationTriangle,
    faEyeSlash,
    faGamepad,
    faGlobeEurope,
    faHourglassHalf,
    faIdCard,
    faInfinity,
    faLink,
    faLock,
    faMap,
    faMapMarkerAlt,
    faMobileAlt,
    faNetworkWired,
    faPause,
    faPlug,
    faRedo,
    faServer,
    faShieldAlt,
    faSignInAlt,
    faSignOutAlt,
    faSignal,
    faTag,
    faTimes,
    faUsers,
    faUserSecret,
} from '@fortawesome/free-solid-svg-icons';
import { EntryType, Flag, Role } from '@/api/furrguard/types';
import { formatDateTime, isOn, isPast, timeAgo } from './format';
import { isIpv4, isIpv6 } from './ips';

/*
 * Labels, tones and icons for the values FurrGuard sends (docs/API.md §1.3, §4.4).
 */

export type Tone = 'neutral' | 'ok' | 'warn' | 'down' | 'accent' | 'gold';

export interface Label {
    label: string;
    icon: IconDefinition;
    tone?: Tone;
    title?: string;
}

/** Reasons of check_player (§1.3). Old connections may carry `proxy`, `vpn`… without the suffix. */
export const REASONS: Readonly<Record<string, Label>> = {
    allowed: { label: 'Permitida', icon: faCheck, tone: 'ok' },
    whitelisted: { label: 'Whitelist', icon: faClipboardCheck, tone: 'ok' },
    blacklisted: { label: 'Blacklist', icon: faBan, tone: 'down' },
    compromised_account: { label: 'Cuenta comprometida', icon: faExclamationTriangle, tone: 'down' },
    proxy_detected: { label: 'Proxy', icon: faUserSecret, tone: 'down' },
    vpn_detected: { label: 'VPN', icon: faEyeSlash, tone: 'down' },
    hosting_detected: { label: 'Hosting', icon: faServer, tone: 'down' },
    mobile_detected: { label: 'Red móvil', icon: faMobileAlt, tone: 'down' },
    blocked_provider: { label: 'Proveedor bloqueado', icon: faBuilding, tone: 'down' },
    blocked_country: { label: 'País bloqueado', icon: faMap, tone: 'down' },
    blocked_continent: { label: 'Continente bloqueado', icon: faGlobeEurope, tone: 'down' },
    ip_api_unavailable: { label: 'Sin datos de IP', icon: faSignal, tone: 'warn' },
};

export function reasonLabel(reason: string | null | undefined): Label {
    const key = (reason ?? '').trim().toLowerCase();
    const known = REASONS[key] ?? REASONS[`${key}_detected`] ?? REASONS[`blocked_${key}`];

    return known ?? { label: reason || 'Bloqueada', icon: faBan, tone: 'down' };
}

/** Detections of a connection, in evaluation order. */
export const DETECTIONS = [
    { key: 'is_proxy', label: 'Proxy', icon: faUserSecret },
    { key: 'is_vpn', label: 'VPN', icon: faEyeSlash },
    { key: 'is_hosting', label: 'Hosting', icon: faServer },
    { key: 'is_mobile', label: 'Móvil', icon: faMobileAlt },
] as const;

export type DetectionKey = (typeof DETECTIONS)[number]['key'];

export const detectionsOf = (row: Partial<Record<DetectionKey, Flag>>) => DETECTIONS.filter((d) => isOn(row[d.key]));

/** Types of activity_logs (§4.4). */
export const LOG_TYPES: readonly ({ value: string } & Label)[] = [
    { value: 'auth', label: 'Accesos', icon: faSignInAlt },
    { value: 'whitelist', label: 'Whitelist', icon: faClipboardCheck },
    { value: 'blacklist', label: 'Blacklist', icon: faBan },
    { value: 'providers', label: 'Proveedores', icon: faBuilding },
    { value: 'countries', label: 'Países', icon: faMap },
    { value: 'continents', label: 'Continentes', icon: faGlobeEurope },
    { value: 'messages', label: 'Mensajes', icon: faCommentAlt },
    { value: 'settings', label: 'Ajustes', icon: faCog },
    { value: 'users', label: 'Usuarios', icon: faUsers },
    { value: 'furrperms', label: 'FurrPerms', icon: faLock },
    { value: 'furrsecurity', label: 'FurrSecurity', icon: faShieldAlt },
    { value: 'security', label: 'Seguridad', icon: faExclamationTriangle },
    { value: 'players', label: 'Jugadores', icon: faGamepad },
];

export const logTypeLabel = (type: string): Label => LOG_TYPES.find((t) => t.value === type) ?? { label: type, icon: faCog };

/** Actions of furrsecurity_logs, including the wrong-Discord ones. */
export const SECURITY_ACTIONS: Readonly<Record<string, Label>> = {
    token_generated: { label: 'Enlace generado', icon: faLink },
    verification_success: { label: 'Verificación completada', icon: faCheck, tone: 'ok' },
    verification_failed: { label: 'Verificación fallida', icon: faTimes, tone: 'down' },
    wrong_discord_attempt: { label: 'Intento con otro Discord', icon: faCommentDots, tone: 'warn' },
    auto_blacklisted: { label: 'Auto-baneo por intentos fallidos', icon: faBan, tone: 'down' },
    auto_blacklisted_wrong_discord: { label: 'Auto-baneo por Discord incorrecto', icon: faBan, tone: 'down' },
    session_extended: { label: 'Sesión extendida', icon: faHourglassHalf, tone: 'ok' },
    session_reset: { label: 'Sesión reiniciada', icon: faRedo },
    session_revoked: { label: 'Sesión revocada', icon: faSignOutAlt, tone: 'warn' },
    revoke_session: { label: 'Sesión revocada', icon: faSignOutAlt, tone: 'warn' },
    player_disconnect: { label: 'Desconexión', icon: faPlug },
    ip_changed: { label: 'Cambio de IP', icon: faMapMarkerAlt, tone: 'warn' },
    token_expired: { label: 'Enlace caducado', icon: faClock, tone: 'warn' },
};

export const securityActionLabel = (action: string): Label =>
    SECURITY_ACTIONS[action] ?? { label: action.replace(/_/g, ' '), icon: faShieldAlt };

export const ROLE_LABELS: Readonly<Record<Role, string>> = {
    founder: 'Founder',
    owner: 'Owner',
    manager: 'Manager',
    sradmin: 'Sr. Admin',
    admin: 'Admin',
};

/* ── Entradas de whitelist / blacklist ─────────────────────────────────── */

export interface EntryTypeInfo {
    value: EntryType;
    label: string;
    icon: IconDefinition;
    placeholder: string;
    help: string;
}

/** Types of the contract (§0): never `asn` nor `cidr`. */
export const ENTRY_TYPES: readonly EntryTypeInfo[] = [
    {
        value: 'uuid',
        label: 'UUID',
        icon: faIdCard,
        placeholder: '069a79f4-44e9-4726-a5be-fca90e38aaf5',
        help: 'UUID del jugador, con o sin guiones.',
    },
    {
        value: 'nick',
        label: 'Nick',
        icon: faTag,
        placeholder: 'Notch',
        help: 'De 1 a 16 caracteres: letras, números y _. Los jugadores de Bedrock (Floodgate) llevan . o * delante.',
    },
    { value: 'ip', label: 'IP', icon: faMapMarkerAlt, placeholder: '203.0.113.7', help: 'Una IPv4 o IPv6 concreta.' },
    {
        value: 'ip_range',
        label: 'Rango IP',
        icon: faNetworkWired,
        placeholder: '203.0.113.0/24',
        help: 'Rango en notación CIDR. Mínimo /8 en IPv4 y /16 en IPv6.',
    },
    { value: 'as', label: 'AS', icon: faBroadcastTower, placeholder: 'AS3352', help: 'Sistema autónomo del proveedor: AS3352 o solo 3352.' },
];

export const entryInfo = (type: string): EntryTypeInfo | undefined => ENTRY_TYPES.find((t) => t.value === type);

export const entryLabel = (type: string): string => entryInfo(type)?.label ?? type;

export const isIpEntry = (type: string): boolean => type === 'ip' || type === 'ip_range';

const UUID = /^[0-9a-f]{8}-?[0-9a-f]{4}-?[0-9a-f]{4}-?[0-9a-f]{4}-?[0-9a-f]{12}$/i;
const NICK = /^[.*]?[A-Za-z0-9_]{1,16}$/;
const AS = /^(?:AS)?\d{1,10}(?:\s.*)?$/i;

export const isUuid = (value: string): boolean => UUID.test(value.trim());
export const isNick = (value: string): boolean => NICK.test(value) && value.length <= 16;
export const isDiscordId = (value: string): boolean => /^\d{17,20}$/.test(value.trim());

/** Client-side validation to warn early; the server normalises and validates again. */
export function validateEntry(type: EntryType, raw: string): string | null {
    const value = raw.trim();
    if (!value) return 'Escribe un valor.';
    switch (type) {
        case 'uuid':
            return isUuid(value) ? null : 'No es un UUID válido.';
        case 'nick':
            return isNick(value) ? null : 'Nick no válido: 1-16 caracteres (letras, números y _).';
        case 'ip':
            return isIpv4(value) || isIpv6(value) ? null : 'No es una IPv4 ni una IPv6 válida.';
        case 'ip_range': {
            const [address = '', prefix = '', extra] = value.split('/');
            const bits = /^\d{1,3}$/.test(prefix) ? Number(prefix) : Number.NaN;
            if (extra !== undefined || Number.isNaN(bits)) return 'Usa notación CIDR, p. ej. 203.0.113.0/24.';
            if (isIpv4(address)) return bits >= 8 && bits <= 32 ? null : 'En IPv4 el prefijo va de /8 a /32.';
            if (isIpv6(address)) return bits >= 16 && bits <= 128 ? null : 'En IPv6 el prefijo va de /16 a /128.';

            return 'La dirección del rango no es válida.';
        }
        case 'as':
            return AS.test(value) ? null : 'Escribe el número de AS, p. ej. AS3352.';
        default:
            return null;
    }
}

export const DURATION_PRESETS: readonly { minutes: number; label: string }[] = [
    { minutes: 0, label: 'Permanente' },
    { minutes: 30, label: '30 minutos' },
    { minutes: 60, label: '1 hora' },
    { minutes: 360, label: '6 horas' },
    { minutes: 720, label: '12 horas' },
    { minutes: 1440, label: '1 día' },
    { minutes: 10080, label: '7 días' },
    { minutes: 43200, label: '30 días' },
];

/* ── Baneos ─────────────────────────────────────────────────────────────── */

export function banStatus(active: Flag, expiresAt: string | null): Label {
    if (!isOn(active)) return { label: 'Inactivo', icon: faPause, tone: 'neutral' };
    if (expiresAt && isPast(expiresAt)) return { label: 'Expirado', icon: faClock, tone: 'warn' };

    return { label: 'Activo', icon: faBan, tone: 'down' };
}

export function banExpiry(expiresAt: string | null): Label {
    if (!expiresAt) return { label: 'Permanente', icon: faInfinity, tone: 'neutral' };

    return { label: timeAgo(expiresAt), icon: faHourglassHalf, tone: 'neutral', title: formatDateTime(expiresAt) };
}

/* ── Geolocalización ────────────────────────────────────────────────────── */

const GEO_PROVIDERS: Record<string, string> = {
    'ip-api': 'ip-api.com',
    proxycheck: 'proxycheck.io',
    'ipapi-is': 'ipapi.is',
    freeipapi: 'freeipapi.com',
    maxmind: 'espejo MaxMind',
};

/** Readable text of the method and providers stored with a connection (`geo_source`). */
export function geoSourceLabel(source: string | null | undefined): string {
    if (!source) return 'Sin registro (conexión anterior a la 2.0)';
    if (source === 'none') return 'Sin datos: ningún proveedor respondió';
    if (source === 'maxmind') return 'Solo espejo MaxMind (proveedores remotos no disponibles: modo degradado)';
    const cached = source.startsWith('cache:');
    const parts = (cached ? source.slice(6) : source).split('+').map((p) => GEO_PROVIDERS[p] ?? p);
    const detail = parts.length > 1 ? `${parts[0]} + ${parts.slice(1).join(' + ')}` : parts[0];

    return cached ? `Caché de IP (24 h) · origen: ${detail}` : `Consulta en directo · ${detail}`;
}
