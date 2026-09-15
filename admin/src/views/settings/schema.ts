/** Claves editables de docs/API.md §7, agrupadas, con rangos y validación en cliente. */
import type { SettingValue } from '@/api/types'

export type FieldKind = 'bool' | 'int' | 'float' | 'text' | 'url' | 'csv' | 'permission'

export interface SettingField {
  key: string
  label: string
  help?: string
  kind: FieldKind
  min?: number
  max?: number
  maxLength?: number
  /** Unidad mostrada junto al número (los segundos se enseñan también en formato legible). */
  unit?: 's' | 'días' | '%'
  optional?: boolean
  fallback: string
}

export interface SettingGroup {
  id: string
  title: string
  desc: string
  fields: SettingField[]
}

const bool = (key: string, label: string, fallback: '0' | '1', help?: string): SettingField => ({ key, label, kind: 'bool', fallback, ...(help && { help }) })

export const SETTING_GROUPS: SettingGroup[] = [
  {
    id: 'deteccion',
    title: 'Detección',
    desc: 'Reglas automáticas que se aplican a quien no está en whitelist.',
    fields: [
      bool('block_proxy', 'Bloquear proxies', '1'),
      bool('block_vpn', 'Bloquear VPN', '1'),
      bool('block_hosting', 'Bloquear hosting y datacenters', '1'),
      bool('block_mobile', 'Bloquear redes móviles', '0'),
      bool('ip_api_fail_open', 'Dejar pasar si no hay ningún dato de IP', '0', 'Solo aplica cuando no hay caché, ni ip-api, ni espejo MaxMind.'),
    ],
  },
  {
    id: 'comprometida',
    title: 'Cuenta comprometida',
    desc: 'Detecta un cambio brusco de país respecto al historial del jugador.',
    fields: [
      bool('country_change_detection_enabled', 'Activar la detección', '1'),
      bool('country_change_continent_only', 'Solo si cambia de continente', '0'),
      { key: 'country_change_min_connections', label: 'Conexiones mínimas de historial', kind: 'int', min: 1, max: 1000, fallback: '3' },
      { key: 'country_change_min_percentage', label: 'Porcentaje mínimo del país habitual', kind: 'float', min: 0, max: 100, unit: '%', fallback: '70' },
    ],
  },
  {
    id: 'furrperms',
    title: 'FurrPerms',
    desc: 'Protección de comandos sensibles.',
    fields: [
      bool('fur_perms_enabled', 'Activar FurrPerms', '1'),
      bool('fur_perms_log_allowed', 'Registrar comandos permitidos', '1'),
      bool('fur_perms_log_blocked', 'Registrar comandos bloqueados', '1'),
    ],
  },
  {
    id: 'furrsecurity',
    title: 'FurrSecurity',
    desc: 'Verificación del staff con Discord antes de poder jugar.',
    fields: [
      bool('furrsecurity_enabled', 'Activar FurrSecurity', '1'),
      bool('furrsecurity_notify_admins', 'Avisar a los admins', '1'),
      bool('furrsecurity_lock_movement', 'Bloquear movimiento sin verificar', '1'),
      bool('furrsecurity_lock_commands', 'Bloquear comandos sin verificar', '1'),
      bool('furrsecurity_lock_inventory', 'Bloquear inventario sin verificar', '1'),
      bool('furrsecurity_lock_server_switch', 'Bloquear cambio de servidor sin verificar', '1'),
      { key: 'furrsecurity_session_duration', label: 'Duración de la sesión verificada', kind: 'int', min: 300, max: 604800, unit: 's', fallback: '28800' },
      { key: 'furrsecurity_token_expiration', label: 'Caducidad del enlace de verificación', kind: 'int', min: 60, max: 3600, unit: 's', fallback: '180' },
      { key: 'furrsecurity_max_failed_attempts', label: 'Intentos fallidos antes del auto-baneo', kind: 'int', min: 1, max: 20, fallback: '3' },
      { key: 'furrsecurity_failed_attempts_window', label: 'Ventana de intentos fallidos', kind: 'int', min: 300, max: 2592000, unit: 's', fallback: '86400' },
      { key: 'furrsecurity_early_verify_time', label: 'Permitir re-verificar antes de caducar', kind: 'int', min: 0, max: 86400, unit: 's', fallback: '300' },
      { key: 'furrsecurity_alert_times', label: 'Avisos antes de caducar (segundos)', kind: 'csv', fallback: '3600,1800,300,240,180,120,60,30', help: 'Lista separada por comas de enteros ≥ 0.' },
      { key: 'furrsecurity_verify_url', label: 'URL de verificación', kind: 'url', fallback: '', help: 'https://…/verify.php' },
      { key: 'furrsecurity_admin_permission', label: 'Permiso para recibir avisos', kind: 'permission', maxLength: 100, fallback: 'furrsecurity.notify' },
    ],
  },
  {
    id: 'retencion',
    title: 'Retención',
    desc: 'Cuántos días se guardan los datos históricos. 0 = conservar siempre.',
    fields: [
      { key: 'retention_connections_days', label: 'Conexiones', kind: 'int', min: 0, max: 3650, unit: 'días', fallback: '0' },
      { key: 'retention_logs_days', label: 'Registro de actividad', kind: 'int', min: 0, max: 3650, unit: 'días', fallback: '0' },
    ],
  },
  {
    id: 'general',
    title: 'General',
    desc: 'Datos que aparecen en los mensajes del plugin y avisos en el servidor.',
    fields: [
      { key: 'server_name', label: 'Nombre del servidor', kind: 'text', maxLength: 64, fallback: 'FurrGuard' },
      { key: 'discord_url', label: 'Enlace de Discord', kind: 'url', optional: true, fallback: '', help: 'https://… o vacío.' },
      bool('notify_connections', 'Avisar de cada conexión al staff', '0'),
      bool('notify_hispanic', 'Avisar al staff de la procedencia (hispana o no) al conectar', '0'),
    ],
  },
]

