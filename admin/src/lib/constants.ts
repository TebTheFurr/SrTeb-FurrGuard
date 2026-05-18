// ============================================
// FurrGuard Admin - Constants
// ============================================

// -------------------------------------------
// Role hierarchy (lowest to highest privilege)
// -------------------------------------------
export const ROLE_HIERARCHY = ['admin', 'sradmin', 'manager', 'owner', 'founder'] as const
export type Role = (typeof ROLE_HIERARCHY)[number]

// -------------------------------------------
// Sidebar navigation
// -------------------------------------------
export const SIDEBAR_SECTIONS = [
  { id: 'overview', label: 'Dashboard', icon: 'LayoutDashboard' },
  {
    category: 'Jugadores',
    items: [
      { id: 'players', label: 'Jugadores', icon: 'Users' },
      { id: 'connections', label: 'Conexiones', icon: 'Link' },
      { id: 'ips', label: 'Direcciones IP', icon: 'Globe' },
    ],
  },
  {
    category: 'Proteccion',
    items: [
      { id: 'whitelist', label: 'Whitelist', icon: 'ShieldCheck' },
      { id: 'blacklist', label: 'Blacklist', icon: 'ShieldOff' },
      { id: 'sanctions', label: 'Sanciones', icon: 'Gavel' },
    ],
  },
  {
    category: 'Filtrado',
    items: [
      { id: 'providers', label: 'Proveedores', icon: 'ShieldAlert' },
      { id: 'countries', label: 'Paises', icon: 'MapPin' },
      { id: 'continents', label: 'Continentes', icon: 'Globe2' },
    ],
  },
  {
    category: 'Modulos',
    items: [
      { id: 'furrperms', label: 'FurrPerms', icon: 'Key' },
      { id: 'furrsecurity', label: 'FurrSecurity', icon: 'Lock' },
    ],
  },
  {
    category: 'Sistema',
    items: [
      { id: 'messages', label: 'Mensajes', icon: 'MessageSquare' },
      { id: 'logs', label: 'Logs', icon: 'FileText' },
      { id: 'settings', label: 'Configuracion', icon: 'Settings' },
      { id: 'users', label: 'Usuarios', icon: 'UserCog' },
    ],
  },
] as const

// -------------------------------------------
// Connection filters (matches getConnections filter param)
// -------------------------------------------
export const CONNECTION_FILTERS = [
  { id: 'all', label: 'Todas' },
  { id: 'allowed', label: 'Permitidas' },
  { id: 'blocked', label: 'Bloqueadas' },
  { id: 'proxy', label: 'Proxy' },
  { id: 'vpn', label: 'VPN' },
  { id: 'hosting', label: 'Hosting' },
] as const

// -------------------------------------------
// Player filters (matches getPlayers filter param)
// -------------------------------------------
export const PLAYER_FILTERS = [
  { id: 'all', label: 'Todos' },
  { id: 'online', label: 'Online' },
  { id: 'whitelisted', label: 'Whitelist' },
  { id: 'blacklisted', label: 'Blacklist' },
] as const

// -------------------------------------------
// Whitelist entry types (matches whitelist.type ENUM)
// -------------------------------------------
export const WHITELIST_TYPES = [
  { id: 'uuid', label: 'UUID' },
  { id: 'nick', label: 'Nickname' },
  { id: 'ip', label: 'IP' },
  { id: 'ip_range', label: 'Rango IP' },
  { id: 'as', label: 'ASN' },
] as const

// -------------------------------------------
// Blacklist entry types (matches blacklist.type ENUM)
// -------------------------------------------
export const BLACKLIST_TYPES = [
  { id: 'uuid', label: 'UUID' },
  { id: 'nick', label: 'Nickname' },
  { id: 'ip', label: 'IP' },
  { id: 'asn', label: 'ASN' },
  { id: 'cidr', label: 'CIDR' },
] as const

// -------------------------------------------
// Sanction filters (matches getSanctions filter param)
// -------------------------------------------
export const SANCTION_FILTERS = [
  { id: 'all', label: 'Todas' },
  { id: 'active', label: 'Activas' },
  { id: 'expired', label: 'Expiradas' },
  { id: 'inactive', label: 'Inactivas' },
  { id: 'permanent', label: 'Permanentes' },
  { id: 'temporary', label: 'Temporales' },
] as const

// -------------------------------------------
// Provider type filters (matches blocked_providers.type ENUM)
// -------------------------------------------
export const PROVIDER_TYPE_FILTERS = [
  { id: 'all', label: 'Todos' },
  { id: 'hosting', label: 'Hosting' },
  { id: 'vpn', label: 'VPN' },
  { id: 'proxy', label: 'Proxy' },
] as const

// -------------------------------------------
// Log type filters (matches activity_logs.type values)
// -------------------------------------------
export const LOG_TYPES = [
  { id: 'all', label: 'Todos' },
  { id: 'auth', label: 'Auth' },
  { id: 'player', label: 'Jugadores' },
  { id: 'whitelist', label: 'Whitelist' },
  { id: 'blacklist', label: 'Blacklist' },
  { id: 'settings', label: 'Config' },
  { id: 'connection', label: 'Conexiones' },
] as const

// -------------------------------------------
// FurrPerms log filters
// -------------------------------------------
export const FURRPERMS_LOG_FILTERS = [
  { id: 'all', label: 'Todos' },
  { id: 'allowed', label: 'Permitidos' },
  { id: 'blocked', label: 'Bloqueados' },
] as const

// -------------------------------------------
// FurrSecurity log filters (matches action column values)
// -------------------------------------------
export const FURRSECURITY_LOG_FILTERS = [
  { id: 'all', label: 'Todos' },
  { id: 'token_generated', label: 'Tokens' },
  { id: 'session_extended', label: 'Extensiones' },
  { id: 'verification_failed', label: 'Fallos' },
  { id: 'auto_blacklisted', label: 'Auto-Bans' },
  { id: 'player_disconnect', label: 'Desconexiones' },
  { id: 'session_reset', label: 'Resets' },
] as const

// -------------------------------------------
// Admin roles (for user management dropdown)
// -------------------------------------------
export const ADMIN_ROLES = [
  { id: 'admin', label: 'Admin' },
  { id: 'sradmin', label: 'Sr. Admin' },
  { id: 'manager', label: 'Manager' },
  { id: 'owner', label: 'Owner' },
] as const

// -------------------------------------------
// Pagination
// -------------------------------------------
export const PER_PAGE = 20
export const PER_PAGE_LARGE = 50

// -------------------------------------------
// Duration presets (in minutes) for blacklist
// -------------------------------------------
export const DURATION_PRESETS = [
  { label: '30 min', value: 30 },
  { label: '1 hora', value: 60 },
  { label: '6 horas', value: 360 },
  { label: '12 horas', value: 720 },
  { label: '1 dia', value: 1440 },
  { label: '7 dias', value: 10080 },
  { label: '30 dias', value: 43200 },
  { label: 'Permanente', value: 0 },
] as const
