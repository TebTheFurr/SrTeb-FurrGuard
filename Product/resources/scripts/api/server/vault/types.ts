/**
 * Shapes of the Tebby Vault data returned by the client API
 * (`/api/client/servers/{server}/vault/...`).
 *
 * The panel proxies the vault's `data` object unchanged, so these types keep
 * the protocol's Spanish, snake_case field names on purpose: they must stay
 * identical to vault/docs/PTERODACTYL.md §3 and §4.4. If a shape changes
 * there, change it here too.
 */

export type Carpeta = 'Global' | 'Mundos' | 'Backups' | 'M-Backups';

/** Carpetas whose root lists one entry per copy. */
export type CarpetaCopias = 'Backups' | 'M-Backups';

export type Nivel = 'ver' | 'restaurar' | 'gestionar';

export type Rango = 'founder' | 'admin' | 'user' | null;

export interface Actor {
    id: string;
    nombre: string;
}

export interface UsuarioVault {
    id: string;
    nombre: string;
    avatar: string;
    rango: Rango;
}

export type TipoTrabajo = 'sincronizar' | 'backup_diaria' | 'backup_manual' | 'restaurar' | 'importar';

export type EstadoTrabajo = 'en_cola' | 'despachado' | 'en_curso' | 'procesando' | 'ok' | 'fallo' | 'cancelado';

export type FaseTrabajo = 'consistencia' | 'manifiesto' | 'enviando' | 'recibiendo' | 'vaciando' | 'instantanea' | 'limpieza';

export interface ProgresoTrabajo {
    fase: FaseTrabajo | null;
    archivos: number;
    archivos_total: number;
    bytes: number;
    bytes_total: number;
}

export interface ResultadoTrabajo {
    backup: string | null;
    archivos: number;
    bytes: number;
    nuevos: number;
    borrados: number;
    avisos: string[];
}

export interface Trabajo {
    id: string;
    servidor: string;
    tipo: TipoTrabajo;
    estado: EstadoTrabajo;
    creado_ts: number;
    inicio_ts: number | null;
    fin_ts: number | null;
    /** null when the job was started by the system (daily backup, import). */
    actor: Actor | null;
    progreso: ProgresoTrabajo;
    resultado: ResultadoTrabajo | null;
    error: string | null;
    /** Ready-to-display description written by the vault. */
    resumen: string;
}

export type TipoBackup = 'diaria' | 'manual' | 'importada';

export type AlcanceBackup = 'completa' | 'sin_mundos' | 'mundos' | 'rutas';

export interface BackupImportada {
    uuid: string;
    nombre: string;
    checksum: string;
}

export interface Backup {
    carpeta: CarpetaCopias;
    nombre: string;
    tipo: TipoBackup;
    alcance: AlcanceBackup;
    fijada: boolean;
    nota: string;
    archivos: number;
    bytes: number;
    creado_ts: number;
    autor: Actor | null;
    importada: BackupImportada | null;
}

export interface Entrada {
    nombre: string;
    tipo: 'archivo' | 'carpeta';
    bytes: number;
    mtime: number;
    /** Only present at the root of Backups / M-Backups. */
    backup: Backup | null;
}

export interface Acceso {
    discord_id: string;
    nombre: string;
    avatar: string;
    nivel: Nivel;
    registrado: boolean;
    nota: string;
    creado_por: string;
    creado_ts: number;
}

export interface EventoServidor {
    id: number | string;
    ts: number;
    usuario: Actor;
    accion: string;
    carpeta: string;
    ruta: string;
    detalle: string;
    bytes: number;
    ok: boolean;
    /** Only included for vault founders and admins. */
    ip?: string;
}

export interface CarpetaResumen {
    id: Carpeta;
    bytes: number;
    archivos: number;
}

export interface CuotaResumen {
    usado: number;
    /** 0 means unlimited. */
    total: number;
    superada: boolean;
}

export interface Resumen {
    servidor: { short: string; nombre: string };
    usuario: UsuarioVault;
    nivel: Nivel;
    /** Vault founder or admin: may delete daily backups. */
    admin_vault: boolean;
    carpetas: CarpetaResumen[];
    cuota: CuotaResumen;
    exclusiones: string[];
    consistencia: boolean;
    mundos: string[];
    ultima_sync_ts: number | null;
    ultima_diaria: Backup | null;
    proxima_diaria_ts: number | null;
    retencion_dias: number;
    trabajo_activo: Trabajo | null;
}

/** `GET /vault`: no session yet, or the signed-in identity with its summary. */
export type EstadoVault = { sesion: null } | { sesion: UsuarioVault; resumen: Resumen };

export type Cursor = string | number;

export interface Listado {
    carpeta: Carpeta;
    ruta: string;
    entradas: Entrada[];
    total: number;
    siguiente: Cursor | null;
}

export interface PaginaActividad {
    entradas: EventoServidor[];
    siguiente: Cursor | null;
}

export interface RestaurarPeticion {
    carpeta: Carpeta;
    /** Required for Backups / M-Backups, null otherwise. */
    backup: string | null;
    /** Relative to the carpeta (or to the copy). Empty means everything. */
    rutas: string[];
    destino: string;
    detener: boolean;
    vaciar: boolean;
    encender: boolean;
}

export interface CrearBackupPeticion {
    alcance: AlcanceBackup;
    rutas?: string[];
    nota?: string;
}
