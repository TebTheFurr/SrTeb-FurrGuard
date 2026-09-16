import { Carpeta, CarpetaCopias, Nivel, RestaurarPeticion, TipoBackup } from '@/api/server/vault/types';

/*
 * Access levels, vault paths and the restore rules of vault/docs/PTERODACTYL.md
 * §2.2 and §4.4.1. The vault applies the same rules again before creating a
 * job; mirroring them here lets the dialog explain up front what will happen.
 */

export const FOLDERS: Carpeta[] = ['Global', 'Mundos', 'Backups', 'M-Backups'];

const LEVEL_ORDER: Record<Nivel, number> = { ver: 0, restaurar: 1, gestionar: 2 };

export const levelAllows = (level: Nivel, required: Nivel): boolean => LEVEL_ORDER[level] >= LEVEL_ORDER[required];

export const isFolder = (value: string): value is Carpeta => (FOLDERS as string[]).indexOf(value) !== -1;

/** Backups and M-Backups hold one sub-folder per copy. */
export const isBackupFolder = (carpeta: Carpeta): carpeta is CarpetaCopias =>
    carpeta === 'Backups' || carpeta === 'M-Backups';

export const pathSegments = (path: string): string[] => path.split('/').filter((segment) => segment.length > 0);

/** Joins relative vault paths without leading, trailing or repeated slashes. */
export const joinPath = (...parts: string[]): string =>
    parts.reduce<string[]>((segments, part) => segments.concat(pathSegments(part)), []).join('/');

export const parentPath = (path: string): string => pathSegments(path).slice(0, -1).join('/');

/** In Backups / M-Backups the first segment names the copy and the rest is relative to it. */
export const splitBackupPath = (path: string): { backup: string | null; rest: string } => {
    const [backup, ...rest] = pathSegments(path);

    return { backup: backup ?? null, rest: rest.join('/') };
};

/** Whether restoring `path` writes into one of the world roots (or contains one). */
export const touchesWorld = (path: string, worlds: string[]): boolean => {
    const target = joinPath(path);
    if (!target) return worlds.length > 0;

    return worlds.some((world) => {
        const root = joinPath(world);

        return root !== '' && (target === root || target.indexOf(`${root}/`) === 0 || root.indexOf(`${target}/`) === 0);
    });
};

const MAX_PATH_BYTES = 4096;

const byteLength = (value: string): number => new TextEncoder().encode(value).length;

/**
 * Normalises the destination folder on the server ("" → "/", "a//b/" → "/a/b").
 * Returns null for anything that is not a plain path inside the server.
 */
export const normalizeDestination = (value: string): string | null => {
    const trimmed = value.trim();
    // eslint-disable-next-line no-control-regex
    if (/[\u0000-\u001f\\]/.test(trimmed)) return null;

    const segments = pathSegments(trimmed);
    if (segments.some((segment) => segment === '.' || segment === '..')) return null;

    const result = `/${segments.join('/')}`;

    return byteLength(result) > MAX_PATH_BYTES ? null : result;
};

export interface RestoreSource {
    carpeta: Carpeta;
    /** Copy name, required for Backups / M-Backups. */
    backup: string | null;
    /** Type of that copy when known: imported copies can only be restored whole. */
    backupType?: TipoBackup | null;
    /** Relative to the carpeta (or to the copy). Empty means everything. */
    rutas: string[];
}

export type WipeScope = 'todo' | 'sin_mundos' | 'mundos';

export type StopReason = 'worlds' | 'whole_backup' | 'wipe';

export interface RestoreRules {
    /** Paths actually sent: deduplicated, and empty when the whole source is restored. */
    rutas: string[];
    restoresEverything: boolean;
    wholeOnly: boolean;
    /** Wiping is only allowed for a whole source restored to "/". */
    canWipe: boolean;
    wipeScope: WipeScope | null;
    stopForced: boolean;
    stopReason: StopReason | null;
}

