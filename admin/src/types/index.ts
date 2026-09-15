// ============================================
// FurrGuard Admin - TypeScript Types
// Cross-referenced with admin/api.php responses
// and install.sql table schemas
// ============================================

// -------------------------------------------
// Auth / Session
// -------------------------------------------

/** Admin user stored in PHP session (from Discord OAuth) */
export interface AdminUser {
  discord_id: string
  username: string
  avatar: string | null
  role: AdminRole
  session_token: string
  expires_at: string
}

/** Admin user row from admin_users table */
export interface AdminUserRow {
  id: number
  discord_id: string
  discord_username?: string | null
  role: AdminRole
  created_by: string | null
  created_at: string
}

export type AdminRole = 'founder' | 'owner' | 'manager' | 'sradmin' | 'admin'

// -------------------------------------------
// Players
// -------------------------------------------

/** Player row from `players` table (SELECT * in getPlayers) */
export interface Player {
  id: number
  uuid: string
  first_nick: string
  last_nick: string
  first_ip: string | null
  last_ip: string | null
  last_country: string | null
  last_country_code: string | null
  is_online: number // TINYINT(1) from MySQL, comes as 0|1
  is_whitelisted: number
  is_blacklisted: number
  total_connections: number
  first_seen: string
  last_seen: string
}

/** Nick history from player_nicks table */
export interface PlayerNick {
  nick: string
  first_used: string
  last_used: string
}

/** IP history from player_ips table */
export interface PlayerIP {
  ip: string
  country: string | null
  country_code: string | null
  first_used: string
  last_used: string
}

/** Player detail response data */
export interface PlayerDetail {
  player: Player
  nicks: PlayerNick[]
  ips: PlayerIP[]
}

// -------------------------------------------
// Connections
// -------------------------------------------

/** Connection row from player_connections table (SELECT *) */
export interface Connection {
  id: number
  uuid: string
  nick: string
  ip: string
  ip_version: 'ipv4' | 'ipv6'
  country: string | null
  country_code: string | null
  region: string | null
  city: string | null
  isp: string | null
  org: string | null
  asn: string | null
  asname: string | null
  is_proxy: number
  is_vpn: number
  is_hosting: number
  is_mobile: number
  latitude: string | null
  longitude: string | null
  timezone: string | null
  game_version: string | null
  blocked: number
  block_reason: string | null
  raw_data: Record<string, unknown> | null
  created_at: string
}

// -------------------------------------------
// IPs (aggregated)
// -------------------------------------------

/** IP list entry returned by getIPs (aggregated query) */
export interface IPEntry {
  ip: string
  country: string | null
  country_code: string | null
  isp: string | null
  asn: string | null
  first_seen: string
  player_count: number
  connection_count: number
  is_whitelisted: number
  is_blacklisted: number
}

/** IP detail returned by getIPDetail */
export interface IPDetail {
  ip: string
  country: string | null
  country_code: string | null
  isp: string | null
  asn: string | null
  connection_count: number
  is_whitelisted: number
  is_blacklisted: number
}

/** Player associated with an IP (from getIPDetail) */
export interface IPPlayer {
  uuid: string
  nick: string
  last_used: string
}

// -------------------------------------------
// Whitelist
// -------------------------------------------

/** Whitelist entry from whitelist table (SELECT *) */
export interface WhitelistEntry {
  id: number
  type: WhitelistType
  value: string
  reason: string | null
  added_by: string
  created_at: string
  updated_at: string
  /** Appended by API when type is uuid */
  minecraft_name?: string | null
}

export type WhitelistType = 'uuid' | 'nick' | 'ip' | 'ip_range' | 'as'

// -------------------------------------------
// Blacklist / Sanctions
// -------------------------------------------

/** Blacklist entry from blacklist table (SELECT *) */
export interface BlacklistEntry {
  id: number
  ban_id: string
  type: BlacklistType
  value: string
  reason: string | null
  added_by: string
  active: number
  expires_at: string | null
  parent_id: number | null
  created_at: string
  updated_at: string
  /** Appended by API when type is uuid */
  minecraft_name?: string | null
  /** Child entries (stained IPs) - only for parent entries */
  children?: BlacklistChild[]
  child_count?: number
}

/** Child blacklist entry (stained IP) returned within parent BlacklistEntry */
export interface BlacklistChild {
  id: number
  ban_id: string
  type: 'ip'
  display_value: string
  value: string
  active: boolean
  expires_at: string | null
}

export type BlacklistType = 'uuid' | 'nick' | 'ip' | 'as' | 'ip_range'

/** Sanction stats returned by getSanctions */
export interface SanctionStats {
  total: number
  active: number
  expired: number
  inactive: number
  permanent: number
  temporary: number
}

// -------------------------------------------
// Blocked Providers (VPN/Proxy/Hosting)
// -------------------------------------------

/** Provider entry from blocked_providers table (SELECT *) */
export interface Provider {
  id: number
  name: string
  pattern: string
  type: 'hosting' | 'vpn' | 'proxy'
  block_count: number
  active: number
  added_by: string
  created_at: string
  updated_at: string
}

/** Provider stats by type */
export interface ProviderStats {
  hosting: number
  vpn: number
  proxy: number
}

// -------------------------------------------
// Countries & Continents
// -------------------------------------------

/** Blocked country entry from blocked_countries table */
export interface Country {
  id: number
  country_code: string
  country_name: string
  kick_message: string | null
  block_count: number
  active: number
  added_by: string
  created_at: string
  updated_at: string
}

/** Blocked country stats */
export interface CountryStats {
  total: number
  active: number
  total_blocks: number
}

