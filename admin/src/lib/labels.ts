/** Etiquetas e iconos (pixelarticons) de los valores que llegan del servidor. */
import type { Component } from 'vue'
import IconBuildings from '~icons/pixelarticons/buildings'
import IconCancel from '~icons/pixelarticons/cancel'
import IconCellularOff from '~icons/pixelarticons/cellular-signal-off'
import IconCheck from '~icons/pixelarticons/check'
import IconChecklist from '~icons/pixelarticons/checklist'
import IconClock from '~icons/pixelarticons/clock'
import IconClose from '~icons/pixelarticons/close'
import IconDiscord from '~icons/pixelarticons/discord'
import IconEarth from '~icons/pixelarticons/earth'
import IconGamepad from '~icons/pixelarticons/gamepad'
import IconHidden from '~icons/pixelarticons/hidden'
import IconHourglass from '~icons/pixelarticons/hourglass'
import IconLink from '~icons/pixelarticons/link'
import IconLock from '~icons/pixelarticons/lock'
import IconLogin from '~icons/pixelarticons/login'
import IconLogout from '~icons/pixelarticons/logout'
import IconMap from '~icons/pixelarticons/map'
import IconMapPin from '~icons/pixelarticons/map-pin'
import IconMessageText from '~icons/pixelarticons/message-text'
import IconPlug from '~icons/pixelarticons/plug'
import IconReload from '~icons/pixelarticons/reload'
import IconServer from '~icons/pixelarticons/server'
import IconSettings from '~icons/pixelarticons/settings-cog'
import IconShield from '~icons/pixelarticons/shield'
import IconSiren from '~icons/pixelarticons/siren'
import IconSmartphone from '~icons/pixelarticons/smartphone'
import IconSunglasses from '~icons/pixelarticons/sunglasses'
import IconUsers from '~icons/pixelarticons/users'
import type { Role } from '@/api/types'

export type ChipTone = '' | 'ok' | 'warn' | 'down' | 'accent' | 'gold' | 'fox' | 'tenue'

export interface Label {
  label: string
  icon: Component
  tone?: ChipTone
}

/** Motivos de check_player (§1.3). Las conexiones antiguas pueden traer `proxy`, `vpn`… sin sufijo. */
export const REASONS: Readonly<Record<string, Label>> = {
  allowed: { label: 'Permitida', icon: IconCheck, tone: 'ok' },
  whitelisted: { label: 'Whitelist', icon: IconChecklist, tone: 'ok' },
  blacklisted: { label: 'Blacklist', icon: IconCancel, tone: 'down' },
  compromised_account: { label: 'Cuenta comprometida', icon: IconSiren, tone: 'down' },
  proxy_detected: { label: 'Proxy', icon: IconSunglasses, tone: 'down' },
  vpn_detected: { label: 'VPN', icon: IconHidden, tone: 'down' },
  hosting_detected: { label: 'Hosting', icon: IconServer, tone: 'down' },
  mobile_detected: { label: 'Red móvil', icon: IconSmartphone, tone: 'down' },
  blocked_provider: { label: 'Proveedor bloqueado', icon: IconBuildings, tone: 'down' },
  blocked_country: { label: 'País bloqueado', icon: IconMap, tone: 'down' },
  blocked_continent: { label: 'Continente bloqueado', icon: IconEarth, tone: 'down' },
  ip_api_unavailable: { label: 'Sin datos de IP', icon: IconCellularOff, tone: 'warn' },
}

export function reasonLabel(reason: string | null | undefined): Label {
  const key = (reason ?? '').trim().toLowerCase()
  const known = REASONS[key] ?? REASONS[`${key}_detected`] ?? REASONS[`blocked_${key}`]
  return known ?? { label: reason || 'Bloqueada', icon: IconCancel, tone: 'down' }
}

/** Detecciones de una conexión, en el orden de la evaluación. */
export const DETECTIONS = [
  { key: 'is_proxy', label: 'Proxy', icon: IconSunglasses },
  { key: 'is_vpn', label: 'VPN', icon: IconHidden },
  { key: 'is_hosting', label: 'Hosting', icon: IconServer },
  { key: 'is_mobile', label: 'Móvil', icon: IconSmartphone },
] as const

/** Tipos de activity_logs (§4.4). */
export const LOG_TYPES: readonly ({ value: string } & Label)[] = [
  { value: 'auth', label: 'Accesos', icon: IconLogin },
  { value: 'whitelist', label: 'Whitelist', icon: IconChecklist },
  { value: 'blacklist', label: 'Blacklist', icon: IconCancel },
  { value: 'providers', label: 'Proveedores', icon: IconBuildings },
  { value: 'countries', label: 'Países', icon: IconMap },
  { value: 'continents', label: 'Continentes', icon: IconEarth },
  { value: 'messages', label: 'Mensajes', icon: IconMessageText },
  { value: 'settings', label: 'Ajustes', icon: IconSettings },
  { value: 'users', label: 'Usuarios', icon: IconUsers },
  { value: 'furrperms', label: 'FurrPerms', icon: IconLock },
  { value: 'furrsecurity', label: 'FurrSecurity', icon: IconShield },
  { value: 'security', label: 'Seguridad', icon: IconSiren },
  { value: 'players', label: 'Jugadores', icon: IconGamepad },
]

export const logTypeLabel = (type: string): Label =>
  LOG_TYPES.find((t) => t.value === type) ?? { label: type, icon: IconSettings }

/** Acciones de furrsecurity_logs, incluidas las de Discord incorrecto. */
export const SECURITY_ACTIONS: Readonly<Record<string, Label>> = {
  token_generated: { label: 'Enlace generado', icon: IconLink },
  verification_success: { label: 'Verificación completada', icon: IconCheck, tone: 'ok' },
  verification_failed: { label: 'Verificación fallida', icon: IconClose, tone: 'down' },
  wrong_discord_attempt: { label: 'Intento con otro Discord', icon: IconDiscord, tone: 'warn' },
  auto_blacklisted: { label: 'Auto-baneo por intentos fallidos', icon: IconCancel, tone: 'down' },
  auto_blacklisted_wrong_discord: { label: 'Auto-baneo por Discord incorrecto', icon: IconCancel, tone: 'down' },
  session_extended: { label: 'Sesión extendida', icon: IconHourglass, tone: 'ok' },
  session_reset: { label: 'Sesión reiniciada', icon: IconReload },
  session_revoked: { label: 'Sesión revocada', icon: IconLogout, tone: 'warn' },
  revoke_session: { label: 'Sesión revocada', icon: IconLogout, tone: 'warn' },
  player_disconnect: { label: 'Desconexión', icon: IconPlug },
  ip_changed: { label: 'Cambio de IP', icon: IconMapPin, tone: 'warn' },
  token_expired: { label: 'Enlace caducado', icon: IconClock, tone: 'warn' },
}

export const securityActionLabel = (action: string): Label =>
  SECURITY_ACTIONS[action] ?? { label: action.replace(/_/g, ' '), icon: IconShield }

export const ROLE_LABELS: Readonly<Record<Role, string>> = {
  founder: 'Founder',
  owner: 'Owner',
  manager: 'Manager',
  sradmin: 'Sr. Admin',
  admin: 'Admin',
}
