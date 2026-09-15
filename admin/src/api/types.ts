/**
 * Formas del contrato del panel (docs/API.md §4). Los TINYINT de MySQL pueden llegar como
 * número, texto o booleano según el driver: por eso los indicadores son `Flag` y se leen
 * siempre con `isOn()` (lib/format.ts).
 */

export const ROLES = ['founder', 'owner', 'manager', 'sradmin', 'admin'] as const
export type Role = (typeof ROLES)[number]

export const SECTIONS = [
  'overview', 'players', 'connections', 'ips', 'whitelist', 'blacklist', 'sanctions', 'providers',
  'countries', 'continents', 'messages', 'logs', 'settings', 'users', 'furrperms', 'furrsecurity',
] as const
export type Section = (typeof SECTIONS)[number]

export type Flag = boolean | number | string
export type Num = number | string

export interface SessionUser {
  discord_id: string
  username: string
  avatar: string | null
  role: Role
}

export interface Boot {
  version: string
  csrfToken: string
  loginUrl: string
  loginError: string | null
  user: SessionUser | null
  permissions: Section[]
  canSeeIps: boolean
}

export interface Pagination {
  page: number
  per_page: number
  total: number
  total_pages: number
}

export type EntryType = 'uuid' | 'nick' | 'ip' | 'ip_range' | 'as'

/* ── resumen ───────────────────────────────────────────────────────────── */
export interface Health {
  api_key_configured: boolean
  geo_mirror: 'ok' | 'missing' | 'disabled'
  ip_api: 'ok' | 'limited' | 'down'
}

export interface RecentConnection {
  id?: number
  /** null en conexiones antiguas (anteriores a 2.0) que no guardaban el UUID */
  uuid: string | null
  nick: string
  ip: string | null
  country: string | null
  country_code: string | null
  blocked: Flag
  block_reason?: string | null
  created_at: string
}

export interface RecentBlock {
  id?: number
  ban_id?: string
  type: EntryType
  value: string
  reason: string | null
  created_at: string
  minecraft_name?: string | null
}

export interface Overview {
  online_players: Num
  total_players: Num
  connections_24h: Num
  blocked_24h: Num
  recent_connections: RecentConnection[]
  recent_blocks: RecentBlock[]
  counts: Record<'whitelist' | 'blacklist' | 'providers' | 'countries' | 'continents', Num>
  health: Health
}

/* ── jugadores, conexiones e IPs ───────────────────────────────────────── */
export interface PlayerRow {
  id: number
  uuid: string
  last_nick: string
  first_nick: string
  last_ip: string | null
  last_country: string | null
  last_country_code: string | null
  is_online: Flag
  is_whitelisted: Flag
  is_blacklisted: Flag
  total_connections: Num
  first_seen: string | null
  last_seen: string | null
}

export interface PlayerNick {
  nick: string
  first_used: string | null
  last_used: string | null
}

export interface PlayerIp {
  ip: string | null
  country: string | null
  country_code: string | null
  isp?: string | null
  first_used: string | null
  last_used: string | null
}

export interface ConnectionRow {
  id: number
  /** null en conexiones antiguas (anteriores a 2.0) que no guardaban el UUID */
  uuid: string | null
  nick: string
  ip: string | null
  country: string | null
  country_code: string | null
  region?: string | null
  city?: string | null
  isp?: string | null
  org?: string | null
  asn?: string | null
  asname?: string | null
  geo_source?: string | null
  is_proxy: Flag
  is_vpn: Flag
  is_hosting: Flag
  is_mobile: Flag
  game_version?: string | null
  timezone?: string | null
  blocked: Flag
  block_reason: string | null
  created_at: string
}

export type PremiumStatus = 'premium' | 'not_found' | 'unknown'

export interface WhitelistRef {
  id: number
  type: EntryType
  value: string
}

export interface BlacklistRef {
  id: number
  ban_id: string
  type: EntryType
  value: string
  reason: string | null
  active: Flag
  expires_at: string | null
}