/** Blocked continent entry from blocked_continents table */
export interface Continent {
  id: number
  continent_code: string
  continent_name: string
  kick_message: string | null
  block_count: number
  active: number
  added_by: string
  created_at: string
  updated_at: string
}

/** Blocked continent stats */
export interface ContinentStats {
  total: number
  active: number
  total_blocks: number
}

// -------------------------------------------
// Activity Logs
// -------------------------------------------

/** Log entry from activity_logs table */
export interface LogEntry {
  id: number
  type: string
  action: string
  details: string | null
  ip_address: string | null
  created_at: string
}

// -------------------------------------------
// Messages (kick messages / plugin messages)
// -------------------------------------------

/**
 * Messages returned as a flat Record<string, string>.
 * getMessages returns { messages: { key: value, ... } }
 */
export type MessagesMap = Record<string, string>

// -------------------------------------------
// Settings
// -------------------------------------------

/**
 * Settings returned as a flat Record<string, string>.
 * getSettings returns { settings: { key: value, ... } }
 */
export type SettingsMap = Record<string, string>

// -------------------------------------------
// Dashboard / Overview
// -------------------------------------------

/** Overview data returned by getOverview */
export interface OverviewData {
  online_players: number
  total_players: number
  connections_24h: number
  blocked_24h: number
  recent_connections: OverviewConnection[]
  recent_blocks: OverviewBlock[]
}

/** Recent connection in overview (partial fields) */
export interface OverviewConnection {
  uuid: string
  nick: string
  ip: string
  country: string | null
  country_code: string | null
  blocked: number
  created_at: string
}

/** Recent block in overview (from blacklist table) */
export interface OverviewBlock {
  type: string
  value: string
  reason: string | null
  created_at: string
  /** Appended when type is uuid */
  minecraft_name?: string | null
}

// -------------------------------------------
// Badge Counts (sidebar)
// -------------------------------------------

/** Counts returned by getCounts */
export interface BadgeCounts {
  players: number
  whitelist: number
  blacklist: number
  providers: number
  countries: number
  continents: number
}

// -------------------------------------------
// FurrPerms Module
// -------------------------------------------

/** FurrPerms whitelist entry from fur_perms_whitelist table */
export interface FurrPermsEntry {
  id: number
  nick: string
  uuid: string | null
  added_by: string
  reason: string | null
  active: number
  created_at: string
  updated_at: string
}

/** FurrPerms command log from fur_perms_command_logs table */
export interface FurrPermsLog {
  id: number
  player_uuid: string | null
  player_nick: string
  command: string
  server_name: string | null
  allowed: number
  reason: string | null
  ip_address: string | null
  created_at: string
}

/** FurrPerms logs stats */
export interface FurrPermsLogStats {
  total: number
  allowed: number
  blocked: number
}

// -------------------------------------------
// FurrSecurity Module
// -------------------------------------------

/** FurrSecurity staff entry from furrsecurity_staff table */
export interface FurrSecurityStaff {
  id: number
  discord_id: string
  minecraft_nick: string
  added_by: string
  added_at: string
}

/** FurrSecurity verification/session from furrsecurity_verifications table */
export interface FurrSecuritySession {
  id: number
  uuid: string | null
  discord_id: string | null
  minecraft_nick: string
  status: 'pending' | 'verified' | 'expired' | 'token_expired'
  verified_at: string | null
  expires_at: string
  ip_address: string | null
  created_at: string
}

/** FurrSecurity log entry from furrsecurity_logs table */
export interface FurrSecurityLog {
  id: number
  uuid: string | null
  minecraft_nick: string | null
  discord_id: string | null
  action: string
  details: string | null
  ip_address: string | null
  created_at: string
}

/** FurrSecurity stats returned by getFurrSecurityStats */
export interface FurrSecurityStats {
  total_staff: number
  active_sessions: number
  pending_verifications: number
  verified_today: number
}

// -------------------------------------------
// Pagination
// -------------------------------------------

/** Pagination metadata returned by most list endpoints */
export interface PaginationData {
  current_page: number
  total_pages: number
  total: number
}

// -------------------------------------------
// Player Lookup (Mojang API)
// -------------------------------------------

/** Player lookup result from lookupPlayer action */
export interface PlayerLookup {
  is_premium: boolean
  uuid: string | null
  name: string | null
  error: string | null
}

/** Name history entry from getNameHistory */
export interface NameHistoryEntry {
  name: string
  changedToAt?: number
}

// -------------------------------------------
// Migration Results
// -------------------------------------------

/** Blacklist migration result */
export interface MigrationResult {
  total_processed: number
  migrated: number
  removed: number
  errors: string[]
  details: string[]
}

/** Players migration result */
export interface PlayerMigrationResult {
  total_processed: number
  premium: number
  not_premium: number
  updated: number
  errors: string[]
  details: string[]
}

// -------------------------------------------
// API Response Wrapper
// -------------------------------------------

/** Standard API response wrapper used by all admin/api.php endpoints */
export interface ApiResponse<T = unknown> {
  success: boolean
  data?: T
  error?: string
  pagination?: PaginationData
}

// -------------------------------------------
// Export Data
// -------------------------------------------

/** Data returned by exportData */
export interface ExportData {
  exported_at: string
  whitelist: Array<{
    type: string
    value: string
    reason: string | null
    created_at: string
  }>
  blacklist: Array<{
    type: string
    value: string
    reason: string | null
    active: number
    created_at: string
  }>
  settings: SettingsMap
  messages: MessagesMap
}