export const restoreRules = (source: RestoreSource, destination: string, wipe: boolean, worlds: string[]): RestoreRules => {
    const wholeOnly = source.backupType === 'importada';
    const cleaned = source.rutas.map((ruta) => joinPath(ruta));
    const restoresEverything = wholeOnly || cleaned.length === 0 || cleaned.indexOf('') !== -1;
    const rutas = restoresEverything ? [] : cleaned.filter((ruta, index) => cleaned.indexOf(ruta) === index);

    const fromBackup = isBackupFolder(source.carpeta);
    const canWipe = restoresEverything && normalizeDestination(destination) === '/';
    const wipeScope: WipeScope | null = !canWipe
        ? null
        : fromBackup
        ? 'todo'
        : source.carpeta === 'Global'
        ? 'sin_mundos'
        : 'mundos';

    // The vault forces a stop for worlds and for whole copies. Deleting the
    // server tree while it runs is never safe either, so wiping forces it too.
    const restoresWorlds = source.carpeta === 'Mundos' || (fromBackup && rutas.some((ruta) => touchesWorld(ruta, worlds)));
    const stopReason: StopReason | null = restoresWorlds
        ? 'worlds'
        : fromBackup && restoresEverything
        ? 'whole_backup'
        : canWipe && wipe
        ? 'wipe'
        : null;

    return { rutas, restoresEverything, wholeOnly, canWipe, wipeScope, stopForced: stopReason !== null, stopReason };
};

export interface RestoreOptions {
    destino: string;
    detener: boolean;
    vaciar: boolean;
    encender: boolean;
}

/** Builds the `restaurar` body, or null when the destination or the source is invalid. */
export const buildRestoreRequest = (
    source: RestoreSource,
    options: RestoreOptions,
    worlds: string[]
): RestaurarPeticion | null => {
    const destino = normalizeDestination(options.destino);
    if (destino === null) return null;
    if (isBackupFolder(source.carpeta) && !source.backup) return null;

    const rules = restoreRules(source, destino, options.vaciar, worlds);

    return {
        carpeta: source.carpeta,
        backup: isBackupFolder(source.carpeta) ? source.backup : null,
        rutas: rules.rutas,
        destino,
        detener: rules.stopForced || options.detener,
        vaciar: rules.canWipe && options.vaciar,
        encender: options.encender,
    };
};

export const MAX_EXCLUSIONS = 100;
export const MAX_EXCLUSION_LENGTH = 256;

/** Shortcuts offered by the exclusions editor (same list as the admin tab). */
export const EXCLUSION_PRESETS = [
    'logs/',
    'crash-reports/',
    'cache/',
    'plugins/dynmap/web/tiles/',
    'bluemap/web/maps/',
    '.paper-remapped/',
];

/** One pattern per line; blank lines and duplicates are dropped. */
export const parseExclusions = (text: string): string[] =>
    text
        .split(/\r?\n/)
        .map((line) => line.trim())
        .filter((line, index, lines) => line.length > 0 && lines.indexOf(line) === index);

export type ExclusionProblem =
    | { kind: 'too_many'; max: number }
    | { kind: 'too_long'; pattern: string; max: number }
    | { kind: 'invalid'; pattern: string };

export const validateExclusions = (patterns: string[]): ExclusionProblem | null => {
    if (patterns.length > MAX_EXCLUSIONS) return { kind: 'too_many', max: MAX_EXCLUSIONS };

    const tooLong = patterns.find((pattern) => pattern.length > MAX_EXCLUSION_LENGTH);
    if (tooLong !== undefined) return { kind: 'too_long', pattern: tooLong, max: MAX_EXCLUSION_LENGTH };

    // eslint-disable-next-line no-control-regex
    const invalid = patterns.find((pattern) => /[\r\n\u0000]/.test(pattern));

    return invalid !== undefined ? { kind: 'invalid', pattern: invalid } : null;
};

export const togglePattern = (patterns: string[], pattern: string): string[] =>
    patterns.indexOf(pattern) !== -1 ? patterns.filter((item) => item !== pattern) : [...patterns, pattern];

export const sameList = (a: string[], b: string[]): boolean =>
    a.length === b.length && a.every((item, index) => item === b[index]);

/** Server-root relative paths (no leading slash) for files picked in the file manager. */
export const serverRelativePaths = (directory: string, names: string[]): string[] =>
    names.map((name) => joinPath(directory, name)).filter((path) => path.length > 0);