export const ALL_FIELDS: SettingField[] = SETTING_GROUPS.flatMap((group) => group.fields)

export const toText = (value: SettingValue | undefined, field: SettingField): string =>
  value === null || value === undefined ? field.fallback : String(value)

export function validateSetting(field: SettingField, raw: string): string | null {
  const value = raw.trim()
  switch (field.kind) {
    case 'bool':
      return value === '0' || value === '1' ? null : 'Valor no válido.'
    case 'int':
    case 'float': {
      const pattern = field.kind === 'int' ? /^-?\d+$/ : /^-?\d+(\.\d+)?$/
      const n = Number(value)
      if (!pattern.test(value) || !Number.isFinite(n)) return field.kind === 'int' ? 'Escribe un número entero.' : 'Escribe un número.'
      if ((field.min !== undefined && n < field.min) || (field.max !== undefined && n > field.max)) return `Debe estar entre ${field.min} y ${field.max}.`
      return null
    }
    case 'text':
      if (!value) return 'No puede estar vacío.'
      return field.maxLength && value.length > field.maxLength ? `Máximo ${field.maxLength} caracteres.` : null
    case 'url':
      if (!value) return field.optional ? null : 'Escribe una URL https.'
      try {
        return new URL(value).protocol === 'https:' ? null : 'La URL debe empezar por https://.'
      } catch {
        return 'No es una URL válida.'
      }
    case 'csv':
      return /^\d+(\s*,\s*\d+)*$/.test(value) ? null : 'Lista de enteros ≥ 0 separados por comas.'
    case 'permission':
      return /^[a-z0-9._*-]+$/.test(value) ? null : 'Solo minúsculas, números y . _ * -'
  }
}

/** Tipo que se envía: número para bool/int/float, texto normalizado para el resto. */
export function toPayload(field: SettingField, raw: string): string | number {
  const value = raw.trim()
  if (field.kind === 'bool' || field.kind === 'int' || field.kind === 'float') return Number(value)
  if (field.kind === 'csv') return value.split(',').map((part) => part.trim()).join(',')
  return value
}