export interface PlayerDetail {
  player: PlayerRow
  nicks: PlayerNick[]
  ips: PlayerIp[]
  recent_connections: ConnectionRow[]
  whitelist_entries: WhitelistRef[]
  blacklist_entries: BlacklistRef[]
  premium: { status: PremiumStatus; uuid: string | null }
  ip_hidden?: boolean
}

export interface LookupResult {
  status: PremiumStatus
  uuid: string | null
  name: string | null
}

export type NameHistorySource = 'mojang' | 'laby' | 'namemc'

export interface NameHistory {
  uuid: string | null
  history: { name: string; changed_at: string | null }[]
  /** false si alguna fuente no se pudo consultar: puede faltar historial. */
  complete: boolean
  failed_sources: NameHistorySource[]
}

export interface IpRow {
  ip: string | null
  country: string | null
  country_code: string | null
  isp: string | null
  asn: string | null
  first_seen: string | null
  player_count: Num
  connection_count: Num
  is_whitelisted: Flag
  is_blacklisted: Flag
}

export interface IpDetail {
  ip: IpRow | string | null
  players: { uuid: string; nick: string; last_used?: string | null }[]
}

/* ── whitelist, blacklist y sanciones ──────────────────────────────────── */
export interface WhitelistRow {
  id: number
  type: EntryType
  value: string
  reason: string | null
  added_by: string | null
  created_at: string
  minecraft_name: string | null
}

export interface BanChild {
  id: number
  ban_id: string
  type: EntryType
  value: string
  active: Flag
  expires_at: string | null
}

export interface BanRow extends BanChild {
  reason: string | null
  added_by: string | null
  created_at: string
  minecraft_name: string | null
  children: BanChild[]
}

export type SanctionRow = Omit<BanRow, 'children'>

export type SanctionFilter = 'all' | 'active' | 'expired' | 'inactive' | 'permanent' | 'temporary'

/* ── filtros ───────────────────────────────────────────────────────────── */
export type ProviderType = 'hosting' | 'vpn' | 'proxy'

export interface ProviderRow {
  id: number
  name: string
  pattern: string
  type: ProviderType
  block_count: Num
  active: Flag
  added_by: string | null
  created_at: string
}

/* ── sistema ───────────────────────────────────────────────────────────── */
export interface LogRow {
  id: number
  type: string
  action: string
  details: string | null
  ip_address: string | null
  created_at: string
}

export type SettingValue = string | number | null

export interface SettingsPayload {
  settings: Record<string, SettingValue>
  api_key: { configured: boolean; prefix: string | null; created_at: string | null }
}

export interface MigrationBatch {
  processed: Num
  skipped: Num
  changed: Num
  next_cursor: string | number | null
  details: string[]
}

export interface AdminUserRow {
  id: number
  discord_id: string
  role: Role
  created_by: string | null
  created_at: string
  discord_username?: string | null
  /** false solo en la fila de FOUNDER_DISCORD_ID, que no se puede quitar. */
  removable: boolean
}

/* ── módulos ───────────────────────────────────────────────────────────── */
export interface FurrPermsEntry {
  id: number
  nick: string
  uuid: string | null
  reason: string | null
  added_by: string | null
  created_at: string
}

export interface FurrPermsLog {
  id: number
  player_uuid: string | null
  player_nick: string
  command: string
  server_name: string | null
  allowed: Flag
  reason: string | null
  ip_address: string | null
  created_at: string
}

export interface StaffRow {
  id: number
  discord_id: string
  minecraft_nick: string
  added_by: string | null
  added_at: string | null
}

export interface VerificationRow {
  id: number
  uuid: string
  discord_id: string | null
  minecraft_nick: string
  status: 'pending' | 'verified' | 'expired'
  verified_at: string | null
  expires_at: string | null
  ip_address: string | null
  created_at: string
}

export interface SecurityLogRow {
  id: number
  uuid: string | null
  minecraft_nick: string | null
  discord_id: string | null
  action: string
  details: string | null
  ip_address: string | null
  created_at: string
}

export interface SecurityStats {
  total_staff: Num
  active_sessions: Num
  pending_verifications: Num
  verified_today: Num
}
